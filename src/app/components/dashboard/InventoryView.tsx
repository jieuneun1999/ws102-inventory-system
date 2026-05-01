import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, AlertCircle, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { DRINK_ADD_ONS, useAppStore, type InventoryItem, type Unit, type WasteReason } from '../../store';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { ExpandableDescription } from '../ui/ExpandableDescription';

type Tab = 'All' | 'Ingredients' | 'Materials' | 'Equipment' | 'Add-ons' | 'Low Stock';
type StockAction = 'stock_in' | 'correction' | 'waste';
type CorrectionMode = 'delta' | 'set';
type CorrectionDirection = 'add' | 'subtract';
type SortOption = 'name' | 'status' | 'latest_stock_add' | 'linked_product';

export function InventoryView() {
  const inventory = useAppStore((state) => state.inventory);
  const products = useAppStore((state) => state.products);
  const productRecipes = useAppStore((state) => state.productRecipes);
  const userRole = useAppStore((state) => state.userRole);
  const addInventoryItem = useAppStore((state) => state.addInventoryItem);
  const updateInventoryItem = useAppStore((state) => state.updateInventoryItem);
  const deleteInventoryItem = useAppStore((state) => state.deleteInventoryItem);
  const inventoryAdjustments = useAppStore((state) => state.inventoryAdjustments);
  const stockInventory = useAppStore((state) => state.stockInventory);
  const adjustInventory = useAppStore((state) => state.adjustInventory);
  const logWaste = useAppStore((state) => state.logWaste);
  const isAdmin = userRole === 'admin';
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<InventoryItem | null>(null);
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Ingredients' as InventoryItem['category'],
    stock: 0,
    unit: 'kg' as Unit,
    reorderLevel: 5,
    monthlyRestockCap: ''
  });
  const [stockModal, setStockModal] = useState<{
    open: boolean;
    item: InventoryItem | null;
    action: StockAction;
    correctionMode: CorrectionMode;
    correctionDirection: CorrectionDirection;
    quantity: string;
    exactStock: string;
    unit: Unit;
    reason: WasteReason;
    note: string;
    monthlyRestockCap: string;
  }>({
    open: false,
    item: null,
    action: 'correction',
    correctionMode: 'delta',
    correctionDirection: 'add',
    quantity: '1',
    exactStock: '0',
    unit: 'pcs',
    reason: 'expired',
    note: '',
    monthlyRestockCap: '1',
  });

  const unitChoices: Unit[] = ['g', 'kg', 'ml', 'L', 'pcs', 'units', 'bottles'];
  const formatStock = (value: number) => value.toFixed(2);
  const getStatusLabel = (status: InventoryItem['status']) => {
    if (status === 'high') return 'Full';
    if (status === 'low') return 'Low';
    return 'Normal';
  };
  const getStatusTone = (status: InventoryItem['status']) => {
    if (status === 'low') return { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', text: 'text-red-700' };
    if (status === 'high') return { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' };
    return { bar: 'bg-[#5C1A1B]', badge: 'bg-[#EADDD1] text-[#4D0E13]', text: 'text-[#4D0E13]' };
  };
  const unitToBase: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, L: 1000, pcs: 1, units: 1, bottles: 1 };
  const unitGroup: Record<Unit, 'mass' | 'volume' | 'count'> = {
    g: 'mass',
    kg: 'mass',
    ml: 'volume',
    L: 'volume',
    pcs: 'count',
    units: 'count',
    bottles: 'count',
  };

  const convertUnits = (amount: number, from: Unit, to: Unit) => {
    if (unitGroup[from] !== unitGroup[to]) return amount;
    return (amount * unitToBase[from]) / unitToBase[to];
  };

  const recentConsumptionByItem = useMemo(() => {
    const recentWindowStart = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const map = new Map<string, number>();
    inventoryAdjustments.forEach((adj) => {
      if (adj.createdAt < recentWindowStart || adj.delta >= 0) return;
      map.set(adj.inventoryItemId, (map.get(adj.inventoryItemId) ?? 0) + Math.abs(adj.delta));
    });
    return map;
  }, [inventoryAdjustments]);

  const monthRestockAddedByItem = useMemo(() => {
    const monthStartDate = new Date();
    monthStartDate.setDate(1);
    monthStartDate.setHours(0, 0, 0, 0);
    const monthStart = monthStartDate.getTime();
    const map = new Map<string, number>();
    inventoryAdjustments.forEach((adj) => {
      if (adj.createdAt < monthStart || adj.delta <= 0) return;
      if (!['item_add', 'batch_add'].includes(adj.type)) return;
      map.set(adj.inventoryItemId, (map.get(adj.inventoryItemId) ?? 0) + adj.delta);
    });
    return map;
  }, [inventoryAdjustments]);

  const computeForecastDays = (itemId: string, stock: number) => {
    const consumption = recentConsumptionByItem.get(itemId) ?? 0;
    if (consumption <= 0) return null;
    const avgDaily = consumption / 14;
    if (avgDaily <= 0) return null;
    return Math.max(0, Math.round(stock / avgDaily));
  };

  const formatMonthlyCap = (cap: number, unit: Unit) => {
    const normalized = Number(cap ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return `0.00 ${unit}`;
    return `${normalized.toFixed(2)} ${unit}`;
  };

  const getMonthlyRestockTotal = (itemId: string) => monthRestockAddedByItem.get(itemId) ?? 0;

  const openStockModal = (item: InventoryItem) => {
    setStockModal({
      open: true,
      item,
      action: 'correction',
      correctionMode: 'delta',
      correctionDirection: 'add',
      quantity: '1',
      exactStock: item.stock.toFixed(2),
      unit: item.unit,
      reason: 'expired',
      note: '',
      monthlyRestockCap: item.monthlyRestockCap.toFixed(2),
    });
  };

  const closeStockModal = () => {
    setStockModal((prev) => ({ ...prev, open: false, item: null }));
  };

  const submitStockModal = () => {
    if (!stockModal.item) return;
    const monthlyCapNum = Number(stockModal.monthlyRestockCap);
    if (!Number.isFinite(monthlyCapNum) || monthlyCapNum <= 0) {
      toast.error('Monthly max stock is required and must be greater than zero.');
      return;
    }
    const normalizedMonthlyCap = Number(monthlyCapNum.toFixed(2));
    if (Math.abs(normalizedMonthlyCap - stockModal.item.monthlyRestockCap) > 0.0001) {
      updateInventoryItem(stockModal.item.id, { monthlyRestockCap: normalizedMonthlyCap }, 'Monthly max stock updated');
    }

    const quantityNum = Number(stockModal.quantity);
    const exactNum = Number(stockModal.exactStock);

    if (stockModal.action === 'waste') {
      if (!quantityNum || quantityNum <= 0) {
        toast.error('Enter a valid waste quantity.');
        return;
      }
      logWaste(stockModal.item.id, quantityNum, stockModal.unit, stockModal.reason, stockModal.note || undefined);
      toast.warning(`Waste logged for ${stockModal.item.name}.`);
      closeStockModal();
      return;
    }

    if (stockModal.action === 'stock_in') {
      if (!quantityNum || quantityNum <= 0) {
        toast.error('Enter a valid stock in quantity.');
        return;
      }
      const incoming = convertUnits(quantityNum, stockModal.unit, stockModal.item.unit);
      const monthlyAdded = getMonthlyRestockTotal(stockModal.item.id);
      if (monthlyAdded + incoming > normalizedMonthlyCap) {
        toast.error('Cannot add anymore, exceeds the maximum quantity for this month.');
        return;
      }
      stockInventory(stockModal.item.id, quantityNum, stockModal.unit, stockModal.note || 'Stock in');
      toast.success(`${stockModal.item.name} updated.`);
      closeStockModal();
      return;
    }

    if (stockModal.correctionMode === 'set') {
      if (Number.isNaN(exactNum) || exactNum < 0) {
        toast.error('Enter a valid exact stock value.');
        return;
      }
      const item = stockModal.item;
      const incoming = Math.max(0, exactNum - item.stock);
      const monthlyAdded = getMonthlyRestockTotal(item.id);
      if (monthlyAdded + incoming > normalizedMonthlyCap) {
        toast.error('Cannot add anymore, exceeds the maximum quantity for this month.');
        return;
      }
      updateInventoryItem(stockModal.item.id, { stock: exactNum }, stockModal.note || 'Count correction');
      toast.success(`${stockModal.item.name} corrected.`);
      closeStockModal();
      return;
    }

    if (!quantityNum || Number.isNaN(quantityNum)) {
      toast.error('Enter a valid correction quantity.');
      return;
    }
    if (stockModal.correctionDirection === 'add') {
      const item = stockModal.item;
      const incoming = convertUnits(Math.abs(quantityNum), stockModal.unit, item.unit);
      const monthlyAdded = getMonthlyRestockTotal(item.id);
      if (monthlyAdded + incoming > normalizedMonthlyCap) {
        toast.error('Cannot add anymore, exceeds the maximum quantity for this month.');
        return;
      }
      stockInventory(stockModal.item.id, quantityNum, stockModal.unit, stockModal.note || 'Stock in');
      toast.success(`${stockModal.item.name} updated.`);
      closeStockModal();
      return;
    }
    const signedDelta = stockModal.correctionDirection === 'subtract' ? -Math.abs(quantityNum) : Math.abs(quantityNum);
    adjustInventory(stockModal.item.id, signedDelta, stockModal.unit, stockModal.note || 'Manual correction');
    toast.success(`${stockModal.item.name} corrected.`);
    closeStockModal();
  };

  const projectedStock = useMemo(() => {
    if (!stockModal.item) return null;
    const current = stockModal.item.stock;
    if (stockModal.action === 'waste') {
      const qty = Number(stockModal.quantity);
      if (!qty || qty <= 0) return current;
      const delta = convertUnits(qty, stockModal.unit, stockModal.item.unit);
      return Math.max(0, current - delta);
    }
    if (stockModal.action === 'stock_in') {
      const qty = Number(stockModal.quantity);
      if (!qty || qty <= 0) return current;
      const delta = convertUnits(qty, stockModal.unit, stockModal.item.unit);
      return current + delta;
    }
    if (stockModal.correctionMode === 'set') {
      const exact = Number(stockModal.exactStock);
      return Number.isNaN(exact) ? current : Math.max(0, exact);
    }
    const qty = Number(stockModal.quantity);
    if (!qty || Number.isNaN(qty)) return current;
    const signedQty = stockModal.correctionDirection === 'subtract' ? -Math.abs(qty) : Math.abs(qty);
    const delta = convertUnits(signedQty, stockModal.unit, stockModal.item.unit);
    return Math.max(0, current + delta);
  }, [stockModal]);

  const tabs: Tab[] = ['All', 'Ingredients', 'Materials', 'Equipment', 'Add-ons', 'Low Stock'];
  const addOnInventoryNames = useMemo(
    () => new Set(DRINK_ADD_ONS.map((entry) => entry.inventoryItemName.toLowerCase())),
    []
  );

  const itemIdByLowerName = useMemo(() => {
    const map = new Map<string, string>();
    inventory.forEach((item) => {
      map.set(item.name.trim().toLowerCase(), item.id);
    });
    return map;
  }, [inventory]);

  const inventoryProductMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();

    products.forEach((product) => {
      const recipe = productRecipes[product.id] ?? [];
      recipe.forEach((entry) => {
        const linkedInventoryId = entry.inventoryItemId ?? itemIdByLowerName.get(entry.inventoryName.trim().toLowerCase());
        if (!linkedInventoryId) return;

        const current = map.get(linkedInventoryId) ?? [];
        if (!current.some((linked) => linked.id === product.id)) {
          current.push({ id: product.id, name: product.name });
        }
        map.set(linkedInventoryId, current);
      });
    });

    map.forEach((linkedProducts, key) => {
      linkedProducts.sort((a, b) => a.name.localeCompare(b.name));
      map.set(key, linkedProducts);
    });

    return map;
  }, [products, productRecipes, itemIdByLowerName]);

  const productFilterOptions = useMemo(() => {
    return products
      .filter((product) => (productRecipes[product.id] ?? []).length > 0)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, productRecipes]);

  const filteredInventory = useMemo(() => {
    let filtered = inventory;
    if (activeTab === 'Low Stock') {
      filtered = inventory.filter(item => item.status === 'low');
    } else if (activeTab === 'Add-ons') {
      filtered = inventory.filter(
        (item) =>
          item.category === 'Ingredients' &&
          addOnInventoryNames.has(item.name.trim().toLowerCase())
      );
    } else if (activeTab !== 'All') {
      filtered = inventory.filter(item => item.category === activeTab);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (inventoryProductMap.get(item.id) ?? []).some((product) => product.name.toLowerCase().includes(query))
      );
    }

    if (productFilter !== 'all') {
      filtered = filtered.filter((item) =>
        (inventoryProductMap.get(item.id) ?? []).some((product) => product.id === productFilter)
      );
    }

    const statusRank: Record<InventoryItem['status'], number> = {
      low: 0,
      normal: 1,
      high: 2,
    };

    const latestStockAddedMap = new Map<string, number>();
    inventoryAdjustments.forEach((adj) => {
      if (adj.delta <= 0) return;
      const prev = latestStockAddedMap.get(adj.inventoryItemId) ?? 0;
      if (adj.createdAt > prev) {
        latestStockAddedMap.set(adj.inventoryItemId, adj.createdAt);
      }
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortOption === 'status') {
        const diff = statusRank[a.status] - statusRank[b.status];
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }

      if (sortOption === 'linked_product') {
        const aLinked = inventoryProductMap.get(a.id) ?? [];
        const bLinked = inventoryProductMap.get(b.id) ?? [];
        const aFirst = aLinked[0]?.name ?? '';
        const bFirst = bLinked[0]?.name ?? '';
        if (aFirst && bFirst) {
          const byProduct = aFirst.localeCompare(bFirst);
          if (byProduct !== 0) return byProduct;
        }
        if (aFirst && !bFirst) return -1;
        if (!aFirst && bFirst) return 1;
        return a.name.localeCompare(b.name);
      }

      if (sortOption === 'latest_stock_add') {
        const aTs = latestStockAddedMap.get(a.id) ?? 0;
        const bTs = latestStockAddedMap.get(b.id) ?? 0;
        if (aTs !== bTs) return bTs - aTs;
        return a.name.localeCompare(b.name);
      }

      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [
    inventory,
    activeTab,
    searchQuery,
    productFilter,
    addOnInventoryNames,
    inventoryAdjustments,
    sortOption,
    inventoryProductMap,
  ]);

  const handleDeleteItem = (item: InventoryItem) => {
    if (!isAdmin) return;
    setPendingDeleteItem(item);
  };

  const saveMonthlyCap = (item: InventoryItem) => {
    const raw = capDrafts[item.id] ?? item.monthlyRestockCap.toFixed(2);
    const nextCap = Number(raw);
    if (!Number.isFinite(nextCap) || nextCap <= 0) {
      toast.error('Monthly max stock must be greater than zero.');
      return;
    }
    const normalized = Number(nextCap.toFixed(2));
    if (Math.abs(normalized - item.monthlyRestockCap) < 0.0001) {
      toast.message('Monthly max stock is unchanged.');
      return;
    }
    updateInventoryItem(item.id, { monthlyRestockCap: normalized }, 'Monthly max stock updated');
    setCapDrafts((prev) => ({ ...prev, [item.id]: normalized.toFixed(2) }));
    toast.success(`Monthly max stock updated for ${item.name}.`);
  };

  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      toast.error('Please enter an item name');
      return;
    }
    const monthlyCapNum = Number(newItem.monthlyRestockCap);
    if (!Number.isFinite(monthlyCapNum) || monthlyCapNum <= 0) {
      toast.error('Monthly max stock is required and must be greater than zero.');
      return;
    }
    addInventoryItem({
      ...newItem,
      monthlyRestockCap: Number(monthlyCapNum.toFixed(2)),
      status: newItem.stock <= newItem.reorderLevel ? 'low' : newItem.stock > newItem.reorderLevel * 2 ? 'high' : 'normal'
    });
    toast.success('Item added successfully!', {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' }
    });
    setShowAddModal(false);
    setNewItem({
      name: '',
      category: 'Ingredients',
      stock: 0,
      unit: 'kg',
      reorderLevel: 5,
      monthlyRestockCap: '1'
    });
  };

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] mb-1 tracking-tight">Inventory</h2>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Manage stock levels and supplies.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 bg-white/50 border border-[#D8C4AC]/30 rounded-full p-1 backdrop-blur-md">
            {(['cards', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                  viewMode === mode
                    ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-sm'
                    : 'text-[#4D0E13]/60 hover:text-[#4D0E13]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#4D0E13] text-[#F5EFE6] px-5 py-2.5 rounded-full hover:bg-[#3a0a0e] transition-all shadow-md active:scale-95 text-sm font-bold uppercase tracking-wide"
            >
              <Plus size={16} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Search + Sort Controls */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
        <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
          <Search size={16} className="text-[#4D0E13]/60" />
          <input
            type="text"
            placeholder="Search item, category, or mapped product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#4D0E13] placeholder-[#4D0E13]/40 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3 py-2 backdrop-blur-md">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#4D0E13]/55">Product</span>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="bg-white/80 border border-[#D8C4AC]/30 rounded-lg px-2 py-1 text-xs font-semibold text-[#4D0E13]"
          >
            <option value="all">All products</option>
            {productFilterOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3 py-2 backdrop-blur-md">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#4D0E13]/55">Sort</span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="bg-white/80 border border-[#D8C4AC]/30 rounded-lg px-2 py-1 text-xs font-semibold text-[#4D0E13]"
          >
            <option value="name">Name (A-Z)</option>
            <option value="status">Stock Status</option>
            <option value="linked_product">Mapped Product</option>
            <option value="latest_stock_add">Latest Stock Added</option>
          </select>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 mb-6 hide-scrollbar pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab ? 'text-[#4D0E13]' : 'text-[#4D0E13]/60 hover:text-[#4D0E13] hover:bg-white/20'
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="inventoryTab"
                className="absolute inset-0 bg-white/60 border border-white/50 shadow-sm rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab === 'Low Stock' && <AlertCircle size={14} className={activeTab === tab ? "text-red-500" : ""} />}
              {tab}
            </span>
          </button>
        ))}
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 items-stretch auto-rows-fr">
          <AnimatePresence initial={false}>
            {filteredInventory.map((item) => {
              const isLow = item.status === 'low';
              const isCapReached = item.status === 'high';
              const tone = getStatusTone(item.status);
              const visualCap = item.monthlyRestockCap > 0 ? item.monthlyRestockCap : Math.max(item.reorderLevel * 3, 1);
              const progress = item.status === 'high'
                ? 100
                : Math.min(100, Math.max(0, (item.stock / visualCap) * 100));
              const forecastDays = computeForecastDays(item.id, item.stock);
              const linkedProducts = inventoryProductMap.get(item.id) ?? [];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border p-5 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex h-full min-h-[30rem] flex-col ${
                    isLow ? 'border-red-200/50 bg-red-50/20' : 'border-white/50'
                  }`}
                >
                  {isLow && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-bl-full -mr-16 -mt-16 mix-blend-multiply opacity-50 blur-xl" />
                  )}

                  <div className="relative z-10 flex flex-1 flex-col">
                    <div className="mb-3.5 min-h-[4.25rem]">
                      <div className="flex min-h-[2.75rem] flex-wrap content-start items-start gap-1.5">
                        <span className="text-xs font-bold text-[#4D0E13]/50 uppercase tracking-wider bg-[#D8C4AC]/20 px-2.5 py-1 rounded-md inline-flex items-center">
                          {item.category}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md inline-flex items-center ${tone.badge}`}>
                          {getStatusLabel(item.status)}
                        </span>
                        {addOnInventoryNames.has(item.name.trim().toLowerCase()) ? (
                          <span className="text-[10px] font-bold text-[#4D0E13] uppercase tracking-wider bg-[#EADDD1] px-2.5 py-1 rounded-md inline-flex items-center">
                            Add-on stock
                          </span>
                        ) : (
                          <span className="invisible text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md inline-flex items-center">
                            Add-on stock
                          </span>
                        )}
                      </div>
                      <h4 className="mt-1.5 min-h-[2.25rem] font-serif text-xl leading-tight text-[#4D0E13] line-clamp-2">
                        {item.name}
                      </h4>
                    </div>

                    <div className="mb-5 flex flex-1 flex-col">
                      <div className="flex min-h-[2.5rem] items-baseline gap-1.5">
                        <span className={`text-3xl sm:text-4xl font-serif ${tone.text}`}>
                          {formatStock(item.stock)}
                        </span>
                        <span className="text-sm font-medium text-[#4D0E13]/60">{item.unit}</span>
                      </div>

                      <div className="w-full h-1.5 bg-[#D8C4AC]/30 rounded-full mt-3 overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                          className={`h-full rounded-full ${tone.bar}`}
                        />
                      </div>
                      <p className="text-xs text-[#4D0E13]/50 mt-1.5 font-medium">Reorder at {item.reorderLevel} {item.unit}</p>
                      <p className="text-xs text-[#4D0E13]/50 mt-1 font-medium">
                        Monthly cap:{' '}
                        {formatMonthlyCap(item.monthlyRestockCap, item.unit)}
                      </p>
                      <div className="mt-1 min-h-[4.5rem]">
                        {linkedProducts.length > 0 ? (
                          <ExpandableDescription
                            id={`inventory-used-by-${item.id}`}
                            text={`Used by: ${linkedProducts.map((product) => product.name).join(', ')}`}
                            clampLines={2}
                            className="mt-0"
                            paragraphClassName="text-left"
                            textClassName="text-xs text-[#4D0E13]/55 font-medium leading-5"
                            buttonClassName="mt-0.5 text-[10px] font-bold text-[#4D0E13]/65 uppercase tracking-[0.16em]"
                            fadeClassName="bg-gradient-to-t from-white/95 via-white/65 to-transparent"
                            wrapperClassName="min-h-[4.5rem]"
                          />
                        ) : (
                          <div className="invisible text-xs font-medium leading-5">Used by: none</div>
                        )}
                      </div>
                      <div className="mt-1.5 min-h-[1.5rem]">
                        {isCapReached ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Cap reached
                          </span>
                        ) : (
                          <span className="invisible inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                            Cap reached
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="mt-2.5 min-h-[5.5rem] rounded-xl border border-[#D8C4AC]/35 bg-white/55 p-2 flex flex-col justify-between">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D0E13]/45">
                            Edit max stock
                          </p>
                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={capDrafts[item.id] ?? item.monthlyRestockCap.toFixed(2)}
                              onChange={(e) =>
                                setCapDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="w-32 bg-white/80 border border-[#D8C4AC]/50 rounded-lg px-2 py-1.25 text-xs text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                            />
                            <button
                              onClick={() => saveMonthlyCap(item)}
                              className="h-8 px-2.5 py-1.5 rounded-lg bg-[#4D0E13] text-white text-[11px] font-bold uppercase tracking-wide hover:bg-[#3a0a0e]"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="mt-0.5 text-xs text-[#4D0E13]/50 font-medium">
                        Forecast: {forecastDays == null ? 'Insufficient usage data' : `${forecastDays} day(s) remaining`}
                      </p>
                    </div>

                  {isAdmin && (
                    <div className="mt-auto flex flex-col gap-2 pt-3.5 border-t border-[#D8C4AC]/30 relative z-10">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openStockModal(item)}
                          className="flex-1 bg-white/50 text-[#4D0E13] border border-[#D8C4AC]/50 px-4 py-2 rounded-xl text-sm hover:bg-white/80 transition-colors flex items-center justify-center gap-1.5 font-medium"
                        >
                          <Edit2 size={16} /> Update Stock
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-2 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-[#D8C4AC]/35 bg-white/60 backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#F5EFE6]/70 text-[#4D0E13]/70 uppercase tracking-wider text-xs">
              <tr>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Stock</th>
                <th className="text-left px-4 py-3">Reorder</th>
                <th className="text-left px-4 py-3">Monthly Cap</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Forecast</th>
                {isAdmin && <th className="text-left px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const isCapReached = item.status === 'high';
                const tone = getStatusTone(item.status);
                const forecastDays = computeForecastDays(item.id, item.stock);
                return (
                  <tr key={item.id} className="border-t border-[#D8C4AC]/25 text-[#4D0E13] align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-[11px] text-[#4D0E13]/55">{item.id}</p>
                    </td>
                    <td className="px-4 py-3">{item.category}</td>
                    <td className="px-4 py-3 font-semibold">{formatStock(item.stock)} {item.unit}</td>
                    <td className="px-4 py-3 text-[#4D0E13]/70">{item.reorderLevel} {item.unit}</td>
                    <td className="px-4 py-3 text-[#4D0E13]/70">
                      <div className="flex flex-col gap-2">
                        <div>{formatMonthlyCap(item.monthlyRestockCap, item.unit)}</div>
                        {isCapReached && (
                          <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Cap reached
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="mt-3 rounded-lg border border-[#D8C4AC]/35 bg-white/55 p-2">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D0E13]/45">
                            Edit max stock
                          </p>
                          <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={capDrafts[item.id] ?? item.monthlyRestockCap.toFixed(2)}
                            onChange={(e) =>
                              setCapDrafts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-28 bg-white/80 border border-[#D8C4AC]/50 rounded-lg px-2 py-1 text-xs text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                          />
                          <button
                            onClick={() => saveMonthlyCap(item)}
                            className="px-2 py-1 rounded-lg bg-[#4D0E13] text-white text-[10px] font-bold uppercase tracking-wide hover:bg-[#3a0a0e]"
                          >
                            Save
                          </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${tone.badge}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#4D0E13]/70">
                      {forecastDays == null ? 'Insufficient usage data' : `${forecastDays} day(s)`}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openStockModal(item)}
                            className="px-3 py-1.5 rounded-lg border border-[#D8C4AC]/50 bg-white/60 text-xs font-semibold hover:bg-white"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inventory Empty State */}
      {filteredInventory.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-24 h-24 bg-[#D8C4AC]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={36} className="text-[#4D0E13]/30" />
          </div>
          <h3 className="font-serif text-2xl text-[#4D0E13]/60 mb-2">No items found</h3>
          <p className="text-[#4D0E13]/40 text-sm max-w-xs">
            {activeTab === 'Low Stock' ? 'All items are well-stocked.' : 'Start adding inventory items to manage your supplies.'}
          </p>
        </div>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] sm:w-full max-w-md max-h-[90vh] overflow-y-auto bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl z-50 p-5 sm:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif text-[#4D0E13]">Add New Item</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-[#D8C4AC]/20 rounded-full transition-colors"
                >
                  <X size={20} className="text-[#4D0E13]/60" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Item Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g., Espresso Beans"
                    className="w-full bg-white/50 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] placeholder:text-[#4D0E13]/30 focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                    Category
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InventoryItem['category'] })}
                    className="w-full bg-white/50 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all"
                  >
                    <option value="Ingredients">Ingredients</option>
                    <option value="Materials">Materials</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>

                {/* Stock and Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                      Stock
                    </label>
                    <input
                      type="number"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full bg-white/50 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                      Unit
                    </label>
                    <select
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      className="w-full bg-white/50 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all"
                    >
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="pcs">pcs</option>
                      <option value="bottles">bottles</option>
                      <option value="units">units</option>
                    </select>
                  </div>
                </div>

                {/* Reorder Level */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={newItem.reorderLevel}
                    onChange={(e) => setNewItem({ ...newItem, reorderLevel: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full bg-white/50 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all"
                  />
                  <p className="text-xs text-[#4D0E13]/40 mt-1.5">Alert when stock falls below this level</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                    Max Restock Per Month
                  </label>
                  <input
                    type="number"
                    value={newItem.monthlyRestockCap}
                    onChange={(e) => setNewItem({ ...newItem, monthlyRestockCap: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 250"
                    required
                    className="w-full bg-white/50 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] placeholder:text-[#4D0E13]/30 focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all"
                  />
                  <p className="text-xs text-[#4D0E13]/40 mt-1.5">Required. Blocks restocks that exceed this month's maximum quantity.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 bg-white/50 text-[#4D0E13] border border-[#D8C4AC]/50 rounded-full font-bold hover:bg-white/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="flex-1 px-6 py-3 bg-[#4D0E13] text-[#EEE4DA] rounded-full font-bold hover:bg-[#3a0a0e] transition-all shadow-md active:scale-95"
                >
                  Add Item
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title={pendingDeleteItem ? `Delete ${pendingDeleteItem.name}?` : 'Delete inventory item?'}
        message="This action cannot be undone and will remove this inventory item from the system."
        onCancel={() => setPendingDeleteItem(null)}
        onConfirm={() => {
          if (!pendingDeleteItem) return;
          deleteInventoryItem(pendingDeleteItem.id);
          toast.success('Item removed');
          setPendingDeleteItem(null);
        }}
      />

      {stockModal.open && stockModal.item && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[260]">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeStockModal}
            />
            <div
              className="absolute top-1/2 left-1/2 z-[261] w-[calc(100%-1.5rem)] sm:w-full max-w-md max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-white/95 backdrop-blur-2xl border border-white/85 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl p-5 sm:p-8"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-2xl font-serif text-[#4D0E13]">Update Stock</h3>
                <button
                  onClick={closeStockModal}
                  className="p-2 hover:bg-[#D8C4AC]/20 rounded-full transition-colors"
                >
                  <X size={20} className="text-[#4D0E13]/60" />
                </button>
              </div>

              <p className="text-sm text-[#4D0E13]/60 mb-4">Item: <span className="font-semibold text-[#4D0E13]">{stockModal.item.name}</span></p>

              <div className="flex gap-2 mb-4">
                {(['stock_in', 'correction', 'waste'] as StockAction[]).map((action) => (
                  <button
                    key={action}
                    onClick={() => setStockModal((prev) => ({ ...prev, action }))}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      stockModal.action === action
                        ? 'bg-[#4D0E13] text-[#EEE4DA]'
                        : 'bg-white/65 text-[#4D0E13]/65 border border-[#D8C4AC]/45 hover:text-[#4D0E13]'
                    }`}
                  >
                    {action === 'stock_in' ? 'Stock In' : action}
                  </button>
                ))}
              </div>

              {stockModal.action === 'correction' && (
                <div className="flex gap-2 mb-3">
                  {(['delta', 'set'] as CorrectionMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setStockModal((prev) => ({ ...prev, correctionMode: mode }))}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        stockModal.correctionMode === mode
                          ? 'bg-[#C8A49F] text-white'
                          : 'bg-white/65 text-[#4D0E13]/65 border border-[#D8C4AC]/45'
                      }`}
                    >
                      {mode === 'delta' ? 'Add/Subtract' : 'Set Exact'}
                    </button>
                  ))}
                </div>
              )}

              {stockModal.action === 'correction' && stockModal.correctionMode === 'delta' && (
                <div className="flex gap-2 mb-3">
                  {(['add', 'subtract'] as CorrectionDirection[]).map((direction) => (
                    <button
                      key={direction}
                      onClick={() => setStockModal((prev) => ({ ...prev, correctionDirection: direction }))}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        stockModal.correctionDirection === direction
                          ? direction === 'add'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                          : 'bg-white/65 text-[#4D0E13]/65 border border-[#D8C4AC]/45'
                      }`}
                    >
                      {direction === 'add' ? 'Add Stock' : 'Subtract Stock'}
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-[#F7F1E9] border border-[#D8C4AC]/45 rounded-xl p-3 mb-3 text-xs">
                <p className="text-[#4D0E13]/70">Current: <span className="font-bold text-[#4D0E13]">{stockModal.item.stock.toFixed(2)} {stockModal.item.unit}</span></p>
                <p className="text-[#4D0E13]/70">Projected: <span className="font-bold text-[#4D0E13]">{(projectedStock ?? stockModal.item.stock).toFixed(2)} {stockModal.item.unit}</span></p>
                <p className="text-[#4D0E13]/70">
                  Added this month:{' '}
                  <span className="font-bold text-[#4D0E13]">{getMonthlyRestockTotal(stockModal.item.id).toFixed(2)} {stockModal.item.unit}</span>
                </p>
                <p className="text-[#4D0E13]/70">
                  Monthly cap:{' '}
                  <span className="font-bold text-[#4D0E13]">{formatMonthlyCap(stockModal.item.monthlyRestockCap, stockModal.item.unit)}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">
                    {stockModal.action === 'correction' && stockModal.correctionMode === 'set' ? 'Exact Stock' : 'Quantity'}
                  </label>
                  {stockModal.action === 'correction' && stockModal.correctionMode === 'set' ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stockModal.exactStock}
                      onChange={(e) => setStockModal((prev) => ({ ...prev, exactStock: e.target.value }))}
                      className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stockModal.quantity}
                      onChange={(e) => setStockModal((prev) => ({ ...prev, quantity: e.target.value }))}
                      className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Unit</label>
                  <select
                    value={stockModal.unit}
                    onChange={(e) => setStockModal((prev) => ({ ...prev, unit: e.target.value as Unit }))}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                  >
                    {unitChoices.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Max Restock Per Month</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockModal.monthlyRestockCap}
                  onChange={(e) => setStockModal((prev) => ({ ...prev, monthlyRestockCap: e.target.value }))}
                  className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                />
              </div>

              {stockModal.action === 'waste' && (
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Reason</label>
                  <select
                    value={stockModal.reason}
                    onChange={(e) => setStockModal((prev) => ({ ...prev, reason: e.target.value as WasteReason }))}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                  >
                    <option value="expired">Expired</option>
                    <option value="spillage">Spillage</option>
                    <option value="damage">Damage</option>
                    <option value="overproduction">Overproduction</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Note (optional)</label>
                <textarea
                  value={stockModal.note}
                  onChange={(e) => setStockModal((prev) => ({ ...prev, note: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13] focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50"
                  placeholder="Add context for this stock update"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeStockModal}
                  className="flex-1 px-6 py-3 bg-white/60 text-[#4D0E13] border border-[#D8C4AC]/50 rounded-full font-bold hover:bg-white/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitStockModal}
                  className="flex-1 px-6 py-3 bg-[#4D0E13] text-white rounded-full font-bold hover:bg-[#3a0a0e] transition-all shadow-md active:scale-95"
                >
                  Save Update
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}