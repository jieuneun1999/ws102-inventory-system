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

-- Inventory + recipe model
create table if not exists inventory_items (
  id text primary key,
  name text not null unique,
  category app_inventory_category not null,
  stock numeric(12,2) not null default 0,
  unit app_unit not null,
  reorder_level numeric(12,2) not null default 0,
  status app_inventory_status not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  name text not null unique,
  category text not null,
  price numeric(12,2) not null,
  image text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  inventory_item_id text not null references inventory_items(id) on delete restrict,
  amount numeric(12,2) not null,
  unit app_unit not null,
  unique (product_id, inventory_item_id)
);

-- Ordering
create table if not exists orders (
  id text primary key,
  order_number text not null unique,
  status app_order_status not null default 'pending',
  order_type app_order_type not null,
  total numeric(12,2) not null default 0,
  estimated_time integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table inventory_adjustments
  add column if not exists inventory_item_name text;

alter table waste_logs
  add column if not exists inventory_item_name text;

-- ============================================
-- SEED DATA: Products and Inventory
-- ============================================

-- Products
truncate table products cascade;
insert into products (id, name, category, price, description, active) values
  -- Pastry
  ('p1', 'Sansrival Cake', 'Pastry', 120, 'Classic Filipino sansrival with layers of meringue and cashew.', true),
  ('p2', 'Ensaimada', 'Pastry', 95, 'Sweet Filipino pastry roll with cheese and sugar topping.', true),
  ('p3', 'Crinkles', 'Pastry', 85, 'Soft chocolate crackle cookies with powdered sugar coating.', true),
  -- Beverages - Caffeinated
  ('b1', 'Americano', 'Beverage', 150, 'Smooth espresso diluted with hot water.', true),
  ('b2', 'Espresso', 'Beverage', 140, 'Rich and concentrated coffee shot.', true),
  -- Beverages - Decaffeinated
  ('b3', 'Hot Chocolate', 'Beverage', 150, 'Creamy hot chocolate with rich cocoa flavor.', true),
  ('b4', 'Vanilla Milk', 'Beverage', 160, 'Smooth and creamy vanilla-flavored milk.', true),
  -- Rice Meals
  ('r1', 'Tapsilog', 'Rice Meal', 185, 'Marinated beef, fried egg, and garlic rice served together.', true),
  ('r2', 'Sizzling Sisig', 'Rice Meal', 195, 'Sizzling pork with onions and chili served with rice and egg.', true);

-- Inventory Items
truncate table inventory_items cascade;
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
  ('mat-wrapping-paper', 'Wrapping paper', 'Materials', 350.00, 'pcs', 80.00, 'normal');

truncate table add_ons cascade;
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
  ('addon-orange', 'Orange zest or juice', 'Refreshing iced drinks', 'Citrus coffee pairing', 25, true);

truncate table add_on_inventory_usage cascade;
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
  ('addon-orange', 'ing-orange-concentrate', 15, 'ml');

-- Product Recipes with realistic deduction amounts
truncate table product_recipes cascade;

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
  ('p1', 'mat-paper-bags', 1, 'pcs');

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
  ('p2', 'mat-paper-bags', 1, 'pcs');

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
  ('p3', 'mat-paper-bags', 1, 'pcs');

-- Americano (b1) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b1', 'ing-coffee-beans', 15, 'g'),
  ('b1', 'mat-hot-cup-medium', 1, 'pcs'),
  ('b1', 'mat-hot-lids', 1, 'pcs'),
  ('b1', 'mat-cup-sleeves', 1, 'pcs'),
  ('b1', 'mat-stir-sticks', 1, 'pcs'),
  ('b1', 'mat-napkins', 1, 'pcs');

-- Espresso (b2) - per shot
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b2', 'ing-coffee-beans', 9, 'g'),
  ('b2', 'mat-hot-cup-small', 1, 'pcs'),
  ('b2', 'mat-hot-lids', 1, 'pcs'),
  ('b2', 'mat-stir-sticks', 1, 'pcs');

-- Hot Chocolate (b3) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b3', 'ing-milk', 150, 'ml'),
  ('b3', 'ing-cocoa', 15, 'g'),
  ('b3', 'ing-white-sugar', 20, 'g'),
  ('b3', 'mat-hot-cup-medium', 1, 'pcs'),
  ('b3', 'mat-hot-lids', 1, 'pcs'),
  ('b3', 'mat-cup-sleeves', 1, 'pcs'),
  ('b3', 'mat-stir-sticks', 1, 'pcs'),
  ('b3', 'mat-napkins', 1, 'pcs');

-- Vanilla Milk (b4) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b4', 'ing-milk', 180, 'ml'),
  ('b4', 'ing-vanilla-syrup', 10, 'ml'),
  ('b4', 'ing-white-sugar', 15, 'g'),
  ('b4', 'mat-cold-cup-medium', 1, 'pcs'),
  ('b4', 'mat-cold-lids', 1, 'pcs'),
  ('b4', 'mat-straws', 1, 'pcs'),
  ('b4', 'mat-napkins', 1, 'pcs');

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
  ('r1', 'mat-plastic-bags', 1, 'pcs');

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
  ('r2', 'mat-plastic-bags', 1, 'pcs');

-- Normalize existing numeric values to 2 decimals
update unit_factors set factor_to_base = round(factor_to_base, 2);
update inventory_items set stock = round(stock, 2), reorder_level = round(reorder_level, 2);
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
update orders set total = round(total, 2);
update order_items set unit_price = round(unit_price, 2), line_total = round(line_total, 2);
update inventory_adjustments set delta = round(delta, 2);
update waste_logs set quantity = round(quantity, 2);

-- Utility function for stock status
create or replace function calc_inventory_status(stock_value numeric, reorder_value numeric)
returns app_inventory_status
language sql
immutable
as $$
  select case
    when stock_value <= reorder_value then 'low'::app_inventory_status
    when stock_value > reorder_value * 2 then 'high'::app_inventory_status
    else 'normal'::app_inventory_status
  end
$$;

-- Core function: status transition + recipe deduction when completed
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

  -- Deduct only once when transitioning into completed
  if v_prev_status <> 'completed' and p_status = 'completed' then
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
          status = calc_inventory_status(round(greatest(0, stock - v_delta), 2), reorder_level),
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
            status = calc_inventory_status(round(greatest(0, stock - v_delta), 2), reorder_level),
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
  p_items jsonb
) 
returns text
language plpgsql
as $$
declare
  v_order_id text := p_order_id;
  v_item jsonb;
