import { MENU_ITEMS } from '../data';
import type { CartItem, DrinkCustomization, HistoryEvent, HistoryEventKind, InventoryItem, Order, OrderStatus, PaymentMethod, Product, Receipt, SupplierContact, SupplierRequest, SupplierRequestStatus, Unit, WasteReason } from '../store';
import { getStoredSession, isSupabaseSessionExpired, refreshSupabaseSession } from './supabaseAuth';

export type PublicOrderBoardEntry = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: 'delivery' | 'pickup';
  paymentMethod: PaymentMethod;
  total: number;
  estimatedTime: number;
  createdAt: number;
};

type SupabaseSnapshot = {
  products: Product[];
  productRecipes: Record<string, Array<{ inventoryItemId: string; inventoryName: string; amount: number; unit: Unit }>>;
  inventory: InventoryItem[];
  orders: Order[];
  receipts: Record<string, Receipt>;
  historyEvents: HistoryEvent[];
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
  supplierRequests: SupplierRequest[];
  supplierContacts: SupplierContact[];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_PRODUCT_IMAGES_BUCKET = import.meta.env.VITE_SUPABASE_PRODUCT_IMAGES_BUCKET ?? 'product-images';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const roundTo2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const deriveMonthlyRestockCap = (item: {
  stock?: number;
  reorderLevel?: number;
  reorder_level?: number;
  category?: string;
}) => {
  const stock = Number(item.stock ?? 0);
  const reorderLevel = Number(item.reorderLevel ?? item.reorder_level ?? 0);
  const category = String(item.category ?? 'Ingredients');
  const stockFactor = category === 'Materials' ? 2 : category === 'Equipment' ? 1.5 : 3;
  const minCap = category === 'Materials' ? 20 : 1;
  return roundTo2(Math.max(stock * stockFactor, reorderLevel * 8, minCap));
};

const mapInventoryRow = (row: any): InventoryItem => {
  const stock = roundTo2(Number(row.stock ?? 0));
  const reorderLevel = roundTo2(Number(row.reorderLevel ?? row.reorder_level ?? 0));
  const monthlyRestockCap = (() => {
    const capValue = row.monthlyRestockCap ?? row.monthly_restock_cap;
    if (capValue === undefined || capValue === null || capValue === '') {
      return deriveMonthlyRestockCap({ stock, reorderLevel, category: row.category });
    }
    return roundTo2(Math.max(Number(capValue), stock));
  })();

  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category,
    stock,
    unit: row.unit,
    status: row.status,
    reorderLevel,
    monthlyRestockCap,
    updatedAt: row.updatedAt ? Number(row.updatedAt) : new Date(row.updated_at ?? Date.now()).getTime(),
  };
};

const mapSupplierRequestRow = (row: any): SupplierRequest => ({
  id: String(row.id),
  itemName: String(row.item_name ?? row.itemName ?? ''),
  inventoryItemId: row.inventory_item_id ?? row.inventoryItemId ?? null,
  inventoryItemName: String(row.inventory_item_name ?? row.inventoryItemName ?? row.item_name ?? row.itemName ?? ''),
  quantity: roundTo2(Number(row.quantity ?? 0)),
  unit: row.unit ?? row.requested_unit ?? null,
  supplierEmail: String(row.supplier_email ?? row.supplierEmail ?? ''),
  status: (row.status ?? 'pending') as SupplierRequestStatus,
  createdAt: new Date(row.created_at ?? row.createdAt ?? Date.now()).getTime(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : row.updatedAt ? Number(row.updatedAt) : undefined,
  sourceUid: row.source_uid ?? row.sourceUid ?? undefined,
});

const mapSupplierContactRow = (row: any): SupplierContact => ({
  id: String(row.id),
  email: String(row.email ?? '').trim().toLowerCase(),
  displayName: String(row.display_name ?? row.displayName ?? '').trim() || undefined,
  active: Boolean(row.active ?? true),
  notes: String(row.notes ?? '').trim() || undefined,
  createdAt: new Date(row.created_at ?? row.createdAt ?? Date.now()).getTime(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : row.updatedAt ? Number(row.updatedAt) : undefined,
});

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)/g, '') || 'file';

const buildProductBarcode = (seed: string) => {
  const bytes = Array.from(seed).map((char, index) => char.charCodeAt(0) * (index + 3));
  const sum = bytes.reduce((acc, value) => acc + value, 0);
  return `29${String(sum).padStart(10, '0').slice(0, 10)}`;
};

const isDrinkCategory = (category: string) => {
  const normalized = category.trim().toLowerCase();
  return normalized.includes('beverage') || normalized.includes('coffee') || normalized.includes('tea');
};

const normalizeHistoryText = (value: string) => String(value ?? '').trim().toLowerCase();

export const classifyHistoryEvent = (event: Pick<HistoryEvent, 'domain' | 'title' | 'detail'> & { kind?: HistoryEventKind }) => {
  const title = normalizeHistoryText(event.title);
  const detail = normalizeHistoryText(event.detail);
  const haystack = `${title} ${detail}`;

  if ((event.kind as string | undefined) === 'receive') return 'stock_in';
  if ((event.kind as string | undefined) === 'movement') return 'order';
  if ((event.kind as string | undefined) === 'correction' && event.domain === 'orders') {
    if (
      haystack.includes('moved to') ||
      haystack.includes('status updated') ||
      haystack.includes('preparing') ||
      haystack.includes('ready') ||
      haystack.includes('completed') ||
      haystack.includes('pending')
    ) {
      return 'order';
    }
    if (haystack.includes('receipt generated') || title.startsWith('receipt ')) {
      return 'receipt';
    }
    return 'correction';
  }
  if ((event.kind as string | undefined) === 'correction') {
    if (
      haystack.includes('received') ||
      haystack.includes('restocked') ||
      haystack.includes('restock') ||
      haystack.includes('stock in') ||
      haystack.includes('stocked in') ||
      haystack.includes('starting stock') ||
      haystack.includes('batch')
    ) {
      return 'stock_in';
    }
    return 'correction';
  }
  if (event.kind) return event.kind;

  if (event.domain === 'orders') {
    if (title.startsWith('receipt ') || title.includes('receipt generated')) return 'receipt';
    if (title.includes('voided') || title.includes('deleted')) return 'correction';
    return 'order';
  }

  if (haystack.includes('waste') || haystack.includes('expired') || haystack.includes('spillage') || haystack.includes('damage')) {
    return 'waste';
  }

  if (haystack.includes('flagged out of stock') || haystack.includes('restocked') || haystack.includes('added') || haystack.includes('updated')) {
    return 'product';
  }

  if (haystack.includes('received') || haystack.includes('stock in') || haystack.includes('batch')) {
    return 'stock_in';
  }

  if (haystack.includes('deducted') || haystack.includes('used for') || haystack.includes('recipe usage')) {
    return 'deduction';
  }

  if (haystack.includes('adjusted') || haystack.includes('correct')) {
    return 'correction';
  }

  if (event.domain === 'inventory') return 'correction';
  if (event.domain === 'products') return 'product';
  return 'order';
};

