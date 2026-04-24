import { useState, useRef } from 'react';
import { Search, Package, AlertCircle, Coffee, CheckCircle2, MoreHorizontal, ChevronRight, Filter, ShoppingBag, BellRing, Timer, TriangleAlert } from 'lucide-react';
import { useAppStore } from '../../store';
import type { DashboardView } from './Sidebar';
import { toast } from 'sonner';

interface OverviewViewProps {
  onNavigate: (view: DashboardView) => void;
}

const mockCustomerNames = [
  "Jessica Smith", "Michael Chen", "Ava Rodriguez", "Daniel Lee", "Emma Thompson", "James Wilson"
];

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { inventory, orders, updateOrderStatus, deleteOrder, inventoryAdjustments, wasteLogs, userRole } = useAppStore();
  const [inventoryTab, setInventoryTab] = useState<'All Items' | 'Ingredients' | 'Materials & Equipment'>('All Items');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const lastOrderActionAt = useRef(0);

  const canActOnOrder = () => {
    const now = Date.now();
    if (now - lastOrderActionAt.current < 500) return false;
    lastOrderActionAt.current = now;
    return true;
  };

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(i => i.status === 'low');
  const activeOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const now = Date.now();
  const lateOrders = activeOrders.filter((o) => (now - o.createdAt) / 60000 > o.estimatedTime);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => o.createdAt >= startOfDay.getTime());
  const todayCompleted = todayOrders.filter((o) => o.status === 'completed');
  const todayRevenue = todayCompleted.reduce((sum, o) => sum + o.total, 0);
  const avgPrepMinutes = todayCompleted.length
    ? Math.round(
        todayCompleted.reduce((sum, o) => sum + (o.estimatedTime || 0), 0) / todayCompleted.length
      )
    : 0;

  const actionCenterItems = [
    ...lateOrders.map((o) => ({
      id: o.id,
      label: `Order ${o.orderNumber} exceeded SLA`,
      detail: `${Math.floor((now - o.createdAt) / 60000)}m elapsed / ${o.estimatedTime}m target`,
      kind: 'order' as const,
    })),
    ...inventory.filter((i) => i.status === 'low').slice(0, 4).map((i) => ({
      id: i.id,
      label: `${i.name} is low stock`,
      detail: `${i.stock} ${i.unit} left (reorder ${i.reorderLevel})`,
      kind: 'inventory' as const,
    })),
  ].slice(0, 6);

  const smartAlerts = [
    ...(lateOrders.length > 0
      ? [{ id: 'alert-late', text: `${lateOrders.length} order(s) are over SLA right now.` }]
      : []),
    ...(inventory.filter((i) => i.status === 'low').length > 0
      ? [{ id: 'alert-lowstock', text: `${inventory.filter((i) => i.status === 'low').length} inventory item(s) are low.` }]
      : []),
    ...(wasteLogs.length > 0
      ? [{ id: 'alert-waste', text: `${wasteLogs.length} waste log(s) recorded. Review recurring causes.` }]
      : []),
    ...(inventoryAdjustments.length > 10
      ? [{ id: 'alert-adjust', text: `High manual adjustments detected (${inventoryAdjustments.length}).` }]
      : []),
  ].slice(0, 4);

  const stats = [
    { title: "Total Items", value: totalItems.toString(), desc: "All inventory items", icon: Package, color: "text-[#4D0E13]" },
    { title: "Low Stock Items", value: lowStockItems.length.toString(), desc: "Needs restocking", icon: AlertCircle, color: "text-red-500", badge: true },
    { title: "Active Orders", value: activeOrders.length.toString(), desc: "In progress", icon: Coffee, color: "text-[#4D0E13]" },
    { title: "Completed Today", value: completedOrders.length.toString(), desc: "Orders completed", icon: CheckCircle2, color: "text-green-600" }
  ];

  const filteredInventory = inventory.filter(item => {
    if (showLowStockOnly && item.status !== 'low') return false;
    if (inventoryTab === 'Ingredients' && item.category !== 'Ingredients') return false;
    if (inventoryTab === 'Materials & Equipment' && item.category === 'Ingredients') return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusTone = (status: (typeof inventory)[number]['status']) => {
    if (status === 'low') return { bar: 'bg-[#D9534F]', chip: 'bg-red-100 text-red-700' };
    if (status === 'high') return { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' };
    return { bar: 'bg-[#5C1A1B]', chip: 'bg-[#EADDD1] text-[#4D0E13]' };
  };

  const visibleOrders = orders.filter(o => {
    if (o.status === 'completed') return false;
    if (searchQuery && !o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) && !o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  const orderGroups = {
    pending: visibleOrders.filter(o => o.status === 'pending'),
    preparing: visibleOrders.filter(o => o.status === 'preparing'),
    ready: visibleOrders.filter(o => o.status === 'ready'),
  };

  const moveOrder = (orderId: string, next: 'pending' | 'preparing' | 'ready' | 'completed', message: string) => {
    if (!canActOnOrder()) return;
    updateOrderStatus(orderId, next);
    const notify = next === 'completed' ? toast.success : toast.info;
    notify(message);
  };

  const voidOrder = (orderId: string) => {
    deleteOrder(orderId);
    toast.warning('Order voided and deleted from queue.');
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-8 sm:pb-12 pr-0 sm:pr-2">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center bg-transparent mt-2 sm:mt-4 mb-2 gap-3">
        <div>
          <h2 className="text-[28px] md:text-[32px] font-serif text-[#4D0E13] flex items-center gap-2 tracking-tight">
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
              const name = userRole === 'admin' ? 'Admin' : 'Barista';
              return <>{greeting}, {name} <span className="text-[#C8A49F]">☕</span></>;
            })()}
          </h2>
          <p className="text-[#4D0E13]/60 text-sm font-medium mt-1">
            Here's what's happening with Aura Café today.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4D0E13]/40" size={18} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-11 pr-4 py-3 bg-white/60 border border-white/60 rounded-full text-sm font-medium text-[#4D0E13] placeholder:text-[#4D0E13]/40 focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/30 shadow-sm backdrop-blur-md"
            />
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[1.5rem] p-6 shadow-[0_4px_24px_rgba(77,14,19,0.02)] flex flex-col justify-between relative group hover:-translate-y-1 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-[#4D0E13]/70 text-sm font-semibold">{stat.title}</h3>
                <p className="text-4xl font-serif text-[#4D0E13] mt-2 leading-none">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-full border border-[#D8C4AC]/20 bg-white/80 ${stat.color} shadow-sm group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} strokeWidth={1.5} />
              </div>
            </div>
            <p className="text-xs font-medium text-[#4D0E13]/50">{stat.desc}</p>
            {stat.badge && (
              <div className="absolute top-6 right-16 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Daily Ops Summary + Action Center + Smart Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[1.5rem] p-5 shadow-[0_4px_24px_rgba(77,14,19,0.02)]">
          <div className="flex items-center gap-2 mb-3">
            <Timer size={18} className="text-[#4D0E13]" />
            <h3 className="text-lg font-serif text-[#4D0E13]">Daily Ops Summary</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/60 border border-[#D8C4AC]/30 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45">Orders Today</p>
              <p className="font-serif text-2xl text-[#4D0E13]">{todayOrders.length}</p>
            </div>
            <div className="bg-white/60 border border-[#D8C4AC]/30 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45">Completed</p>
              <p className="font-serif text-2xl text-[#4D0E13]">{todayCompleted.length}</p>
            </div>
            <div className="bg-white/60 border border-[#D8C4AC]/30 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45">Revenue</p>
              <p className="font-serif text-2xl text-[#4D0E13]">₱{todayRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-white/60 border border-[#D8C4AC]/30 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45">Avg Prep</p>
              <p className="font-serif text-2xl text-[#4D0E13]">{avgPrepMinutes}m</p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[1.5rem] p-5 shadow-[0_4px_24px_rgba(77,14,19,0.02)]">
          <div className="flex items-center gap-2 mb-3">
            <BellRing size={18} className="text-[#4D0E13]" />
            <h3 className="text-lg font-serif text-[#4D0E13]">Action Center</h3>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto hide-scrollbar pr-1">
            {actionCenterItems.length === 0 ? (
              <p className="text-sm text-[#4D0E13]/45">No urgent items right now.</p>
            ) : (
              actionCenterItems.map((item) => (
                <div key={item.id} className="bg-white/60 border border-[#D8C4AC]/25 rounded-xl p-2.5">
                  <p className="text-xs font-bold text-[#4D0E13]">{item.label}</p>
                  <p className="text-[11px] text-[#4D0E13]/55">{item.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {smartAlerts.length > 0 && (
        <div className="bg-[#FFF7ED]/70 border border-[#FCD9B6] rounded-[1.2rem] p-4">
          <div className="flex items-center gap-2 mb-2">
            <TriangleAlert size={16} className="text-[#9A3412]" />
            <h4 className="text-sm font-bold text-[#9A3412] uppercase tracking-wider">Smart Alerts</h4>
          </div>
          <ul className="space-y-1.5">
            {smartAlerts.map((a) => (
              <li key={a.id} className="text-sm text-[#7C2D12]">• {a.text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 xl:h-[600px] min-h-0">
        
        {/* Left Column: Inventory Overview */}
        <div className="col-span-2 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(77,14,19,0.02)] flex flex-col h-full">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3">
            <div className="flex items-center gap-2">
              <Package size={22} className="text-[#4D0E13]" />
              <h3 className="text-[22px] font-serif text-[#4D0E13] tracking-tight">Inventory Overview</h3>
            </div>
            <button 
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-[#4D0E13]/70 hover:text-[#4D0E13] flex items-center gap-1"
            >
              View all inventory <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <div className="flex gap-2">
              {(['All Items', 'Ingredients', 'Materials & Equipment'] as const).map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => setInventoryTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    inventoryTab === tab ? 'border border-[#4D0E13] text-[#4D0E13]' : 'bg-white/50 text-[#4D0E13]/60 hover:bg-white/80 border border-transparent'
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button 
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                  showLowStockOnly ? 'bg-red-100 text-red-800 border-red-200' : 'bg-[#FFF0F0] text-red-700 border-red-100 hover:bg-red-50'
                }`}
              >
                Low Stocks ({lowStockItems.length})
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => toast.info('Advanced filters coming soon')}
                className="p-2 bg-white/80 rounded-full border border-[#D8C4AC]/40 hover:bg-white shadow-sm text-[#4D0E13]/60 transition-colors hover:text-[#4D0E13]"
              >
                <Filter size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 hide-scrollbar">
            {filteredInventory.length === 0 ? (
              <p className="text-center text-[#4D0E13]/50 text-sm mt-10">No items match the current filters.</p>
            ) : (
              filteredInventory.map((item) => {
                const isLow = item.status === 'low';
                const progress = Math.min(100, Math.max(0, (item.stock / (item.reorderLevel * 3)) * 100));
                
                return (
                  <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl transition-colors border border-transparent hover:border-white/60 hover:bg-white/40 ${isLow ? 'bg-[#FDF3F3]/80 hover:bg-[#FDF3F3]' : ''}`}>
                    <div className="w-12 h-12 rounded-full bg-[#EADDD1] flex-shrink-0 border-2 border-white overflow-hidden flex items-center justify-center text-[#4D0E13]">
                      <Package size={20} className="opacity-50" />
                    </div>
                    
                    <div className="w-full sm:w-48 sm:shrink-0">
                      <h4 className="font-serif text-[#4D0E13] text-[15px] font-bold mb-0.5">{item.name}</h4>
                      <span className="text-[10px] font-bold text-[#4D0E13]/50 uppercase tracking-wider border border-[#D8C4AC]/30 px-2 py-0.5 rounded-md inline-block">
                        {item.category}
                      </span>
                      <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-md inline-block ${getStatusTone(item.status).chip}`}>
                        {item.status === 'high' ? 'full' : item.status}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 sm:min-w-[150px]">
                      <div className="flex justify-between text-[11px] font-semibold text-[#4D0E13]/60 mb-1.5">
                        <span>Stock Level</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-[#EADDD1]/60 rounded-full overflow-hidden w-full sm:max-w-[200px]">
                        <div 
                          className={`h-full rounded-full ${getStatusTone(item.status).bar}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-full sm:w-24 text-left sm:text-right shrink-0">
                      <p className="font-serif text-[#4D0E13] text-base">{item.stock} {item.unit}</p>
                      <p className="text-[10px] font-medium text-[#4D0E13]/40 mt-0.5">Updated 2h ago</p>
                    </div>

                    <button 
                      onClick={() => onNavigate('inventory')}
                      className="p-2 text-[#4D0E13]/40 hover:text-[#4D0E13] transition-colors sm:ml-2 shrink-0 self-end sm:self-auto"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Orders */}
        <div className="col-span-1 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(77,14,19,0.02)] flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <ShoppingBag size={22} className="text-[#4D0E13]" />
              <h3 className="text-[22px] font-serif text-[#4D0E13] tracking-tight">Orders</h3>
            </div>
            <button 
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-[#4D0E13]/70 hover:text-[#4D0E13] flex items-center gap-1"
            >
              View all orders <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 hide-scrollbar pr-1">
            {(['pending', 'preparing', 'ready'] as const).map((statusGroup) => {
              const sectionOrders = orderGroups[statusGroup];
              const sectionLabel = statusGroup === 'pending' ? 'Pending' : statusGroup === 'preparing' ? 'Preparing' : 'Ready';

              return (
                <section key={statusGroup} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/60">{sectionLabel}</h4>
                    <span className="text-[10px] font-bold text-[#4D0E13]/60 bg-white/60 border border-[#D8C4AC]/30 px-2 py-0.5 rounded-full">
                      {sectionOrders.length}
                    </span>
                  </div>

                  {sectionOrders.length === 0 ? (
                    <div className="bg-white/40 border border-dashed border-[#D8C4AC]/40 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-[#4D0E13]/35">No orders</p>
                    </div>
                  ) : (
                    sectionOrders.map((order, idx) => {
                      const customerName = mockCustomerNames[idx % mockCustomerNames.length];
                      const initials = customerName.split(' ').map(n => n[0]).join('');

                      return (
                        <div key={order.id} className="bg-white/80 backdrop-blur-md border border-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(77,14,19,0.03)] hover:shadow-md transition-all flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FDF1F0] flex items-center justify-center text-[#5C1A1B] font-serif font-bold text-sm">
                              {initials}
                            </div>
                            <div>
                              <h4 className="font-bold text-[#4D0E13] text-xs leading-tight mb-0.5">Order #{order.orderNumber}</h4>
                              <p className="text-[10px] text-[#4D0E13]/60 font-semibold">{customerName}</p>
                              <p className="text-[9px] text-[#4D0E13]/40 font-bold uppercase tracking-wider mt-0.5">{order.orderType === 'delivery' ? 'Takeaway' : 'Dine In'}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 md:items-end">
                            <div className="md:text-right">
                              <p className="text-[10px] font-bold text-[#4D0E13]/60">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              <p className="text-[9px] font-semibold text-[#4D0E13]/40">{order.items.reduce((acc, item) => acc + item.quantity, 0)} items</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => moveOrder(order.id, 'preparing', 'Order moved to preparing.')}
                                  className="px-2.5 py-1 bg-[#5C1A1B] hover:bg-[#3a0a0e] text-[#EEE4DA] rounded-lg text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider"
                                >
                                  To Preparing
                                </button>
                              )}

                              {order.status === 'preparing' && (
                                <>
                                  <button
                                    onClick={() => moveOrder(order.id, 'pending', 'Order moved back to pending.')}
                                    className="px-2.5 py-1 bg-[#F5EFE6] hover:bg-[#EADDD1] text-[#4D0E13] rounded-lg text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider"
                                  >
                                    To Pending
                                  </button>
                                  <button
                                    onClick={() => moveOrder(order.id, 'ready', 'Order marked as ready.')}
                                    className="px-2.5 py-1 bg-[#C8A49F] hover:bg-[#b08b86] text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider"
                                  >
                                    To Ready
                                  </button>
                                </>
                              )}

                              {order.status === 'ready' && (
                                <>
                                  <button
                                    onClick={() => moveOrder(order.id, 'preparing', 'Order moved back to preparing.')}
                                    className="px-2.5 py-1 bg-[#F5EFE6] hover:bg-[#EADDD1] text-[#4D0E13] rounded-lg text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider"
                                  >
                                    To Preparing
                                  </button>
                                  <button
                                    onClick={() => moveOrder(order.id, 'completed', 'Order completed.')}
                                    className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider"
                                  >
                                    Complete
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => voidOrder(order.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[10px] font-bold shadow-sm transition-colors uppercase tracking-wider border border-red-100"
                              >
                                Void
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}