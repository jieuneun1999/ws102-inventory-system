import { MENU_ITEMS } from '../data';
import type { CartItem, DrinkCustomization, InventoryItem, Order, OrderStatus, Product, Unit, WasteReason } from '../store';
import { getStoredSession } from './supabaseAuth';

type SupabaseSnapshot = {
  products: Product[];
  productRecipes: Record<string, Array<{ inventoryItemId: string; inventoryName: string; amount: number; unit: Unit }>>;
  inventory: InventoryItem[];
  orders: Order[];
  inventoryAdjustments: Array<{
    id: string;
    inventoryItemId: string;
    inventoryItemName: string;
    type: 'manual_adjustment' | 'recipe_deduction' | 'waste' | 'batch_add' | 'item_add' | 'item_delete';
    delta: number;
    unit: Unit;
    note: string;
    createdAt: number;
  }>;
  wasteLogs: Array<{
    id: string;
    inventoryItemId: string;
    inventoryItemName: string;
    quantity: number;
    unit: Unit;
    reason: WasteReason;
    note?: string;
    createdAt: number;
  }>;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const roundTo2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const isDrinkCategory = (category: string) => {
  const normalized = category.trim().toLowerCase();
  return normalized.includes('beverage') || normalized.includes('coffee') || normalized.includes('tea');
};

const baseHeaders = {
  apikey: SUPABASE_ANON_KEY ?? '',
  Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  'Content-Type': 'application/json',
};

const getHeaders = (extraHeaders: Record<string, string> = {}) => {
  const session = getStoredSession();
  return {
    ...baseHeaders,
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
    ...extraHeaders,
  };
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T | null> => {
  if (!isConfigured) return null;

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
};

const upsertRows = async <T>(table: string, rows: T[], onConflict: string) => {
  if (!isConfigured || rows.length === 0) return;
  await request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
};

const fetchRows = async <T>(table: string, query = 'select=*') => {
  const result = await request<T[]>(`/rest/v1/${table}?${query}`, { method: 'GET' });
  return result ?? [];
};

const deleteRowsByIds = async (table: string, column: string, ids: string[]) => {
  if (!isConfigured || ids.length === 0) return;
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const inList = uniqueIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
  await request(`/rest/v1/${table}?${column}=in.(${encodeURIComponent(inList)})`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
};

// Use MENU_ITEMS as the product catalog
const DEEP_CATALOG = MENU_ITEMS.map(item => ({
  id: item.id,
  name: item.name,
  category: item.category,
  price: item.price,
  image: item.image,
  description: item.description,
}));

const INBOX_INVENTORY: InventoryItem[] = [
  { id: 'ing-flour', name: 'All-purpose flour', category: 'Ingredients', stock: 10, unit: 'kg', status: 'normal', reorderLevel: 2 },
  { id: 'ing-white-sugar', name: 'White sugar', category: 'Ingredients', stock: 5, unit: 'kg', status: 'normal', reorderLevel: 1 },
  { id: 'ing-powdered-sugar', name: 'Powdered sugar', category: 'Ingredients', stock: 3, unit: 'kg', status: 'normal', reorderLevel: 1 },
  { id: 'ing-eggs', name: 'Eggs', category: 'Ingredients', stock: 20, unit: 'pcs', status: 'normal', reorderLevel: 5 },
  { id: 'ing-butter', name: 'Butter', category: 'Ingredients', stock: 4, unit: 'kg', status: 'normal', reorderLevel: 1 },
  { id: 'ing-milk', name: 'Milk', category: 'Ingredients', stock: 2, unit: 'L', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-yeast', name: 'Yeast', category: 'Ingredients', stock: 0.5, unit: 'kg', status: 'normal', reorderLevel: 0.1 },
  { id: 'ing-cocoa', name: 'Cocoa powder', category: 'Ingredients', stock: 1, unit: 'kg', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-cashews', name: 'Cashew nuts', category: 'Ingredients', stock: 2, unit: 'kg', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-baking-powder', name: 'Baking powder', category: 'Ingredients', stock: 1, unit: 'kg', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-vanilla-extract', name: 'Vanilla extract', category: 'Ingredients', stock: 0.5, unit: 'L', status: 'normal', reorderLevel: 0.1 },
  { id: 'ing-chocolate-chips', name: 'Chocolate chips', category: 'Ingredients', stock: 2, unit: 'kg', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-coffee-beans', name: 'Coffee beans (espresso roast)', category: 'Ingredients', stock: 5, unit: 'kg', status: 'normal', reorderLevel: 1 },
  { id: 'ing-ground-coffee', name: 'Ground coffee', category: 'Ingredients', stock: 2, unit: 'kg', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-vanilla-syrup', name: 'Vanilla syrup', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-caramel-drizzle', name: 'Caramel drizzle', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-hazelnut-syrup', name: 'Hazelnut syrup', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-brown-sugar-syrup', name: 'Brown sugar syrup', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-chocolate-syrup', name: 'Chocolate syrup', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-oat-milk', name: 'Oat milk', category: 'Ingredients', stock: 2, unit: 'L', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-almond-milk', name: 'Almond milk', category: 'Ingredients', stock: 2, unit: 'L', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-coconut-milk', name: 'Coconut milk', category: 'Ingredients', stock: 2, unit: 'L', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-whipped-cream', name: 'Whipped cream', category: 'Ingredients', stock: 1.5, unit: 'L', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-cinnamon-powder', name: 'Cinnamon powder', category: 'Ingredients', stock: 0.5, unit: 'kg', status: 'normal', reorderLevel: 0.1 },
  { id: 'ing-sea-salt-foam', name: 'Sea salt foam', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-matcha-powder', name: 'Matcha powder', category: 'Ingredients', stock: 0.5, unit: 'kg', status: 'normal', reorderLevel: 0.1 },
  { id: 'ing-cold-foam', name: 'Cold foam', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-honey', name: 'Honey', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-orange-concentrate', name: 'Orange concentrate', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-beef', name: 'Beef', category: 'Ingredients', stock: 5, unit: 'kg', status: 'normal', reorderLevel: 1 },
  { id: 'ing-soy-sauce', name: 'Soy sauce', category: 'Ingredients', stock: 2, unit: 'L', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-garlic', name: 'Garlic', category: 'Ingredients', stock: 0.5, unit: 'kg', status: 'normal', reorderLevel: 0.1 },
  { id: 'ing-calamansi', name: 'Calamansi', category: 'Ingredients', stock: 50, unit: 'pcs', status: 'normal', reorderLevel: 10 },
  { id: 'ing-cooking-oil', name: 'Cooking oil', category: 'Ingredients', stock: 5, unit: 'L', status: 'normal', reorderLevel: 1 },
  { id: 'ing-rice', name: 'Rice', category: 'Ingredients', stock: 10, unit: 'kg', status: 'normal', reorderLevel: 2 },
  { id: 'ing-pork', name: 'Pork', category: 'Ingredients', stock: 5, unit: 'kg', status: 'normal', reorderLevel: 1 },
  { id: 'ing-onion', name: 'Onion', category: 'Ingredients', stock: 2, unit: 'kg', status: 'normal', reorderLevel: 0.5 },
  { id: 'ing-chili', name: 'Chili', category: 'Ingredients', stock: 0.5, unit: 'kg', status: 'normal', reorderLevel: 0.1 },
  { id: 'ing-mayonnaise', name: 'Mayonnaise', category: 'Ingredients', stock: 1, unit: 'L', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-salt', name: 'Salt', category: 'Ingredients', stock: 1, unit: 'kg', status: 'normal', reorderLevel: 0.25 },
  { id: 'ing-pepper', name: 'Pepper', category: 'Ingredients', stock: 0.5, unit: 'kg', status: 'normal', reorderLevel: 0.1 },
  { id: 'mat-hot-cup-small', name: 'Hot cups (small)', category: 'Materials', stock: 250, unit: 'pcs', status: 'normal', reorderLevel: 50 },
  { id: 'mat-hot-cup-medium', name: 'Hot cups (medium)', category: 'Materials', stock: 250, unit: 'pcs', status: 'normal', reorderLevel: 50 },
  { id: 'mat-hot-cup-large', name: 'Hot cups (large)', category: 'Materials', stock: 200, unit: 'pcs', status: 'normal', reorderLevel: 40 },
  { id: 'mat-cold-cup-small', name: 'Cold cups (small plastic)', category: 'Materials', stock: 250, unit: 'pcs', status: 'normal', reorderLevel: 50 },
  { id: 'mat-cold-cup-medium', name: 'Cold cups (medium plastic)', category: 'Materials', stock: 250, unit: 'pcs', status: 'normal', reorderLevel: 50 },
  { id: 'mat-cold-cup-large', name: 'Cold cups (large plastic)', category: 'Materials', stock: 200, unit: 'pcs', status: 'normal', reorderLevel: 40 },
  { id: 'mat-coffee-mugs', name: 'Coffee mugs (for dine-in)', category: 'Materials', stock: 40, unit: 'pcs', status: 'normal', reorderLevel: 10 },
  { id: 'mat-glass-cups', name: 'Glass cups', category: 'Materials', stock: 40, unit: 'pcs', status: 'normal', reorderLevel: 10 },
  { id: 'mat-paper-cups', name: 'Paper cups', category: 'Materials', stock: 300, unit: 'pcs', status: 'normal', reorderLevel: 60 },
  { id: 'mat-cup-sleeves', name: 'Cup sleeves', category: 'Materials', stock: 300, unit: 'pcs', status: 'normal', reorderLevel: 60 },
  { id: 'mat-hot-lids', name: 'Cup lids (hot)', category: 'Materials', stock: 300, unit: 'pcs', status: 'normal', reorderLevel: 60 },
  { id: 'mat-cold-lids', name: 'Cup lids (cold)', category: 'Materials', stock: 300, unit: 'pcs', status: 'normal', reorderLevel: 60 },
  { id: 'mat-dome-lids', name: 'Dome lids (for frappes)', category: 'Materials', stock: 200, unit: 'pcs', status: 'normal', reorderLevel: 40 },
  { id: 'mat-straws', name: 'Straws (regular)', category: 'Materials', stock: 500, unit: 'pcs', status: 'normal', reorderLevel: 100 },
  { id: 'mat-jumbo-straws', name: 'Jumbo straws (for frappes)', category: 'Materials', stock: 350, unit: 'pcs', status: 'normal', reorderLevel: 80 },
  { id: 'mat-stir-sticks', name: 'Stir sticks', category: 'Materials', stock: 500, unit: 'pcs', status: 'normal', reorderLevel: 100 },
  { id: 'mat-plastic-spoons', name: 'Plastic spoons', category: 'Materials', stock: 350, unit: 'pcs', status: 'normal', reorderLevel: 80 },
  { id: 'mat-plastic-forks', name: 'Plastic forks', category: 'Materials', stock: 350, unit: 'pcs', status: 'normal', reorderLevel: 80 },
  { id: 'mat-napkins', name: 'Napkins', category: 'Materials', stock: 1200, unit: 'pcs', status: 'normal', reorderLevel: 250 },
  { id: 'mat-tissue-paper', name: 'Tissue paper', category: 'Materials', stock: 1200, unit: 'pcs', status: 'normal', reorderLevel: 250 },
  { id: 'mat-paper-bags', name: 'Paper bags', category: 'Materials', stock: 300, unit: 'pcs', status: 'normal', reorderLevel: 70 },
  { id: 'mat-plastic-bags', name: 'Plastic bags', category: 'Materials', stock: 300, unit: 'pcs', status: 'normal', reorderLevel: 70 },
  { id: 'mat-food-containers', name: 'Food containers', category: 'Materials', stock: 200, unit: 'pcs', status: 'normal', reorderLevel: 50 },
  { id: 'mat-takeout-boxes', name: 'Take-out boxes', category: 'Materials', stock: 220, unit: 'pcs', status: 'normal', reorderLevel: 50 },
  { id: 'mat-cup-carriers', name: 'Cup carriers / drink holders', category: 'Materials', stock: 150, unit: 'pcs', status: 'normal', reorderLevel: 30 },
  { id: 'mat-wrapping-paper', name: 'Wrapping paper', category: 'Materials', stock: 350, unit: 'pcs', status: 'normal', reorderLevel: 80 },
];

const DEMO_RECIPES = [
  { product_id: 'p1', inventory_item_id: 'ing-flour', amount: 50, unit: 'g' as Unit },
  { product_id: 'p1', inventory_item_id: 'ing-white-sugar', amount: 30, unit: 'g' as Unit },
  { product_id: 'p1', inventory_item_id: 'ing-powdered-sugar', amount: 20, unit: 'g' as Unit },
  { product_id: 'p1', inventory_item_id: 'ing-eggs', amount: 0.5, unit: 'pcs' as Unit },
  { product_id: 'p1', inventory_item_id: 'ing-butter', amount: 15, unit: 'g' as Unit },
  { product_id: 'p1', inventory_item_id: 'ing-milk', amount: 20, unit: 'ml' as Unit },
  { product_id: 'p1', inventory_item_id: 'ing-cashews', amount: 40, unit: 'g' as Unit },
  { product_id: 'p1', inventory_item_id: 'mat-food-containers', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'p1', inventory_item_id: 'mat-napkins', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'p1', inventory_item_id: 'mat-paper-bags', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'p2', inventory_item_id: 'ing-flour', amount: 40, unit: 'g' as Unit },
  { product_id: 'p2', inventory_item_id: 'ing-white-sugar', amount: 20, unit: 'g' as Unit },
  { product_id: 'p2', inventory_item_id: 'ing-eggs', amount: 0.3, unit: 'pcs' as Unit },
  { product_id: 'p2', inventory_item_id: 'ing-butter', amount: 10, unit: 'g' as Unit },
  { product_id: 'p2', inventory_item_id: 'ing-milk', amount: 15, unit: 'ml' as Unit },
  { product_id: 'p2', inventory_item_id: 'ing-yeast', amount: 2, unit: 'g' as Unit },
  { product_id: 'p2', inventory_item_id: 'mat-food-containers', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'p2', inventory_item_id: 'mat-napkins', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'p2', inventory_item_id: 'mat-paper-bags', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'p3', inventory_item_id: 'ing-flour', amount: 20, unit: 'g' as Unit },
  { product_id: 'p3', inventory_item_id: 'ing-white-sugar', amount: 15, unit: 'g' as Unit },
  { product_id: 'p3', inventory_item_id: 'ing-powdered-sugar', amount: 10, unit: 'g' as Unit },
  { product_id: 'p3', inventory_item_id: 'ing-eggs', amount: 0.2, unit: 'pcs' as Unit },
  { product_id: 'p3', inventory_item_id: 'ing-cocoa', amount: 8, unit: 'g' as Unit },
  { product_id: 'p3', inventory_item_id: 'ing-baking-powder', amount: 1, unit: 'g' as Unit },
  { product_id: 'p3', inventory_item_id: 'ing-vanilla-extract', amount: 1, unit: 'ml' as Unit },
  { product_id: 'p3', inventory_item_id: 'mat-food-containers', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'p3', inventory_item_id: 'mat-napkins', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'p3', inventory_item_id: 'mat-paper-bags', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'b1', inventory_item_id: 'ing-coffee-beans', amount: 15, unit: 'g' as Unit },
  { product_id: 'b1', inventory_item_id: 'mat-hot-cup-medium', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b1', inventory_item_id: 'mat-hot-lids', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b1', inventory_item_id: 'mat-cup-sleeves', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b1', inventory_item_id: 'mat-stir-sticks', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b1', inventory_item_id: 'mat-napkins', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b2', inventory_item_id: 'ing-coffee-beans', amount: 9, unit: 'g' as Unit },
  { product_id: 'b2', inventory_item_id: 'mat-hot-cup-small', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b2', inventory_item_id: 'mat-hot-lids', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b2', inventory_item_id: 'mat-stir-sticks', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'b3', inventory_item_id: 'ing-milk', amount: 150, unit: 'ml' as Unit },
  { product_id: 'b3', inventory_item_id: 'ing-cocoa', amount: 15, unit: 'g' as Unit },
  { product_id: 'b3', inventory_item_id: 'ing-white-sugar', amount: 20, unit: 'g' as Unit },
  { product_id: 'b3', inventory_item_id: 'mat-hot-cup-medium', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b3', inventory_item_id: 'mat-hot-lids', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b3', inventory_item_id: 'mat-cup-sleeves', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b3', inventory_item_id: 'mat-stir-sticks', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b3', inventory_item_id: 'mat-napkins', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'b4', inventory_item_id: 'ing-milk', amount: 180, unit: 'ml' as Unit },
  { product_id: 'b4', inventory_item_id: 'ing-vanilla-syrup', amount: 10, unit: 'ml' as Unit },
  { product_id: 'b4', inventory_item_id: 'ing-white-sugar', amount: 15, unit: 'g' as Unit },
  { product_id: 'b4', inventory_item_id: 'mat-cold-cup-medium', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b4', inventory_item_id: 'mat-cold-lids', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b4', inventory_item_id: 'mat-straws', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'b4', inventory_item_id: 'mat-napkins', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'r1', inventory_item_id: 'ing-beef', amount: 150, unit: 'g' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-soy-sauce', amount: 30, unit: 'ml' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-garlic', amount: 10, unit: 'g' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-cooking-oil', amount: 10, unit: 'ml' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-eggs', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-rice', amount: 150, unit: 'g' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-salt', amount: 2, unit: 'g' as Unit },
  { product_id: 'r1', inventory_item_id: 'ing-pepper', amount: 1, unit: 'g' as Unit },
  { product_id: 'r1', inventory_item_id: 'mat-takeout-boxes', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r1', inventory_item_id: 'mat-plastic-spoons', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r1', inventory_item_id: 'mat-plastic-forks', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r1', inventory_item_id: 'mat-tissue-paper', amount: 2, unit: 'pcs' as Unit },
  { product_id: 'r1', inventory_item_id: 'mat-plastic-bags', amount: 1, unit: 'pcs' as Unit },

  { product_id: 'r2', inventory_item_id: 'ing-pork', amount: 150, unit: 'g' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-onion', amount: 30, unit: 'g' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-chili', amount: 10, unit: 'g' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-soy-sauce', amount: 30, unit: 'ml' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-cooking-oil', amount: 10, unit: 'ml' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-eggs', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-rice', amount: 150, unit: 'g' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-calamansi', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-salt', amount: 2, unit: 'g' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-pepper', amount: 1, unit: 'g' as Unit },
  { product_id: 'r2', inventory_item_id: 'ing-mayonnaise', amount: 20, unit: 'ml' as Unit },
  { product_id: 'r2', inventory_item_id: 'mat-takeout-boxes', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r2', inventory_item_id: 'mat-plastic-spoons', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r2', inventory_item_id: 'mat-plastic-forks', amount: 1, unit: 'pcs' as Unit },
  { product_id: 'r2', inventory_item_id: 'mat-tissue-paper', amount: 2, unit: 'pcs' as Unit },
  { product_id: 'r2', inventory_item_id: 'mat-plastic-bags', amount: 1, unit: 'pcs' as Unit },
];

const LEGACY_INVENTORY_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);

export const bootstrapSupabaseDemo = async (): Promise<SupabaseSnapshot | null> => {
  if (!isConfigured) return null;

  let products = await fetchRows<Product>('products', 'select=*&active=eq.true&order=created_at.asc');
  let inventory = await fetchRows<InventoryItem>('inventory_items', 'select=*&order=created_at.asc');

  const legacyProductIds = products
    .filter((item) => /^c\d+$/i.test(item.id) || /^n\d+$/i.test(item.id))
    .map((item) => item.id);
  const legacyInventoryIds = inventory
    .filter((item) => LEGACY_INVENTORY_IDS.has(String(item.id)))
    .map((item) => String(item.id));

  if (legacyProductIds.length > 0 || legacyInventoryIds.length > 0) {
    await deleteRowsByIds('product_recipes', 'product_id', legacyProductIds);
    await deleteRowsByIds('product_recipes', 'inventory_item_id', legacyInventoryIds);
    await deleteRowsByIds('order_items', 'product_id', legacyProductIds);
    await deleteRowsByIds('inventory_adjustments', 'inventory_item_id', legacyInventoryIds);
    await deleteRowsByIds('waste_logs', 'inventory_item_id', legacyInventoryIds);
    await deleteRowsByIds('products', 'id', legacyProductIds);
    await deleteRowsByIds('inventory_items', 'id', legacyInventoryIds);

    products = await fetchRows<Product>('products', 'select=*&active=eq.true&order=created_at.asc');
    inventory = await fetchRows<InventoryItem>('inventory_items', 'select=*&order=created_at.asc');
  }

  const ordersRaw = await fetchRows<any>('orders', 'select=*&order=created_at.desc');
  const orderItemsRaw = await fetchRows<any>('order_items', 'select=*&order=created_at.asc');
  let recipeRows = await fetchRows<any>(
    'product_recipes',
    'select=product_id,inventory_item_id,amount,unit,inventory_items(name)&order=product_id.asc'
  );
  const inventoryAdjustments = await fetchRows<SupabaseSnapshot['inventoryAdjustments'][number]>('inventory_adjustments', 'select=*&order=created_at.desc');
  const wasteLogs = await fetchRows<SupabaseSnapshot['wasteLogs'][number]>('waste_logs', 'select=*&order=created_at.desc');

  const hasLegacyProducts = products.some((item) => /^c\d+$/i.test(item.id) || /^n\d+$/i.test(item.id));
  const hasCanonicalProducts = products.some((item) => item.id === 'p1' || item.id === 'b1' || item.id === 'r1');
  if (products.length === 0 || hasLegacyProducts || !hasCanonicalProducts) {
    await upsertRows('products', DEEP_CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      image: item.image,
      description: item.description,
      active: true,
    })), 'id');
  }

  const hasLegacyInventory = inventory.some((item) => LEGACY_INVENTORY_IDS.has(String(item.id)));
  const hasCanonicalInventory = inventory.some((item) => String(item.id).startsWith('ing-'));
  if (inventory.length === 0 || hasLegacyInventory || !hasCanonicalInventory) {
    await upsertRows('inventory_items', INBOX_INVENTORY, 'id');
  }

  if (recipeRows.length === 0) {
    await upsertRows('product_recipes', DEMO_RECIPES, 'product_id,inventory_item_id');
    recipeRows = await fetchRows<any>(
      'product_recipes',
      'select=product_id,inventory_item_id,amount,unit,inventory_items(name)&order=product_id.asc'
    );
  }

  const nextProducts = (products.length > 0 && !hasLegacyProducts && hasCanonicalProducts
    ? products
    : DEEP_CATALOG) as Product[];
  const productById = new Map(nextProducts.map((item) => [item.id, item]));
  const nextInventorySource = (inventory.length > 0 && !hasLegacyInventory && hasCanonicalInventory)
    ? inventory
    : INBOX_INVENTORY;
  const nextInventory = nextInventorySource.map((item: any) => ({
    id: String(item.id),
    name: String(item.name),
    category: item.category,
    stock: roundTo2(Number(item.stock ?? 0)),
    unit: item.unit,
    status: item.status,
    reorderLevel: roundTo2(Number(item.reorderLevel ?? item.reorder_level ?? 0)),
  })) as InventoryItem[];
  const inventoryNameById = new Map(nextInventory.map((item) => [item.id, item.name]));
  const productRecipes: SupabaseSnapshot['productRecipes'] = recipeRows.reduce((acc, row) => {
    const inventoryItemId = String(row.inventory_item_id ?? '');
    if (!inventoryItemId) return acc;
    const inventoryName = String(
      row.inventory_items?.name ?? inventoryNameById.get(inventoryItemId) ?? inventoryItemId
    );
    const productId = String(row.product_id ?? '');
    if (!productId) return acc;
    if (!acc[productId]) acc[productId] = [];
    acc[productId].push({
      inventoryItemId,
      inventoryName,
      amount: roundTo2(Number(row.amount ?? 0)),
      unit: row.unit,
    });
    return acc;
  }, {} as SupabaseSnapshot['productRecipes']);
  const mergedProducts = nextProducts.map((item) => ({
    ...item,
    ingredients: productRecipes[item.id]?.map((entry) => entry.inventoryName) ?? item.ingredients,
  }));

  const nextOrders: Order[] = ordersRaw.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    items: orderItemsRaw
      .filter((item) => item.order_id === order.id)
      .map((item) => {
        const catalogProduct = productById.get(item.product_id);
        return {
          id: item.product_id,
          cartItemId: item.id,
          name: item.product_name,
          price: Number(item.unit_price),
          basePrice: Number(item.base_price ?? item.unit_price),
          category: item.product_category ?? catalogProduct?.category ?? 'Beverage',
          image: catalogProduct?.image ?? '',
          quantity: item.quantity,
          customization: (item.customization_json ?? null) as DrinkCustomization | undefined,
        } as CartItem;
      }),
    total: Number(order.total),
    status: order.status,
    createdAt: new Date(order.created_at).getTime(),
    estimatedTime: order.estimated_time,
    orderType: order.order_type,
  }));

  return {
    products: mergedProducts,
    productRecipes,
    inventory: nextInventory,
    orders: nextOrders,
    inventoryAdjustments,
    wasteLogs,
  };
};

export const syncSupabaseProductCatalog = async (products: Product[]) => {
  if (!isConfigured) return;
  await upsertRows('products', products.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    image: item.image,
    description: item.description,
    active: true,
  })), 'id');
};

export const syncSupabaseProductWithRecipe = async (
  product: Product,
  recipe: Array<{ inventoryItemId?: string; inventoryName: string; amount: number; unit: Unit }>
) => {
  if (!isConfigured) return;

  await upsertRows('products', [
    {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image: product.image,
      description: product.description,
      active: true,
    },
  ], 'id');

  await request(`/rest/v1/product_recipes?product_id=eq.${encodeURIComponent(product.id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  const recipeRows = recipe
    .filter((entry) => Boolean(entry.inventoryItemId) && Number(entry.amount) > 0)
    .map((entry) => ({
      product_id: product.id,
      inventory_item_id: String(entry.inventoryItemId),
      amount: roundTo2(Number(entry.amount)),
      unit: entry.unit,
    }));

  if (recipeRows.length === 0) return;

  await request('/rest/v1/product_recipes', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(recipeRows),
  });
};

export const deleteSupabaseProductWithRecipe = async (productId: string) => {
  if (!isConfigured) return;

  await request(`/rest/v1/product_recipes?product_id=eq.${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  await request(`/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ active: false }),
  });
};

export const syncSupabaseInventory = async (inventory: InventoryItem[]) => {
  if (!isConfigured) return;
  await upsertRows('inventory_items', inventory.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    stock: roundTo2(item.stock),
    unit: item.unit,
    reorder_level: roundTo2(item.reorderLevel),
    status: item.status,
  })), 'id');
};

export const syncSupabaseOrderCreate = async (order: Order) => {
  if (!isConfigured) return;

  await upsertRows('products', order.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    image: item.image,
    description: item.description,
    active: true,
  })), 'id');

  await upsertRows('orders', [
    {
      id: order.id,
      order_number: order.orderNumber,
      status: order.status,
      order_type: order.orderType,
      total: order.total,
      estimated_time: order.estimatedTime,
      created_at: new Date(order.createdAt).toISOString(),
      updated_at: new Date(order.createdAt).toISOString(),
    },
  ], 'id');

  const richPayload = order.items.map((item) => {
    const customization = item.customization ?? null;
    return {
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      product_category: item.category,
      quantity: item.quantity,
      unit_price: roundTo2(item.price),
      base_price: roundTo2(item.basePrice ?? item.price),
      line_total: roundTo2(item.price * item.quantity),
      sugar_level: customization?.sugarLevel ?? null,
      size_label: customization?.size ?? null,
      selected_addons: customization?.addOnIds ?? [],
      customization_json: customization,
      is_drink: isDrinkCategory(item.category),
    };
  });

  try {
    await request('/rest/v1/order_items', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(richPayload),
    });
  } catch {
    await request('/rest/v1/order_items', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(order.items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: roundTo2(item.price),
        line_total: roundTo2(item.price * item.quantity),
      }))),
    });
  }
};

export const syncSupabaseOrderStatus = async (orderId: string, status: OrderStatus) => {
  if (!isConfigured) return;
  await request('/rest/v1/rpc/set_order_status', {
    method: 'POST',
    body: JSON.stringify({ p_order_id: orderId, p_status: status }),
  });
};

export const syncSupabaseOrderDelete = async (orderId: string) => {
  if (!isConfigured) return;
  await request(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
};

export const syncSupabaseInventoryItem = async (item: InventoryItem) => {
  if (!isConfigured) return;
  await upsertRows('inventory_items', [{
    id: item.id,
    name: item.name,
    category: item.category,
    stock: roundTo2(item.stock),
    unit: item.unit,
    reorder_level: roundTo2(item.reorderLevel),
    status: item.status,
  }], 'id');
};

export const syncSupabaseInventoryAdjustment = async (input: {
  inventoryItemId: string;
  inventoryItemName: string;
  type: 'manual_adjustment' | 'recipe_deduction' | 'waste' | 'batch_add' | 'item_add' | 'item_delete';
  delta: number;
  unit: Unit;
  note: string;
}) => {
  if (!isConfigured) return;
  await request('/rest/v1/inventory_adjustments', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      inventory_item_id: input.inventoryItemId,
      inventory_item_name: input.inventoryItemName,
      type: input.type,
      delta: roundTo2(input.delta),
      unit: input.unit,
      note: input.note,
    }),
  });
};

export const syncSupabaseWasteLog = async (input: {
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: Unit;
  reason: WasteReason;
  note?: string;
}) => {
  if (!isConfigured) return;
  await request('/rest/v1/waste_logs', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      inventory_item_id: input.inventoryItemId,
      inventory_item_name: input.inventoryItemName,
      quantity: roundTo2(input.quantity),
      unit: input.unit,
      reason: input.reason,
      note: input.note,
    }),
  });
};
