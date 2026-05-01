-- Aura Cafe Supabase schema for online demo
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type app_order_status as enum ('pending', 'preparing', 'ready', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_order_type as enum ('delivery', 'pickup');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_payment_method as enum ('cash', 'ewallet');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_inventory_category as enum ('Ingredients', 'Materials', 'Equipment');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_unit as enum ('g', 'kg', 'ml', 'L', 'pcs', 'units', 'bottles');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_inventory_status as enum ('low', 'normal', 'high');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type app_adjustment_type as enum ('manual_adjustment', 'recipe_deduction', 'waste', 'item_add', 'item_delete');
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_adjustment_type'
      and e.enumlabel = 'batch_add'
  ) then
    alter type app_adjustment_type add value 'batch_add';
  end if;
end $$;

do $$ begin
  create type app_waste_reason as enum ('expired', 'spillage', 'damage', 'overproduction', 'other');
exception when duplicate_object then null;
end $$;

-- Role-Based Access Control
do $$ begin
  create type app_user_role as enum ('admin', 'cashier', 'kitchen', 'supplier');
exception when duplicate_object then null;
end $$;

-- User profiles with role assignments
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_user_role not null default 'cashier',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper function to get current user's role
create or replace function get_user_role()
returns app_user_role
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_user_role;
begin
  select role into v_role from profiles where id = auth.uid();
  return coalesce(v_role, 'cashier'::app_user_role);
end;
$$;

-- Helper function to check if user has a specific role or higher
-- role hierarchy: admin > kitchen > cashier > supplier (for permission levels)
create or replace function has_role(required_role app_user_role)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return get_user_role() = required_role or get_user_role() = 'admin'::app_user_role;
end;
$$;

-- Base conversion factors (same as your frontend logic)
create table if not exists unit_factors (
  unit app_unit primary key,
  factor_to_base numeric(12,2) not null,
  unit_group text not null check (unit_group in ('mass', 'volume', 'count'))
);

insert into unit_factors (unit, factor_to_base, unit_group) values
('g', 1, 'mass'),
('kg', 1000, 'mass'),
('ml', 1, 'volume'),
('L', 1000, 'volume'),
('pcs', 1, 'count'),
('units', 1, 'count'),
('bottles', 1, 'count')
on conflict (unit) do update set
factor_to_base = excluded.factor_to_base,
unit_group = excluded.unit_group;

create or replace function convert_units(amount numeric, from_unit app_unit, to_unit app_unit)
returns numeric
language plpgsql
as $$
declare
  f_from numeric;
  f_to numeric;
  g_from text;
  g_to text;
begin
  select factor_to_base, unit_group into f_from, g_from from unit_factors where unit = from_unit;
  select factor_to_base, unit_group into f_to, g_to from unit_factors where unit = to_unit;

  if g_from is null or g_to is null then
    return amount;
  end if;

  if g_from <> g_to then
    -- Keep behavior aligned with current app fallback
    return amount;
  end if;

  return round((amount * f_from) / f_to, 2);
end;
$$;

