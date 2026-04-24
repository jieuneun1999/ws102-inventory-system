import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Coffee, Package, CheckCircle2, ArrowRight,
  Check, ChevronDown, ChevronUp, Timer, ShoppingBag, Archive
} from 'lucide-react';
import { useAppStore, type OrderStatus, type Order } from '../../store';
import { toast } from 'sonner';

const COLUMNS: { id: OrderStatus; label: string; icon: any; color: string; dotColor: string; bg: string }[] = [
  { id: 'pending',   label: 'Pending',          icon: Clock,         color: 'text-amber-700',   dotColor: 'bg-amber-400',  bg: 'bg-amber-50/60'  },
  { id: 'preparing', label: 'Preparing',         icon: Coffee,        color: 'text-[#4D0E13]',   dotColor: 'bg-[#C8A49F]',  bg: 'bg-[#C8A49F]/10' },
  { id: 'ready',     label: 'Ready for Pickup',  icon: Package,       color: 'text-emerald-700', dotColor: 'bg-emerald-400',bg: 'bg-emerald-50/60'},
  { id: 'completed', label: 'Completed',         icon: CheckCircle2,  color: 'text-gray-500',    dotColor: 'bg-gray-300',   bg: 'bg-gray-50/60'  },
];

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
};

const ACTION_LABELS: Record<OrderStatus, string> = {
  pending: 'Start Preparing',
  preparing: 'Mark Ready',
  ready: 'Complete',
  completed: '',
};

function useElapsedTime(createdAt: number) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - createdAt) / 1000));
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - createdAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m ${secs}s`;
}

function ElapsedBadge({ createdAt, status }: { createdAt: number; status: OrderStatus }) {
  const elapsed = useElapsedTime(createdAt);
  const totalSeconds = Math.floor((Date.now() - createdAt) / 1000);
  const isLate = totalSeconds > 600; // 10 minutes

  if (status === 'completed') return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
      isLate ? 'bg-red-100 text-red-700' : 'bg-[#D8C4AC]/25 text-[#4D0E13]/60'
    }`}>
      <Timer size={9} />
      {elapsed}
    </span>
  );
}

