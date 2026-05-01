import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MENU_ITEMS } from './data';
import {
  deleteSupabaseInventoryItem,
  deleteSupabaseProductWithRecipe,
  syncSupabaseInventoryAdjustment,
  syncSupabaseInventoryItem,
  syncSupabaseOrderCreate,
  syncSupabaseOrderDelete,
  syncSupabaseOrderReceipt,
  syncSupabaseOrderStatus,
  syncSupabaseProductWithRecipe,
  syncSupabaseSupplierContactDelete,
  syncSupabaseSupplierContactUpsert,
  syncSupabaseSupplierRequestStatus,
  syncSupabaseWasteLog,
} from './lib/supabaseSync';
import { getStoredAuthRole } from './lib/supabaseAuth';

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  barcode?: string;
  description?: string;
  ingredients?: string[];
  isManuallyOutOfStock?: boolean;
  outOfStockNote?: string;
};

export type SugarLevel = 0 | 25 | 75 | 100;
export type DrinkSize = 'small' | 'medium' | 'large';

export type AddOn = {
  id: string;
  name: string;
  description: string;
  price: number;
  inventoryItemName: string;
  amount: number;
  unit: Unit;
};

export type DrinkCustomization = {
  size: DrinkSize;
  sugarLevel: SugarLevel;
  addOnIds: string[];
};

export const SUGAR_LEVEL_OPTIONS: SugarLevel[] = [0, 25, 75, 100];

export const DRINK_ADD_ONS: AddOn[] = [
  { id: 'addon-vanilla-syrup', name: 'Vanilla syrup', description: 'Smooth and classic', price: 20, inventoryItemName: 'Vanilla syrup', amount: 10, unit: 'ml' },
  { id: 'addon-caramel-drizzle', name: 'Caramel drizzle', description: 'Sweet with slight burnt sugar notes', price: 25, inventoryItemName: 'Caramel drizzle', amount: 10, unit: 'ml' },
  { id: 'addon-hazelnut-syrup', name: 'Hazelnut syrup', description: 'Nutty and aromatic', price: 25, inventoryItemName: 'Hazelnut syrup', amount: 10, unit: 'ml' },
  { id: 'addon-brown-sugar-syrup', name: 'Brown sugar syrup', description: 'Richer, milk tea style', price: 20, inventoryItemName: 'Brown sugar syrup', amount: 12, unit: 'ml' },
  { id: 'addon-chocolate-syrup', name: 'Chocolate syrup', description: 'For mocha style drinks', price: 20, inventoryItemName: 'Chocolate syrup', amount: 12, unit: 'ml' },
  { id: 'addon-oat-milk', name: 'Oat milk', description: 'Creamy but light', price: 35, inventoryItemName: 'Oat milk', amount: 120, unit: 'ml' },
  { id: 'addon-almond-milk', name: 'Almond milk', description: 'Slightly nutty and less heavy', price: 35, inventoryItemName: 'Almond milk', amount: 120, unit: 'ml' },
  { id: 'addon-coconut-milk', name: 'Coconut milk', description: 'Tropical twist', price: 30, inventoryItemName: 'Coconut milk', amount: 120, unit: 'ml' },
  { id: 'addon-whipped-cream', name: 'Whipped cream', description: 'Extra indulgent', price: 25, inventoryItemName: 'Whipped cream', amount: 25, unit: 'ml' },
  { id: 'addon-extra-espresso', name: 'Extra espresso shot', description: 'More kick', price: 35, inventoryItemName: 'Coffee beans (espresso roast)', amount: 9, unit: 'g' },
  { id: 'addon-cinnamon', name: 'Cinnamon powder', description: 'Warm and lightly spicy', price: 15, inventoryItemName: 'Cinnamon powder', amount: 1, unit: 'g' },
  { id: 'addon-sea-salt-foam', name: 'Sea salt foam', description: 'Sweet and salty combo', price: 35, inventoryItemName: 'Sea salt foam', amount: 30, unit: 'ml' },
  { id: 'addon-matcha-shot', name: 'Matcha shot', description: 'Coffee + tea twist', price: 40, inventoryItemName: 'Matcha powder', amount: 3, unit: 'g' },
  { id: 'addon-cold-foam', name: 'Cold foam', description: 'Light frothy topping', price: 30, inventoryItemName: 'Cold foam', amount: 30, unit: 'ml' },
  { id: 'addon-honey', name: 'Honey', description: 'Natural sweetness', price: 20, inventoryItemName: 'Honey', amount: 10, unit: 'ml' },
  { id: 'addon-orange', name: 'Orange zest or juice', description: 'Bright citrus coffee pairing', price: 25, inventoryItemName: 'Orange concentrate', amount: 15, unit: 'ml' },
];

export type CartItem = Product & {
  cartItemId: string;
  basePrice: number;
  quantity: number;
  customization?: DrinkCustomization;
};

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed';
export type OrderType = 'delivery' | 'pickup';
export type PaymentMethod = 'cash' | 'ewallet';

export type Order = {
  id: string;
  orderNumber: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: number;
  estimatedTime: number;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  approvedAt?: number;
  receiptNumber?: string;
};

export type Receipt = {
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  issuedAt: number;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  total: number;
  cashReceived?: number;
  changeDue?: number;
};

export type InventoryStatus = 'low' | 'normal' | 'high';
export type InventoryCategory = 'Ingredients' | 'Materials' | 'Equipment';
export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'pcs' | 'units' | 'bottles';
export type WasteReason = 'expired' | 'spillage' | 'damage' | 'overproduction' | 'other';

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  stock: number;
  unit: Unit;
  status: InventoryStatus;
  reorderLevel: number;
  monthlyRestockCap: number;
  updatedAt: number;
};

export type InventoryBatch = {
  id: string;
  inventoryItemId: string;
  lotCode: string;
  quantity: number;
  unit: Unit;
  receivedAt: number;
  expiryAt?: number;
};

export type InventoryAdjustment = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  type: 'manual_adjustment' | 'recipe_deduction' | 'waste' | 'batch_add' | 'item_add' | 'item_delete';
  delta: number;
  unit: Unit;
  note: string;
  createdAt: number;
};

export type WasteLog = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: Unit;
  reason: WasteReason;
  note?: string;
  createdAt: number;
};

export type SupplierRequestStatus = 'pending' | 'approved' | 'void';

export type SupplierRequest = {
  id: string;
  itemName: string;
  inventoryItemId?: string | null;
  inventoryItemName?: string | null;
  quantity: number;
  unit?: Unit | null;
  supplierEmail: string;
  status: SupplierRequestStatus;
  createdAt: number;
  updatedAt?: number;
  sourceUid?: string;
};

export type SupplierContact = {
  id: string;
  email: string;
  displayName?: string;
  active: boolean;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
};

export type HistoryDomain = 'orders' | 'inventory' | 'products';

export type HistoryEventKind = 'movement' | 'stock_in' | 'deduction' | 'correction' | 'waste' | 'product' | 'inventory' | 'order' | 'receipt';

export type HistoryEvent = {
  id: string;
  domain: HistoryDomain;
  kind?: HistoryEventKind;
  title: string;
  detail: string;
  createdAt: number;
};

export type SyncTrigger = 'initial' | 'realtime' | 'interval' | 'focus' | 'visibility' | 'storage' | 'manual';

export type UserRole = 'admin' | 'barista';