create table if not exists products (
  id text primary key,
  name text not null unique,
  barcode text unique,
  category text not null,
  price numeric(12,2) not null,
  image text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Inventory + recipe model
create table if not exists inventory_items (
  id text primary key,
  name text not null unique,
  category app_inventory_category not null,
  stock numeric(12,2) not null default 0,
  unit app_unit not null,
  reorder_level numeric(12,2) not null default 0,
  monthly_restock_cap numeric(12,2) not null default 1,
  status app_inventory_status not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventory_items
  add column if not exists monthly_restock_cap numeric(12,2) default 1;

alter table inventory_items
  alter column monthly_restock_cap set default 1;

update inventory_items
set monthly_restock_cap = round(
  case
    when category = 'Ingredients' then greatest(stock * 3, reorder_level * 8, stock, 1)
    when category = 'Materials' then greatest(stock * 2, reorder_level * 8, stock, 20)
    else greatest(stock * 1.5, reorder_level * 6, stock, 1)
  end,
  2
)
where monthly_restock_cap is null or monthly_restock_cap <= 0;

alter table inventory_items
  alter column monthly_restock_cap set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_monthly_restock_cap_positive'
  ) then
    alter table inventory_items
      add constraint inventory_items_monthly_restock_cap_positive
      check (monthly_restock_cap > 0);
  end if;
end $$;

create table if not exists products (
  id text primary key,
  name text not null unique,
  barcode text unique,
  category text not null,
  price numeric(12,2) not null,
  image text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products
  add column if not exists out_of_stock boolean not null default false;

alter table products
  add column if not exists out_of_stock_note text;

create table if not exists product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  inventory_item_id text not null references inventory_items(id) on delete restrict,
  amount numeric(12,2) not null,
  unit app_unit not null,
  unique (product_id, inventory_item_id)
);

create table if not exists system_history_events (
  id text primary key,
  domain text not null check (domain in ('orders', 'inventory', 'products')),
  kind text not null,
  title text not null,
  detail text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists system_history_events_created_at_idx on system_history_events (created_at desc);

-- Ordering
create table if not exists orders (
  id text primary key,
  order_number text not null unique,
  status app_order_status not null default 'pending',
  order_type app_order_type not null,
  payment_method app_payment_method not null default 'ewallet',
  total numeric(12,2) not null default 0,
  estimated_time integer not null default 10,
  approved_at timestamptz,
  receipt_number text,
  receipt_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products add column if not exists barcode text;
create unique index if not exists products_barcode_key on products (barcode);
alter table orders add column if not exists payment_method app_payment_method default 'ewallet';
alter table orders add column if not exists approved_at timestamptz;
alter table orders add column if not exists receipt_number text;
alter table orders add column if not exists receipt_payload jsonb;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  product_id text not null references products(id) on delete restrict,
  product_name text not null,
  product_category text,
  quantity integer not null,
  base_price numeric(12,2),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  sugar_level integer,
  size_label text,
  selected_addons text[] default '{}',
  customization_json jsonb,
  is_drink boolean default false,
  created_at timestamptz not null default now()
);

alter table order_items add column if not exists product_category text;
alter table order_items add column if not exists base_price numeric(12,2);
alter table order_items add column if not exists sugar_level integer;
alter table order_items add column if not exists size_label text;
alter table order_items add column if not exists selected_addons text[] default '{}';
alter table order_items add column if not exists customization_json jsonb;
alter table order_items add column if not exists is_drink boolean default false;

create table if not exists add_ons (
  id text primary key,
  name text not null unique,
  category text not null,
  description text,
  price numeric(12,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists add_on_inventory_usage (
  id uuid primary key default gen_random_uuid(),
  add_on_id text not null references add_ons(id) on delete cascade,
  inventory_item_id text not null references inventory_items(id) on delete restrict,
  amount numeric(12,2) not null,
  unit app_unit not null,
  unique (add_on_id, inventory_item_id)
);

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id text not null references inventory_items(id) on delete restrict,
  type app_adjustment_type not null,
  delta numeric(12,2) not null,
  unit app_unit not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists waste_logs (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id text not null references inventory_items(id) on delete restrict,
  quantity numeric(12,2) not null,
  unit app_unit not null,
  reason app_waste_reason not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists supplier_requests (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  inventory_item_id text references inventory_items(id) on delete set null,
  inventory_item_name text,
  quantity numeric(12,2) not null,
  unit app_unit,
  supplier_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'void')),
  source_uid text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table supplier_requests
  add column if not exists inventory_item_id text references inventory_items(id) on delete set null;

alter table supplier_requests
  add column if not exists inventory_item_name text;

alter table supplier_requests
  add column if not exists unit app_unit;

create table if not exists supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventory_adjustments
  add column if not exists inventory_item_name text;

alter table waste_logs
  add column if not exists inventory_item_name text;

-- ============================================
-- SEED DATA: Products and Inventory
-- ============================================

-- Products
-- Keep existing products and custom fields on rerun.
insert into products (id, name, barcode, category, price, description, out_of_stock, out_of_stock_note, active) values
  -- Pastry
  ('p1', 'Sansrival Cake', '291000000111', 'Pastry', 120, 'Classic Filipino sansrival with layers of meringue and cashew.', false, null, true),
  ('p2', 'Ensaimada', '291000000112', 'Pastry', 95, 'Sweet Filipino pastry roll with cheese and sugar topping.', false, null, true),
  ('p3', 'Crinkles', '291000000113', 'Pastry', 85, 'Soft chocolate crackle cookies with powdered sugar coating.', false, null, true),
  -- Beverages - Caffeinated
  ('b1', 'Americano', '291000000211', 'Beverage', 150, 'Smooth espresso diluted with hot water.', false, null, true),
  ('b2', 'Espresso', '291000000212', 'Beverage', 140, 'Rich and concentrated coffee shot.', false, null, true),
  -- Beverages - Decaffeinated
  ('b3', 'Hot Chocolate', '291000000213', 'Beverage', 150, 'Creamy hot chocolate with rich cocoa flavor.', false, null, true),
  ('b4', 'Vanilla Milk', '291000000214', 'Beverage', 160, 'Smooth and creamy vanilla-flavored milk.', false, null, true),
  -- Rice Meals
  ('r1', 'Tapsilog', '291000000311', 'Rice Meal', 185, 'Marinated beef, fried egg, and garlic rice served together.', false, null, true),
  ('r2', 'Sizzling Sisig', '291000000312', 'Rice Meal', 195, 'Sizzling pork with onions and chili served with rice and egg.', false, null, true)
on conflict (id) do nothing;

-- Inventory Items
-- Keep existing inventory data on rerun.
insert into inventory_items (id, name, category, stock, unit, reorder_level, status) values
  -- Pastry Ingredients
  ('ing-flour', 'All-purpose flour', 'Ingredients', 10.00, 'kg', 2.00, 'normal'),
  ('ing-white-sugar', 'White sugar', 'Ingredients', 5.00, 'kg', 1.00, 'normal'),
  ('ing-powdered-sugar', 'Powdered sugar', 'Ingredients', 3.00, 'kg', 1.00, 'normal'),
  ('ing-eggs', 'Eggs', 'Ingredients', 20.00, 'pcs', 5.00, 'normal'),
  ('ing-butter', 'Butter', 'Ingredients', 4.00, 'kg', 1.00, 'normal'),
  ('ing-milk', 'Milk', 'Ingredients', 2.00, 'L', 0.50, 'normal'),
  ('ing-yeast', 'Yeast', 'Ingredients', 0.50, 'kg', 0.10, 'normal'),
  ('ing-cocoa', 'Cocoa powder', 'Ingredients', 1.00, 'kg', 0.25, 'normal'),
  ('ing-cashews', 'Cashew nuts', 'Ingredients', 2.00, 'kg', 0.50, 'normal'),
  ('ing-baking-powder', 'Baking powder', 'Ingredients', 1.00, 'kg', 0.25, 'normal'),
  ('ing-vanilla-extract', 'Vanilla extract', 'Ingredients', 0.50, 'L', 0.10, 'normal'),
  ('ing-chocolate-chips', 'Chocolate chips', 'Ingredients', 2.00, 'kg', 0.50, 'normal'),
  -- Beverage Ingredients
  ('ing-coffee-beans', 'Coffee beans (espresso roast)', 'Ingredients', 5.00, 'kg', 1.00, 'normal'),
  ('ing-ground-coffee', 'Ground coffee', 'Ingredients', 2.00, 'kg', 0.50, 'normal'),
  ('ing-vanilla-syrup', 'Vanilla syrup', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-caramel-drizzle', 'Caramel drizzle', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-hazelnut-syrup', 'Hazelnut syrup', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-brown-sugar-syrup', 'Brown sugar syrup', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-chocolate-syrup', 'Chocolate syrup', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-oat-milk', 'Oat milk', 'Ingredients', 2.00, 'L', 0.50, 'normal'),
  ('ing-almond-milk', 'Almond milk', 'Ingredients', 2.00, 'L', 0.50, 'normal'),
  ('ing-coconut-milk', 'Coconut milk', 'Ingredients', 2.00, 'L', 0.50, 'normal'),
  ('ing-whipped-cream', 'Whipped cream', 'Ingredients', 1.50, 'L', 0.50, 'normal'),
  ('ing-cinnamon-powder', 'Cinnamon powder', 'Ingredients', 0.50, 'kg', 0.10, 'normal'),
  ('ing-sea-salt-foam', 'Sea salt foam', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-matcha-powder', 'Matcha powder', 'Ingredients', 0.50, 'kg', 0.10, 'normal'),
  ('ing-cold-foam', 'Cold foam', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-honey', 'Honey', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-orange-concentrate', 'Orange concentrate', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  -- Rice Meal Ingredients
  ('ing-beef', 'Beef', 'Ingredients', 5.00, 'kg', 1.00, 'normal'),
  ('ing-soy-sauce', 'Soy sauce', 'Ingredients', 2.00, 'L', 0.50, 'normal'),
  ('ing-garlic', 'Garlic', 'Ingredients', 0.50, 'kg', 0.10, 'normal'),
  ('ing-calamansi', 'Calamansi', 'Ingredients', 50.00, 'pcs', 10.00, 'normal'),
  ('ing-cooking-oil', 'Cooking oil', 'Ingredients', 5.00, 'L', 1.00, 'normal'),
  ('ing-rice', 'Rice', 'Ingredients', 10.00, 'kg', 2.00, 'normal'),
  ('ing-pork', 'Pork', 'Ingredients', 5.00, 'kg', 1.00, 'normal'),
  ('ing-onion', 'Onion', 'Ingredients', 2.00, 'kg', 0.50, 'normal'),
  ('ing-chili', 'Chili', 'Ingredients', 0.50, 'kg', 0.10, 'normal'),
  ('ing-mayonnaise', 'Mayonnaise', 'Ingredients', 1.00, 'L', 0.25, 'normal'),
  ('ing-salt', 'Salt', 'Ingredients', 1.00, 'kg', 0.25, 'normal'),
  ('ing-pepper', 'Pepper', 'Ingredients', 0.50, 'kg', 0.10, 'normal'),
  ('mat-hot-cup-small', 'Hot cups (small)', 'Materials', 250.00, 'pcs', 50.00, 'normal'),
  ('mat-hot-cup-medium', 'Hot cups (medium)', 'Materials', 250.00, 'pcs', 50.00, 'normal'),
  ('mat-hot-cup-large', 'Hot cups (large)', 'Materials', 200.00, 'pcs', 40.00, 'normal'),
  ('mat-cold-cup-small', 'Cold cups (small plastic)', 'Materials', 250.00, 'pcs', 50.00, 'normal'),
  ('mat-cold-cup-medium', 'Cold cups (medium plastic)', 'Materials', 250.00, 'pcs', 50.00, 'normal'),
  ('mat-cold-cup-large', 'Cold cups (large plastic)', 'Materials', 200.00, 'pcs', 40.00, 'normal'),
  ('mat-coffee-mugs', 'Coffee mugs (for dine-in)', 'Materials', 40.00, 'pcs', 10.00, 'normal'),
  ('mat-glass-cups', 'Glass cups', 'Materials', 40.00, 'pcs', 10.00, 'normal'),
  ('mat-paper-cups', 'Paper cups', 'Materials', 300.00, 'pcs', 60.00, 'normal'),
  ('mat-cup-sleeves', 'Cup sleeves', 'Materials', 300.00, 'pcs', 60.00, 'normal'),
  ('mat-hot-lids', 'Cup lids (hot)', 'Materials', 300.00, 'pcs', 60.00, 'normal'),
  ('mat-cold-lids', 'Cup lids (cold)', 'Materials', 300.00, 'pcs', 60.00, 'normal'),
  ('mat-dome-lids', 'Dome lids (for frappes)', 'Materials', 200.00, 'pcs', 40.00, 'normal'),
  ('mat-straws', 'Straws (regular)', 'Materials', 500.00, 'pcs', 100.00, 'normal'),
  ('mat-jumbo-straws', 'Jumbo straws (for frappes)', 'Materials', 350.00, 'pcs', 80.00, 'normal'),
  ('mat-stir-sticks', 'Stir sticks', 'Materials', 500.00, 'pcs', 100.00, 'normal'),
  ('mat-plastic-spoons', 'Plastic spoons', 'Materials', 350.00, 'pcs', 80.00, 'normal'),
  ('mat-plastic-forks', 'Plastic forks', 'Materials', 350.00, 'pcs', 80.00, 'normal'),
  ('mat-napkins', 'Napkins', 'Materials', 1200.00, 'pcs', 250.00, 'normal'),
  ('mat-tissue-paper', 'Tissue paper', 'Materials', 1200.00, 'pcs', 250.00, 'normal'),
  ('mat-paper-bags', 'Paper bags', 'Materials', 300.00, 'pcs', 70.00, 'normal'),
  ('mat-plastic-bags', 'Plastic bags', 'Materials', 300.00, 'pcs', 70.00, 'normal'),
  ('mat-food-containers', 'Food containers', 'Materials', 200.00, 'pcs', 50.00, 'normal'),
  ('mat-takeout-boxes', 'Take-out boxes', 'Materials', 220.00, 'pcs', 50.00, 'normal'),
  ('mat-cup-carriers', 'Cup carriers / drink holders', 'Materials', 150.00, 'pcs', 30.00, 'normal'),
  ('mat-wrapping-paper', 'Wrapping paper', 'Materials', 350.00, 'pcs', 80.00, 'normal')
on conflict (id) do nothing;

-- Keep existing add-ons on rerun.
insert into add_ons (id, name, category, description, price, active) values
  ('addon-vanilla-syrup', 'Vanilla syrup', 'Sweetness & flavor', 'Smooth and classic', 20, true),
  ('addon-caramel-drizzle', 'Caramel drizzle', 'Sweetness & flavor', 'Sweet with a slight burnt sugar taste', 25, true),
  ('addon-hazelnut-syrup', 'Hazelnut syrup', 'Sweetness & flavor', 'Nutty and aromatic', 25, true),
  ('addon-brown-sugar-syrup', 'Brown sugar syrup', 'Sweetness & flavor', 'Richer, milk tea feel', 20, true),
  ('addon-chocolate-syrup', 'Chocolate syrup', 'Sweetness & flavor', 'For mocha-style coffee', 20, true),
  ('addon-oat-milk', 'Oat milk', 'Creaminess', 'Creamy but light', 35, true),
  ('addon-almond-milk', 'Almond milk', 'Creaminess', 'Slightly nutty, less heavy', 35, true),
  ('addon-coconut-milk', 'Coconut milk', 'Creaminess', 'Tropical twist', 30, true),
  ('addon-whipped-cream', 'Whipped cream', 'Creaminess', 'Extra indulgent', 25, true),
  ('addon-extra-espresso', 'Extra espresso shot', 'Stronger or unique taste', 'For more kick', 35, true),
  ('addon-cinnamon', 'Cinnamon powder', 'Stronger or unique taste', 'Warm and slightly spicy', 15, true),
  ('addon-sea-salt-foam', 'Sea salt foam', 'Stronger or unique taste', 'Sweet + salty combo', 35, true),
  ('addon-matcha-shot', 'Matcha shot', 'Stronger or unique taste', 'Coffee + tea flavor', 40, true),
  ('addon-cold-foam', 'Cold foam', 'Refreshing iced drinks', 'Light and frothy topping', 30, true),
  ('addon-honey', 'Honey', 'Refreshing iced drinks', 'Natural sweetness', 20, true),
  ('addon-orange', 'Orange zest or juice', 'Refreshing iced drinks', 'Citrus coffee pairing', 25, true)
on conflict (id) do nothing;

-- Keep existing add-on usage mappings on rerun.
insert into add_on_inventory_usage (add_on_id, inventory_item_id, amount, unit) values
  ('addon-vanilla-syrup', 'ing-vanilla-syrup', 10, 'ml'),
  ('addon-caramel-drizzle', 'ing-caramel-drizzle', 10, 'ml'),
  ('addon-hazelnut-syrup', 'ing-hazelnut-syrup', 10, 'ml'),
  ('addon-brown-sugar-syrup', 'ing-brown-sugar-syrup', 12, 'ml'),
  ('addon-chocolate-syrup', 'ing-chocolate-syrup', 12, 'ml'),
  ('addon-oat-milk', 'ing-oat-milk', 120, 'ml'),
  ('addon-almond-milk', 'ing-almond-milk', 120, 'ml'),
  ('addon-coconut-milk', 'ing-coconut-milk', 120, 'ml'),
  ('addon-whipped-cream', 'ing-whipped-cream', 25, 'ml'),
  ('addon-extra-espresso', 'ing-coffee-beans', 9, 'g'),
  ('addon-cinnamon', 'ing-cinnamon-powder', 1, 'g'),
  ('addon-sea-salt-foam', 'ing-sea-salt-foam', 30, 'ml'),
  ('addon-matcha-shot', 'ing-matcha-powder', 3, 'g'),
  ('addon-cold-foam', 'ing-cold-foam', 30, 'ml'),
  ('addon-honey', 'ing-honey', 10, 'ml'),
  ('addon-orange', 'ing-orange-concentrate', 15, 'ml')
on conflict (add_on_id, inventory_item_id) do nothing;

-- Product Recipes with realistic deduction amounts
-- Keep existing recipes on rerun.

-- Sansrival Cake (p1) - per piece (assume 8 pieces per cake)
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('p1', 'ing-flour', 50, 'g'),
  ('p1', 'ing-white-sugar', 30, 'g'),
  ('p1', 'ing-powdered-sugar', 20, 'g'),
  ('p1', 'ing-eggs', 0.5, 'pcs'),
  ('p1', 'ing-butter', 15, 'g'),
  ('p1', 'ing-milk', 20, 'ml'),
  ('p1', 'ing-cashews', 40, 'g'),
  ('p1', 'mat-food-containers', 1, 'pcs'),
  ('p1', 'mat-napkins', 1, 'pcs'),
  ('p1', 'mat-paper-bags', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Ensaimada (p2) - per piece
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('p2', 'ing-flour', 40, 'g'),
  ('p2', 'ing-white-sugar', 20, 'g'),
  ('p2', 'ing-eggs', 0.3, 'pcs'),
  ('p2', 'ing-butter', 10, 'g'),
  ('p2', 'ing-milk', 15, 'ml'),
  ('p2', 'ing-yeast', 2, 'g'),
  ('p2', 'mat-food-containers', 1, 'pcs'),
  ('p2', 'mat-napkins', 1, 'pcs'),
  ('p2', 'mat-paper-bags', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Crinkles (p3) - per piece (assume 15 pieces per batch)
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('p3', 'ing-flour', 20, 'g'),
  ('p3', 'ing-white-sugar', 15, 'g'),
  ('p3', 'ing-powdered-sugar', 10, 'g'),
  ('p3', 'ing-eggs', 0.2, 'pcs'),
  ('p3', 'ing-cocoa', 8, 'g'),
  ('p3', 'ing-baking-powder', 1, 'g'),
  ('p3', 'ing-vanilla-extract', 1, 'ml'),
  ('p3', 'mat-food-containers', 1, 'pcs'),
  ('p3', 'mat-napkins', 1, 'pcs'),
  ('p3', 'mat-paper-bags', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Americano (b1) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b1', 'ing-coffee-beans', 15, 'g'),
  ('b1', 'mat-hot-cup-medium', 1, 'pcs'),
  ('b1', 'mat-hot-lids', 1, 'pcs'),
  ('b1', 'mat-cup-sleeves', 1, 'pcs'),
  ('b1', 'mat-stir-sticks', 1, 'pcs'),
  ('b1', 'mat-napkins', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Espresso (b2) - per shot
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b2', 'ing-coffee-beans', 9, 'g'),
  ('b2', 'mat-hot-cup-small', 1, 'pcs'),
  ('b2', 'mat-hot-lids', 1, 'pcs'),
  ('b2', 'mat-stir-sticks', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Hot Chocolate (b3) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b3', 'ing-milk', 150, 'ml'),
  ('b3', 'ing-cocoa', 15, 'g'),
  ('b3', 'ing-white-sugar', 20, 'g'),
  ('b3', 'mat-hot-cup-medium', 1, 'pcs'),
  ('b3', 'mat-hot-lids', 1, 'pcs'),
  ('b3', 'mat-cup-sleeves', 1, 'pcs'),
  ('b3', 'mat-stir-sticks', 1, 'pcs'),
  ('b3', 'mat-napkins', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Vanilla Milk (b4) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b4', 'ing-milk', 180, 'ml'),
  ('b4', 'ing-vanilla-syrup', 10, 'ml'),
  ('b4', 'ing-white-sugar', 15, 'g'),
  ('b4', 'mat-cold-cup-medium', 1, 'pcs'),
  ('b4', 'mat-cold-lids', 1, 'pcs'),
  ('b4', 'mat-straws', 1, 'pcs'),
  ('b4', 'mat-napkins', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Tapsilog (r1) - per serving
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('r1', 'ing-beef', 150, 'g'),
  ('r1', 'ing-soy-sauce', 30, 'ml'),
  ('r1', 'ing-garlic', 10, 'g'),
  ('r1', 'ing-cooking-oil', 10, 'ml'),
  ('r1', 'ing-eggs', 1, 'pcs'),
  ('r1', 'ing-rice', 150, 'g'),
  ('r1', 'ing-salt', 2, 'g'),
  ('r1', 'ing-pepper', 1, 'g'),
  ('r1', 'mat-takeout-boxes', 1, 'pcs'),
  ('r1', 'mat-plastic-spoons', 1, 'pcs'),
  ('r1', 'mat-plastic-forks', 1, 'pcs'),
  ('r1', 'mat-tissue-paper', 2, 'pcs'),
  ('r1', 'mat-plastic-bags', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Sizzling Sisig (r2) - per serving
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('r2', 'ing-pork', 150, 'g'),
  ('r2', 'ing-onion', 30, 'g'),
  ('r2', 'ing-chili', 10, 'g'),
  ('r2', 'ing-soy-sauce', 30, 'ml'),
  ('r2', 'ing-cooking-oil', 10, 'ml'),
  ('r2', 'ing-eggs', 1, 'pcs'),
  ('r2', 'ing-rice', 150, 'g'),
  ('r2', 'ing-calamansi', 1, 'pcs'),
  ('r2', 'ing-salt', 2, 'g'),
  ('r2', 'ing-pepper', 1, 'g'),
  ('r2', 'ing-mayonnaise', 20, 'ml'),
  ('r2', 'mat-takeout-boxes', 1, 'pcs'),
  ('r2', 'mat-plastic-spoons', 1, 'pcs'),
  ('r2', 'mat-plastic-forks', 1, 'pcs'),
  ('r2', 'mat-tissue-paper', 2, 'pcs'),
  ('r2', 'mat-plastic-bags', 1, 'pcs')
on conflict (product_id, inventory_item_id) do nothing;

-- Normalize existing numeric values to 2 decimals
update unit_factors set factor_to_base = round(factor_to_base, 2);
update inventory_items set stock = round(stock, 2), reorder_level = round(reorder_level, 2);
update inventory_items
set monthly_restock_cap = round(
  case
    when monthly_restock_cap is null or monthly_restock_cap <= 0 then
      case
        when category = 'Ingredients' then greatest(stock * 3, reorder_level * 8, stock, 1)
        when category = 'Materials' then greatest(stock * 2, reorder_level * 8, stock, 20)
        else greatest(stock * 1.5, reorder_level * 6, stock, 1)
      end
    else greatest(monthly_restock_cap, stock)
  end,
  2
),
status = calc_inventory_status(stock, reorder_level, monthly_restock_cap),
updated_at = now();
update inventory_adjustments ia
set inventory_item_name = ii.name
from inventory_items ii
where ia.inventory_item_id = ii.id
  and (ia.inventory_item_name is null or ia.inventory_item_name = '');
update waste_logs wl
set inventory_item_name = ii.name
from inventory_items ii
where wl.inventory_item_id = ii.id
  and (wl.inventory_item_name is null or wl.inventory_item_name = '');
update products set price = round(price, 2);
update product_recipes set amount = round(amount, 2);
update orders set total = round(total, 2), payment_method = coalesce(payment_method, 'ewallet'::app_payment_method);
update order_items set unit_price = round(unit_price, 2), line_total = round(line_total, 2);
update inventory_adjustments set delta = round(delta, 2);
update waste_logs set quantity = round(quantity, 2);

-- Utility function for stock status
create or replace function calc_inventory_status(stock_value numeric, reorder_value numeric, monthly_cap_value numeric default null)
returns app_inventory_status
language sql
immutable
as $$
  select case
    when stock_value <= reorder_value then 'low'::app_inventory_status
    when monthly_cap_value is not null and monthly_cap_value > 0 and stock_value >= monthly_cap_value then 'high'::app_inventory_status
    else 'normal'::app_inventory_status
  end
$$;

create or replace function normalize_inventory_item_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.monthly_restock_cap = round(greatest(coalesce(new.monthly_restock_cap, 0), new.stock, 1), 2);
  new.status = calc_inventory_status(new.stock, new.reorder_level, new.monthly_restock_cap);
  return new;
end;
$$;

drop trigger if exists normalize_inventory_item_row_trigger on inventory_items;
create trigger normalize_inventory_item_row_trigger
before insert or update on inventory_items
for each row execute function normalize_inventory_item_row();

-- Core function: status transition + recipe deduction when approved (pending -> preparing)
create or replace function set_order_status(p_order_id text, p_status app_order_status)
returns void
language plpgsql
as $$
declare
  v_prev_status app_order_status;
  v_order_number text;
  v_item record;
  v_recipe record;
  v_addon record;
  v_addon_id text;
  v_delta numeric;
  v_work_amount numeric;
  v_sugar_scale numeric;
begin
  select status, order_number
  into v_prev_status, v_order_number
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  update orders
  set status = p_status,
      updated_at = now()
  where id = p_order_id;

  -- Deduct only once when transaction is approved (pending -> preparing)
  if v_prev_status = 'pending' and p_status = 'preparing' then
    for v_item in
      select oi.product_id, oi.product_name, oi.quantity, oi.customization_json, oi.selected_addons
      from order_items oi
      where oi.order_id = p_order_id
    loop
      v_sugar_scale := 1;
      if v_item.customization_json is not null and (v_item.customization_json ? 'sugarLevel') then
        v_sugar_scale := greatest(0, least(1, coalesce((v_item.customization_json->>'sugarLevel')::numeric, 100) / 100));
      end if;

      for v_recipe in
        select pr.inventory_item_id, pr.amount, pr.unit, ii.unit as inventory_unit
        from product_recipes pr
        join inventory_items ii on ii.id = pr.inventory_item_id
        where pr.product_id = v_item.product_id
      loop
        v_work_amount := v_recipe.amount;
        if v_item.product_id in ('b1', 'b2', 'b3', 'b4') and v_recipe.inventory_item_id = 'ing-white-sugar' then
          v_work_amount := round(v_work_amount * v_sugar_scale, 2);
        end if;

        v_delta := convert_units(v_work_amount * v_item.quantity, v_recipe.unit, v_recipe.inventory_unit);
        v_delta := round(v_delta, 2);

        update inventory_items
        set stock = round(greatest(0, stock - v_delta), 2),
          status = calc_inventory_status(round(greatest(0, stock - v_delta), 2), reorder_level, monthly_restock_cap),
            updated_at = now()
        where id = v_recipe.inventory_item_id;

        insert into inventory_adjustments (inventory_item_id, inventory_item_name, type, delta, unit, note)
        values (
          v_recipe.inventory_item_id,
          (select name from inventory_items where id = v_recipe.inventory_item_id),
          'recipe_deduction',
          round(-v_delta, 2),
          v_recipe.inventory_unit,
          format('Used for %s (%s x)', v_item.product_name, v_item.quantity)
        );
      end loop;

      for v_addon_id in
        select value::text
        from jsonb_array_elements_text(coalesce(v_item.customization_json->'addOnIds', '[]'::jsonb))
      loop
        for v_addon in
          select aoi.inventory_item_id, aoi.amount, aoi.unit, ii.unit as inventory_unit
          from add_on_inventory_usage aoi
          join inventory_items ii on ii.id = aoi.inventory_item_id
          where aoi.add_on_id = v_addon_id
        loop
          v_delta := convert_units(v_addon.amount * v_item.quantity, v_addon.unit, v_addon.inventory_unit);
          v_delta := round(v_delta, 2);

          update inventory_items
          set stock = round(greatest(0, stock - v_delta), 2),
            status = calc_inventory_status(round(greatest(0, stock - v_delta), 2), reorder_level, monthly_restock_cap),
            updated_at = now()
          where id = v_addon.inventory_item_id;

          insert into inventory_adjustments (inventory_item_id, inventory_item_name, type, delta, unit, note)
          values (
            v_addon.inventory_item_id,
            (select name from inventory_items where id = v_addon.inventory_item_id),
            'recipe_deduction',
            round(-v_delta, 2),
            v_addon.inventory_unit,
            format('Used for add-on %s on %s (%s x)', v_addon_id, v_item.product_name, v_item.quantity)
          );
        end loop;
      end loop;
    end loop;
  end if;
end;
$$;

-- Optional helper function: create order + items in one call
create or replace function create_order_with_items(
  p_order_id text,
  p_order_number text,
  p_order_type app_order_type,
  p_total numeric,
  p_estimated_time integer,
  p_items jsonb,
  p_payment_method app_payment_method default 'ewallet'
) 
returns text
language plpgsql
as $$
declare
  v_order_id text := p_order_id;
  v_item jsonb;
begin
  insert into orders (id, order_number, order_type, payment_method, total, estimated_time)
  values (p_order_id, p_order_number, p_order_type, p_payment_method, round(p_total, 2), p_estimated_time)
  on conflict (id) do update set
    order_number = excluded.order_number,
    order_type = excluded.order_type,
    payment_method = excluded.payment_method,
    total = round(excluded.total, 2),
    estimated_time = excluded.estimated_time,
    updated_at = now()
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (
      order_id,
      product_id,
      product_name,
      product_category,
      quantity,
      base_price,
      unit_price,
      line_total,
      sugar_level,
      size_label,
      selected_addons,
      customization_json,
      is_drink
    )
    values (
      v_order_id,
      (v_item->>'product_id'),
      v_item->>'product_name',
      v_item->>'product_category',
      (v_item->>'quantity')::integer,
      round(coalesce((v_item->>'base_price')::numeric, (v_item->>'unit_price')::numeric), 2),
      round((v_item->>'unit_price')::numeric, 2),
      round((v_item->>'line_total')::numeric, 2),
      nullif(v_item->>'sugar_level', '')::integer,
      nullif(v_item->>'size_label', ''),
      coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(v_item->'selected_addons', '[]'::jsonb)) as value),
        '{}'::text[]
      ),
      v_item->'customization_json',
      coalesce((v_item->>'is_drink')::boolean, false)
    );
  end loop;

  return v_order_id;
end;
$$;

-- Daily Inventory Snapshots for analytics
create table if not exists daily_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  inventory_item_id text not null references inventory_items(id) on delete restrict,
  inventory_item_name text not null,
  stock_level numeric(12,2) not null,
  unit app_unit not null,
  created_at timestamptz not null default now(),
  unique (date, inventory_item_id)
);

create index if not exists daily_inventory_snapshots_date_idx on daily_inventory_snapshots(date);
create index if not exists daily_inventory_snapshots_item_idx on daily_inventory_snapshots(inventory_item_id);

-- Business realism: shift tracking, reconciliation, and refunds
create table if not exists shift_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references auth.users(id) on delete set null,
  opened_by_name text,
  opened_by_role app_user_role,
  opened_at timestamptz not null default now(),
  opening_cash numeric(12,2) not null default 0,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  variance numeric(12,2),
  closed_by uuid references auth.users(id) on delete set null,
  closed_by_name text,
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_reconciliation_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  cash_sales numeric(12,2) not null default 0,
  cash_received numeric(12,2) not null default 0,
  cash_change numeric(12,2) not null default 0,
  ewallet_sales numeric(12,2) not null default 0,
  variance numeric(12,2) not null default 0,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refund_audit_logs (
  id uuid primary key default gen_random_uuid(),
  order_id text references orders(id) on delete set null,
  order_number text not null,
  amount numeric(12,2) not null,
  reason text not null,
  processed_by uuid references auth.users(id) on delete set null,
  processed_by_name text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists shift_sessions_opened_at_idx on shift_sessions(opened_at desc);
create index if not exists payment_reconciliation_reports_report_date_idx on payment_reconciliation_reports(report_date desc);
create index if not exists refund_audit_logs_created_at_idx on refund_audit_logs(created_at desc);

create or replace function open_shift_session(
  p_opened_by uuid default null,
  p_opened_by_name text default null,
  p_opened_by_role app_user_role default null,
  p_opening_cash numeric default 0,
  p_notes text default null
)
returns shift_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session shift_sessions;
begin
  insert into shift_sessions (
    opened_by,
    opened_by_name,
    opened_by_role,
    opening_cash,
    notes,
    updated_at
  ) values (
    p_opened_by,
    p_opened_by_name,
    p_opened_by_role,
    round(coalesce(p_opening_cash, 0), 2),
    p_notes,
    now()
  )
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function close_shift_session(
  p_session_id uuid,
  p_expected_cash numeric default null,
  p_counted_cash numeric default null,
  p_closed_by uuid default null,
  p_closed_by_name text default null,
  p_notes text default null
)
returns shift_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session shift_sessions;
  v_expected numeric;
  v_counted numeric;
begin
  select * into v_session
  from shift_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Shift session % not found', p_session_id;
  end if;

  v_expected := round(coalesce(p_expected_cash, v_session.expected_cash, 0), 2);
  v_counted := round(coalesce(p_counted_cash, v_session.counted_cash, 0), 2);

  update shift_sessions
  set expected_cash = v_expected,
      counted_cash = v_counted,
      variance = round(v_counted - v_expected, 2),
      closed_by = p_closed_by,
      closed_by_name = p_closed_by_name,
      closed_at = now(),
      status = 'closed',
      notes = coalesce(p_notes, notes),
      updated_at = now()
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function log_payment_reconciliation(
  p_report_date date,
  p_cash_sales numeric default 0,
  p_cash_received numeric default 0,
  p_cash_change numeric default 0,
  p_ewallet_sales numeric default 0,
  p_note text default null,
  p_created_by uuid default null
)
returns payment_reconciliation_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report payment_reconciliation_reports;
  v_variance numeric;
begin
  v_variance := round(coalesce(p_cash_received, 0) - coalesce(p_cash_sales, 0), 2);

  insert into payment_reconciliation_reports (
    report_date,
    cash_sales,
    cash_received,
    cash_change,
    ewallet_sales,
    variance,
    note,
    created_by,
    updated_at
  ) values (
    p_report_date,
    round(coalesce(p_cash_sales, 0), 2),
    round(coalesce(p_cash_received, 0), 2),
    round(coalesce(p_cash_change, 0), 2),
    round(coalesce(p_ewallet_sales, 0), 2),
    v_variance,
    p_note,
    p_created_by,
    now()
  )
  on conflict (report_date) do update set
    cash_sales = excluded.cash_sales,
    cash_received = excluded.cash_received,
    cash_change = excluded.cash_change,
    ewallet_sales = excluded.ewallet_sales,
    variance = excluded.variance,
    note = excluded.note,
    created_by = excluded.created_by,
    updated_at = now()
  returning * into v_report;

  return v_report;
end;
$$;

create or replace function log_refund_audit(
  p_order_id text,
  p_order_number text,
  p_amount numeric,
  p_reason text,
  p_processed_by uuid default null,
  p_processed_by_name text default null,
  p_note text default null
)
returns refund_audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund refund_audit_logs;
begin
  insert into refund_audit_logs (
    order_id,
    order_number,
    amount,
    reason,
    processed_by,
    processed_by_name,
    note
  ) values (
    nullif(p_order_id, ''),
    coalesce(nullif(p_order_number, ''), 'Unknown Order'),
    round(coalesce(p_amount, 0), 2),
    coalesce(nullif(p_reason, ''), 'Unspecified'),
    p_processed_by,
    p_processed_by_name,
    p_note
  )
  returning * into v_refund;

  return v_refund;
end;
$$;

-- Ensure realtime publication includes all synced tables
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.order_items;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.products;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.product_recipes;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.inventory_items;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.inventory_adjustments;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.waste_logs;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.supplier_requests;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.supplier_contacts;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.shift_sessions;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.payment_reconciliation_reports;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.refund_audit_logs;
  exception when duplicate_object then null;
  end;
end $$;

-- Storage bucket for product images used by dashboard upload
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "public_read_product_images" on storage.objects;
create policy "public_read_product_images"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

drop policy if exists "authenticated_write_product_images" on storage.objects;
create policy "authenticated_write_product_images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "authenticated_update_product_images" on storage.objects;
create policy "authenticated_update_product_images"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "authenticated_delete_product_images" on storage.objects;
create policy "authenticated_delete_product_images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images');

-- Row Level Security for online demo
alter table unit_factors enable row level security;
alter table products enable row level security;
alter table inventory_items enable row level security;
alter table product_recipes enable row level security;
alter table add_ons enable row level security;
alter table add_on_inventory_usage enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table system_history_events enable row level security;
alter table inventory_adjustments enable row level security;
alter table waste_logs enable row level security;
alter table supplier_requests enable row level security;
alter table supplier_contacts enable row level security;
alter table daily_inventory_snapshots enable row level security;
alter table shift_sessions enable row level security;
alter table payment_reconciliation_reports enable row level security;
alter table refund_audit_logs enable row level security;
alter table profiles enable row level security;

-- Profiles RLS: users can read their own profile and admins can read all
drop policy if exists read_own_profile on profiles;
create policy read_own_profile on profiles for select to authenticated using (auth.uid() = id or get_user_role() = 'admin'::app_user_role);

drop policy if exists write_own_profile on profiles;
create policy write_own_profile on profiles for update to authenticated using (auth.uid() = id);

-- Admin-only policies
drop policy if exists read_all_profiles_admin on profiles;
create policy read_all_profiles_admin on profiles for select to authenticated using (get_user_role() = 'admin'::app_user_role);

-- Unit factors: all authenticated can read
drop policy if exists read_unit_factors on unit_factors;
create policy read_unit_factors on unit_factors for select to authenticated using (true);

-- Products: all can read, only admin can write
drop policy if exists read_products on products;
create policy read_products on products for select to authenticated using (true);
drop policy if exists read_products_public on products;
create policy read_products_public on products for select to anon using (true);
drop policy if exists write_products on products;
create policy write_products on products for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Add-ons: all can read, only admin can write
drop policy if exists read_add_ons on add_ons;
create policy read_add_ons on add_ons for select to authenticated using (true);
drop policy if exists read_add_ons_public on add_ons;
create policy read_add_ons_public on add_ons for select to anon using (true);
drop policy if exists write_add_ons on add_ons;
create policy write_add_ons on add_ons for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Add-on inventory usage: all can read, only admin can write
drop policy if exists read_add_on_inventory_usage on add_on_inventory_usage;
create policy read_add_on_inventory_usage on add_on_inventory_usage for select to authenticated using (true);
drop policy if exists read_add_on_inventory_usage_public on add_on_inventory_usage;
create policy read_add_on_inventory_usage_public on add_on_inventory_usage for select to anon using (true);
drop policy if exists write_add_on_inventory_usage on add_on_inventory_usage;
create policy write_add_on_inventory_usage on add_on_inventory_usage for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Inventory items: all can read, only admin can write
drop policy if exists read_inventory_items on inventory_items;
create policy read_inventory_items on inventory_items for select to authenticated using (true);
drop policy if exists write_inventory_items on inventory_items;
create policy write_inventory_items on inventory_items for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Product recipes: all can read, only admin can write
drop policy if exists read_product_recipes on product_recipes;
create policy read_product_recipes on product_recipes for select to authenticated using (true);
drop policy if exists read_product_recipes_public on product_recipes;
create policy read_product_recipes_public on product_recipes for select to anon using (true);
drop policy if exists write_product_recipes on product_recipes;
create policy write_product_recipes on product_recipes for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Orders: cashier and kitchen can read/write, kitchen/admin can update status
drop policy if exists read_orders on orders;
create policy read_orders on orders for select to authenticated using (get_user_role() in ('cashier'::app_user_role, 'kitchen'::app_user_role, 'admin'::app_user_role));
drop policy if exists read_orders_public on orders;
create policy read_orders_public on orders for select to anon using (true);
drop policy if exists write_orders on orders;
create policy write_orders on orders for insert to authenticated with check (get_user_role() in ('cashier'::app_user_role, 'admin'::app_user_role));
drop policy if exists write_orders_public on orders;
create policy write_orders_public on orders for insert to anon with check (true);
drop policy if exists update_orders_public on orders;
create policy update_orders_public on orders for update to anon using (true) with check (true);

-- Order items: cashier/kitchen can read/write, only admin can insert
drop policy if exists read_order_items on order_items;
create policy read_order_items on order_items for select to authenticated using (get_user_role() in ('cashier'::app_user_role, 'kitchen'::app_user_role, 'admin'::app_user_role));
drop policy if exists write_order_items on order_items;
create policy write_order_items on order_items for insert to authenticated with check (get_user_role() in ('cashier'::app_user_role, 'admin'::app_user_role));
drop policy if exists read_order_items_public on order_items;
create policy read_order_items_public on order_items for select to anon using (true);
drop policy if exists write_order_items_public on order_items;
create policy write_order_items_public on order_items for insert to anon with check (true);

-- Inventory adjustments: admin and kitchen can read, only admin can write (auto-triggered)
drop policy if exists read_inventory_adjustments on inventory_adjustments;
create policy read_inventory_adjustments on inventory_adjustments for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'kitchen'::app_user_role));
drop policy if exists write_inventory_adjustments on inventory_adjustments;
create policy write_inventory_adjustments on inventory_adjustments for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- System history events: admin and kitchen can read, only backend (via admin API) can write
drop policy if exists read_system_history_events on system_history_events;
create policy read_system_history_events on system_history_events for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'kitchen'::app_user_role, 'cashier'::app_user_role));
drop policy if exists write_system_history_events on system_history_events;
create policy write_system_history_events on system_history_events for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Waste logs: admin and kitchen can read/write
drop policy if exists read_waste_logs on waste_logs;
create policy read_waste_logs on waste_logs for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'kitchen'::app_user_role));
drop policy if exists write_waste_logs on waste_logs;
create policy write_waste_logs on waste_logs for all to authenticated using (get_user_role() in ('admin'::app_user_role, 'kitchen'::app_user_role)) with check (get_user_role() in ('admin'::app_user_role, 'kitchen'::app_user_role));

-- Supplier requests: supplier role can read/write own, admin can read all
drop policy if exists read_supplier_requests on supplier_requests;
create policy read_supplier_requests on supplier_requests for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'supplier'::app_user_role));
drop policy if exists read_supplier_requests_public on supplier_requests;
create policy read_supplier_requests_public on supplier_requests for select to anon using (true);
drop policy if exists write_supplier_requests on supplier_requests;
create policy write_supplier_requests on supplier_requests for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);
drop policy if exists write_supplier_requests_public on supplier_requests;
create policy write_supplier_requests_public on supplier_requests for update to anon using (true) with check (true);

-- Supplier contacts: admin can manage, supplier can read
drop policy if exists read_supplier_contacts on supplier_contacts;
create policy read_supplier_contacts on supplier_contacts for select to authenticated using (true);
drop policy if exists read_supplier_contacts_public on supplier_contacts;
create policy read_supplier_contacts_public on supplier_contacts for select to anon using (true);
drop policy if exists write_supplier_contacts on supplier_contacts;
create policy write_supplier_contacts on supplier_contacts for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);
drop policy if exists write_supplier_contacts_public on supplier_contacts;
create policy write_supplier_contacts_public on supplier_contacts for all to anon using (true) with check (true);

-- Daily inventory snapshots: admin and kitchen can read, admin only can write
drop policy if exists read_daily_inventory_snapshots on daily_inventory_snapshots;
create policy read_daily_inventory_snapshots on daily_inventory_snapshots for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'kitchen'::app_user_role));
drop policy if exists write_daily_inventory_snapshots on daily_inventory_snapshots;
create policy write_daily_inventory_snapshots on daily_inventory_snapshots for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Shift sessions: admin/cashier/kitchen can read, admin can write
drop policy if exists read_shift_sessions on shift_sessions;
create policy read_shift_sessions on shift_sessions for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'cashier'::app_user_role, 'kitchen'::app_user_role));
drop policy if exists write_shift_sessions on shift_sessions;
create policy write_shift_sessions on shift_sessions for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Payment reconciliation: admin only
drop policy if exists read_payment_reconciliation_reports on payment_reconciliation_reports;
create policy read_payment_reconciliation_reports on payment_reconciliation_reports for select to authenticated using (get_user_role() = 'admin'::app_user_role);
drop policy if exists write_payment_reconciliation_reports on payment_reconciliation_reports;
create policy write_payment_reconciliation_reports on payment_reconciliation_reports for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- Refund audit logs: admin/cashier can read, admin can write
drop policy if exists read_refund_audit_logs on refund_audit_logs;
create policy read_refund_audit_logs on refund_audit_logs for select to authenticated using (get_user_role() in ('admin'::app_user_role, 'cashier'::app_user_role));
drop policy if exists write_refund_audit_logs on refund_audit_logs;
create policy write_refund_audit_logs on refund_audit_logs for all to authenticated using (get_user_role() = 'admin'::app_user_role) with check (get_user_role() = 'admin'::app_user_role);

