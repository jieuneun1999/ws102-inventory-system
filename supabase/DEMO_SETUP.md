# Supabase Demo Setup (Aura Cafe)

This setup gives you online data + automatic ingredient deduction when an order is completed.

## 1) Create Supabase project

1. Create a new Supabase project.
2. Open SQL Editor.
3. Run [schema.sql](schema.sql).

## 2) Add environment variables to your app

Create a file named .env.local in project root:

VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

## 3) No extra package install is required

The app uses Supabase REST endpoints directly from the browser, so your current Vite app does not need an extra Supabase client package for the demo.

## 4) Data model mapping from your app

- products: menu items
- inventory_items: stocks (beans, milk, syrup, etc.)
- product_recipes: per-product ingredient requirements
- orders + order_items: customer orders
- set_order_status(order_id, status): moves order state and auto-deducts inventory when status becomes completed

## 5) Recommended app integration flow

1. The app seeds products and inventory into Supabase automatically on startup.
2. Order creation is mirrored to Supabase as soon as the order is placed.
3. Update dashboard status using the `set_order_status` RPC so ingredient deduction happens in the database.
4. Read inventory, orders, adjustments, and waste logs directly from Supabase after boot.

## 6) Demo-safe approach for roles

Current SQL policies allow all authenticated users read/write for demo speed.
Before production, split policies by role:

- barista: create/update orders, read inventory
- admin: full write access to inventory/recipes/settings

## 7) Seeding your current products + ingredients

You do not need to manually seed the demo data if you run the app with Supabase configured.

The app will automatically upsert:

1. products
2. inventory_items
3. product_recipes

If you want to seed manually, run the SQL from [schema.sql](schema.sql) first, then start the app once so it can sync the catalog.

## 8) Go live checklist

- Enable Email auth in Supabase Auth.
- Replace local-only auth logic with Supabase session.
- Deploy frontend (Vercel/Netlify).
- Add your frontend URL to Supabase Auth redirect URLs.

## 9) Optional next step in codebase

After this setup, migrate your Zustand actions to async Supabase calls:

- createOrder
- updateOrderStatus
- inventory reads/writes

Keep Zustand for UI state, but move data source of truth to Supabase.