function OrderCard({ order, columnId }: { order: Order; columnId: OrderStatus }) {
  const { updateOrderStatus, deleteOrder } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const lastActionAt = useRef(0);

  const canAct = () => {
    const now = Date.now();
    if (now - lastActionAt.current < 500) return false;
    lastActionAt.current = now;
    return true;
  };

  const handleAdvance = () => {
    if (!canAct()) return;
    const next = NEXT_STATUS[columnId];
    if (!next) return;
    updateOrderStatus(order.id, next);

    const messages: Record<string, string> = {
      preparing: `Order ${order.orderNumber} is now being prepared! ☕`,
      ready: `Order ${order.orderNumber} is ready for pickup! 📦`,
      completed: `Order ${order.orderNumber} completed. ✅`,
    };
    const notify = next === 'completed' ? toast.success : toast.info;
    notify(messages[next] ?? `Order moved to ${next}`, {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
  };

  const handleBack = () => {
    if (!canAct()) return;
    const prev: Partial<Record<OrderStatus, OrderStatus>> = {
      preparing: 'pending',
      ready: 'preparing',
    };

    const previous = prev[columnId];
    if (!previous) return;

    updateOrderStatus(order.id, previous);
    toast.info(`Order ${order.orderNumber} moved back to ${previous}.`, {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
  };

  const handleVoid = () => {
    if (!canAct()) return;
    deleteOrder(order.id);
    toast.warning(`Order ${order.orderNumber} voided and deleted.`, {
      style: { background: '#FFF4F4', color: '#7F1D1D', border: '1px solid rgba(127,29,29,0.15)' },
    });
  };

  const statusSteps: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed'];
  const currentIdx = statusSteps.indexOf(order.status);

  return (
    <motion.div
      layout
      key={order.id}
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group"
    >
      {/* Top stripe based on status */}
      <div className={`h-1 w-full ${
        columnId === 'pending' ? 'bg-amber-400' :
        columnId === 'preparing' ? 'bg-[#C8A49F]' :
        columnId === 'ready' ? 'bg-emerald-400' :
        'bg-gray-300'
      }`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/40">
              {order.orderType === 'delivery' ? '🛵' : '🏪'}
            </span>
            <h4 className="font-serif text-base text-[#4D0E13] font-medium">#{order.orderNumber}</h4>
            <ElapsedBadge createdAt={order.createdAt} status={order.status} />
          </div>
          <span className="text-[10px] text-[#4D0E13]/40 font-semibold">
            {new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-3">
          {statusSteps.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                i <= currentIdx ? 'bg-[#4D0E13]' : 'bg-[#D8C4AC]/30'
              }`}
            />
          ))}
        </div>

        {/* Items */}
        <div className="mb-3">
          {order.items.slice(0, expanded ? undefined : 2).map(item => (
            <div key={item.id} className="flex items-center gap-2 py-1">
              <span className="w-5 h-5 rounded-full bg-[#4D0E13]/10 flex items-center justify-center text-[9px] font-bold text-[#4D0E13] shrink-0">
                {item.quantity}
              </span>
              <span className="text-sm text-[#4D0E13]/70 font-medium truncate flex-1">{item.name}</span>
            </div>
          ))}
          {order.items.length > 2 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#C8A49F] hover:text-[#4D0E13] mt-1 transition-colors"
            >
              {expanded ? (
                <><ChevronUp size={11} /> Show less</>
              ) : (
                <><ChevronDown size={11} /> +{order.items.length - 2} more</>
              )}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 pt-2.5 border-t border-[#D8C4AC]/20">
          <span className="font-serif text-base text-[#4D0E13] font-medium">₱{order.total.toFixed(2)}</span>

          {columnId !== 'completed' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {(columnId === 'preparing' || columnId === 'ready') && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-all active:scale-95 bg-[#F5EFE6] text-[#4D0E13] hover:bg-[#EADDD1]"
                >
                  {columnId === 'preparing' ? 'To Pending' : 'To Preparing'}
                </button>
              )}

              <button
                onClick={handleAdvance}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-all active:scale-95 ${
                  columnId === 'pending'
                    ? 'bg-[#4D0E13] text-[#EEE4DA] hover:bg-[#3a0a0e]'
                    : columnId === 'preparing'
                    ? 'bg-[#C8A49F] text-white hover:bg-[#b08b86]'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {columnId === 'ready' ? <Check size={12} /> : <ArrowRight size={12} />}
                {columnId === 'pending' ? 'To Preparing' : columnId === 'preparing' ? 'To Ready' : 'Done'}
              </button>

              <button
                onClick={handleVoid}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-all active:scale-95 bg-red-50 text-red-700 hover:bg-red-100 border border-red-100"
              >
                Void
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={11} /> ✓
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function OrdersView() {
  const { orders, clearedOrderIds, clearCompletedOrders, updateOrderStatus, deleteOrder } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'delivery' | 'pickup'>('all');

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.orderType === filter);
  const completedOrders = filteredOrders.filter((o) => o.status === 'completed' && !clearedOrderIds.includes(o.id));
  const clearedOrders = filteredOrders.filter((o) => o.status === 'completed' && clearedOrderIds.includes(o.id));
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  const handleAdvanceInList = (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    updateOrderStatus(order.id, next);
    const notify = next === 'completed' ? toast.success : toast.info;
    notify(next === 'completed' ? `Order ${order.orderNumber} completed. ✅` : `Order ${order.orderNumber} moved to ${next}.`);
  };

  const handleBackInList = (order: Order) => {
    const prev: Partial<Record<OrderStatus, OrderStatus>> = {
      preparing: 'pending',
      ready: 'preparing',
    };
    const previous = prev[order.status];
    if (!previous) return;
    updateOrderStatus(order.id, previous);
    toast.info(`Order ${order.orderNumber} moved back to ${previous}.`);
  };

  const handleVoidInList = (order: Order) => {
    deleteOrder(order.id);
    toast.warning(`Order ${order.orderNumber} voided and deleted.`);
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">Order Queue</h2>
            {pendingCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200"
              >
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                {pendingCount} new
              </motion.span>
            )}
          </div>
          <p className="text-[#4D0E13]/60 font-medium text-sm">
            Manage and process incoming orders in real time.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 bg-white/50 border border-[#D8C4AC]/30 rounded-full p-1 backdrop-blur-md overflow-x-auto hide-scrollbar max-w-full">
          {(['all', 'pickup', 'delivery'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                filter === f
                  ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-sm'
                  : 'text-[#4D0E13]/60 hover:text-[#4D0E13]'
              }`}
            >
              {f === 'all' ? 'All Orders' : f === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-24 h-24 bg-[#D8C4AC]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag size={36} className="text-[#4D0E13]/30" />
          </div>
          <h3 className="font-serif text-2xl text-[#4D0E13]/60 mb-2">No orders yet</h3>
          <p className="text-[#4D0E13]/40 text-sm max-w-xs">
            Orders placed by customers will appear here. You can accept, prepare, and complete them from this board.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 min-h-0">
          {COLUMNS.map((col) => {
            const colOrders = col.id === 'completed'
              ? completedOrders
              : filteredOrders.filter((o) => o.status === col.id);
            const ColIcon = col.icon;

            return (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-xl ${col.bg} border border-white/40 backdrop-blur-sm`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor} ${col.id === 'pending' && colOrders.length > 0 ? 'animate-pulse' : ''}`} />
                    <ColIcon size={14} className={col.color} />
                    <h3 className={`font-serif text-sm ${col.color} font-medium`}>{col.label}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.color} bg-white/60`}>
                      {colOrders.length}
                    </span>
                    {col.id === 'completed' && completedOrders.length > 0 && (
                      <button
                        onClick={() => {
                          clearCompletedOrders();
                          toast.success(`${completedOrders.length} completed order(s) moved to Cleared.`);
                        }}
                        className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#4D0E13] text-[#EEE4DA] hover:bg-[#3a0a0e] transition-colors whitespace-nowrap"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Cards with custom scrollbar */}
                <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto scrollbar-elegant pr-1 max-h-[60vh] lg:max-h-[calc(100vh-280px)]">
                  <AnimatePresence mode="popLayout">
                    {colOrders.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-24 rounded-xl border-2 border-dashed border-[#D8C4AC]/25 flex items-center justify-center"
                      >
                        <p className="text-[10px] font-semibold text-[#4D0E13]/25">No orders</p>
                      </motion.div>
                    ) : (
                      colOrders.map(order => (
                        <OrderCard key={order.id} order={order} columnId={col.id} />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
          </div>

          <div className="rounded-2xl border border-[#D8C4AC]/35 bg-white/50 backdrop-blur-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Archive size={14} className="text-[#4D0E13]/70" />
                <h3 className="font-serif text-base text-[#4D0E13]">Cleared</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[#4D0E13]/70 bg-[#F5EFE6]">
                {clearedOrders.length}
              </span>
            </div>

            {clearedOrders.length === 0 ? (
              <p className="text-xs text-[#4D0E13]/45">No cleared orders yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-elegant">
                {clearedOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-[#D8C4AC]/25 bg-white/65 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#4D0E13]">#{order.orderNumber}</p>
                      <p className="text-[10px] text-[#4D0E13]/50">₱{order.total.toFixed(2)}</p>
                    </div>
                    <p className="text-[11px] text-[#4D0E13]/60 mt-1 truncate">
                      {order.items.length} item(s) • {new Date(order.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        /* Custom Scrollbar for horizontal scroll */
        .scrollbar-custom::-webkit-scrollbar {
          height: 8px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
          background: rgba(216, 196, 172, 0.15);
          border-radius: 100px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #C8A49F 0%, #4D0E13 100%);
          border-radius: 100px;
          transition: background 0.3s;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #b08b86 0%, #3a0a0e 100%);
        }

        /* Custom Scrollbar for vertical scroll */
        .scrollbar-elegant::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-elegant::-webkit-scrollbar-track {
          background: rgba(216, 196, 172, 0.1);
          border-radius: 100px;
          margin: 8px 0;
        }
        .scrollbar-elegant::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #C8A49F 0%, #4D0E13 100%);
          border-radius: 100px;
          transition: background 0.3s;
        }
        .scrollbar-elegant::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #b08b86 0%, #3a0a0e 100%);
        }

        /* Firefox scrollbar */
        .scrollbar-custom, .scrollbar-elegant {
          scrollbar-width: thin;
          scrollbar-color: #C8A49F rgba(216, 196, 172, 0.15);
        }
      `}</style>
    </div>
  );
}