-- ============================================
-- ANALYTICS LAYER (Dashboards & Intelligence)
-- ============================================

-- View: Daily Sales Summary
create or replace view daily_sales_summary as
select
  cast(o.created_at as date) as sales_date,
  count(distinct o.id) as order_count,
  count(distinct oi.product_id) as unique_products,
  round(sum(o.total)::numeric, 2) as total_revenue,
  round(avg(o.total)::numeric, 2) as avg_order_value,
  count(case when o.payment_method = 'cash' then 1 end) as cash_orders,
  count(case when o.payment_method = 'ewallet' then 1 end) as ewallet_orders
from orders o
left join order_items oi on o.id = oi.order_id
where o.status in ('completed', 'ready')
group by cast(o.created_at as date)
order by sales_date desc;

-- View: Top Selling Products (7-day)
create or replace view top_selling_products_7day as
select
  p.id,
  p.name,
  p.category,
  count(oi.id) as unit_sales,
  round(sum(oi.line_total)::numeric, 2) as revenue,
  round(avg(oi.unit_price)::numeric, 2) as avg_price
from products p
join order_items oi on p.id = oi.product_id
join orders o on oi.order_id = o.id
where o.created_at >= now() - interval '7 days'
  and o.status in ('completed', 'ready')
group by p.id, p.name, p.category
order by unit_sales desc;