begin
  insert into orders (id, order_number, order_type, total, estimated_time)
  values (p_order_id, p_order_number, p_order_type, round(p_total, 2), p_estimated_time)
  on conflict (id) do update set
    order_number = excluded.order_number,
    order_type = excluded.order_type,
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
      quantity,
      unit_price,
      line_total
    )
    values (
      v_order_id,
      (v_item->>'product_id'),
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      round((v_item->>'unit_price')::numeric, 2),
      round((v_item->>'line_total')::numeric, 2)
    );
  end loop;

  return v_order_id;
end;
$$;

-- Row Level Security for online demo
alter table unit_factors enable row level security;
alter table products enable row level security;
alter table inventory_items enable row level security;
alter table product_recipes enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_adjustments enable row level security;
alter table waste_logs enable row level security;

-- Demo policies: authenticated users can read/write. Tighten later per role.
drop policy if exists read_unit_factors on unit_factors;
create policy read_unit_factors on unit_factors for select to authenticated using (true);

drop policy if exists read_products on products;
create policy read_products on products for select to authenticated using (true);
drop policy if exists write_products on products;
create policy write_products on products for all to authenticated using (true) with check (true);

drop policy if exists read_inventory_items on inventory_items;
create policy read_inventory_items on inventory_items for select to authenticated using (true);
drop policy if exists write_inventory_items on inventory_items;
create policy write_inventory_items on inventory_items for all to authenticated using (true) with check (true);

drop policy if exists read_product_recipes on product_recipes;
create policy read_product_recipes on product_recipes for select to authenticated using (true);
drop policy if exists write_product_recipes on product_recipes;
create policy write_product_recipes on product_recipes for all to authenticated using (true) with check (true);

drop policy if exists read_orders on orders;
create policy read_orders on orders for select to authenticated using (true);
drop policy if exists write_orders on orders;
create policy write_orders on orders for all to authenticated using (true) with check (true);

drop policy if exists read_order_items on order_items;
create policy read_order_items on order_items for select to authenticated using (true);
drop policy if exists write_order_items on order_items;
create policy write_order_items on order_items for all to authenticated using (true) with check (true);

drop policy if exists read_inventory_adjustments on inventory_adjustments;
create policy read_inventory_adjustments on inventory_adjustments for select to authenticated using (true);
drop policy if exists write_inventory_adjustments on inventory_adjustments;
create policy write_inventory_adjustments on inventory_adjustments for all to authenticated using (true) with check (true);

drop policy if exists read_waste_logs on waste_logs;
create policy read_waste_logs on waste_logs for select to authenticated using (true);
drop policy if exists write_waste_logs on waste_logs;
create policy write_waste_logs on waste_logs for all to authenticated using (true) with check (true);