const mapSystemHistoryRow = (row: any): HistoryEvent => ({
  id: String(row.id),
  domain: row.domain === 'inventory' ? 'inventory' : row.domain === 'products' ? 'products' : 'orders',
  kind: row.kind
    ? ((row.kind === 'receive' || row.kind === 'stock_in'
        ? 'stock_in'
        : row.kind === 'movement'
          ? 'order'
          : row.kind === 'inventory'
            ? 'correction'
            : row.kind) as HistoryEventKind)
    : undefined,
  title: String(row.title ?? ''),
  detail: String(row.detail ?? ''),
  createdAt: new Date(row.created_at ?? row.createdAt ?? Date.now()).getTime(),
});

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

  const primaryHeaders = {
    ...getHeaders(),
    ...(init.headers ?? {}),
  };

  let response = await fetch(`${SUPABASE_URL}${path}`, {
    cache: 'no-store',
    ...init,
    headers: primaryHeaders,
  });

  // If the stored bearer token is stale, retry once with anon credentials.
  if (!response.ok && (response.status === 401 || response.status === 403)) {
    const fallbackHeaders = {
      ...baseHeaders,
      ...(init.headers ?? {}),
      Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
    };

    response = await fetch(`${SUPABASE_URL}${path}`, {
      cache: 'no-store',
      ...init,
      headers: fallbackHeaders,
    });
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
};

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const isRetryableSyncError = (error: unknown) => {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return [
    'failed to fetch',
    'network',
    'timeout',
    'timed out',
    '429',
    '502',
    '503',
    '504',
    'temporar',
  ].some((token) => message.includes(token));
};

const retryWrite = async (label: string, operation: () => Promise<void>) => {
  const delays = [0, 250, 900];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await wait(delays[attempt]);
    }

    try {
      await operation();
      return true;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableSyncError(error);
      const isLast = attempt === delays.length - 1;
      if (!retryable || isLast) {
        break;
      }
    }
  }
  console.error(`[supabaseSync] ${label} failed`, lastError);
  return false;
};