export interface Account {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: number;
  displayName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

type RecipeIngredient = {
  inventoryItemId?: string;
  inventoryName: string;
  amount: number;
  unit: Unit;
};

const PRODUCT_RECIPES: Record<string, RecipeIngredient[]> = {
  p1: [
    { inventoryName: 'All-purpose flour', amount: 50, unit: 'g' },
    { inventoryName: 'White sugar', amount: 30, unit: 'g' },
    { inventoryName: 'Powdered sugar', amount: 20, unit: 'g' },
    { inventoryName: 'Eggs', amount: 0.5, unit: 'pcs' },
    { inventoryName: 'Butter', amount: 15, unit: 'g' },
    { inventoryName: 'Milk', amount: 20, unit: 'ml' },
    { inventoryName: 'Cashew nuts', amount: 40, unit: 'g' },
  ],
  p2: [
    { inventoryName: 'All-purpose flour', amount: 40, unit: 'g' },
    { inventoryName: 'White sugar', amount: 20, unit: 'g' },
    { inventoryName: 'Eggs', amount: 0.3, unit: 'pcs' },
    { inventoryName: 'Butter', amount: 10, unit: 'g' },
    { inventoryName: 'Milk', amount: 15, unit: 'ml' },
    { inventoryName: 'Yeast', amount: 2, unit: 'g' },
  ],
  p3: [
    { inventoryName: 'All-purpose flour', amount: 20, unit: 'g' },
    { inventoryName: 'White sugar', amount: 15, unit: 'g' },
    { inventoryName: 'Powdered sugar', amount: 10, unit: 'g' },
    { inventoryName: 'Eggs', amount: 0.2, unit: 'pcs' },
    { inventoryName: 'Cocoa powder', amount: 8, unit: 'g' },
    { inventoryName: 'Baking powder', amount: 1, unit: 'g' },
    { inventoryName: 'Vanilla extract', amount: 1, unit: 'ml' },
  ],
  b1: [{ inventoryName: 'Coffee beans (espresso roast)', amount: 15, unit: 'g' }],
  b2: [{ inventoryName: 'Coffee beans (espresso roast)', amount: 9, unit: 'g' }],
  b3: [
    { inventoryName: 'Milk', amount: 150, unit: 'ml' },
    { inventoryName: 'Cocoa powder', amount: 15, unit: 'g' },
    { inventoryName: 'White sugar', amount: 20, unit: 'g' },
  ],
  b4: [
    { inventoryName: 'Milk', amount: 180, unit: 'ml' },
    { inventoryName: 'Vanilla syrup', amount: 10, unit: 'ml' },
    { inventoryName: 'White sugar', amount: 15, unit: 'g' },
  ],
  r1: [
    { inventoryName: 'Beef', amount: 150, unit: 'g' },
    { inventoryName: 'Soy sauce', amount: 30, unit: 'ml' },
    { inventoryName: 'Garlic', amount: 10, unit: 'g' },
    { inventoryName: 'Cooking oil', amount: 10, unit: 'ml' },
    { inventoryName: 'Eggs', amount: 1, unit: 'pcs' },
    { inventoryName: 'Rice', amount: 150, unit: 'g' },
    { inventoryName: 'Salt', amount: 2, unit: 'g' },
    { inventoryName: 'Pepper', amount: 1, unit: 'g' },
  ],
  r2: [
    { inventoryName: 'Pork', amount: 150, unit: 'g' },
    { inventoryName: 'Onion', amount: 30, unit: 'g' },
    { inventoryName: 'Chili', amount: 10, unit: 'g' },
    { inventoryName: 'Soy sauce', amount: 30, unit: 'ml' },
    { inventoryName: 'Cooking oil', amount: 10, unit: 'ml' },
    { inventoryName: 'Eggs', amount: 1, unit: 'pcs' },
    { inventoryName: 'Rice', amount: 150, unit: 'g' },
    { inventoryName: 'Calamansi', amount: 1, unit: 'pcs' },
    { inventoryName: 'Salt', amount: 2, unit: 'g' },
    { inventoryName: 'Pepper', amount: 1, unit: 'g' },
    { inventoryName: 'Mayonnaise', amount: 20, unit: 'ml' },
  ],
};

const PRODUCT_MATERIALS: Record<string, RecipeIngredient[]> = {
  p1: [
    { inventoryName: 'Food containers', amount: 1, unit: 'pcs' },
    { inventoryName: 'Napkins', amount: 1, unit: 'pcs' },
    { inventoryName: 'Paper bags', amount: 1, unit: 'pcs' },
  ],
  p2: [
    { inventoryName: 'Food containers', amount: 1, unit: 'pcs' },
    { inventoryName: 'Napkins', amount: 1, unit: 'pcs' },
    { inventoryName: 'Paper bags', amount: 1, unit: 'pcs' },
  ],
  p3: [
    { inventoryName: 'Food containers', amount: 1, unit: 'pcs' },
    { inventoryName: 'Napkins', amount: 1, unit: 'pcs' },
    { inventoryName: 'Paper bags', amount: 1, unit: 'pcs' },
  ],
  r1: [
    { inventoryName: 'Take-out boxes', amount: 1, unit: 'pcs' },
    { inventoryName: 'Plastic spoons', amount: 1, unit: 'pcs' },
    { inventoryName: 'Plastic forks', amount: 1, unit: 'pcs' },
    { inventoryName: 'Tissue paper', amount: 2, unit: 'pcs' },
    { inventoryName: 'Plastic bags', amount: 1, unit: 'pcs' },
  ],
  r2: [
    { inventoryName: 'Take-out boxes', amount: 1, unit: 'pcs' },
    { inventoryName: 'Plastic spoons', amount: 1, unit: 'pcs' },
    { inventoryName: 'Plastic forks', amount: 1, unit: 'pcs' },
    { inventoryName: 'Tissue paper', amount: 2, unit: 'pcs' },
    { inventoryName: 'Plastic bags', amount: 1, unit: 'pcs' },
  ],
};

const LEGACY_PRODUCT_RECIPES: Record<string, RecipeIngredient[]> = {
  ...Object.fromEntries(
    Object.entries(PRODUCT_RECIPES).map(([productId, ingredients]) => [productId, [...ingredients]])
  ),
};

Object.entries(PRODUCT_MATERIALS).forEach(([productId, materials]) => {
  LEGACY_PRODUCT_RECIPES[productId] = [
    ...(LEGACY_PRODUCT_RECIPES[productId] ?? []),
    ...materials,
  ];
});

const isDrink = (category: string) => {
  const normalized = category.trim().toLowerCase();
  return normalized.includes('beverage') || normalized.includes('coffee') || normalized.includes('tea');
};

type ProductAvailability = {
  isOutOfStock: boolean;
  availableQuantity: number;
  reason: 'manual' | 'inventory' | null;
  limitingIngredient: string | null;
};

const getDrinkDefaultCustomization = (): DrinkCustomization => ({
  size: 'medium',
  sugarLevel: 100,
  addOnIds: [],
});

const getSizeSurcharge = (size: DrinkSize) => {
  if (size === 'large') return 30;
  if (size === 'medium') return 15;
  return 0;
};

const sortAddOnIds = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b));

const buildCartSignature = (productId: string, customization?: DrinkCustomization) => {
  if (!customization) return `${productId}:default`;
  const addOnKey = sortAddOnIds(customization.addOnIds).join(',');
  return `${productId}:${customization.size}:${customization.sugarLevel}:${addOnKey}`;
};

const resolveDrinkUnitPrice = (basePrice: number, customization?: DrinkCustomization) => {
  const selectedCustomization = customization ?? getDrinkDefaultCustomization();
  const addOnTotal = selectedCustomization.addOnIds.reduce((sum, addOnId) => {
    const addOn = DRINK_ADD_ONS.find((entry) => entry.id === addOnId);
    return sum + (addOn?.price ?? 0);
  }, 0);
  return roundTo2(basePrice + getSizeSurcharge(selectedCustomization.size) + addOnTotal);
};

const getCupMaterialName = (customization: DrinkCustomization, hotDrink: boolean) => {
  if (hotDrink) {
    if (customization.size === 'small') return 'Hot cups (small)';
    if (customization.size === 'large') return 'Hot cups (large)';
    return 'Hot cups (medium)';
  }
  if (customization.size === 'small') return 'Cold cups (small plastic)';
  if (customization.size === 'large') return 'Cold cups (large plastic)';
  return 'Cold cups (medium plastic)';
};

const getDrinkMaterialRecipe = (productId: string, customization: DrinkCustomization): RecipeIngredient[] => {
  const hotDrink = productId !== 'b4';
  const hasColdFoam = customization.addOnIds.includes('addon-cold-foam');
  const isLarge = customization.size === 'large';

  const materials: RecipeIngredient[] = [
    { inventoryName: getCupMaterialName(customization, hotDrink), amount: 1, unit: 'pcs' },
    { inventoryName: 'Napkins', amount: 1, unit: 'pcs' },
  ];

  if (hotDrink) {
    materials.push(
      { inventoryName: 'Cup lids (hot)', amount: 1, unit: 'pcs' },
      { inventoryName: 'Cup sleeves', amount: 1, unit: 'pcs' },
      { inventoryName: 'Stir sticks', amount: 1, unit: 'pcs' }
    );
  } else {
    materials.push({ inventoryName: hasColdFoam ? 'Dome lids (for frappes)' : 'Cup lids (cold)', amount: 1, unit: 'pcs' });
    materials.push({ inventoryName: hasColdFoam || isLarge ? 'Jumbo straws (for frappes)' : 'Straws (regular)', amount: 1, unit: 'pcs' });
  }

  if (customization.size === 'large') {
    materials.push({ inventoryName: 'Cup carriers / drink holders', amount: 1, unit: 'pcs' });
  }

  return materials;
};

const getAddOnRecipe = (customization?: DrinkCustomization): RecipeIngredient[] => {
  if (!customization) return [];
  return customization.addOnIds
    .map((addOnId) => DRINK_ADD_ONS.find((entry) => entry.id === addOnId))
    .filter((entry): entry is AddOn => Boolean(entry))
    .map((addOn) => ({ inventoryName: addOn.inventoryItemName, amount: addOn.amount, unit: addOn.unit }));
};

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

const toBaseUnit = (amount: number, unit: Unit) => amount * unitToBase[unit];

const roundTo2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const convertUnits = (amount: number, from: Unit, to: Unit) => {
  if (unitGroup[from] !== unitGroup[to]) return amount;
  const base = toBaseUnit(amount, from);
  return roundTo2(base / unitToBase[to]);
};

const recalcStatus = (stock: number, reorderLevel: number, monthlyRestockCap: number): InventoryStatus => {
  if (stock <= reorderLevel) return 'low';
  if (Number.isFinite(monthlyRestockCap) && monthlyRestockCap > 0 && stock >= monthlyRestockCap) return 'high';
  return 'normal';
};

type InventoryItemLike = Pick<InventoryItem, 'id' | 'name' | 'category' | 'stock' | 'unit' | 'reorderLevel'> &
  Partial<Pick<InventoryItem, 'status' | 'monthlyRestockCap' | 'updatedAt'>>;

const deriveMonthlyRestockCap = (item: InventoryItemLike) => {
  const stockFactor = item.category === 'Materials' ? 2 : item.category === 'Equipment' ? 1.5 : 3;
  const minCap = item.category === 'Materials' ? 20 : 1;
  return roundTo2(Math.max(item.stock * stockFactor, item.reorderLevel * 8, minCap));
};

