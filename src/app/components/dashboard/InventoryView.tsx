import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { DRINK_ADD_ONS, useAppStore, type InventoryItem, type Unit, type WasteReason } from '../../store';
import { toast } from 'sonner';

type Tab = 'All' | 'Ingredients' | 'Materials' | 'Equipment' | 'Add-ons' | 'Low Stock';
type StockAction = 'receive' | 'correction' | 'waste';
type CorrectionMode = 'delta' | 'set';
type CorrectionDirection = 'add' | 'subtract';

export function InventoryView() {
  const {
    inventory,
    userRole,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    inventoryAdjustments,
    adjustInventory,
    logWaste,
  } = useAppStore();
  const isAdmin = userRole === 'admin';
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Ingredients' as InventoryItem['category'],
    stock: 0,
    unit: 'kg' as Unit,
    reorderLevel: 5
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
  });

  const unitChoices: Unit[] = ['g', 'kg', 'ml', 'L', 'pcs', 'units', 'bottles'];
  const formatStock = (value: number) => value.toFixed(2);
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

  const computeForecastDays = (itemId: string, stock: number) => {
    const recentMs = 14 * 24 * 60 * 60 * 1000;
    const since = Date.now() - recentMs;
    const consumption = inventoryAdjustments
      .filter((adj) => adj.inventoryItemId === itemId && adj.createdAt >= since && adj.delta < 0)
      .reduce((sum, adj) => sum + Math.abs(adj.delta), 0);

    if (consumption <= 0) return null;
    const avgDaily = consumption / 14;
    if (avgDaily <= 0) return null;
    return Math.max(0, Math.round(stock / avgDaily));
  };

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
    });
  };

  const closeStockModal = () => {
    setStockModal((prev) => ({ ...prev, open: false, item: null }));
  };

  const submitStockModal = () => {
    if (!stockModal.item) return;

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

    if (stockModal.action === 'receive') {
      if (!quantityNum || quantityNum <= 0) {
        toast.error('Enter a valid received quantity.');
        return;
      }
      adjustInventory(stockModal.item.id, quantityNum, stockModal.unit, stockModal.note || 'Stock received');
      toast.success(`${stockModal.item.name} updated.`);
      closeStockModal();
      return;
    }

    if (stockModal.correctionMode === 'set') {
      if (Number.isNaN(exactNum) || exactNum < 0) {
        toast.error('Enter a valid exact stock value.');
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
    if (stockModal.action === 'receive') {
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
    return filtered;
  }, [inventory, activeTab, addOnInventoryNames]);

  const handleDeleteItem = (id: string) => {
    if (!isAdmin) return;
    deleteInventoryItem(id);
    toast.success('Item removed');
  };

  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      toast.error('Please enter an item name');
      return;
    }
    addInventoryItem({
      ...newItem,
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
      reorderLevel: 5
    });
  };

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] mb-1 tracking-tight">Inventory</h2>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Manage stock levels and supplies.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredInventory.map((item) => {
            const isLow = item.status === 'low';
            const progress = Math.min(100, Math.max(0, (item.stock / (item.reorderLevel * 3)) * 100));
            const forecastDays = computeForecastDays(item.id, item.stock);
            
            return (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border p-6 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 ${
                  isLow ? 'border-red-200/50 bg-red-50/20' : 'border-white/50'
                }`}
              >
                {isLow && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-bl-full -mr-16 -mt-16 mix-blend-multiply opacity-50 blur-xl" />
                )}
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <span className="text-xs font-bold text-[#4D0E13]/50 uppercase tracking-wider bg-[#D8C4AC]/20 px-2.5 py-1 rounded-md mb-2 inline-block">
                      {item.category}
                    </span>
                    {addOnInventoryNames.has(item.name.trim().toLowerCase()) && (
                      <span className="ml-2 text-[10px] font-bold text-[#4D0E13] uppercase tracking-wider bg-[#EADDD1] px-2.5 py-1 rounded-md inline-block">
                        Add-on stock
                      </span>
                    )}
                    <h4 className="font-serif text-xl text-[#4D0E13]">{item.name}</h4>
                  </div>
                </div>

                <div className="mb-6 relative z-10">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-4xl font-serif ${isLow ? 'text-red-700' : 'text-[#4D0E13]'}`}>
                      {formatStock(item.stock)}
                    </span>
                    <span className="text-sm font-medium text-[#4D0E13]/60">{item.unit}</span>
                  </div>
                  
                  <div className="w-full h-1.5 bg-[#D8C4AC]/30 rounded-full mt-4 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${isLow ? 'bg-red-500' : item.status === 'high' ? 'bg-blue-400' : 'bg-[#4D0E13]/80'}`}
                    />
                  </div>
                  <p className="text-xs text-[#4D0E13]/50 mt-2 font-medium">Reorder at {item.reorderLevel} {item.unit}</p>
                  <p className="text-xs text-[#4D0E13]/50 mt-1 font-medium">
                    Forecast: {forecastDays == null ? 'Insufficient usage data' : `${forecastDays} day(s) remaining`}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex flex-col gap-2 pt-4 border-t border-[#D8C4AC]/30 relative z-10">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openStockModal(item)}
                        className="flex-1 bg-white/50 text-[#4D0E13] border border-[#D8C4AC]/50 px-4 py-2 rounded-xl text-sm hover:bg-white/80 transition-colors flex items-center justify-center gap-1.5 font-medium"
                      >
                        <Edit2 size={16} /> Update Stock
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-2xl z-50 p-8"
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

      <AnimatePresence>
        {stockModal.open && stockModal.item && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={closeStockModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/85 backdrop-blur-2xl border border-white/70 rounded-[2rem] shadow-2xl z-50 p-8"
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
                {(['receive', 'correction', 'waste'] as StockAction[]).map((action) => (
                  <button
                    key={action}
                    onClick={() => setStockModal((prev) => ({ ...prev, action }))}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      stockModal.action === action
                        ? 'bg-[#4D0E13] text-[#EEE4DA]'
                        : 'bg-white/65 text-[#4D0E13]/65 border border-[#D8C4AC]/45 hover:text-[#4D0E13]'
                    }`}
                  >
                    {action}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}