const emitAppSyncSignal = (reason: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('aura-cafe-sync', { detail: { reason } }));
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
  barcode: item.barcode ?? buildProductBarcode(item.id),
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

  const missingBarcode = products.filter((item: any) => !String(item?.barcode ?? '').trim());
  if (missingBarcode.length > 0) {
    await upsertRows(
      'products',
      missingBarcode.map((item: any) => ({
        id: item.id,
        name: item.name,
        barcode: buildProductBarcode(String(item.id)),
        category: item.category,
        price: item.price,
        image: item.image,
        description: item.description,
        active: item.active ?? true,
      })),
      'id'
    );
    products = await fetchRows<Product>('products', 'select=*&active=eq.true&order=created_at.asc');
  }

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
  const inventoryAdjustmentsRaw = await fetchRows<any>('inventory_adjustments', 'select=*&order=created_at.desc');
  const wasteLogsRaw = await fetchRows<any>('waste_logs', 'select=*&order=created_at.desc');
  const systemHistoryRows = await fetchRows<any>('system_history_events', 'select=*&order=created_at.desc').catch(() => []);
  const supplierRequestsRaw = await fetchRows<any>('supplier_requests', 'select=*&order=created_at.desc').catch(() => []);
  const supplierContactsRaw = await fetchRows<any>('supplier_contacts', 'select=*&order=created_at.desc').catch(() => []);

  const inventoryAdjustments: SupabaseSnapshot['inventoryAdjustments'] = inventoryAdjustmentsRaw.map((row) => ({
    id: String(row.id),
    inventoryItemId: String(row.inventory_item_id),
    inventoryItemName: String(row.inventory_item_name ?? row.inventory_item_id ?? ''),
    type: row.type,
    delta: roundTo2(Number(row.delta ?? 0)),
    unit: row.unit,
    note: String(row.note ?? ''),
    createdAt: new Date(row.created_at).getTime(),
  }));

  const wasteLogs: SupabaseSnapshot['wasteLogs'] = wasteLogsRaw.map((row) => ({
    id: String(row.id),
    inventoryItemId: String(row.inventory_item_id),
    inventoryItemName: String(row.inventory_item_name ?? row.inventory_item_id ?? ''),
    quantity: roundTo2(Number(row.quantity ?? 0)),
    unit: row.unit,
    reason: row.reason,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  }));

  const supplierRequests: SupabaseSnapshot['supplierRequests'] = supplierRequestsRaw.map(mapSupplierRequestRow);
  const supplierContacts: SupabaseSnapshot['supplierContacts'] = supplierContactsRaw.map(mapSupplierContactRow);

  const hasLegacyProducts = products.some((item) => /^c\d+$/i.test(item.id) || /^n\d+$/i.test(item.id));
  const existingProductIds = new Set(products.map((item) => String(item.id)));
  const missingCatalogProducts = DEEP_CATALOG.filter((item) => !existingProductIds.has(String(item.id)));
  if (products.length === 0 || hasLegacyProducts || missingCatalogProducts.length > 0) {
    const seedProducts = products.length === 0 ? DEEP_CATALOG : missingCatalogProducts;
    if (seedProducts.length > 0) {
      await upsertRows('products', seedProducts.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        image: item.image,
        description: item.description,
        out_of_stock: Boolean(item.isManuallyOutOfStock),
        out_of_stock_note: item.outOfStockNote ?? null,
        active: true,
      })), 'id');

      products = await fetchRows<Product>('products', 'select=*&active=eq.true&order=created_at.asc');
    }
  }

  const hasLegacyInventory = inventory.some((item) => LEGACY_INVENTORY_IDS.has(String(item.id)));
  const existingInventoryIds = new Set(inventory.map((item) => String(item.id)));
  const missingSeedInventory = INBOX_INVENTORY.filter((item) => !existingInventoryIds.has(String(item.id)));
  if (inventory.length === 0 || hasLegacyInventory || missingSeedInventory.length > 0) {
    const seedInventory = inventory.length === 0 ? INBOX_INVENTORY : missingSeedInventory;
    if (seedInventory.length > 0) {
      await upsertRows('inventory_items', seedInventory.map((item) => ({
        ...item,
        reorder_level: item.reorderLevel,
        monthly_restock_cap: deriveMonthlyRestockCap(item),
      })), 'id');

      inventory = await fetchRows<InventoryItem>('inventory_items', 'select=*&order=created_at.asc');
    }
  }

  if (recipeRows.length === 0) {
    await upsertRows('product_recipes', DEMO_RECIPES, 'product_id,inventory_item_id');
    recipeRows = await fetchRows<any>(
      'product_recipes',
      'select=product_id,inventory_item_id,amount,unit,inventory_items(name)&order=product_id.asc'
    );
  }

  const nextProducts = (products.length > 0 && !hasLegacyProducts
    ? products
    : DEEP_CATALOG) as Product[];
  const productById = new Map(nextProducts.map((item) => [item.id, item]));
  const nextInventorySource = (inventory.length > 0 && !hasLegacyInventory)
    ? inventory
    : INBOX_INVENTORY;
  const nextInventory = nextInventorySource.map((item: any) => ({
    ...mapInventoryRow(item),
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
    barcode: item.barcode ?? buildProductBarcode(item.id),
    isManuallyOutOfStock: Boolean((item as any).isManuallyOutOfStock ?? (item as any).out_of_stock),
    outOfStockNote: String((item as any).outOfStockNote ?? (item as any).out_of_stock_note ?? '').trim() || undefined,
    ingredients: productRecipes[item.id]?.map((entry) => entry.inventoryName) ?? item.ingredients,
  }));

  const productByName = new Map(
    mergedProducts.map((item) => [String(item.name).trim().toLowerCase(), item])
  );

  const findProductByOrderItemName = (value: string) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return undefined;

    const exact = productByName.get(normalized);
    if (exact) return exact;

    const partial = mergedProducts.find((product) => {
      const productName = String(product.name).trim().toLowerCase();
      return productName.includes(normalized) || normalized.includes(productName);
    });

    return partial;
  };

  const orderItemsByOrderId = orderItemsRaw.reduce<Record<string, any[]>>((acc, item) => {
    const orderId = String(item.order_id ?? '');
    if (!orderId) return acc;
    if (!acc[orderId]) acc[orderId] = [];
    acc[orderId].push(item);
    return acc;
  }, {});

  const nextOrders: Order[] = ordersRaw.map((order) => {
    const persistedItems = orderItemsByOrderId[String(order.id)] ?? [];
    const receiptItems = Array.isArray((order.receipt_payload as any)?.items)
      ? ((order.receipt_payload as any).items as Array<{ name: string; quantity: number; unitPrice?: number; lineTotal?: number }> )
      : [];

    const mappedItems: CartItem[] = persistedItems.length > 0
      ? persistedItems.map((item) => {
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
        })
      : receiptItems.map((item, index) => {
          const catalogProduct = productByName.get(String(item.name ?? '').trim().toLowerCase());
          const quantity = Number(item.quantity ?? 0);
          const lineTotal = Number(item.lineTotal ?? 0);
          const unitPrice = Number(item.unitPrice ?? (quantity > 0 ? lineTotal / quantity : 0));
          return {
            id: catalogProduct?.id ?? `receipt-${order.id}-${index}`,
            cartItemId: `receipt-${order.id}-${index}`,
            name: String(item.name ?? catalogProduct?.name ?? 'Unknown item'),
            price: roundTo2(unitPrice),
            basePrice: roundTo2(unitPrice),
            category: catalogProduct?.category ?? 'Beverage',
            image: catalogProduct?.image ?? '',
            quantity,
            customization: undefined,
          } as CartItem;
        }).filter((item) => item.quantity > 0);

    return {
    id: order.id,
    orderNumber: order.order_number,
    items: mappedItems,
    total: Number(order.total),
    status: order.status,
    createdAt: new Date(order.created_at).getTime(),
    estimatedTime: order.estimated_time,
    orderType: order.order_type,
    paymentMethod: (order.payment_method as PaymentMethod) ?? 'ewallet',
    approvedAt: order.approved_at ? new Date(order.approved_at).getTime() : undefined,
    receiptNumber: order.receipt_number ?? undefined,
    };
  });

  const receipts: Record<string, Receipt> = {};
  ordersRaw.forEach((order) => {
    const orderItems = nextOrders.find((entry) => entry.id === order.id)?.items ?? [];
    const payload = order.receipt_payload as Receipt | null;

    if (payload?.orderId && payload?.receiptNumber) {
      receipts[order.id] = {
        ...payload,
        issuedAt: payload.issuedAt ?? (order.approved_at ? new Date(order.approved_at).getTime() : new Date(order.updated_at).getTime()),
      };
      return;
    }

    if (!order.receipt_number) return;

    const subtotal = roundTo2(orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0));
    receipts[order.id] = {
      orderId: order.id,
      orderNumber: order.order_number,
      receiptNumber: String(order.receipt_number),
      orderType: order.order_type,
      paymentMethod: (order.payment_method as PaymentMethod) ?? 'ewallet',
      issuedAt: order.approved_at ? new Date(order.approved_at).getTime() : new Date(order.updated_at).getTime(),
      items: orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: roundTo2(Number(item.price)),
        lineTotal: roundTo2(Number(item.price) * item.quantity),
      })),
      subtotal,
      total: roundTo2(Number(order.total ?? subtotal)),
    };
  });

  const existingRecipeDeductionCounts = inventoryAdjustments
    .filter((adj) => adj.type === 'recipe_deduction')
    .reduce<Record<string, number>>((acc, adj) => {
      const key = `${adj.inventoryItemId}|${adj.note}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  const derivedInventoryEvents: HistoryEvent[] = [];
  nextOrders.forEach((order) => {
    if (order.status === 'pending') return;
    order.items.forEach((item, itemIndex) => {
      const matchedProduct = findProductByOrderItemName(item.name);
      const recipeProductId = productRecipes[item.id] ? item.id : matchedProduct?.id;
      const recipe = recipeProductId ? productRecipes[recipeProductId] ?? [] : [];
      const deductionNote = `Used for ${item.name} (${item.quantity}x)`;
      recipe.forEach((ingredient, ingredientIndex) => {
        const key = `${ingredient.inventoryItemId}|${deductionNote}`;
        if ((existingRecipeDeductionCounts[key] ?? 0) > 0) {
          existingRecipeDeductionCounts[key] -= 1;
          return;
        }

        derivedInventoryEvents.push({
          id: `derived-inventory-${order.id}-${itemIndex}-${ingredientIndex}`,
          domain: 'inventory',
          kind: 'deduction',
          title: `${ingredient.inventoryName} deducted`,
          detail: `${roundTo2(ingredient.amount * item.quantity).toFixed(2)} ${ingredient.unit} derived from ${item.name} (${item.quantity}x)`,
          createdAt: order.approvedAt ?? order.createdAt,
        });
      });
    });
  });

  const systemHistoryEvents = systemHistoryRows.map(mapSystemHistoryRow);

  const historyEvents: HistoryEvent[] = [
    ...systemHistoryEvents,
    ...nextOrders.map((order) => ({
      id: `remote-order-${order.id}`,
      domain: 'orders' as const,
      kind: 'order' as const,
      title: `Order ${order.orderNumber} ${order.status}`,
      detail: `${order.items.length} item(s) • P ${roundTo2(order.total).toFixed(2)}`,
      createdAt: order.createdAt,
    })),
    ...Object.values(receipts).map((receipt) => ({
      id: `remote-receipt-${receipt.orderId}`,
      domain: 'orders' as const,
      kind: 'receipt' as const,
      title: `Receipt ${receipt.receiptNumber}`,
      detail: `Order #${receipt.orderNumber} • P ${receipt.total.toFixed(2)}`,
      createdAt: receipt.issuedAt,
    })),
    ...nextOrders.flatMap((order, orderIndex) =>
      order.items.map((item, itemIndex) => ({
        id: `remote-order-item-${order.id}-${orderIndex}-${itemIndex}`,
        domain: 'products' as const,
        kind: 'product' as const,
        title: `${item.name} sold`,
        detail: `${item.quantity}x ${item.name} in order #${order.orderNumber}`,
        createdAt: order.createdAt,
      }))
    ),
    ...inventoryAdjustments.map((adj) => ({
      id: `remote-adjustment-${adj.id}`,
      domain: 'inventory' as const,
      kind: adj.type === 'recipe_deduction'
        ? 'deduction' as const
        : adj.type === 'manual_adjustment'
          ? 'correction' as const
          : adj.type === 'waste'
            ? 'waste' as const
            : adj.type === 'item_add' || adj.type === 'batch_add'
              ? 'stock_in' as const
              : 'inventory' as const,
      title: `${adj.inventoryItemName} ${adj.delta < 0 ? 'deducted' : 'updated'}`,
      detail: `${adj.note} • ${adj.delta > 0 ? '+' : ''}${adj.delta.toFixed(2)} ${adj.unit}`,
      createdAt: adj.createdAt,
    })),
    ...derivedInventoryEvents,
    ...wasteLogs.map((log) => ({
      id: `remote-waste-${log.id}`,
      domain: 'inventory' as const,
      kind: 'waste' as const,
      title: `Waste logged for ${log.inventoryItemName}`,
      detail: `${log.quantity.toFixed(2)} ${log.unit} • ${log.reason}${log.note ? ` • ${log.note}` : ''}`,
      createdAt: log.createdAt,
    })),
  ]
    .filter((event, index, list) => list.findIndex((entry) => entry.id === event.id) === index)
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    products: mergedProducts,
    productRecipes,
    inventory: nextInventory,
    orders: nextOrders,
    receipts,
    historyEvents,
    inventoryAdjustments,
    wasteLogs,
    supplierRequests,
    supplierContacts,
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
    barcode: item.barcode ?? buildProductBarcode(item.id),
    description: item.description,
    out_of_stock: Boolean(item.isManuallyOutOfStock),
    out_of_stock_note: item.outOfStockNote ?? null,
    active: true,
  })), 'id');
};