const ensureInventoryMonthlyCap = (item: InventoryItemLike): InventoryItem => {
  const normalizedCap =
    Number.isFinite(Number(item.monthlyRestockCap)) && Number(item.monthlyRestockCap) > 0
      ? roundTo2(Math.max(Number(item.monthlyRestockCap), item.stock))
      : deriveMonthlyRestockCap(item);
  const updatedAt = Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : Date.now();

  return {
    ...item,
    monthlyRestockCap: normalizedCap,
    status: recalcStatus(item.stock, item.reorderLevel, normalizedCap),
    updatedAt,
  };
};

const preferNonEmptyArray = <T>(persisted: T[] | undefined, current: T[]) => {
  if (Array.isArray(persisted) && persisted.length > 0) {
    return persisted;
  }

  return current;
};

const getMonthStart = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const exceedsMonthlyRestockCap = (item: InventoryItem, incomingDelta: number) => {
  if (incomingDelta <= 0) return false;
  const cap = item.monthlyRestockCap;
  if (!Number.isFinite(cap) || cap <= 0) return false;
  return roundTo2(item.stock + incomingDelta) > roundTo2(cap);
};

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildProductBarcode = (seed: string) => {
  const bytes = Array.from(seed).map((char, index) => char.charCodeAt(0) * (index + 3));
  const sum = bytes.reduce((acc, value) => acc + value, 0);
  return `29${String(sum).padStart(10, '0').slice(0, 10)}`;
};

const ensureProductBarcode = (product: Product): Product => ({
  ...product,
  barcode: (product.barcode ?? '').trim() || buildProductBarcode(product.id),
  isManuallyOutOfStock: Boolean(product.isManuallyOutOfStock),
  outOfStockNote: (product.outOfStockNote ?? '').trim(),
});

const getProductRecipeEntries = (productId: string, productRecipes: Record<string, RecipeIngredient[]>) =>
  productRecipes[productId] ?? LEGACY_PRODUCT_RECIPES[productId] ?? [];

const resolveProductAvailability = (
  product: Product,
  inventory: InventoryItem[],
  productRecipes: Record<string, RecipeIngredient[]>,
  quantity = 1
): ProductAvailability => {
  if (product.isManuallyOutOfStock) {
    return {
      isOutOfStock: true,
      availableQuantity: 0,
      reason: 'manual',
      limitingIngredient: product.outOfStockNote?.trim() || 'Manually flagged out of stock',
    };
  }

  const recipe = getProductRecipeEntries(product.id, productRecipes);
  if (recipe.length === 0) {
    return {
      isOutOfStock: false,
      availableQuantity: Number.POSITIVE_INFINITY,
      reason: null,
      limitingIngredient: null,
    };
  }

  let availableQuantity = Number.POSITIVE_INFINITY;
  let limitingIngredient: string | null = null;

  recipe.forEach((ingredient) => {
    const inventoryItem = inventory.find(
      (entry) =>
        entry.id === ingredient.inventoryItemId ||
        entry.name.trim().toLowerCase() === ingredient.inventoryName.trim().toLowerCase()
    );

    if (!inventoryItem) {
      availableQuantity = 0;
      limitingIngredient = ingredient.inventoryName;
      return;
    }

    const requiredPerProduct = roundTo2(convertUnits(ingredient.amount, ingredient.unit, inventoryItem.unit));
    if (requiredPerProduct <= 0) return;

    const possible = roundTo2(inventoryItem.stock / requiredPerProduct);
    if (possible < availableQuantity) {
      availableQuantity = possible;
      limitingIngredient = inventoryItem.name;
    }
  });

  const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const isOutOfStock = !Number.isFinite(availableQuantity) ? false : availableQuantity < normalizedQuantity;

  return {
    isOutOfStock,
    availableQuantity: Number.isFinite(availableQuantity) ? roundTo2(availableQuantity) : Number.POSITIVE_INFINITY,
    reason: isOutOfStock ? 'inventory' : null,
    limitingIngredient,
  };
};

const buildOrderNumber = () => String(Math.floor(1000 + Math.random() * 9000));

const buildReceiptNumber = () => {
  const stamp = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `R-${stamp}${rand}`;
};

const buildReceiptFromOrder = (order: Order): Receipt => {
  const subtotal = roundTo2(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    receiptNumber: order.receiptNumber ?? buildReceiptNumber(),
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    issuedAt: order.approvedAt ?? Date.now(),
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: roundTo2(item.price),
      lineTotal: roundTo2(item.price * item.quantity),
    })),
    subtotal,
    total: roundTo2(order.total),
  };
};

