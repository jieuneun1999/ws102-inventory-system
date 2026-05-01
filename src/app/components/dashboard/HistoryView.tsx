import { useDeferredValue, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, Box, CalendarDays, Clock3, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { useAppStore, type HistoryDomain } from '../../store';
import { classifyHistoryEvent } from '../../lib/supabaseSync';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type HistoryTab = 'all' | HistoryDomain;
type HistoryFilter = 'all' | 'stock_in' | 'deduction' | 'correction' | 'waste' | 'order' | 'receipt' | 'product';
type InventoryHistorySort = 'newest' | 'oldest';

type InventoryHistoryEvent = {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
  ingredientInventoryItemIds: string[];
  relatedProducts: Array<{ id: string; name: string }>;
};

type TimelineEvent = {
  id: string;
  domain: HistoryDomain | 'all';
  kind?: string;
  title: string;
  detail: string;
  createdAt: number;
  relatedProducts?: Array<{ id: string; name: string }>;
};

const toLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatHistoryDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const shiftDate = (value: string, offset: number) => {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(year, month - 1, day + offset, 12, 0, 0, 0);
  return toLocalDateInputValue(next);
};

const toDayKey = (timestamp: number) => toLocalDateInputValue(new Date(timestamp));

const HISTORY_TONES = {
  stock_in: { label: 'Stock In', ring: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', accent: 'bg-emerald-500' },
  deduction: { label: 'Deduction', ring: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', accent: 'bg-orange-500' },
  correction: { label: 'Correction', ring: 'border-sky-200', badge: 'bg-sky-100 text-sky-800', accent: 'bg-sky-500' },
  waste: { label: 'Waste', ring: 'border-rose-200', badge: 'bg-rose-100 text-rose-800', accent: 'bg-rose-500' },
  product: { label: 'Product', ring: 'border-violet-200', badge: 'bg-violet-100 text-violet-800', accent: 'bg-violet-500' },
  order: { label: 'Order', ring: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-800', accent: 'bg-cyan-500' },
  receipt: { label: 'Receipt', ring: 'border-teal-200', badge: 'bg-teal-100 text-teal-800', accent: 'bg-teal-500' },
} as const;

const getHistoryTone = (event: TimelineEvent) => {
  const kind = classifyHistoryEvent(event);
  return HISTORY_TONES[kind as keyof typeof HISTORY_TONES] ?? HISTORY_TONES.correction;
};

export function HistoryView() {
  const historyEvents = useAppStore((state) => state.historyEvents);
  const receipts = useAppStore((state) => state.receipts);
  const orders = useAppStore((state) => state.orders);
  const products = useAppStore((state) => state.products);
  const inventory = useAppStore((state) => state.inventory);
  const productRecipes = useAppStore((state) => state.productRecipes);
  const inventoryAdjustments = useAppStore((state) => state.inventoryAdjustments);
  const wasteLogs = useAppStore((state) => state.wasteLogs);
  const printReceipt = useAppStore((state) => state.printReceipt);
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue());
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const deferredInventorySearchQuery = useDeferredValue(inventorySearchQuery);
  const [inventoryProductFilter, setInventoryProductFilter] = useState<string>('all');
  const [inventorySort, setInventorySort] = useState<InventoryHistorySort>('newest');

  const selectedDateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const selectedDateLabel = useMemo(() => formatHistoryDate(selectedDate), [selectedDate]);
  const receiptList = useMemo(() => Object.values(receipts).sort((a, b) => b.issuedAt - a.issuedAt), [receipts]);

  const productFallbackEvents = useMemo(
    () =>
      orders
        .filter((order) => order.items.length > 0)
        .map((order) => ({
          id: `order-products-${order.id}`,
          domain: 'products' as const,
          title: `Products sold in order #${order.orderNumber}`,
          detail: order.items.map((item) => `${item.quantity}x ${item.name}`).join(', '),
          createdAt: order.createdAt,
        })),
    [orders]
  );

  const mergedAllEvents = useMemo<TimelineEvent[]>(() => {
    const merged = [...historyEvents, ...productFallbackEvents];
    const seen = new Set<string>();
    return merged
      .filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      })
        .sort((a, b) => b.createdAt - a.createdAt);
  }, [historyEvents, productFallbackEvents]);

  const selectedDayAllEvents = useMemo(
    () => mergedAllEvents.filter((event) => toDayKey(event.createdAt) === selectedDate),
    [mergedAllEvents, selectedDate]
  );

  const selectedDayAllEventsFiltered = useMemo(
    () =>
      historyFilter === 'all'
        ? selectedDayAllEvents
        : selectedDayAllEvents.filter((event) => classifyHistoryEvent(event) === historyFilter),
    [historyFilter, selectedDayAllEvents]
  );

  const historyFilterCounts = useMemo(() => {
    const counts: Record<HistoryFilter, number> = {
      all: selectedDayAllEvents.length,
      stock_in: 0,
      deduction: 0,
      correction: 0,
      waste: 0,
      order: 0,
      receipt: 0,
      product: 0,
    };

    selectedDayAllEvents.forEach((event) => {
      const kind = classifyHistoryEvent(event) as HistoryFilter;
      counts[kind] = (counts[kind] ?? 0) + 1;
    });

    return counts;
  }, [selectedDayAllEvents]);

  const selectedDayOrderEvents = useMemo(
    () =>
      historyEvents
        .filter((event) => event.domain === 'orders')
        .filter((event) => toDayKey(event.createdAt) === selectedDate)
        .sort((a, b) => b.createdAt - a.createdAt),
    [historyEvents, selectedDate]
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

  const productIngredientInventoryItemIds = useMemo(() => {
    const map = new Map<string, Set<string>>();

    products.forEach((product) => {
      const recipe = productRecipes[product.id] ?? [];
      const ids = new Set<string>();

      recipe.forEach((entry) => {
        const linkedInventoryId = entry.inventoryItemId ?? itemIdByLowerName.get(entry.inventoryName.trim().toLowerCase());
        if (linkedInventoryId) {
          ids.add(linkedInventoryId);
        }
      });

      map.set(product.id, ids);
    });

    return map;
  }, [products, productRecipes, itemIdByLowerName]);

  const inventoryProductOptions = useMemo(
    () =>
      products
        .filter((product) => (productRecipes[product.id] ?? []).length > 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products, productRecipes]
  );

  const inventoryTimelineEvents = useMemo<InventoryHistoryEvent[]>(() => {
    const adjustmentEvents: InventoryHistoryEvent[] = inventoryAdjustments.map((entry) => {
      const deltaLabel = `${entry.delta > 0 ? '+' : ''}${entry.delta.toFixed(2)} ${entry.unit}`;
      return {
        id: `inventory-adjustment-${entry.id}`,
        title: `${entry.inventoryItemName} ${entry.delta < 0 ? 'deducted' : 'updated'}`,
        detail: `${entry.note} • ${deltaLabel}`,
        createdAt: entry.createdAt,
        ingredientInventoryItemIds: [entry.inventoryItemId],
        relatedProducts: inventoryProductMap.get(entry.inventoryItemId) ?? [],
      };
    });

    const wasteEvents: InventoryHistoryEvent[] = wasteLogs.map((entry) => ({
      id: `inventory-waste-${entry.id}`,
      title: `Waste logged for ${entry.inventoryItemName}`,
      detail: `${entry.quantity.toFixed(2)} ${entry.unit} • ${entry.reason}${entry.note ? ` • ${entry.note}` : ''}`,
      createdAt: entry.createdAt,
      ingredientInventoryItemIds: [entry.inventoryItemId],
      relatedProducts: inventoryProductMap.get(entry.inventoryItemId) ?? [],
    }));

    const orderDerivedEvents: InventoryHistoryEvent[] = orders
      .filter((order) => order.status !== 'pending')
      .flatMap((order) =>
        order.items.map((item, idx) => {
          const recipe = productRecipes[item.id] ?? [];
          const preview = recipe.slice(0, 3).map((entry) => entry.inventoryName).join(', ');
          const extraCount = Math.max(0, recipe.length - 3);
          const suffix = extraCount > 0 ? ` +${extraCount} more` : '';
          const linkedProduct = products.find((product) => product.id === item.id);

          return {
            id: `order-inventory-${order.id}-${idx}`,
            title: `Inventory used for ${item.name}`,
            detail: recipe.length > 0 ? `${item.quantity}x ${item.name} • ${preview}${suffix}` : `${item.quantity}x ${item.name}`,
            createdAt: order.approvedAt ?? order.createdAt,
            ingredientInventoryItemIds: recipe
              .map((entry) => entry.inventoryItemId ?? itemIdByLowerName.get(entry.inventoryName.trim().toLowerCase()))
              .filter((inventoryItemId): inventoryItemId is string => Boolean(inventoryItemId)),
            relatedProducts: linkedProduct ? [{ id: linkedProduct.id, name: linkedProduct.name }] : [],
          };
        })
      );

    return [...adjustmentEvents, ...wasteEvents, ...orderDerivedEvents]
      .filter((event, index, list) => list.findIndex((entry) => entry.id === event.id) === index)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [inventoryAdjustments, wasteLogs, inventoryProductMap, orders, productRecipes, products, itemIdByLowerName]);

  const inventoryEvents = useMemo(() => {
    const query = deferredInventorySearchQuery.trim().toLowerCase();
    const selectedIngredientIds = inventoryProductFilter === 'all' ? null : productIngredientInventoryItemIds.get(inventoryProductFilter) ?? new Set<string>();

    let scoped = inventoryTimelineEvents.filter((event) => toDayKey(event.createdAt) === selectedDate);

    if (selectedIngredientIds) {
      scoped = scoped.filter((event) =>
        event.ingredientInventoryItemIds.some((inventoryItemId) => selectedIngredientIds.has(inventoryItemId))
      );
    }

    if (query) {
      scoped = scoped.filter((event) => {
        const haystack = [
          event.title,
          event.detail,
          ...event.relatedProducts.map((product) => product.name),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return [...scoped].sort((a, b) => (inventorySort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
  }, [inventoryTimelineEvents, inventoryProductFilter, deferredInventorySearchQuery, inventorySort, productIngredientInventoryItemIds, selectedDate]);

  const productEvents = useMemo(
    () =>
      productFallbackEvents
        .filter((event) => toDayKey(event.createdAt) === selectedDate)
        .sort((a, b) => b.createdAt - a.createdAt),
    [productFallbackEvents, selectedDate]
  );

  const selectedDayReceipts = useMemo(
    () => receiptList.filter((receipt) => toDayKey(receipt.issuedAt) === selectedDate),
    [receiptList, selectedDate]
  );

  const tabs: { id: HistoryTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'orders', label: 'Orders' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'products', label: 'Products' },
  ];

  const historyFilters: Array<{ id: HistoryFilter; label: string }> = [
    { id: 'all', label: 'All Events' },
    { id: 'stock_in', label: 'Stock In' },
    { id: 'deduction', label: 'Deduction' },
    { id: 'correction', label: 'Correction' },
    { id: 'waste', label: 'Waste' },
    { id: 'order', label: 'Orders' },
    { id: 'receipt', label: 'Receipts' },
    { id: 'product', label: 'Products' },
  ];

  return (
    <div className="w-full flex flex-col h-full pt-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">System History</h2>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Track everything that happened across orders, products, and inventory.</p>
        </div>
      </div>

      <div className="mb-5 rounded-[1.5rem] border border-white/70 bg-white/55 backdrop-blur-xl p-4 shadow-[0_4px_20px_rgba(77,14,19,0.03)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#4D0E13]/50">Date Filter</p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <CalendarDays size={18} className="text-[#4D0E13]/60" />
              <h3 className="text-2xl font-serif text-[#4D0E13]">{selectedDateLabel}</h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedDate((value) => shiftDate(value, -1))}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-white/70 border border-[#D8C4AC]/40 text-[#4D0E13] hover:bg-white"
            >
              Previous Day
            </button>
            <button
              onClick={() => setSelectedDate(toLocalDateInputValue())}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#4D0E13] text-[#EEE4DA] hover:bg-[#3a0a0e]"
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate((value) => shiftDate(value, 1))}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-white/70 border border-[#D8C4AC]/40 text-[#4D0E13] hover:bg-white"
            >
              Next Day
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-white/70 border border-[#D8C4AC]/40 text-[#4D0E13] hover:bg-white">
                  <CalendarDays size={14} /> Pick date
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0 border-[#D8C4AC]/35 bg-white/95 backdrop-blur-xl">
                <Calendar
                  mode="single"
                  selected={selectedDateObj}
                  onSelect={(date) => date && setSelectedDate(toLocalDateInputValue(date))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#4D0E13] text-[#EEE4DA]'
                : 'bg-white/50 text-[#4D0E13]/65 hover:text-[#4D0E13] border border-[#D8C4AC]/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {historyFilters.map((filter) => {
          const active = historyFilter === filter.id;
          const tone = filter.id === 'stock_in'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : filter.id === 'deduction'
                ? 'bg-orange-100 text-orange-800 border-orange-200'
                : filter.id === 'correction'
                  ? 'bg-sky-100 text-sky-800 border-sky-200'
                  : filter.id === 'waste'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : filter.id === 'order'
                      ? 'bg-cyan-100 text-cyan-800 border-cyan-200'
                      : filter.id === 'receipt'
                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                        : filter.id === 'product'
                          ? 'bg-violet-100 text-violet-800 border-violet-200'
                          : 'bg-stone-100 text-stone-800 border-stone-200';

          return (
            <button
              key={filter.id}
              onClick={() => setHistoryFilter(filter.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                active ? tone : 'bg-white/65 text-[#4D0E13]/60 border-[#D8C4AC]/35 hover:bg-white'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-current' : 'bg-[#D8C4AC]'}`} />
              {filter.label}
              <span className="text-[10px] font-extrabold opacity-70">{historyFilterCounts[filter.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'inventory' && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
          <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
            <Search size={16} className="text-[#4D0E13]/60" />
            <input
              type="text"
              placeholder="Search inventory history..."
              value={inventorySearchQuery}
              onChange={(e) => setInventorySearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#4D0E13] placeholder-[#4D0E13]/40 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3 py-2 backdrop-blur-md">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#4D0E13]/55">Product</span>
            <select
              value={inventoryProductFilter}
              onChange={(e) => setInventoryProductFilter(e.target.value)}
              className="bg-white/80 border border-[#D8C4AC]/30 rounded-lg px-2 py-1 text-xs font-semibold text-[#4D0E13]"
            >
              <option value="all">All products</option>
              {inventoryProductOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3 py-2 backdrop-blur-md">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#4D0E13]/55">Sort</span>
            <select
              value={inventorySort}
              onChange={(e) => setInventorySort(e.target.value as InventoryHistorySort)}
              className="bg-white/80 border border-[#D8C4AC]/30 rounded-lg px-2 py-1 text-xs font-semibold text-[#4D0E13]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === 'all' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] gap-4">
          <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl p-4 shadow-sm min-h-[24rem]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#4D0E13]/70" />
              <h3 className="font-serif text-lg text-[#4D0E13]">Day Timeline</h3>
            </div>

            <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1 hide-scrollbar">
              {selectedDayAllEventsFiltered.length === 0 ? (
                <div className="h-52 rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 flex flex-col items-center justify-center text-center">
                  <Sparkles size={20} className="text-[#4D0E13]/30 mb-2" />
                  <p className="text-[#4D0E13]/45 text-sm font-medium">No events found for this filter.</p>
                </div>
              ) : (
                selectedDayAllEventsFiltered.map((event, idx) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.01, 0.08), duration: 0.16, ease: 'easeOut' }}
                    className={`bg-white/60 backdrop-blur-xl border rounded-2xl p-4 shadow-sm ${getHistoryTone(event).ring}`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {event.domain === 'orders' && <ShoppingBag size={14} className="text-[#4D0E13]/60" />}
                        {event.domain === 'products' && <Sparkles size={14} className="text-[#4D0E13]/60" />}
                        <h4 className="font-semibold text-[#4D0E13] text-sm">{event.title}</h4>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${getHistoryTone(event).badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getHistoryTone(event).accent}`} />
                        {getHistoryTone(event).label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4D0E13]/45">
                        <Clock3 size={11} />
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#4D0E13]/60">{event.detail}</p>
                    {event.relatedProducts?.length ? (
                      <p className="text-[11px] text-[#4D0E13]/50 mt-1.5">
                        Linked products: {event.relatedProducts.map((product) => product.name).join(', ')}
                      </p>
                    ) : null}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Archive size={16} className="text-[#4D0E13]/70" />
                <h3 className="font-serif text-lg text-[#4D0E13]">Receipt Archive</h3>
              </div>
              <p className="text-xs text-[#4D0E13]/45 mb-3">Receipts are kept here so the timeline stays readable.</p>

              <div className="space-y-2 max-h-[20rem] overflow-y-auto pr-1 hide-scrollbar">
                {selectedDayReceipts.length === 0 ? (
                  <p className="text-sm text-[#4D0E13]/45">No receipts for this date.</p>
                ) : (
                  selectedDayReceipts.map((receipt) => (
                    <div key={receipt.receiptNumber} className="flex items-center justify-between gap-3 bg-white/70 border border-[#D8C4AC]/35 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-[#4D0E13]">{receipt.receiptNumber}</p>
                        <p className="text-[11px] text-[#4D0E13]/55">
                          Order #{receipt.orderNumber} • P {receipt.total.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => printReceipt(receipt.orderId)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#4D0E13] text-[#EEE4DA] hover:bg-[#3a0a0e]"
                      >
                        Print
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>

            <div className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={16} className="text-[#4D0E13]/70" />
                <h3 className="font-serif text-lg text-[#4D0E13]">Order Snapshot</h3>
              </div>
              <div className="space-y-2 max-h-[14rem] overflow-y-auto pr-1 hide-scrollbar">
                {selectedDayOrderEvents.length === 0 ? (
                  <p className="text-sm text-[#4D0E13]/45">No order events recorded for this date.</p>
                ) : (
                  selectedDayOrderEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="bg-white/70 border border-[#D8C4AC]/35 rounded-xl px-3 py-2">
                      <p className="text-xs font-bold text-[#4D0E13]">{event.title}</p>
                      <p className="text-[11px] text-[#4D0E13]/55">{event.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'inventory' ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Box size={16} className="text-[#4D0E13]/70" />
              <h3 className="font-serif text-lg text-[#4D0E13]">Inventory History for {selectedDateLabel}</h3>
            </div>
            <p className="text-xs text-[#4D0E13]/45">This view only shows inventory actions that happened on the selected day.</p>
          </div>

          <div className="space-y-3 max-h-[44rem] overflow-y-auto pr-1 hide-scrollbar">
            {inventoryEvents.length === 0 ? (
              <div className="h-52 rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 flex flex-col items-center justify-center text-center">
                <Box size={20} className="text-[#4D0E13]/30 mb-2" />
                <p className="text-[#4D0E13]/45 text-sm font-medium">No inventory events found for this date.</p>
              </div>
            ) : (
              inventoryEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.01, 0.08), duration: 0.16, ease: 'easeOut' }}
                  className={`bg-white/60 backdrop-blur-xl border rounded-2xl p-4 shadow-sm ${getHistoryTone(event).ring}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Box size={14} className="text-[#4D0E13]/60" />
                      <h4 className="font-semibold text-[#4D0E13] text-sm">{event.title}</h4>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${getHistoryTone(event).badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${getHistoryTone(event).accent}`} />
                      {getHistoryTone(event).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4D0E13]/45">
                      <Clock3 size={11} />
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#4D0E13]/60">{event.detail}</p>
                  {event.relatedProducts.length > 0 && (
                    <p className="text-[11px] text-[#4D0E13]/50 mt-1.5">
                      Linked products: {event.relatedProducts.map((product) => product.name).join(', ')}
                    </p>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'products' ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-[#4D0E13]/70" />
              <h3 className="font-serif text-lg text-[#4D0E13]">Product History for {selectedDateLabel}</h3>
            </div>
            <p className="text-xs text-[#4D0E13]/45">This view only shows product-related activity that happened on the selected day.</p>
          </div>

          <div className="space-y-3 max-h-[44rem] overflow-y-auto pr-1 hide-scrollbar">
            {productEvents.length === 0 ? (
              <div className="h-52 rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 flex flex-col items-center justify-center text-center">
                <Sparkles size={20} className="text-[#4D0E13]/30 mb-2" />
                <p className="text-[#4D0E13]/45 text-sm font-medium">No product events found for this date.</p>
              </div>
            ) : (
              productEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.01, 0.08), duration: 0.16, ease: 'easeOut' }}
                  className={`bg-white/60 backdrop-blur-xl border rounded-2xl p-4 shadow-sm ${getHistoryTone(event).ring}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#4D0E13]/60" />
                      <h4 className="font-semibold text-[#4D0E13] text-sm">{event.title}</h4>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${getHistoryTone(event).badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${getHistoryTone(event).accent}`} />
                      {getHistoryTone(event).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4D0E13]/45">
                      <Clock3 size={11} />
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#4D0E13]/60">{event.detail}</p>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag size={16} className="text-[#4D0E13]/70" />
              <h3 className="font-serif text-lg text-[#4D0E13]">Order History for {selectedDateLabel}</h3>
            </div>
            <p className="text-xs text-[#4D0E13]/45">Orders and related order events for the selected day.</p>
          </div>

          <div className="space-y-3 max-h-[44rem] overflow-y-auto pr-1 hide-scrollbar">
            {selectedDayOrderEvents.length === 0 ? (
              <div className="h-52 rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 flex flex-col items-center justify-center text-center">
                <ShoppingBag size={20} className="text-[#4D0E13]/30 mb-2" />
                <p className="text-[#4D0E13]/45 text-sm font-medium">No order events found for this date.</p>
              </div>
            ) : (
              selectedDayOrderEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.01, 0.08), duration: 0.16, ease: 'easeOut' }}
                  className={`bg-white/60 backdrop-blur-xl border rounded-2xl p-4 shadow-sm ${getHistoryTone(event).ring}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={14} className="text-[#4D0E13]/60" />
                      <h4 className="font-semibold text-[#4D0E13] text-sm">{event.title}</h4>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${getHistoryTone(event).badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${getHistoryTone(event).accent}`} />
                      {getHistoryTone(event).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4D0E13]/45">
                      <Clock3 size={11} />
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#4D0E13]/60">{event.detail}</p>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
