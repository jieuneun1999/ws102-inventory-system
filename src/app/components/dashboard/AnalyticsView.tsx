import { useEffect, useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { useAppStore } from '../../store';
import { DRINK_ADD_ONS, type Unit } from '../../store';
import {
  fetchDailyAnalyticsForDate,
  fetchDailySalesSummary,
  fetchSlowMovers,
  fetchStockUsageData,
  type DailySalesToday,
  type DailyRevenuePoint,
  type SlowMoverProduct,
  type StockUsageData,
  type DailyAnalyticsDetail,
} from '../../lib/supabaseSync';
import { subscribeDashboardRealtime } from '../../lib/supabaseRealtime';

const toLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatAnalyticsDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
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

type LocalRecipeLine = {
  inventoryItemId?: string;
  inventoryName: string;
  amount: number;
  unit: Unit;
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

const roundTo2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const convertUnits = (amount: number, from: Unit, to: Unit) => {
  if (unitGroup[from] !== unitGroup[to]) return amount;
  return roundTo2((amount * unitToBase[from]) / unitToBase[to]);
};

const toDayKey = (timestamp: number) => toLocalDateInputValue(new Date(timestamp));

const getAddOnUsage = (addOnIds: string[]) =>
  addOnIds
    .map((addOnId) => DRINK_ADD_ONS.find((entry) => entry.id === addOnId))
    .filter((entry): entry is (typeof DRINK_ADD_ONS)[number] => Boolean(entry))
    .map((addOn) => ({
      inventoryName: addOn.inventoryItemName,
      amount: addOn.amount,
      unit: addOn.unit,
    }));

const getSelectedDayAnalyticsFromLocal = (
  orders: ReturnType<typeof useAppStore.getState>['orders'],
  productRecipes: ReturnType<typeof useAppStore.getState>['productRecipes'],
  selectedDate: string,
): DailyAnalyticsDetail => {
  const dayOrders = orders.filter((order) => toDayKey(order.createdAt) === selectedDate);
  const revenueByHour = new Map<number, DailyRevenuePoint>(
    Array.from({ length: 24 }, (_, hour) => [hour, { hour, label: `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? 'PM' : 'AM'}`, revenue: 0, orders: 0 }])
  );
  const salesByProduct: Record<string, { name: string; quantity: number; revenue: number }> = {};

  let totalRevenue = 0;

  dayOrders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    const bucket = revenueByHour.get(hour);
    if (bucket) {
      bucket.revenue = roundTo2(bucket.revenue + order.total);
      bucket.orders += 1;
    }
    totalRevenue += order.total;

    order.items.forEach((item) => {
      if (!salesByProduct[item.id]) {
        salesByProduct[item.id] = { name: item.name, quantity: 0, revenue: 0 };
      }
      salesByProduct[item.id].quantity += item.quantity;
      salesByProduct[item.id].revenue += item.price * item.quantity;
    });
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
    date: selectedDate,
    totalOrders: dayOrders.length,
    totalRevenue: roundTo2(totalRevenue),
    avgOrderValue: dayOrders.length > 0 ? roundTo2(totalRevenue / dayOrders.length) : 0,
    revenueByHour: Array.from(revenueByHour.values()),
    bestSellers,
  };
};

const getSalesTrendFromLocal = (orders: ReturnType<typeof useAppStore.getState>['orders']) => {
  const buckets = new Map<string, DailySalesToday>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    const key = toLocalDateInputValue(day);
    buckets.set(key, { date: key, totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 });
  }

  orders.forEach((order) => {
    const key = toDayKey(order.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.totalOrders += 1;
    bucket.totalRevenue = roundTo2(bucket.totalRevenue + order.total);
  });

  return Array.from(buckets.values()).map((item) => ({
    ...item,
    avgOrderValue: item.totalOrders > 0 ? roundTo2(item.totalRevenue / item.totalOrders) : 0,
  }));
};

const getStockUsageFromLocal = (
  orders: ReturnType<typeof useAppStore.getState>['orders'],
  inventory: ReturnType<typeof useAppStore.getState>['inventory'],
  productRecipes: ReturnType<typeof useAppStore.getState>['productRecipes'],
) => {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const usageWindowDays = 7;
  const recentCutoff = Date.now() - usageWindowDays * 24 * 60 * 60 * 1000;
  const deductionMap = new Map<string, number>();

  orders
    .filter((order) => order.status !== 'pending' && order.createdAt >= recentCutoff)
    .forEach((order) => {
      order.items.forEach((item) => {
        const recipeLines = (productRecipes[item.id] ?? []) as LocalRecipeLine[];
        const addOnLines = item.customization?.addOnIds ? getAddOnUsage(item.customization.addOnIds) : [];

        [...recipeLines, ...addOnLines].forEach((line) => {
          const inventoryItem = inventoryById.get(line.inventoryItemId ?? '') ?? inventory.find((entry) => entry.name.toLowerCase() === line.inventoryName.toLowerCase());
          if (!inventoryItem) return;

          let baseAmount = Number(line.amount ?? 0);
          if (inventoryItem.name.toLowerCase() === 'white sugar' && item.customization) {
            baseAmount = roundTo2(baseAmount * (item.customization.sugarLevel / 100));
          }

          const converted = convertUnits(baseAmount * item.quantity, line.unit, inventoryItem.unit);
          deductionMap.set(inventoryItem.id, roundTo2((deductionMap.get(inventoryItem.id) ?? 0) + converted));
        });
      });
    });

  return inventory.map((item) => {
    const totalDeductions = deductionMap.get(item.id) ?? 0;
    const avgDailyUsage = roundTo2(totalDeductions / usageWindowDays);
    return {
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      totalDeductions: roundTo2(totalDeductions),
      unit: item.unit,
      avgDailyUsage,
      daysUntilEmpty: avgDailyUsage > 0 ? Math.round(item.stock / avgDailyUsage) : null,
    };
  });
};

export function AnalyticsView() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue());
  const [selectedDayAnalytics, setSelectedDayAnalytics] = useState<DailyAnalyticsDetail | null>(null);
  const [slowMovers, setSlowMovers] = useState<SlowMoverProduct[]>([]);
  const [stockUsage, setStockUsage] = useState<StockUsageData[]>([]);
  const [dailySalesTrend, setDailySalesTrend] = useState<DailySalesToday[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const orders = useAppStore((state) => state.orders);
  const historyEvents = useAppStore((state) => state.historyEvents);
  const inventory = useAppStore((state) => state.inventory);
  const productRecipes = useAppStore((state) => state.productRecipes);

  const chartConfig = {
    value: {
      label: 'Revenue',
      color: '#4D0E13',
    },
  };

  useEffect(() => {
    let active = true;
    let debounceTimer: number | null = null;

    const loadAnalytics = async (initial = false) => {
      const shouldShowInitialLoading = initial && !hasLoadedOnceRef.current;
      try {
        if (!active) return;
        if (shouldShowInitialLoading) {
          setLoading(true);
        } else {
          isRefreshingRef.current = true;
        }

        const [selectedDay, trend, slow, stock] = await Promise.allSettled([
          fetchDailyAnalyticsForDate(selectedDate),
          fetchDailySalesSummary(),
          fetchSlowMovers(),
          fetchStockUsageData(),
        ]);

        setSelectedDayAnalytics(selectedDay.status === 'fulfilled' ? selectedDay.value : null);
        setDailySalesTrend(trend.status === 'fulfilled' ? trend.value : []);
        setSlowMovers(slow.status === 'fulfilled' ? slow.value : []);
        setStockUsage(stock.status === 'fulfilled' ? stock.value : []);
      } finally {
        if (active && shouldShowInitialLoading) {
          setLoading(false);
        }
        if (active) {
          isRefreshingRef.current = false;
        }
        if (initial) {
          hasLoadedOnceRef.current = true;
        }
      }
    };

    const scheduleRefresh = () => {
      if (!active) return;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        void loadAnalytics(false);
      }, 180);
    };

    void loadAnalytics(true);

    const unsubscribe = subscribeDashboardRealtime(scheduleRefresh);

    return () => {
      active = false;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      unsubscribe();
    };
  }, [selectedDate]);

  const fallbackSelectedDayAnalytics = useMemo(
    () => getSelectedDayAnalyticsFromLocal(orders, productRecipes, selectedDate),
    [orders, productRecipes, selectedDate]
  );
  const displaySelectedDayAnalytics = selectedDayAnalytics ?? fallbackSelectedDayAnalytics;

  const fallbackSalesTrend = useMemo(() => getSalesTrendFromLocal(orders), [orders]);
  const displayDailySalesTrend = dailySalesTrend.length > 0 ? dailySalesTrend : fallbackSalesTrend;

  const fallbackStockUsage = useMemo(
    () => getStockUsageFromLocal(orders, inventory, productRecipes),
    [inventory, orders, productRecipes]
  );
  const displayStockUsage = stockUsage.some((item) => item.avgDailyUsage > 0) ? stockUsage : fallbackStockUsage;

  const selectedDayBestSellers = displaySelectedDayAnalytics.bestSellers ?? [];
  const maxSold = Math.max(...selectedDayBestSellers.map((item) => item.quantitySold), 1);
  const revenueChartData = displaySelectedDayAnalytics.revenueByHour ?? [];
  const salesTrendChartData = displayDailySalesTrend.map((item) => ({
    label: item.date,
    revenue: item.totalRevenue,
    orders: item.totalOrders,
  }));
  const selectedDayLabel = formatAnalyticsDate(selectedDate);
  const isShowingSkeleton = loading && !hasLoadedOnceRef.current;

  const metrics = useMemo(() => {
    const selectedOrders = orders.filter((order) => toDayKey(order.createdAt) === selectedDate);
    const completedOrders = selectedOrders.filter((order) => order.status === 'completed').length;
    const voidedOrders = historyEvents.filter(
      (event) =>
        event.domain === 'orders' &&
        /voided\/deleted/i.test(event.title) &&
        toDayKey(event.createdAt) === selectedDate
    ).length;

    return [
      {
        title: 'Selected Day Revenue',
        value: `₱${displaySelectedDayAnalytics.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        trend: selectedDayLabel,
      },
      {
        title: 'Selected Day Orders',
        value: selectedOrders.length.toString(),
        trend: 'Pending, preparing, ready, and completed',
      },
      {
        title: 'Completed Orders',
        value: completedOrders.toString(),
        trend: 'Finished orders on the selected day',
      },
      {
        title: 'Voided Orders',
        value: voidedOrders.toString(),
        trend: 'Voided or deleted orders for the selected day',
      },
    ];
  }, [displaySelectedDayAnalytics.totalRevenue, historyEvents, orders, selectedDate, selectedDayLabel]);

  return (
    <div className="flex flex-col gap-3 w-full pb-6 pt-2">
      {isRefreshingRef.current && !isShowingSkeleton && (
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C4AC]/35 bg-white/65 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#4D0E13]/65 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Refreshing analytics
          </div>
        </div>
      )}

      {isShowingSkeleton ? (
        <div className="grid grid-cols-1 gap-3 pt-2">
          <div className="rounded-[1.35rem] border border-white/60 bg-white/55 p-4 backdrop-blur-xl">
            <div className="h-5 w-56 rounded-full bg-[#D8C4AC]/40 animate-pulse" />
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="h-9 w-28 rounded-full bg-[#EADDD1]/60 animate-pulse" />
              <div className="h-9 w-24 rounded-full bg-[#EADDD1]/60 animate-pulse" />
              <div className="h-9 w-24 rounded-full bg-[#EADDD1]/60 animate-pulse" />
              <div className="h-9 w-36 rounded-full bg-[#EADDD1]/60 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 rounded-[1.35rem] border border-white/60 bg-white/55 p-4 backdrop-blur-xl">
                <div className="h-3 w-24 rounded-full bg-[#D8C4AC]/40 animate-pulse" />
                <div className="mt-3 h-8 w-32 rounded-full bg-[#EADDD1]/60 animate-pulse" />
                <div className="mt-3 h-3 w-40 rounded-full bg-[#EADDD1]/45 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <div className="h-[360px] rounded-[1.65rem] border border-white/60 bg-white/55 p-5 backdrop-blur-xl animate-pulse" />
            <div className="h-[360px] rounded-[1.65rem] border border-white/60 bg-white/55 p-5 backdrop-blur-xl animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-[1.35rem] border border-white/60 bg-white/55 backdrop-blur-xl px-4 py-3 shadow-[0_4px_20px_rgba(77,14,19,0.03)]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#4D0E13]/50">Date Navigator</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-2xl font-serif text-[#4D0E13]">{selectedDayLabel}</h3>
                  <span className="text-xs font-semibold text-[#4D0E13]/45">Selected day analytics</span>
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
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="rounded-full border border-[#D8C4AC]/40 bg-white/80 px-4 py-2 text-sm text-[#4D0E13] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((metric, idx) => (
              <motion.div
                key={`metric-${metric.title}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.4 }}
                className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-4 rounded-[1.35rem] flex flex-col gap-2 min-h-[8.5rem]"
              >
                <div className="text-[#4D0E13]/50 text-sm font-bold uppercase tracking-wider">{metric.title}</div>
                <div className="text-3xl font-serif text-[#4D0E13] font-medium">{metric.value}</div>
                <div className="text-xs text-[#4D0E13]/40">{metric.trend}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-5 rounded-[1.65rem] flex flex-col h-[360px] overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-serif text-[#4D0E13] font-medium">Daily Revenue</h3>
                  <p className="text-xs text-[#4D0E13]/45">Hourly revenue for the selected day</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45">{selectedDayLabel}</span>
              </div>

              <div className="flex-1 w-full relative">
                {revenueChartData.length > 0 ? (
                  <ChartContainer id="revenue-bar-chart" config={chartConfig} className="w-full h-full min-h-[250px]">
                    <BarChart data={revenueChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8C4AC" strokeOpacity={0.4} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#4D0E13', opacity: 0.6, fontSize: 13, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#4D0E13', opacity: 0.6, fontSize: 13, fontWeight: 600 }}
                        tickFormatter={(val) => `₱${val}`}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-value)" radius={[10, 10, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#4D0E13]/40">No data available</div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-5 rounded-[1.65rem] flex flex-col h-[360px] overflow-hidden"
            >
              <h3 className="text-xl font-serif text-[#4D0E13] font-medium mb-1">Best Sellers</h3>
              <p className="text-xs text-[#4D0E13]/45 mb-4">Top products by units sold for {selectedDayLabel}</p>

              <div className="flex flex-col flex-1 gap-5 overflow-y-auto pr-2">
                {selectedDayBestSellers.length > 0 ? (
                  selectedDayBestSellers.map((item, idx) => (
                    <div key={`best-seller-${item.productId}`} className="flex items-center gap-4">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-bold text-[#4D0E13] truncate">{item.productName}</span>
                          <span className="text-sm font-bold text-[#4D0E13]/60">{item.quantitySold}</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#D8C4AC]/30 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.quantitySold / maxSold) * 100}%` }}
                            transition={{ delay: 0.5 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-emerald-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[#4D0E13]/40 text-sm">No sales data available</div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-5 rounded-[1.75rem] flex flex-col min-h-[430px] lg:col-span-2 overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-serif text-[#4D0E13] font-medium">Sales Trend</h3>
                  <p className="text-xs text-[#4D0E13]/45">Revenue trend across the last 7 days</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45">7 Days</span>
              </div>

              <div className="flex-1 w-full relative">
                {salesTrendChartData.length > 0 ? (
                  <ChartContainer id="sales-trend-bar-chart" config={chartConfig} className="w-full h-full min-h-[300px]">
                    <BarChart data={salesTrendChartData} margin={{ top: 10, right: 20, left: -10, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8C4AC" strokeOpacity={0.4} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#4D0E13', opacity: 0.6, fontSize: 12, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#4D0E13', opacity: 0.6, fontSize: 13, fontWeight: 600 }}
                        tickFormatter={(val) => `₱${val}`}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-value)" radius={[10, 10, 0, 0]} maxBarSize={38} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#4D0E13]/40">No data available</div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-5 rounded-[1.65rem] flex flex-col"
            >
              <h3 className="text-xl font-serif text-[#4D0E13] font-medium mb-2">Slow Movers</h3>
              <p className="text-xs text-[#4D0E13]/45 mb-4">Lowest-selling products over the last 30 days, measured by quantity sold.</p>

              <div className="flex flex-col gap-3">
                {slowMovers.length > 0 ? (
                  slowMovers.map((item) => (
                    <div key={`slow-mover-${item.productId}`} className="bg-white/50 rounded-lg p-3 border border-[#D8C4AC]/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-[#4D0E13]">{item.productName}</p>
                          <p className="text-xs text-[#4D0E13]/60">Sold: {item.quantitySold} unit(s)</p>
                        </div>
                        <p className="text-sm font-bold text-[#4D0E13]/70">₱{item.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[#4D0E13]/40 text-sm">No data available</div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-5 rounded-[1.65rem] flex flex-col"
            >
              <h3 className="text-xl font-serif text-[#4D0E13] font-medium mb-4">Stock Usage Rate</h3>
              <p className="text-xs text-[#4D0E13]/45 mb-4">Based on actual orders from the last 7 days, with a rolling daily average and remaining days estimated from current stock.</p>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-80 pr-2">
                {displayStockUsage.filter((item) => item.avgDailyUsage > 0).length > 0 ? (
                  displayStockUsage.filter((item) => item.avgDailyUsage > 0).map((item) => (
                    <div key={`stock-${item.inventoryItemId}`} className="bg-white/50 rounded-[1rem] p-3 border border-[#D8C4AC]/20">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#4D0E13] truncate">{item.inventoryItemName}</p>
                          <p className="text-xs text-[#4D0E13]/60">Avg daily: {item.avgDailyUsage.toFixed(2)} {item.unit}</p>
                          <p className="text-xs text-[#4D0E13]/45">Used in last 7 days: {item.totalDeductions.toFixed(2)} {item.unit}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {item.daysUntilEmpty !== null ? (
                            <p className="text-sm font-bold text-[#4D0E13]/70">{item.daysUntilEmpty} days left</p>
                          ) : (
                            <p className="text-sm font-bold text-[#4D0E13]/70">Stable</p>
                          )}
                          <p className="text-xs text-[#4D0E13]/50">at current pace</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[#4D0E13]/40 text-sm">No usage data available</div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