export const syncSupabaseProductWithRecipe = async (
  product: Product,
  recipe: Array<{ inventoryItemId?: string; inventoryName: string; amount: number; unit: Unit }>
) => {
  if (!isConfigured) return;

  const productId = String(product.id ?? '').trim();
  if (!productId) return;

  const inventoryRows = await fetchRows<{ id: string; name: string }>('inventory_items', 'select=id,name');
  const inventoryIdSet = new Set(inventoryRows.map((row) => String(row.id)));
  const inventoryIdByName = new Map(
    inventoryRows.map((row) => [String(row.name).trim().toLowerCase(), String(row.id)])
  );

  await upsertRows('products', [
    {
      id: productId,
      name: product.name,
      category: product.category,
      price: product.price,
      image: product.image,
      barcode: product.barcode ?? buildProductBarcode(productId),
      description: product.description,
      out_of_stock: Boolean(product.isManuallyOutOfStock),
      out_of_stock_note: product.outOfStockNote ?? null,
      active: true,
    },
  ], 'id');

  await request(`/rest/v1/product_recipes?product_id=eq.${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  const recipeRows = recipe
    .map((entry) => {
      const candidateId = String(entry.inventoryItemId ?? '').trim();
      const resolvedInventoryId = inventoryIdSet.has(candidateId)
        ? candidateId
        : inventoryIdByName.get(String(entry.inventoryName ?? '').trim().toLowerCase());

      if (!resolvedInventoryId || Number(entry.amount) <= 0) return null;

      return {
        product_id: productId,
        inventory_item_id: resolvedInventoryId,
        amount: roundTo2(Number(entry.amount)),
        unit: entry.unit,
      };
    })
    .filter(
      (entry): entry is { product_id: string; inventory_item_id: string; amount: number; unit: Unit } => Boolean(entry)
    );

  if (recipeRows.length === 0) return;

  await request('/rest/v1/product_recipes', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(recipeRows),
  });

  emitAppSyncSignal('product-recipe');
};

export const syncSupabaseHistoryEvents = async (events: HistoryEvent[]) => {
  if (!isConfigured || events.length === 0) return false;

  try {
    await upsertRows('system_history_events', events.map((event) => ({
      id: event.id,
      domain: event.domain,
      kind: classifyHistoryEvent(event),
      title: event.title,
      detail: event.detail,
      created_at: new Date(event.createdAt).toISOString(),
    })), 'id');

    emitAppSyncSignal('history-event');
    return true;
  } catch (error) {
    console.warn('[supabaseSync] history-event sync skipped', error);
    return false;
  }
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
    updated_at: new Date(item.updatedAt).toISOString(),
    monthly_restock_cap:
      roundTo2(Math.max(item.monthlyRestockCap > 0 ? item.monthlyRestockCap : deriveMonthlyRestockCap(item), item.stock)),
  })), 'id');

  emitAppSyncSignal('inventory-bulk');
};

export const syncSupabaseOrderCreate = async (order: Order) => {
  if (!isConfigured) return;

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

  const rpcSuccess = await retryWrite(`create_order_with_items(${order.id})`, async () => {
    await request('/rest/v1/rpc/create_order_with_items', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        p_order_id: order.id,
        p_order_number: order.orderNumber,
        p_order_type: order.orderType,
        p_total: order.total,
        p_estimated_time: order.estimatedTime,
        p_items: richPayload,
        p_payment_method: order.paymentMethod,
      }),
    });
  });

  if (rpcSuccess) {
    emitAppSyncSignal('order-create');
    return;
  }

  await retryWrite(`order_fallback_upsert(${order.id})`, async () => {
    await upsertRows('orders', [
      {
        id: order.id,
        order_number: order.orderNumber,
        status: order.status,
        order_type: order.orderType,
        payment_method: order.paymentMethod,
        total: order.total,
        estimated_time: order.estimatedTime,
        approved_at: order.approvedAt ? new Date(order.approvedAt).toISOString() : null,
        receipt_number: order.receiptNumber ?? null,
        receipt_payload: null,
        created_at: new Date(order.createdAt).toISOString(),
        updated_at: new Date(order.createdAt).toISOString(),
      },
    ], 'id');

    await request(`/rest/v1/order_items?order_id=eq.${encodeURIComponent(order.id)}`, {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    });

    if (richPayload.length === 0) return;

    await request('/rest/v1/order_items', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(richPayload),
    });
  });

  emitAppSyncSignal('order-create');
};

export const syncSupabaseOrderStatus = async (orderId: string, status: OrderStatus) => {
  if (!isConfigured) return;
  await retryWrite(`set_order_status(${orderId},${status})`, async () => {
    await request('/rest/v1/rpc/set_order_status', {
      method: 'POST',
      body: JSON.stringify({ p_order_id: orderId, p_status: status }),
    });
  });

  emitAppSyncSignal('order-status');
};

export const fetchPublicOrderBoard = async (): Promise<PublicOrderBoardEntry[] | null> => {
  if (!isConfigured) return null;

  const rows = await request<Array<{
    id: string;
    order_number: string;
    status: OrderStatus;
    order_type: 'delivery' | 'pickup';
    payment_method: PaymentMethod;
    total: number;
    estimated_time: number;
    created_at: string;
  }>>(
    '/rest/v1/orders?select=id,order_number,status,order_type,payment_method,total,estimated_time,created_at&order=created_at.desc',
    { method: 'GET' }
  );

  if (!rows) return null;

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    orderType: row.order_type,
    paymentMethod: row.payment_method,
    total: roundTo2(Number(row.total ?? 0)),
    estimatedTime: Number(row.estimated_time ?? 0),
    createdAt: new Date(row.created_at).getTime(),
  }));
};

export const fetchPublicCatalog = async (): Promise<Product[] | null> => {
  if (!isConfigured) return null;

  const rows = await request<Array<{
    id: string;
    name: string;
    barcode: string | null;
    category: string;
    price: number;
    image: string | null;
    description: string | null;
    out_of_stock: boolean | null;
    out_of_stock_note: string | null;
    active: boolean;
  }>>(
    '/rest/v1/products?select=id,name,barcode,category,price,image,description,out_of_stock,out_of_stock_note,active&active=eq.true&order=created_at.asc',
    { method: 'GET' }
  );

  if (!rows) return null;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    barcode: row.barcode ?? buildProductBarcode(row.id),
    category: row.category,
    price: roundTo2(Number(row.price ?? 0)),
    image: row.image ?? '',
    description: row.description ?? undefined,
    isManuallyOutOfStock: Boolean(row.out_of_stock),
    outOfStockNote: row.out_of_stock_note ?? undefined,
  }));
};

export const fetchSupabaseProductById = async (productId: string): Promise<{
  id: string;
  image: string | null;
  description: string | null;
  updatedAt: number | null;
} | null> => {
  if (!isConfigured) return null;

  const rows = await request<Array<{
    id: string;
    image: string | null;
    description: string | null;
    updated_at: string | null;
  }>>(
    `/rest/v1/products?select=id,image,description,updated_at&id=eq.${encodeURIComponent(productId)}&limit=1`,
    { method: 'GET' }
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    id: row.id,
    image: row.image,
    description: row.description,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  };
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

export const uploadSupabaseProductImage = async (file: File, productHint?: string): Promise<string> => {
  if (!isConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured.');
  }

  let session = getStoredSession();
  if (!session?.access_token) {
    throw new Error('Please sign in as staff before uploading images.');
  }

  if (isSupabaseSessionExpired(session)) {
    const refreshed = await refreshSupabaseSession();
    if (refreshed?.access_token) {
      session = refreshed;
    }
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }

  const productSegment = sanitizePathSegment(productHint ?? 'product');
  const originalName = sanitizePathSegment(file.name.replace(/\s+/g, '-'));
  const objectPath = `products/${productSegment}/${Date.now()}-${originalName}`;
  const encodedObjectPath = objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');

  const upload = async (accessToken: string) => fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_PRODUCT_IMAGES_BUCKET}/${encodedObjectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'x-upsert': 'true',
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  let response = await upload(session.access_token);

  if (!response.ok && (response.status === 401 || response.status === 403)) {
    const errorText = await response.text();
    if (/exp.*claim.*timestamp check failed|Unauthorized/i.test(errorText)) {
      const refreshed = await refreshSupabaseSession();
      if (refreshed?.access_token) {
        session = refreshed;
        response = await upload(refreshed.access_token);
      }
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404 && /Bucket not found/i.test(errorText)) {
      throw new Error(
        `Storage bucket "${SUPABASE_PRODUCT_IMAGES_BUCKET}" was not found. Create it in Supabase Storage and allow authenticated uploads.`
      );
    }
    throw new Error(errorText);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_PRODUCT_IMAGES_BUCKET}/${objectPath}`;
};

export const syncSupabaseOrderReceipt = async (orderId: string, receipt: Receipt) => {
  if (!isConfigured) return;
  await retryWrite(`order_receipt_patch(${orderId})`, async () => {
    await request(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        approved_at: new Date(receipt.issuedAt).toISOString(),
        receipt_number: receipt.receiptNumber,
        receipt_payload: receipt,
      }),
    });
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
    updated_at: new Date(item.updatedAt).toISOString(),
    monthly_restock_cap:
      roundTo2(Math.max(item.monthlyRestockCap > 0 ? item.monthlyRestockCap : deriveMonthlyRestockCap(item), item.stock)),
  }], 'id');

  emitAppSyncSignal('inventory-item');
};