const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const printReceiptDocument = (receipt: Receipt) => {
  if (typeof window === 'undefined') return;

  const popup = window.open('', '_blank', 'width=380,height=720');
  if (!popup) return;

  const clampText = (value: string, maxLength: number) => {
    const text = String(value).trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
  };

  const rows = receipt.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #ece6de;">
            <div style="font-size:11px;font-weight:600;color:#1f1f1f;">${escapeHtml(`${item.quantity}x ${clampText(item.name, 28)}`)}</div>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #ece6de;text-align:right;font-size:11px;font-weight:600;color:#1f1f1f;">P ${item.lineTotal.toFixed(2)}</td>
        </tr>
      `
    )
    .join('');

  const issuedDate = new Date(receipt.issuedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const summaryRows = receipt.paymentMethod === 'cash'
    ? `
      <div style="display:flex;justify-content:space-between;gap:16px;margin-top:6px;color:#666;"><span>Cash Received</span><strong>P ${Number(receipt.cashReceived ?? 0).toFixed(2)}</strong></div>
      <div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;color:#666;"><span>Change Due</span><strong>P ${Number(receipt.changeDue ?? 0).toFixed(2)}</strong></div>
    `
    : `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:6px;color:#2F5D50;"><span>Payment Status</span><strong>Paid</strong></div>`;

  popup.document.write(`
    <html>
      <head><title>Receipt ${receipt.receiptNumber}</title></head>
      <body style="margin:0;padding:12px;background:#f5f1ea;font-family:Arial,sans-serif;color:#1f1f1f;display:flex;justify-content:center;">
        <div style="width:100%;max-width:320px;background:#fffdf9;border:1px solid #e6e1da;box-shadow:0 8px 22px rgba(31,31,31,0.08);padding:14px 12px;">
          <div style="text-align:center;margin-bottom:8px;">
            <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;line-height:1;color:#1f1f1f;">Aura Cafe</div>
            <div style="margin-top:3px;font-size:9px;color:#757575;">Freshly brewed, made with care</div>
          </div>

          <div style="border-top:1px solid #ece6de;border-bottom:1px solid #ece6de;padding:8px 0;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:9.5px;color:#757575;margin-bottom:4px;"><span>Receipt</span><span>${escapeHtml(receipt.receiptNumber)}</span></div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:9.5px;color:#757575;margin-bottom:4px;"><span>Order</span><span>#${escapeHtml(receipt.orderNumber)}</span></div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:9.5px;color:#757575;margin-bottom:4px;"><span>Date</span><span>${escapeHtml(issuedDate)}</span></div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:9.5px;color:#757575;"><span>Type</span><span>${escapeHtml(receipt.orderType.charAt(0).toUpperCase() + receipt.orderType.slice(1))} • ${escapeHtml(receipt.paymentMethod === 'cash' ? 'Cash' : 'E-wallet / Online')}</span></div>
          </div>

          <div style="font-size:9px;font-weight:700;letter-spacing:1.2px;color:#757575;margin-bottom:6px;">ITEMS</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">${rows}</table>

          <div style="border-top:1px solid #ece6de;margin-top:12px;padding-top:8px;">
            <div style="display:flex;justify-content:space-between;gap:16px;color:#666;"><span>Subtotal</span><strong style="color:#1f1f1f;">P ${receipt.subtotal.toFixed(2)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;font-size:15px;font-family:Georgia,serif;color:#1f1f1f;"><span>Total</span><strong>P ${receipt.total.toFixed(2)}</strong></div>
            ${summaryRows}
          </div>

          <div style="text-align:center;margin-top:10px;padding-top:8px;border-top:1px solid #ece6de;">
            <div style="font-size:10px;font-weight:700;color:#1f1f1f;">Thank you for choosing Aura Cafe</div>
            <div style="font-size:9px;color:#757575;margin-top:2px;">Please come again</div>
          </div>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
};

const initialInventorySeed: Array<Omit<InventoryItem, 'monthlyRestockCap'>> = [
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

const initialInventory: InventoryItem[] = initialInventorySeed.map((item) => ensureInventoryMonthlyCap({
  ...item,
  monthlyRestockCap: 0,
  updatedAt: Date.now(),
}));

interface AppState {
  cart: CartItem[];
  addToCart: (product: Product, customization?: DrinkCustomization) => boolean;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateCartItemCustomization: (cartItemId: string, customization: DrinkCustomization) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cartTotal: () => number;

  isAuthenticated: boolean;
  userRole: UserRole | null;
  currentAccountId: string | null;
  login: (role?: UserRole, accountId?: string) => void;
  logout: () => void;
  hydrateAuthSession: (payload: { role: UserRole; accountId: string }) => void;

  orders: Order[];
  receipts: Record<string, Receipt>;
  clearedOrderIds: string[];
  currentOrderId: string | null;
  lastSyncedAt: number | null;
  lastSyncSource: SyncTrigger | null;
  products: Product[];
  productRecipes: Record<string, RecipeIngredient[]>;
  getProductAvailability: (productId: string, quantity?: number) => ProductAvailability;
  setProductOutOfStock: (productId: string, isOutOfStock: boolean, note?: string) => void;
  createOrder: (orderType?: OrderType, paymentMethod?: PaymentMethod) => string;
  createOrderFromItems: (items: CartItem[], orderType?: OrderType, paymentMethod?: PaymentMethod) => string;
  approvePendingOrder: (orderId: string, options?: { cashReceived?: number }) => Receipt | null;
  getReceipt: (orderId: string) => Receipt | undefined;
  printReceipt: (orderId: string) => void;
  upsertProductWithRecipe: (input: {
    product: Product;
    recipe: Array<{ inventoryItemId: string; amount: number; unit: Unit }>;
  }) => void;
  deleteProductWithRecipe: (productId: string) => void;
  clearCompletedOrders: () => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  deleteOrder: (orderId: string) => void;
  getOrder: (orderId: string) => Order | undefined;
  getActiveOrders: () => Order[];
  hydrateRemoteData: (
    snapshot: Partial<Pick<AppState, 'products' | 'productRecipes' | 'inventory' | 'orders' | 'inventoryAdjustments' | 'wasteLogs' | 'receipts' | 'historyEvents' | 'supplierRequests' | 'supplierContacts'>>,
    metadata?: { source?: SyncTrigger }
  ) => void;

  inventory: InventoryItem[];
  inventoryBatches: Record<string, InventoryBatch[]>;
  inventoryAdjustments: InventoryAdjustment[];
  wasteLogs: WasteLog[];
  historyEvents: HistoryEvent[];
  supplierContacts: SupplierContact[];
  supplierRequests: SupplierRequest[];

  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>, note?: string) => void;
  deleteInventoryItem: (id: string) => void;
  addInventoryBatch: (input: Omit<InventoryBatch, 'id' | 'receivedAt'>) => void;
  stockInventory: (inventoryItemId: string, quantity: number, unit: Unit, note?: string) => void;
  adjustInventory: (inventoryItemId: string, delta: number, unit: Unit, note: string) => void;
  logWaste: (inventoryItemId: string, quantity: number, unit: Unit, reason: WasteReason, note?: string) => void;
  addSupplierContact: (input: { email: string; displayName?: string; notes?: string; active?: boolean }) => void;
  toggleSupplierContactActive: (contactId: string, active: boolean) => void;
  deleteSupplierContact: (contactId: string) => void;
  updateSupplierRequestStatus: (requestId: string, status: SupplierRequestStatus) => void;

  clearCart: () => void;

  accounts: Account[];
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      cart: [],
      addToCart: (product, providedCustomization) =>
        (() => {
          const state = get();
          if (resolveProductAvailability(product, state.inventory, state.productRecipes).isOutOfStock) {
            return false;
          }

          const drink = isDrink(product.category);
          const customization = drink ? (providedCustomization ?? getDrinkDefaultCustomization()) : undefined;
          const signature = buildCartSignature(product.id, customization);
          const existing = state.cart.find((item) => buildCartSignature(item.id, item.customization) === signature);
          if (existing) {
            set({
              cart: state.cart.map((item) =>
                item.cartItemId === existing.cartItemId ? { ...item, quantity: item.quantity + 1 } : item
              ),
            });
            return true;
          }
          const basePrice = product.price;
          const price = drink ? resolveDrinkUnitPrice(basePrice, customization) : basePrice;
          set({
            cart: [
              ...state.cart,
              {
                ...product,
                cartItemId: createId('cart'),
                basePrice,
                price,
                quantity: 1,
                customization,
              },
            ],
          });
          return true;
        })(),
      removeFromCart: (cartItemId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.cartItemId !== cartItemId),
        })),
      updateQuantity: (cartItemId, quantity) => {
        const state = get();
        const target = state.cart.find((item) => item.cartItemId === cartItemId);
        if (!target) return;

        const nextQuantity = Math.max(0, quantity);
        if (nextQuantity === 0) {
          set({
            cart: state.cart.filter((item) => item.cartItemId !== cartItemId),
          });
          return;
        }

        if (nextQuantity > target.quantity && resolveProductAvailability(target, state.inventory, state.productRecipes, nextQuantity).isOutOfStock) {
          return;
        }

        set({
          cart: state.cart
            .map((item) => (item.cartItemId === cartItemId ? { ...item, quantity: nextQuantity } : item))
            .filter((item) => item.quantity > 0),
        });
      },
      updateCartItemCustomization: (cartItemId, customization) =>
        set((state) => {
          const target = state.cart.find((item) => item.cartItemId === cartItemId);
          if (!target || !isDrink(target.category)) return state;

          const nextPrice = resolveDrinkUnitPrice(target.basePrice, customization);
          const updatedItem: CartItem = {
            ...target,
            customization: {
              size: customization.size,
              sugarLevel: customization.sugarLevel,
              addOnIds: sortAddOnIds(customization.addOnIds),
            },
            price: nextPrice,
          };

          const targetSignature = buildCartSignature(updatedItem.id, updatedItem.customization);
          const mergeCandidate = state.cart.find(
            (item) =>
              item.cartItemId !== cartItemId &&
              buildCartSignature(item.id, item.customization) === targetSignature
          );

          if (!mergeCandidate) {
            return {
              cart: state.cart.map((item) => (item.cartItemId === cartItemId ? updatedItem : item)),
            };
          }

          return {
            cart: state.cart
              .filter((item) => item.cartItemId !== cartItemId)
              .map((item) =>
                item.cartItemId === mergeCandidate.cartItemId
                  ? { ...item, quantity: item.quantity + target.quantity }
                  : item
              ),
          };
        }),
      cartOpen: false,
      setCartOpen: (open) => set({ cartOpen: open }),
      cartTotal: () => {
        const { cart } = get();
        return cart.reduce((total, item) => total + item.price * item.quantity, 0);
      },
      getProductAvailability: (productId, quantity = 1) => {
        const state = get();
        const product = state.products.find((entry) => entry.id === productId);
        if (!product) {
          return {
            isOutOfStock: true,
            availableQuantity: 0,
            reason: 'inventory',
            limitingIngredient: 'Product not found',
          };
        }

        return resolveProductAvailability(product, state.inventory, state.productRecipes, quantity);
      },
      setProductOutOfStock: (productId, isOutOfStock, note = '') =>
        set((state) => {
          const target = state.products.find((product) => product.id === productId);
          if (!target) return state;

          const nextProduct = {
            ...target,
            isManuallyOutOfStock: isOutOfStock,
            outOfStockNote: isOutOfStock ? note.trim() : '',
          };

          void syncSupabaseProductWithRecipe(nextProduct, state.productRecipes[productId] ?? []);

          return {
            products: state.products.map((product) => (product.id === productId ? nextProduct : product)),
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'products',
                kind: 'product',
                title: `${nextProduct.name} ${isOutOfStock ? 'flagged out of stock' : 'restocked'}`,
                detail: isOutOfStock ? (nextProduct.outOfStockNote || 'Manually marked unavailable') : 'Manual out-of-stock flag cleared',
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),

      isAuthenticated: false,
      userRole: null,
      currentAccountId: null,
      hydrateAuthSession: ({ role, accountId }) =>
        set({ isAuthenticated: true, userRole: role, currentAccountId: accountId }),
      login: (role = 'barista', accountId) =>
        set({ isAuthenticated: true, userRole: role, currentAccountId: accountId ?? null }),
      logout: () => set({ isAuthenticated: false, userRole: null, currentAccountId: null }),

      orders: [],
      receipts: {},
      clearedOrderIds: [],
      currentOrderId: null,
      lastSyncedAt: null,
      lastSyncSource: null,
      products: MENU_ITEMS.map(ensureProductBarcode),
      productRecipes: LEGACY_PRODUCT_RECIPES,
      hydrateRemoteData: (snapshot, metadata) =>
        set((state) => {
          const nextProducts = (snapshot.products ?? state.products).map(ensureProductBarcode);
          const nextInventory = (snapshot.inventory ?? state.inventory).map((item) => ensureInventoryMonthlyCap(item));
          const nextOrders = snapshot.orders ?? state.orders;
          const nextReceipts = snapshot.receipts ?? state.receipts;
          const nextInventoryAdjustments = snapshot.inventoryAdjustments ?? state.inventoryAdjustments;
          const nextWasteLogs = snapshot.wasteLogs ?? state.wasteLogs;
          const nextSupplierContacts = snapshot.supplierContacts ?? state.supplierContacts;
          const nextSupplierRequests = snapshot.supplierRequests ?? state.supplierRequests;

          const remoteHistory: HistoryEvent[] = [
            ...nextOrders.map((order) => ({
              id: `remote-order-${order.id}`,
              domain: 'orders' as const,
              title: `Order ${order.orderNumber} ${order.status}`,
              detail: `${order.items.length} item(s) • P ${order.total.toFixed(2)}`,
              createdAt: order.createdAt,
            })),
            ...Object.values(nextReceipts).map((receipt) => ({
              id: `remote-receipt-${receipt.orderId}`,
              domain: 'orders' as const,
              title: `Receipt ${receipt.receiptNumber}`,
              detail: `Order #${receipt.orderNumber} • P ${receipt.total.toFixed(2)}`,
              createdAt: receipt.issuedAt,
            })),
            ...nextInventoryAdjustments.map((adj) => ({
              id: `remote-adjustment-${adj.id}`,
              domain: 'inventory' as const,
              title: `${adj.inventoryItemName} ${adj.delta < 0 ? 'deducted' : 'updated'}`,
              detail: `${adj.note} • ${adj.delta > 0 ? '+' : ''}${adj.delta.toFixed(2)} ${adj.unit}`,
              createdAt: adj.createdAt,
            })),
            ...nextWasteLogs.map((log) => ({
              id: `remote-waste-${log.id}`,
              domain: 'inventory' as const,
              title: `Waste logged for ${log.inventoryItemName}`,
              detail: `${log.quantity.toFixed(2)} ${log.unit} • ${log.reason}${log.note ? ` • ${log.note}` : ''}`,
              createdAt: log.createdAt,
            })),
          ]
            .filter((event, index, list) => list.findIndex((entry) => entry.id === event.id) === index)
            .sort((a, b) => b.createdAt - a.createdAt);

          const mergedHistory = [
            ...(snapshot.historyEvents ?? []),
            ...remoteHistory,
            ...state.historyEvents,
          ]
            .filter((event, index, list) => list.findIndex((entry) => entry.id === event.id) === index)
            .sort((a, b) => b.createdAt - a.createdAt);

          return {
            ...state,
            ...snapshot,
            products: nextProducts,
            inventory: nextInventory,
            historyEvents: mergedHistory,
            supplierContacts: nextSupplierContacts,
            supplierRequests: nextSupplierRequests,
            lastSyncedAt: Date.now(),
            lastSyncSource: metadata?.source ?? 'manual',
          };
        }),
      upsertProductWithRecipe: ({ product, recipe }) =>
        set((state) => {
          const productExists = state.products.some((entry) => entry.id === product.id);
          const recipeWithNames: RecipeIngredient[] = recipe
            .map((entry) => {
              const inventoryItem = state.inventory.find((item) => item.id === entry.inventoryItemId);
              if (!inventoryItem) return null;
              return {
                inventoryItemId: inventoryItem.id,
                inventoryName: inventoryItem.name,
                amount: roundTo2(entry.amount),
                unit: entry.unit,
              };
            })
            .filter((entry): entry is RecipeIngredient => Boolean(entry));

          const nextProduct: Product = {
            ...product,
            barcode: (product.barcode ?? '').trim() || buildProductBarcode(product.id),
            ingredients: recipeWithNames.map((entry) => entry.inventoryName),
            isManuallyOutOfStock: Boolean(product.isManuallyOutOfStock),
            outOfStockNote: (product.outOfStockNote ?? '').trim(),
          };

          const nextProducts = productExists
            ? state.products.map((entry) => (entry.id === product.id ? nextProduct : entry))
            : [...state.products, nextProduct];

          const nextRecipes = {
            ...state.productRecipes,
            [product.id]: recipeWithNames,
          };

          void syncSupabaseProductWithRecipe(nextProduct, recipeWithNames);

          return {
            products: nextProducts,
            productRecipes: nextRecipes,
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'products',
                title: productExists ? `${nextProduct.name} updated` : `${nextProduct.name} added`,
                detail: `${recipeWithNames.length} mapped ingredient(s)`,
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      deleteProductWithRecipe: (productId) =>
        set((state) => {
          const target = state.products.find((entry) => entry.id === productId);
          if (!target) return state;

          const nextProducts = state.products.filter((entry) => entry.id !== productId);
          const nextRecipes = { ...state.productRecipes };
          delete nextRecipes[productId];

          void deleteSupabaseProductWithRecipe(productId);

          return {
            products: nextProducts,
            productRecipes: nextRecipes,
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'products',
                title: `${target.name} deleted`,
                detail: 'Product and mapped ingredients removed',
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      clearCompletedOrders: () =>
        set((state) => {
          const completedIds = state.orders
            .filter((order) => order.status === 'completed')
            .map((order) => order.id);

          if (completedIds.length === 0) return state;

          const nextClearedIds = [...new Set([...state.clearedOrderIds, ...completedIds])];

          return {
            clearedOrderIds: nextClearedIds,
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'orders',
                kind: 'correction',
                title: `${completedIds.length} completed order(s) cleared`,
                detail: 'Moved to cleared section',
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      createOrder: (orderType = 'pickup', paymentMethod = 'ewallet') => {
        const { cart, createOrderFromItems } = get();
        return createOrderFromItems(cart, orderType, paymentMethod);
      },
      createOrderFromItems: (items, orderType = 'pickup', paymentMethod = 'ewallet') => {
        const state = get();
        const safeItems = items
          .filter((item) => item.quantity > 0)
          .map((item) => ({
            ...item,
            cartItemId: item.cartItemId || createId('cart'),
            basePrice: item.basePrice ?? item.price,
          }));
        if (safeItems.length === 0) return '';

        const blockedItem = safeItems.find((item) => resolveProductAvailability(item, state.inventory, state.productRecipes, item.quantity).isOutOfStock);
        if (blockedItem) return '';

        const total = roundTo2(safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
        const orderId = createId('order');
        const orderNumber = buildOrderNumber();

        const newOrder: Order = {
          id: orderId,
          orderNumber,
          items: safeItems,
          total,
          status: 'pending',
          createdAt: Date.now(),
          estimatedTime: orderType === 'delivery' ? 25 : 10,
          orderType,
          paymentMethod,
        };

        set((state) => ({
          orders: [newOrder, ...state.orders],
          currentOrderId: state.currentOrderId ?? orderId,
          historyEvents: [
            {
              id: createId('hist'),
              domain: 'products',
              kind: 'product',
              title: `Products added to order ${newOrder.orderNumber}`,
              detail: safeItems.map((i) => `${i.quantity}x ${i.name}`).join(', '),
              createdAt: Date.now(),
            },
            {
              id: createId('hist'),
              domain: 'orders',
              kind: 'order',
              title: `Order ${newOrder.orderNumber} placed`,
              detail: `${newOrder.items.length} item(s), ${newOrder.orderType}, ${newOrder.paymentMethod}`,
              createdAt: Date.now(),
            },
            ...state.historyEvents,
          ],
        }));

        void syncSupabaseOrderCreate(newOrder);

        return orderId;
      },
      approvePendingOrder: (orderId, options) => {
        const target = get().orders.find((entry) => entry.id === orderId);
        if (!target) return null;

        // Realtime sync may move the order state before the approval dialog confirms.
        // If a receipt already exists, return it so UI can still show the popout.
        const existingReceipt = get().receipts[orderId];
        if (target.status !== 'pending') {
          return existingReceipt ?? null;
        }

        const cashReceivedRaw = options?.cashReceived;
        if (target.paymentMethod === 'cash') {
          const cashReceived = Number(cashReceivedRaw ?? 0);
          if (Number.isNaN(cashReceived) || cashReceived < target.total) return null;
        }

        const issuedAt = Date.now();
        const cashReceived = target.paymentMethod === 'cash' ? roundTo2(Number(cashReceivedRaw ?? 0)) : undefined;
        const changeDue =
          target.paymentMethod === 'cash' ? roundTo2(Math.max(0, Number(cashReceived ?? 0) - target.total)) : undefined;

        const receipt: Receipt = {
          ...buildReceiptFromOrder(target),
          issuedAt,
          cashReceived,
          changeDue,
        };

        set((state) => ({
          orders: state.orders.map((entry) =>
            entry.id === orderId
              ? { ...entry, receiptNumber: receipt.receiptNumber, approvedAt: issuedAt }
              : entry
          ),
          receipts: {
            ...state.receipts,
            [orderId]: receipt,
          },
          historyEvents: [
            {
              id: createId('hist'),
              domain: 'orders',
              kind: 'receipt',
              title: `Receipt generated for order ${target.orderNumber}`,
              detail: `Receipt ${receipt.receiptNumber} created`,
              createdAt: issuedAt,
            },
            ...state.historyEvents,
          ],
        }));

        get().updateOrderStatus(orderId, 'preparing');
        void syncSupabaseOrderReceipt(orderId, receipt);

        return receipt;
      },
      getReceipt: (orderId) => get().receipts[orderId],
      printReceipt: (orderId) => {
        const receipt = get().receipts[orderId];
        if (!receipt) return;
        printReceiptDocument(receipt);
      },
      updateOrderStatus: (orderId, status) => {
        set((state) => {
          const target = state.orders.find((o) => o.id === orderId);
          if (!target) return state;

          const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
            pending: ['preparing'],
            preparing: ['ready'],
            ready: ['preparing', 'completed'],
            completed: [],
          };
          if (!allowedTransitions[target.status].includes(status)) return state;

          let nextInventory = state.inventory;
          let nextBatches = state.inventoryBatches;
          const nextAdjustments = [...state.inventoryAdjustments];
          const nextHistory = [...state.historyEvents];
          let nextReceipts = state.receipts;
          let generatedReceipt: Receipt | null = null;

          const transitioningToPreparing = target.status === 'pending' && status === 'preparing';
          if (transitioningToPreparing && !state.receipts[orderId]) {
            const issuedAt = Date.now();
            generatedReceipt = {
              ...buildReceiptFromOrder(target),
              issuedAt,
              cashReceived: target.paymentMethod === 'cash' ? roundTo2(target.total) : undefined,
              changeDue: target.paymentMethod === 'cash' ? 0 : undefined,
            };
            nextReceipts = {
              ...state.receipts,
              [orderId]: generatedReceipt,
            };
          }

          if (transitioningToPreparing) {
            nextInventory = [...state.inventory];
            nextBatches = { ...state.inventoryBatches };
            const updatedAt = Date.now();

            target.items.forEach((orderItem) => {
              const mappedRecipe = state.productRecipes[orderItem.id] ?? [];
              const hasMappedRecipe = mappedRecipe.length > 0;
              const legacyRecipe = [
                ...(PRODUCT_RECIPES[orderItem.id] ?? []),
                ...(PRODUCT_MATERIALS[orderItem.id] ?? []),
              ];
              const baseRecipe = hasMappedRecipe ? mappedRecipe : legacyRecipe;
              const drinkCustomization = orderItem.customization ?? getDrinkDefaultCustomization();
              const drinkMaterials = !hasMappedRecipe && isDrink(orderItem.category)
                ? getDrinkMaterialRecipe(orderItem.id, drinkCustomization)
                : [];
              const addOnRecipe = isDrink(orderItem.category) ? getAddOnRecipe(orderItem.customization) : [];
              const recipe = [...baseRecipe, ...drinkMaterials, ...addOnRecipe].map((ingredient) => {
                if (
                  isDrink(orderItem.category) &&
                  ingredient.inventoryName.toLowerCase() === 'white sugar' &&
                  orderItem.customization
                ) {
                  return {
                    ...ingredient,
                    amount: roundTo2(ingredient.amount * (orderItem.customization.sugarLevel / 100)),
                  };
                }
                return ingredient;
              });

              if (recipe.length === 0) return;

              recipe.forEach((ingredient) => {
                const idx = nextInventory.findIndex(
                  (inv) => inv.name.toLowerCase() === ingredient.inventoryName.toLowerCase()
                );
                if (idx === -1) return;

                const currentItem = nextInventory[idx];
                const needed = ingredient.amount * orderItem.quantity;
                const neededInItemUnit = roundTo2(convertUnits(needed, ingredient.unit, currentItem.unit));
                const newStock = roundTo2(Math.max(0, currentItem.stock - neededInItemUnit));

                nextInventory[idx] = {
                  ...currentItem,
                  stock: newStock,
                  updatedAt,
                  status: recalcStatus(newStock, currentItem.reorderLevel, currentItem.monthlyRestockCap),
                };

                const itemBatches = [...(nextBatches[currentItem.id] ?? [])];
                let remaining = neededInItemUnit;
                const sorted = itemBatches.sort((a, b) => {
                  const aExp = a.expiryAt ?? Number.MAX_SAFE_INTEGER;
                  const bExp = b.expiryAt ?? Number.MAX_SAFE_INTEGER;
                  return aExp - bExp;
                });

                const updatedBatches = sorted
                  .map((batch) => {
                    if (remaining <= 0) return batch;
                    const deduct = roundTo2(Math.min(batch.quantity, remaining));
                    remaining = roundTo2(remaining - deduct);
                    return { ...batch, quantity: roundTo2(Math.max(0, batch.quantity - deduct)) };
                  })
                  .filter((batch) => batch.quantity > 0);

                nextBatches[currentItem.id] = updatedBatches;

                nextAdjustments.unshift({
                  id: createId('adj'),
                  inventoryItemId: currentItem.id,
                  inventoryItemName: currentItem.name,
                  type: 'recipe_deduction',
                  delta: -neededInItemUnit,
                  unit: currentItem.unit,
                  note: `Used for ${orderItem.name} (${orderItem.quantity}x)`,
                  createdAt: Date.now(),
                });

                nextHistory.unshift({
                  id: createId('hist'),
                  domain: 'inventory',
                  kind: 'deduction',
                  title: `${currentItem.name} deducted`,
                  detail: `-${neededInItemUnit.toFixed(2)} ${currentItem.unit} from recipe usage`,
                  createdAt: Date.now(),
                });
              });
            });
          }

          return {
            orders: state.orders.map((order) =>
              order.id === orderId
                ? {
                    ...order,
                    status,
                    receiptNumber: order.receiptNumber ?? generatedReceipt?.receiptNumber,
                    approvedAt: order.approvedAt ?? generatedReceipt?.issuedAt,
                  }
                : order
            ),
            receipts: nextReceipts,
            clearedOrderIds:
              status === 'completed'
                ? state.clearedOrderIds
                : state.clearedOrderIds.filter((id) => id !== orderId),
            inventory: nextInventory,
            inventoryBatches: nextBatches,
            inventoryAdjustments: nextAdjustments,
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'orders',
                kind: 'order',
                title: `Order ${target.orderNumber} moved to ${status}`,
                detail: `Status updated from ${target.status} to ${status}`,
                createdAt: Date.now(),
              },
              ...(generatedReceipt
                ? [
                    {
                      id: createId('hist'),
                      domain: 'orders' as const,
                      kind: 'receipt' as const,
                      title: `Receipt generated for order ${target.orderNumber}`,
                      detail: `Receipt ${generatedReceipt.receiptNumber} created`,
                      createdAt: Date.now(),
                    },
                  ]
                : []),
              ...nextHistory,
            ],
          };
        });

        void syncSupabaseOrderStatus(orderId, status);

        const receipt = get().receipts[orderId];
        if (status === 'preparing' && receipt) {
          void syncSupabaseOrderReceipt(orderId, receipt);
        }
      },
      deleteOrder: (orderId) =>
        set((state) => {
          const target = state.orders.find((o) => o.id === orderId);
          const nextOrders = state.orders.filter((order) => order.id !== orderId);
          const nextReceipts = { ...state.receipts };
          delete nextReceipts[orderId];
          if (target) {
            void syncSupabaseOrderDelete(orderId);
          }
          return {
            orders: nextOrders,
            receipts: nextReceipts,
            clearedOrderIds: state.clearedOrderIds.filter((id) => id !== orderId),
            currentOrderId:
              state.currentOrderId === orderId
                ? (nextOrders.find((o) => o.status !== 'completed')?.id ?? nextOrders[0]?.id ?? null)
                : state.currentOrderId,
            historyEvents: target
              ? [
                  {
                    id: createId('hist'),
                    domain: 'orders',
                    kind: 'correction',
                    title: `Order ${target.orderNumber} voided/deleted`,
                    detail: 'Order removed from queue',
                    createdAt: Date.now(),
                  },
                  ...state.historyEvents,
                ]
              : state.historyEvents,
          };
        }),
      getOrder: (orderId) => {
        const { orders } = get();
        return orders.find((order) => order.id === orderId);
      },
      getActiveOrders: () => {
        const { orders } = get();
        return [...orders]
          .filter((order) => order.status !== 'completed')
          .sort((a, b) => b.createdAt - a.createdAt);
      },

      inventory: initialInventory,
      inventoryBatches: {},
      inventoryAdjustments: [],
      wasteLogs: [],
      historyEvents: [],
      supplierContacts: [],
      supplierRequests: [],

      addInventoryItem: (item) =>
        set((state) => {
          const timestamp = Date.now();
          const newItem = ensureInventoryMonthlyCap({ ...item, id: createId('inv'), updatedAt: timestamp });
          void syncSupabaseInventoryItem(newItem);
          void syncSupabaseInventoryAdjustment({
            inventoryItemId: newItem.id,
            inventoryItemName: newItem.name,
            type: 'item_add',
            delta: newItem.stock,
            unit: newItem.unit,
            note: 'Item created',
          });
          return {
            inventory: [...state.inventory, newItem],
            inventoryAdjustments: [
              {
                id: createId('adj'),
                inventoryItemId: newItem.id,
                inventoryItemName: newItem.name,
                type: 'item_add',
                delta: newItem.stock,
                unit: newItem.unit,
                note: 'Item created',
                createdAt: Date.now(),
              },
              ...state.inventoryAdjustments,
            ],
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'inventory',
                kind: 'stock_in',
                title: `${newItem.name} added`,
                detail: `${newItem.stock} ${newItem.unit} starting stock`,
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      updateInventoryItem: (id, updates, note = 'Manual update') => {
        const currentItem = get().inventory.find((item) => item.id === id);
        if (!currentItem) return;
        if (updates.monthlyRestockCap !== undefined && updates.monthlyRestockCap <= 0) {
          return;
        }
        if (updates.stock !== undefined) {
          const incomingDelta = roundTo2(updates.stock - currentItem.stock);
          const effectiveItem = {
            ...currentItem,
            monthlyRestockCap: updates.monthlyRestockCap ?? currentItem.monthlyRestockCap,
          };
          if (exceedsMonthlyRestockCap(effectiveItem, incomingDelta)) {
            return;
          }
        }

        let nextItem: InventoryItem | null = null;
        let previousItem: InventoryItem | null = null;
        let stockDelta: number | null = null;
        const updatedAt = Date.now();

        set((state) => ({
          inventory: state.inventory.map((item) => {
            if (item.id !== id) return item;
            previousItem = item;
            const nextStock = updates.stock ?? item.stock;
            const next = {
              ...item,
              ...updates,
              stock: nextStock,
              updatedAt,
              status: recalcStatus(
                nextStock,
                updates.reorderLevel ?? item.reorderLevel,
                updates.monthlyRestockCap ?? item.monthlyRestockCap
              ),
            };
            nextItem = ensureInventoryMonthlyCap(next);
            if (updates.stock !== undefined) {
              stockDelta = roundTo2(nextStock - item.stock);
            }
            return ensureInventoryMonthlyCap(next);
          }),
          inventoryAdjustments:
            updates.stock === undefined
              ? state.inventoryAdjustments
              : [
                  {
                    id: createId('adj'),
                    inventoryItemId: id,
                    inventoryItemName: state.inventory.find((i) => i.id === id)?.name ?? 'Inventory Item',
                    type: 'manual_adjustment',
                    delta:
                      (updates.stock ?? 0) - (state.inventory.find((i) => i.id === id)?.stock ?? 0),
                    unit: state.inventory.find((i) => i.id === id)?.unit ?? 'pcs',
                    note,
                    createdAt: Date.now(),
                  },
                  ...state.inventoryAdjustments,
                ],
          historyEvents: [
            {
              id: createId('hist'),
              domain: 'inventory',
                kind: 'correction',
              title: `${state.inventory.find((i) => i.id === id)?.name ?? 'Item'} updated`,
              detail: note,
              createdAt: Date.now(),
            },
            ...state.historyEvents,
          ],
        }));

        if (nextItem) {
          void syncSupabaseInventoryItem(nextItem);
        } else if (previousItem) {
          void syncSupabaseInventoryItem({
            ...previousItem,
            ...updates,
            stock: updates.stock ?? previousItem.stock,
            monthlyRestockCap: updates.monthlyRestockCap ?? previousItem.monthlyRestockCap,
            updatedAt,
          });
        }

        if (updates.stock !== undefined && previousItem && stockDelta !== null) {
          void syncSupabaseInventoryAdjustment({
            inventoryItemId: previousItem.id,
            inventoryItemName: previousItem.name,
            type: 'manual_adjustment',
            delta: stockDelta,
            unit: previousItem.unit,
            note,
          });
        }
      },
      deleteInventoryItem: (id) =>
        set((state) => {
          const target = state.inventory.find((item) => item.id === id);
          if (target) {
            void deleteSupabaseInventoryItem(target.id);
          }
          return {
            inventory: state.inventory.filter((item) => item.id !== id),
            inventoryBatches: Object.fromEntries(
              Object.entries(state.inventoryBatches).filter(([key]) => key !== id)
            ),
            inventoryAdjustments: target
              ? [
                  {
                    id: createId('adj'),
                    inventoryItemId: target.id,
                    inventoryItemName: target.name,
                    type: 'item_delete',
                    delta: -target.stock,
                    unit: target.unit,
                    note: 'Item deleted',
                    createdAt: Date.now(),
                  },
                  ...state.inventoryAdjustments,
                ]
              : state.inventoryAdjustments,
            historyEvents: target
              ? [
                  {
                    id: createId('hist'),
                    domain: 'inventory',
                    kind: 'correction',
                    title: `${target.name} deleted`,
                    detail: 'Inventory item removed',
                    createdAt: Date.now(),
                  },
                  ...state.historyEvents,
                ]
              : state.historyEvents,
          };
        }),
      addInventoryBatch: (input) =>
        set((state) => {
          const inventoryItem = state.inventory.find((i) => i.id === input.inventoryItemId);
          if (!inventoryItem) return state;
          const updatedAt = Date.now();

          const quantityInItemUnit = roundTo2(convertUnits(input.quantity, input.unit, inventoryItem.unit));
          if (exceedsMonthlyRestockCap(inventoryItem, quantityInItemUnit)) {
            return state;
          }
          const nextStock = roundTo2(inventoryItem.stock + quantityInItemUnit);

          void syncSupabaseInventoryItem({
            ...inventoryItem,
            stock: nextStock,
            updatedAt,
            status: recalcStatus(nextStock, inventoryItem.reorderLevel, inventoryItem.monthlyRestockCap),
          });
          void syncSupabaseInventoryAdjustment({
            inventoryItemId: inventoryItem.id,
            inventoryItemName: inventoryItem.name,
            type: 'batch_add',
            delta: quantityInItemUnit,
            unit: inventoryItem.unit,
            note: `Batch ${input.lotCode} received`,
          });

          return {
            inventoryBatches: {
              ...state.inventoryBatches,
              [input.inventoryItemId]: [
                {
                  id: createId('batch'),
                  inventoryItemId: input.inventoryItemId,
                  lotCode: input.lotCode,
                  quantity: input.quantity,
                  unit: input.unit,
                  receivedAt: Date.now(),
                  expiryAt: input.expiryAt,
                },
                ...(state.inventoryBatches[input.inventoryItemId] ?? []),
              ],
            },
            inventory: state.inventory.map((item) =>
              item.id === input.inventoryItemId
                ? {
                    ...item,
                    stock: nextStock,
                    updatedAt,
                    status: recalcStatus(nextStock, item.reorderLevel, item.monthlyRestockCap),
                  }
                : item
            ),
            inventoryAdjustments: [
              {
                id: createId('adj'),
                inventoryItemId: inventoryItem.id,
                inventoryItemName: inventoryItem.name,
                type: 'batch_add',
                delta: quantityInItemUnit,
                unit: inventoryItem.unit,
                note: `Batch ${input.lotCode} received`,
                createdAt: Date.now(),
              },
              ...state.inventoryAdjustments,
            ],
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'inventory',
                kind: 'stock_in',
                title: `Batch added to ${inventoryItem.name}`,
                detail: `${input.quantity} ${input.unit} (${input.lotCode})`,
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      stockInventory: (inventoryItemId, quantity, unit, note = 'Stock in') =>
        set((state) => {
          const target = state.inventory.find((item) => item.id === inventoryItemId);
          if (!target) return state;
          const updatedAt = Date.now();
          const quantityInItemUnit = roundTo2(convertUnits(quantity, unit, target.unit));
          if (exceedsMonthlyRestockCap(target, quantityInItemUnit)) {
            return state;
          }
          const nextStock = roundTo2(target.stock + quantityInItemUnit);

          void syncSupabaseInventoryItem({
            ...target,
            stock: nextStock,
            updatedAt,
            status: recalcStatus(nextStock, target.reorderLevel, target.monthlyRestockCap),
          });
          void syncSupabaseInventoryAdjustment({
            inventoryItemId,
            inventoryItemName: target.name,
            type: 'batch_add',
            delta: quantityInItemUnit,
            unit: target.unit,
            note,
          });

          return {
            inventory: state.inventory.map((item) =>
              item.id === inventoryItemId
                ? {
                    ...item,
                    stock: nextStock,
                    updatedAt,
                    status: recalcStatus(nextStock, item.reorderLevel, item.monthlyRestockCap),
                  }
                : item
            ),
            inventoryAdjustments: [
              {
                id: createId('adj'),
                inventoryItemId,
                inventoryItemName: target.name,
                type: 'batch_add',
                delta: quantityInItemUnit,
                unit: target.unit,
                note,
                createdAt: Date.now(),
              },
              ...state.inventoryAdjustments,
            ],
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'inventory',
                kind: 'stock_in',
                title: `${target.name} stocked in`,
                detail: `${quantityInItemUnit.toFixed(2)} ${target.unit} added`,
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      adjustInventory: (inventoryItemId, delta, unit, note) =>
        set((state) => {
          const target = state.inventory.find((i) => i.id === inventoryItemId);
          if (!target) return state;
          const updatedAt = Date.now();
          const deltaInItemUnit = roundTo2(convertUnits(delta, unit, target.unit));
          if (exceedsMonthlyRestockCap(target, deltaInItemUnit)) {
            return state;
          }
          const nextStock = roundTo2(Math.max(0, target.stock + deltaInItemUnit));

          void syncSupabaseInventoryItem({
            ...target,
            stock: nextStock,
            updatedAt,
            status: recalcStatus(nextStock, target.reorderLevel, target.monthlyRestockCap),
          });
          void syncSupabaseInventoryAdjustment({
            inventoryItemId,
            inventoryItemName: target.name,
            type: 'manual_adjustment',
            delta: deltaInItemUnit,
            unit: target.unit,
            note,
          });

          return {
            inventory: state.inventory.map((item) =>
              item.id === inventoryItemId
                ? {
                    ...item,
                    stock: nextStock,
                    updatedAt,
                    status: recalcStatus(nextStock, item.reorderLevel, item.monthlyRestockCap),
                  }
                : item
            ),
            inventoryAdjustments: [
              {
                id: createId('adj'),
                inventoryItemId,
                inventoryItemName: target.name,
                type: 'manual_adjustment',
                delta: deltaInItemUnit,
                unit: target.unit,
                note,
                createdAt: Date.now(),
              },
              ...state.inventoryAdjustments,
            ],
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'inventory',
                kind: 'correction',
                title: `${target.name} adjusted`,
                detail: `${deltaInItemUnit >= 0 ? '+' : ''}${deltaInItemUnit.toFixed(2)} ${target.unit} (${note})`,
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      logWaste: (inventoryItemId, quantity, unit, reason, note) =>
        set((state) => {
          const target = state.inventory.find((i) => i.id === inventoryItemId);
          if (!target) return state;
          const updatedAt = Date.now();
          const qtyInItemUnit = roundTo2(convertUnits(quantity, unit, target.unit));
          const nextStock = roundTo2(Math.max(0, target.stock - qtyInItemUnit));

          void syncSupabaseInventoryItem({
            ...target,
            stock: nextStock,
            updatedAt,
            status: recalcStatus(nextStock, target.reorderLevel, target.monthlyRestockCap),
          });
          void syncSupabaseWasteLog({
            inventoryItemId,
            inventoryItemName: target.name,
            quantity: roundTo2(quantity),
            unit,
            reason,
            note,
          });
          void syncSupabaseInventoryAdjustment({
            inventoryItemId,
            inventoryItemName: target.name,
            type: 'waste',
            delta: -qtyInItemUnit,
            unit: target.unit,
            note: `Waste: ${reason}${note ? ` (${note})` : ''}`,
          });

          return {
            inventory: state.inventory.map((item) =>
              item.id === inventoryItemId
                ? {
                    ...item,
                    stock: nextStock,
                    updatedAt,
                    status: recalcStatus(nextStock, item.reorderLevel, item.monthlyRestockCap),
                  }
                : item
            ),
            wasteLogs: [
              {
                id: createId('waste'),
                inventoryItemId,
                inventoryItemName: target.name,
                quantity: roundTo2(quantity),
                unit,
                reason,
                note,
                createdAt: Date.now(),
              },
              ...state.wasteLogs,
            ],
            inventoryAdjustments: [
              {
                id: createId('adj'),
                inventoryItemId,
                inventoryItemName: target.name,
                type: 'waste',
                delta: -qtyInItemUnit,
                unit: target.unit,
                note: `Waste: ${reason}${note ? ` (${note})` : ''}`,
                createdAt: Date.now(),
              },
              ...state.inventoryAdjustments,
            ],
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'inventory',
                kind: 'waste',
                title: `Waste logged for ${target.name}`,
                detail: `${quantity} ${unit} (${reason})`,
                createdAt: Date.now(),
              },
              ...state.historyEvents,
            ],
          };
        }),
      addSupplierContact: (input) =>
        set((state) => {
          const email = input.email.trim().toLowerCase();
          if (!email) return state;

          const existing = state.supplierContacts.find((contact) => contact.email.toLowerCase() === email);
          const timestamp = Date.now();
          const nextContact: SupplierContact = {
            id: existing?.id ?? createId('sup'),
            email,
            displayName: input.displayName?.trim() || existing?.displayName,
            notes: input.notes?.trim() || existing?.notes,
            active: input.active ?? existing?.active ?? true,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          };

          void syncSupabaseSupplierContactUpsert(nextContact);

          return {
            supplierContacts: existing
              ? state.supplierContacts.map((contact) => (contact.email.toLowerCase() === email ? nextContact : contact))
              : [nextContact, ...state.supplierContacts],
          };
        }),
      toggleSupplierContactActive: (contactId, active) =>
        set((state) => {
          const target = state.supplierContacts.find((contact) => contact.id === contactId);
          if (!target) return state;

          const nextContact: SupplierContact = {
            ...target,
            active,
            updatedAt: Date.now(),
          };

          void syncSupabaseSupplierContactUpsert(nextContact);

          return {
            supplierContacts: state.supplierContacts.map((contact) => (contact.id === contactId ? nextContact : contact)),
          };
        }),
      deleteSupplierContact: (contactId) =>
        set((state) => {
          const target = state.supplierContacts.find((contact) => contact.id === contactId);
          if (!target) return state;

          void syncSupabaseSupplierContactDelete(contactId);

          return {
            supplierContacts: state.supplierContacts.filter((contact) => contact.id !== contactId),
          };
        }),
      updateSupplierRequestStatus: (requestId, status) =>
        set((state) => {
          const target = state.supplierRequests.find((request) => request.id === requestId);
          if (!target) return state;

          const updatedAt = Date.now();
          const nextRequest = {
            ...target,
            status,
            updatedAt,
          };

          void syncSupabaseSupplierRequestStatus(requestId, status);

          return {
            supplierRequests: state.supplierRequests.map((request) => (request.id === requestId ? nextRequest : request)),
            historyEvents: [
              {
                id: createId('hist'),
                domain: 'inventory',
                kind: 'inventory',
                title: `Supplier request ${status}`,
                detail: `${target.itemName} (${target.quantity}) from ${target.supplierEmail}`,
                createdAt: updatedAt,
              },
              ...state.historyEvents,
            ],
          };
        }),

      clearCart: () => set({ cart: [] }),

      accounts: [
        {
          id: '1',
          email: 'barista@aura.cafe',
          password: 'coffee2024',
          role: 'barista',
          createdAt: Date.now(),
          displayName: 'Barista',
          emailVerified: true,
        },
        {
          id: '2',
          email: 'admin@aura.cafe',
          password: 'admin2024',
          role: 'admin',
          createdAt: Date.now(),
          displayName: 'Admin',
          emailVerified: true,
        },
      ],
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, { ...account, id: Date.now().toString(), createdAt: Date.now() }],
        })),
      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      deleteAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        })),
    }),
    {
      name: 'aura-cafe-storage',
      partialize: (state) => ({
        orders: state.orders,
        receipts: state.receipts,
        clearedOrderIds: state.clearedOrderIds,
        currentOrderId: state.currentOrderId,
        lastSyncedAt: state.lastSyncedAt,
        lastSyncSource: state.lastSyncSource,
        products: state.products,
        productRecipes: state.productRecipes,
        inventory: state.inventory,
        inventoryBatches: state.inventoryBatches,
        inventoryAdjustments: state.inventoryAdjustments,
        wasteLogs: state.wasteLogs,
        historyEvents: state.historyEvents,
        supplierContacts: state.supplierContacts,
        supplierRequests: state.supplierRequests,
        accounts: state.accounts,
      }),
      merge: (persistedState: any, currentState: AppState) => ({
        ...currentState,
        ...persistedState,
        isAuthenticated: false,
        userRole: null,
        currentAccountId: null,
        receipts: persistedState?.receipts ?? currentState.receipts,
        clearedOrderIds: persistedState?.clearedOrderIds ?? currentState.clearedOrderIds,
        lastSyncedAt: persistedState?.lastSyncedAt ?? currentState.lastSyncedAt,
        lastSyncSource: persistedState?.lastSyncSource ?? currentState.lastSyncSource,
        products: (persistedState?.products ?? currentState.products).map(ensureProductBarcode),
        productRecipes: persistedState?.productRecipes ?? currentState.productRecipes,
        orders: (persistedState?.orders ?? currentState.orders).map((order: any) => ({
          ...order,
          paymentMethod: order?.paymentMethod === 'cash' ? 'cash' : 'ewallet',
        })),
        inventory: (() => {
          const sourceInventory = persistedState?.inventory ?? currentState.inventory;
          const hasLegacyInventory = sourceInventory.some(
            (item: any) => ['1', '2', '3', '4', '5', '6', '7', '8'].includes(String(item?.id))
          );
          const hasCanonicalInventory = sourceInventory.some(
            (item: any) => String(item?.id ?? '').startsWith('ing-')
          );
          const selectedInventory = hasLegacyInventory || !hasCanonicalInventory
            ? currentState.inventory
            : sourceInventory;

          const mergedInventory = [
            ...selectedInventory,
            ...currentState.inventory.filter(
              (item) => !selectedInventory.some((existing: any) => String(existing?.id) === item.id)
            ),
          ];

          return mergedInventory.map((item: any) => ({
            ...ensureInventoryMonthlyCap({
              ...item,
              stock: roundTo2(Number(item.stock ?? 0)),
              reorderLevel: roundTo2(Number(item.reorderLevel ?? item.reorder_level ?? 0)),
              updatedAt: Number(item.updatedAt ?? item.updated_at ?? Date.now()),
              monthlyRestockCap: (() => {
                const capValue = item.monthlyRestockCap ?? item.monthly_restock_cap;
                if (capValue === undefined || capValue === null || capValue === '') return 0;
                return roundTo2(Number(capValue));
              })(),
            }),
          }));
        })(),
        inventoryBatches: persistedState?.inventoryBatches ?? currentState.inventoryBatches,
        inventoryAdjustments: (persistedState?.inventoryAdjustments ?? currentState.inventoryAdjustments).map((adj: any) => ({
          ...adj,
          delta: roundTo2(Number(adj.delta ?? 0)),
        })),
        wasteLogs: (persistedState?.wasteLogs ?? currentState.wasteLogs).map((log: any) => ({
          ...log,
          quantity: roundTo2(Number(log.quantity ?? 0)),
        })),
        historyEvents: persistedState?.historyEvents ?? currentState.historyEvents,
        supplierContacts: preferNonEmptyArray(persistedState?.supplierContacts, currentState.supplierContacts).map((contact: any) => ({
          ...contact,
          email: String(contact.email ?? '').trim().toLowerCase(),
          active: Boolean(contact.active ?? true),
          createdAt: Number(contact.createdAt ?? contact.created_at ?? Date.now()),
          updatedAt: contact.updatedAt ?? contact.updated_at ? Number(contact.updatedAt ?? contact.updated_at) : undefined,
        })),
        supplierRequests: preferNonEmptyArray(persistedState?.supplierRequests, currentState.supplierRequests).map((request: any) => ({
          ...request,
          quantity: roundTo2(Number(request.quantity ?? 0)),
          createdAt: Number(request.createdAt ?? request.created_at ?? Date.now()),
          updatedAt: request.updatedAt ?? request.updated_at ? Number(request.updatedAt ?? request.updated_at) : undefined,
        })),
        accounts: (persistedState?.accounts ?? currentState.accounts).map((acc: any) => ({
          displayName: acc.role === 'admin' ? 'Cafe Admin' : 'Barista',
          emailVerified: false,
          ...acc,
        })),
      }),
    }
  )
);