-- Function: Inventory Burn Rate (units per day)
create or replace function calc_inventory_burn_rate(p_inventory_item_id text, p_days integer default 7)
returns numeric
language sql
as $$
  select coalesce(round(sum(
    case when ia.delta < 0 then abs(ia.delta)
         else 0 end
  ) / p_days, 2), 0)
  from inventory_adjustments ia
  where ia.inventory_item_id = p_inventory_item_id
    and ia.type in ('recipe_deduction', 'waste')
    and ia.created_at >= now() - (p_days || ' days')::interval;
$$;

-- Function: Depletion Estimate (days until out of stock)
create or replace function estimate_depletion_days(p_inventory_item_id text)
returns integer
language plpgsql
as $$
declare
  v_current_stock numeric;
  v_burn_rate numeric;
  v_reorder_level numeric;
  v_days_until_depletion integer;
begin
  select stock, reorder_level into v_current_stock, v_reorder_level
  from inventory_items
  where id = p_inventory_item_id;

  if v_current_stock is null then
    return -1;
  end if;

  v_burn_rate := calc_inventory_burn_rate(p_inventory_item_id, 7);

  if v_burn_rate <= 0 then
    return 999; -- No depletion if burn rate is zero
  end if;

  v_days_until_depletion := ceil((v_current_stock - v_reorder_level) / v_burn_rate);
  return greatest(v_days_until_depletion, 0);