export const deleteSupabaseInventoryItem = async (inventoryItemId: string) => {
  if (!isConfigured) return;

  await request(`/rest/v1/product_recipes?inventory_item_id=eq.${encodeURIComponent(inventoryItemId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  await request(`/rest/v1/add_on_inventory_usage?inventory_item_id=eq.${encodeURIComponent(inventoryItemId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  await request(`/rest/v1/inventory_adjustments?inventory_item_id=eq.${encodeURIComponent(inventoryItemId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  await request(`/rest/v1/waste_logs?inventory_item_id=eq.${encodeURIComponent(inventoryItemId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  await request(`/rest/v1/inventory_items?id=eq.${encodeURIComponent(inventoryItemId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
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

  emitAppSyncSignal('inventory-waste');
};

export const syncSupabaseSupplierRequestStatus = async (requestId: string, status: SupplierRequestStatus) => {
  if (!isConfigured) return;

  await request(`/rest/v1/supplier_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString(),
    }),
  });

  emitAppSyncSignal('supplier-request');
};

export const syncSupabaseSupplierContactUpsert = async (contact: Pick<SupplierContact, 'id' | 'email' | 'displayName' | 'active' | 'notes'>) => {
  if (!isConfigured) return;

  await upsertRows('supplier_contacts', [{
      id: contact.id,
      email: contact.email,
      display_name: contact.displayName ?? null,
      active: contact.active,
      notes: contact.notes ?? null,
      updated_at: new Date().toISOString(),
    }], 'email');

  emitAppSyncSignal('supplier-contact');
};

export const syncSupabaseSupplierContactDelete = async (contactId: string) => {
  if (!isConfigured) return;

  await request(`/rest/v1/supplier_contacts?id=eq.${encodeURIComponent(contactId)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  emitAppSyncSignal('supplier-contact');
};

// === ANALYTICS HELPERS ===

export type DailySalesToday = {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
};

export type BestSellerProduct = {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
};

export type SlowMoverProduct = {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
};

export type StockUsageData = {
  inventoryItemId: string;
  inventoryItemName: string;
  totalDeductions: number;
  unit: Unit;
  avgDailyUsage: number;
  daysUntilEmpty: number | null;
};

export type DailyInventorySnapshot = {
  date: string;
  inventoryItemId: string;
  inventoryItemName: string;
  stockLevel: number;
  unit: Unit;
};

export type DailyRevenuePoint = {
  hour: number;
  label: string;
  revenue: number;
  orders: number;
};

export type DailyAnalyticsDetail = {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  revenueByHour: DailyRevenuePoint[];
  bestSellers: BestSellerProduct[];
};

export type ShiftSessionSummary = {
  id: string;
  openedBy: string | null;
  openedByName: string | null;
  openedByRole: string | null;
  openedAt: string;
  openingCash: number;
  expectedCash: number | null;
  countedCash: number | null;
  variance: number | null;
  closedBy: string | null;
  closedByName: string | null;
  closedAt: string | null;
  status: string;
  notes: string | null;
};

export type PaymentReconciliationReportSummary = {
  id: string;
  reportDate: string;
  cashSales: number;
  cashReceived: number;
  cashChange: number;
  ewalletSales: number;
  variance: number;
  note: string | null;
};

export type RefundAuditLogSummary = {
  id: string;
  orderId: string | null;
  orderNumber: string;
  amount: number;
  reason: string;
  processedBy: string | null;
  processedByName: string | null;
  note: string | null;
  createdAt: string;
};

const getLocalDayRange = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
};

const formatHourLabel = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
};

export const fetchDailyAnalyticsForDate = async (dateValue: string): Promise<DailyAnalyticsDetail> => {
  const { start, end } = getLocalDayRange(dateValue);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const ordersRaw = await fetchRows<any>(
    'orders',
    `select=id,order_number,total,created_at&created_at=gte.${encodeURIComponent(startIso)}&created_at=lt.${encodeURIComponent(endIso)}&order=created_at.asc`
  );

  const orderItemsRaw = ordersRaw.length > 0
    ? await fetchRows<any>(
        'order_items',
        `select=order_id,product_id,product_name,quantity,unit_price,created_at&order_id=in.(${ordersRaw
          .map((order) => `"${String(order.id).replace(/"/g, '\\"')}"`)
          .join(',')})`
      )
    : [];

  const revenueByHour = new Map<number, DailyRevenuePoint>(
    Array.from({ length: 24 }, (_, hour) => [hour, { hour, label: formatHourLabel(hour), revenue: 0, orders: 0 }])
  );

  let totalRevenue = 0;
  ordersRaw.forEach((order) => {
    const createdAt = new Date(order.created_at);
    const hour = createdAt.getHours();
    const current = revenueByHour.get(hour);
    if (current) {
      current.revenue = roundTo2(current.revenue + Number(order.total ?? 0));
      current.orders += 1;
    }
    totalRevenue += Number(order.total ?? 0);
  });

  const salesByProduct: Record<string, { name: string; quantity: number; revenue: number }> = {};
  orderItemsRaw.forEach((item) => {
    const productId = String(item.product_id);
    if (!salesByProduct[productId]) {
      salesByProduct[productId] = { name: String(item.product_name ?? productId), quantity: 0, revenue: 0 };
    }
    salesByProduct[productId].quantity += Number(item.quantity ?? 0);
    salesByProduct[productId].revenue += Number(item.unit_price ?? 0) * Number(item.quantity ?? 0);
  });

  const bestSellers = Object.entries(salesByProduct)
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantitySold: data.quantity,
      totalRevenue: roundTo2(data.revenue),
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold || b.totalRevenue - a.totalRevenue)
    .slice(0, 7);

  return {
    date: dateValue,
    totalOrders: ordersRaw.length,
    totalRevenue: roundTo2(totalRevenue),
    avgOrderValue: ordersRaw.length > 0 ? roundTo2(totalRevenue / ordersRaw.length) : 0,
    revenueByHour: Array.from(revenueByHour.values()),
    bestSellers,
  };
};

// Fetch daily sales summary for last 7 days
export const fetchDailySalesSummary = async (): Promise<DailySalesToday[]> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let ordersRaw = await fetchRows<any>(
    'orders',
    `select=*&created_at=gte.${encodeURIComponent(sevenDaysAgo)}&order=created_at.desc`
  );

  // Fallback for older but existing history in database.
  if (ordersRaw.length === 0) {
    ordersRaw = await fetchRows<any>('orders', 'select=*&order=created_at.desc&limit=500');
  }

  const salesByDate: Record<string, { count: number; revenue: number }> = {};

  ordersRaw.forEach((order) => {
    const dateStr = new Date(order.created_at).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    if (!salesByDate[dateStr]) {
      salesByDate[dateStr] = { count: 0, revenue: 0 };
    }
    salesByDate[dateStr].count += 1;
    salesByDate[dateStr].revenue += Number(order.total ?? 0);
  });

  return Object.entries(salesByDate)
    .map(([date, data]) => ({
      date,
      totalOrders: data.count,
      totalRevenue: roundTo2(data.revenue),
      avgOrderValue: roundTo2(data.revenue / data.count),
    }))
    .slice(0, 14);
};

// Fetch best selling products (last 7 days)
export const fetchBestSellers = async (): Promise<BestSellerProduct[]> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let ordersRaw = await fetchRows<any>(
    'orders',
    `select=*&created_at=gte.${encodeURIComponent(sevenDaysAgo)}&order=created_at.desc`
  );

  if (ordersRaw.length === 0) {
    ordersRaw = await fetchRows<any>('orders', 'select=*&order=created_at.desc&limit=500');
  }

  const orderItemsRaw = await fetchRows<any>('order_items', 'select=*&order=created_at.asc');

  const salesByProduct: Record<string, { name: string; quantity: number; revenue: number }> = {};

  ordersRaw.forEach((order) => {
    orderItemsRaw
      .filter((item) => item.order_id === order.id)
      .forEach((item) => {
        const productId = item.product_id;
        if (!salesByProduct[productId]) {
          salesByProduct[productId] = { name: item.product_name, quantity: 0, revenue: 0 };
        }
        salesByProduct[productId].quantity += item.quantity;
        salesByProduct[productId].revenue += Number(item.unit_price ?? 0) * item.quantity;
      });
  });

  return Object.entries(salesByProduct)
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantitySold: data.quantity,
      totalRevenue: roundTo2(data.revenue),
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 7);
};

// Fetch slow moving products (lowest sales in last 30 days)
export const fetchSlowMovers = async (): Promise<SlowMoverProduct[]> => {
  const products = await fetchRows<Product>('products', 'select=*&active=eq.true');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ordersRaw = await fetchRows<any>(
    'orders',
    `select=*&created_at=gte.${encodeURIComponent(thirtyDaysAgo)}&order=created_at.desc`
  );
  const orderItemsRaw = await fetchRows<any>('order_items', 'select=*&order=created_at.asc');

  const salesByProduct: Record<string, { name: string; quantity: number; revenue: number }> = {};

  products.forEach((product) => {
    salesByProduct[product.id] = { name: product.name, quantity: 0, revenue: 0 };
  });

  ordersRaw.forEach((order) => {
    orderItemsRaw
      .filter((item) => item.order_id === order.id)
      .forEach((item) => {
        const productId = item.product_id;
        if (salesByProduct[productId]) {
          salesByProduct[productId].quantity += item.quantity;
          salesByProduct[productId].revenue += Number(item.unit_price ?? 0) * item.quantity;
        }
      });
  });

  return Object.entries(salesByProduct)
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantitySold: data.quantity,
      totalRevenue: roundTo2(data.revenue),
    }))
    .sort((a, b) => a.quantitySold - b.quantitySold)
    .slice(0, 5);
};

// Fetch stock usage data
export const fetchStockUsageData = async (): Promise<StockUsageData[]> => {
  const inventory = await fetchRows<InventoryItem>('inventory_items', 'select=*');

  const usageWindowDays = 7;
  const usageWindowMs = usageWindowDays * 24 * 60 * 60 * 1000;

  const unitToBase: Record<Unit, number> = {
    g: 1,
    kg: 1000,
    ml: 1,
    L: 1000,
    pcs: 1,
    units: 1,
    bottles: 1,
  };

  const unitGroup: Record<Unit, 'mass' | 'volume' | 'count'> = {
    g: 'mass',
    kg: 'mass',
    ml: 'volume',
    L: 'volume',
    pcs: 'count',
    units: 'count',
    bottles: 'count',
  };

  const convertUnitAmount = (amount: number, from: Unit, to: Unit) => {
    if (unitGroup[from] !== unitGroup[to]) return amount;
    return roundTo2((amount * unitToBase[from]) / unitToBase[to]);
  };

  // Derive ingredient usage directly from order items + product recipes for the last 7 days.
  const sinceIso = new Date(Date.now() - usageWindowMs).toISOString();
  const recentOrders = await fetchRows<any>(
    'orders',
    `select=id,created_at&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc`
  );
  const recentOrderIds = new Set(recentOrders.map((order) => String(order.id)));
  const allOrderItems = await fetchRows<any>('order_items', 'select=order_id,product_id,quantity,customization_json');
  const recentOrderItems = allOrderItems.filter((item) => recentOrderIds.has(String(item.order_id)));
  const recipeRows = await fetchRows<any>('product_recipes', 'select=product_id,inventory_item_id,amount,unit');
  const addOnUsageRows = await fetchRows<any>('add_on_inventory_usage', 'select=add_on_id,inventory_item_id,amount,unit');

  const inventoryUnitById = new Map(inventory.map((item) => [item.id, item.unit]));
  const fallbackDeductions = new Map<string, number>();

  recentOrderItems.forEach((item) => {
    const quantity = Number(item.quantity ?? 0);
    if (quantity <= 0) return;

    const customization = item.customization_json && typeof item.customization_json === 'object'
      ? item.customization_json
      : null;
    const sugarLevelRaw = Number(customization?.sugarLevel ?? 100);
    const sugarScale = Math.max(0, Math.min(1, (Number.isNaN(sugarLevelRaw) ? 100 : sugarLevelRaw) / 100));

    recipeRows
      .filter((recipe) => String(recipe.product_id) === String(item.product_id))
      .forEach((recipe) => {
        const inventoryItemId = String(recipe.inventory_item_id);
        const inventoryUnit = inventoryUnitById.get(inventoryItemId);
        if (!inventoryUnit) return;

        let baseAmount = Number(recipe.amount ?? 0);
        if (inventoryItemId === 'ing-white-sugar') {
          baseAmount = roundTo2(baseAmount * sugarScale);
        }

        const converted = convertUnitAmount(baseAmount * quantity, recipe.unit as Unit, inventoryUnit);
        fallbackDeductions.set(inventoryItemId, roundTo2((fallbackDeductions.get(inventoryItemId) ?? 0) + converted));
      });

    const addOnIds = Array.isArray(customization?.addOnIds)
      ? customization.addOnIds.map((entry: unknown) => String(entry))
      : [];

    addOnIds.forEach((addOnId) => {
      addOnUsageRows
        .filter((usage) => String(usage.add_on_id) === addOnId)
        .forEach((usage) => {
          const inventoryItemId = String(usage.inventory_item_id);
          const inventoryUnit = inventoryUnitById.get(inventoryItemId);
          if (!inventoryUnit) return;

          const converted = convertUnitAmount(
            Number(usage.amount ?? 0) * quantity,
            usage.unit as Unit,
            inventoryUnit
          );
          fallbackDeductions.set(inventoryItemId, roundTo2((fallbackDeductions.get(inventoryItemId) ?? 0) + converted));
        });
    });
  });

  return inventory.map((item) => {
    const fallbackUsage = fallbackDeductions.get(item.id) ?? 0;
    const totalDeductions = fallbackUsage;
    const avgDailyUsage = totalDeductions / usageWindowDays;
    const currentStock = item.stock;
    const daysUntilEmpty = avgDailyUsage > 0 ? Math.round(currentStock / avgDailyUsage) : null;

    return {
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      totalDeductions: roundTo2(totalDeductions),
      unit: item.unit,
      avgDailyUsage: roundTo2(avgDailyUsage),
      daysUntilEmpty,
    };
  });
};

export const fetchShiftSessions = async (): Promise<ShiftSessionSummary[]> => {
  const rows = await fetchRows<any>('shift_sessions', 'select=*&order=opened_at.desc&limit=10');
  return rows.map((row) => ({
    id: String(row.id),
    openedBy: row.opened_by ?? null,
    openedByName: row.opened_by_name ?? null,
    openedByRole: row.opened_by_role ?? null,
    openedAt: String(row.opened_at ?? row.created_at ?? new Date().toISOString()),
    openingCash: roundTo2(Number(row.opening_cash ?? 0)),
    expectedCash: row.expected_cash == null ? null : roundTo2(Number(row.expected_cash)),
    countedCash: row.counted_cash == null ? null : roundTo2(Number(row.counted_cash)),
    variance: row.variance == null ? null : roundTo2(Number(row.variance)),
    closedBy: row.closed_by ?? null,
    closedByName: row.closed_by_name ?? null,
    closedAt: row.closed_at ?? null,
    status: String(row.status ?? 'open'),
    notes: row.notes ?? null,
  }));
};

export const fetchPaymentReconciliationReports = async (): Promise<PaymentReconciliationReportSummary[]> => {
  const rows = await fetchRows<any>('payment_reconciliation_reports', 'select=*&order=report_date.desc&limit=10');
  return rows.map((row) => ({
    id: String(row.id),
    reportDate: String(row.report_date),
    cashSales: roundTo2(Number(row.cash_sales ?? 0)),
    cashReceived: roundTo2(Number(row.cash_received ?? 0)),
    cashChange: roundTo2(Number(row.cash_change ?? 0)),
    ewalletSales: roundTo2(Number(row.ewallet_sales ?? 0)),
    variance: roundTo2(Number(row.variance ?? 0)),
    note: row.note ?? null,
  }));
};

export const fetchRefundAuditLogs = async (): Promise<RefundAuditLogSummary[]> => {
  const rows = await fetchRows<any>('refund_audit_logs', 'select=*&order=created_at.desc&limit=10');
  return rows.map((row) => ({
    id: String(row.id),
    orderId: row.order_id ?? null,
    orderNumber: String(row.order_number ?? ''),
    amount: roundTo2(Number(row.amount ?? 0)),
    reason: String(row.reason ?? ''),
    processedBy: row.processed_by ?? null,
    processedByName: row.processed_by_name ?? null,
    note: row.note ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));
};

// Save daily inventory snapshot
export const saveDailyInventorySnapshot = async () => {
  if (!isConfigured) return;

  const inventory = await fetchRows<InventoryItem>('inventory_items', 'select=*');
  const today = new Date().toISOString().split('T')[0];

  const snapshots = inventory.map((item) => ({
    date: today,
    inventory_item_id: item.id,
    inventory_item_name: item.name,
    stock_level: roundTo2(item.stock),
    unit: item.unit,
  }));

  await request('/rest/v1/daily_inventory_snapshots', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(snapshots),
  });
};

// Fetch daily inventory snapshots comparison (yesterday vs today)
export const fetchDailyInventoryComparison = async (): Promise<{
  today: DailyInventorySnapshot[];
  yesterday: DailyInventorySnapshot[];
}> => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todaySnapshots = await fetchRows<any>(
    'daily_inventory_snapshots',
    `select=*&date=eq.${today}&order=inventory_item_name.asc`
  );
  const yesterdaySnapshots = await fetchRows<any>(
    'daily_inventory_snapshots',
    `select=*&date=eq.${yesterday}&order=inventory_item_name.asc`
  );

  return {
    today: todaySnapshots.map((s) => ({
      date: s.date,
      inventoryItemId: s.inventory_item_id,
      inventoryItemName: s.inventory_item_name,
      stockLevel: Number(s.stock_level),
      unit: s.unit,
    })),
    yesterday: yesterdaySnapshots.map((s) => ({
      date: s.date,
      inventoryItemId: s.inventory_item_id,
      inventoryItemName: s.inventory_item_name,
      stockLevel: Number(s.stock_level),
      unit: s.unit,
    })),
  };
};
