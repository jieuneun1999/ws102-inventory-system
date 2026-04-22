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
  quantity integer not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
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
  ('ing-pepper', 'Pepper', 'Ingredients', 0.50, 'kg', 0.10, 'normal');

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
  ('p1', 'ing-cashews', 40, 'g');

-- Ensaimada (p2) - per piece
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('p2', 'ing-flour', 40, 'g'),
  ('p2', 'ing-white-sugar', 20, 'g'),
  ('p2', 'ing-eggs', 0.3, 'pcs'),
  ('p2', 'ing-butter', 10, 'g'),
  ('p2', 'ing-milk', 15, 'ml'),
  ('p2', 'ing-yeast', 2, 'g');

-- Crinkles (p3) - per piece (assume 15 pieces per batch)
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('p3', 'ing-flour', 20, 'g'),
  ('p3', 'ing-white-sugar', 15, 'g'),
  ('p3', 'ing-powdered-sugar', 10, 'g'),
  ('p3', 'ing-eggs', 0.2, 'pcs'),
  ('p3', 'ing-cocoa', 8, 'g'),
  ('p3', 'ing-baking-powder', 1, 'g'),
  ('p3', 'ing-vanilla-extract', 1, 'ml');

-- Americano (b1) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b1', 'ing-coffee-beans', 15, 'g');

-- Espresso (b2) - per shot
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b2', 'ing-coffee-beans', 9, 'g');

-- Hot Chocolate (b3) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b3', 'ing-milk', 150, 'ml'),
  ('b3', 'ing-cocoa', 15, 'g'),
  ('b3', 'ing-white-sugar', 20, 'g');

-- Vanilla Milk (b4) - per cup
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('b4', 'ing-milk', 180, 'ml'),
  ('b4', 'ing-vanilla-syrup', 10, 'ml'),
  ('b4', 'ing-white-sugar', 15, 'g');

-- Tapsilog (r1) - per serving
insert into product_recipes (product_id, inventory_item_id, amount, unit) values
  ('r1', 'ing-beef', 150, 'g'),
  ('r1', 'ing-soy-sauce', 30, 'ml'),
  ('r1', 'ing-garlic', 10, 'g'),
  ('r1', 'ing-cooking-oil', 10, 'ml'),
  ('r1', 'ing-eggs', 1, 'pcs'),
  ('r1', 'ing-rice', 150, 'g'),
  ('r1', 'ing-salt', 2, 'g'),
  ('r1', 'ing-pepper', 1, 'g');

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
  ('r2', 'ing-mayonnaise', 20, 'ml');

-- Normalize existing numeric values to 2 decimals
update unit_factors set factor_to_base = round(factor_to_base, 2);
update inventory_items set stock = round(stock, 2), reorder_level = round(reorder_level, 2);
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
  v_delta numeric;
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
      select oi.product_id, oi.product_name, oi.quantity
      from order_items oi
      where oi.order_id = p_order_id
    loop
      for v_recipe in
        select pr.inventory_item_id, pr.amount, pr.unit, ii.unit as inventory_unit
        from product_recipes pr
        join inventory_items ii on ii.id = pr.inventory_item_id
        where pr.product_id = v_item.product_id
      loop
        v_delta := convert_units(v_recipe.amount * v_item.quantity, v_recipe.unit, v_recipe.inventory_unit);
        v_delta := round(v_delta, 2);

        update inventory_items
        set stock = round(greatest(0, stock - v_delta), 2),
          status = calc_inventory_status(round(greatest(0, stock - v_delta), 2), reorder_level),
            updated_at = now()
        where id = v_recipe.inventory_item_id;

        insert into inventory_adjustments (inventory_item_id, type, delta, unit, note)
        values (
          v_recipe.inventory_item_id,
          'recipe_deduction',
          round(-v_delta, 2),
          v_recipe.inventory_unit,
          format('Used for %s (%s x)', v_item.product_name, v_item.quantity)
        );
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