end;
$$;

-- Function: Reorder Quantity Suggestion
-- Suggested quantity = monthly_restock_cap or (burn_rate * 30) + safety_stock
create or replace function suggest_reorder_quantity(p_inventory_item_id text)
returns numeric
language plpgsql
as $$
declare
  v_monthly_cap numeric;
  v_burn_rate numeric;
  v_current_stock numeric;
  v_reorder_level numeric;
  v_suggested_qty numeric;
begin
  select stock, reorder_level, monthly_restock_cap into v_current_stock, v_reorder_level, v_monthly_cap
  from inventory_items
  where id = p_inventory_item_id;

  if v_monthly_cap is null or v_monthly_cap <= 0 then
    return 1;
  end if;

  v_burn_rate := calc_inventory_burn_rate(p_inventory_item_id, 30);

  -- If enough data, suggest based on burn rate + safety stock
  if v_burn_rate > 0 then
    v_suggested_qty := round((v_burn_rate * 30) + v_reorder_level, 2);
    -- Cap at monthly_restock_cap
    return least(v_suggested_qty, v_monthly_cap);
  end if;

  -- Fallback to monthly cap
  return v_monthly_cap;
end;
$$;

-- View: Inventory Intelligence (reorder suggestions)
create or replace view inventory_reorder_suggestions as
select
  ii.id,
  ii.name,
  ii.category,
  ii.stock as current_stock,
  ii.unit,
  ii.reorder_level,
  ii.monthly_restock_cap,
  calc_inventory_burn_rate(ii.id, 7) as burn_rate_7day,
  calc_inventory_burn_rate(ii.id, 30) as burn_rate_30day,
  estimate_depletion_days(ii.id) as days_until_depletion,
  suggest_reorder_quantity(ii.id) as suggested_reorder_qty,
  case
    when ii.stock <= ii.reorder_level then 'urgent'::text
    when estimate_depletion_days(ii.id) <= 14 then 'soon'::text
    when ii.stock >= ii.monthly_restock_cap then 'full'::text
    else 'normal'::text
  end as reorder_status
from inventory_items ii
where ii.category = 'Ingredients' or ii.category = 'Materials'
order by reorder_status desc, days_until_depletion asc;
