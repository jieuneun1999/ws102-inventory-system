import { useEffect, useMemo, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Clock3, Coffee, PackageCheck } from 'lucide-react';
import { useParams } from 'react-router';
import { useAppStore } from '../store';
import { fetchPublicOrderBoard, type PublicOrderBoardEntry } from '../lib/supabaseSync';
import { subscribePublicOrderRealtime } from '../lib/supabaseRealtime';

const MAX_QUEUE_DISPLAY = 10;

// Simple beep sound for ready orders
const playReadySound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch {
    // Audio context not supported
  }
};

export function OrderTracking() {
  const { orderId } = useParams();
  const storeOrders = useAppStore((state) => state.orders);
  const [liveOrders, setLiveOrders] = useState<PublicOrderBoardEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const previousReadyCount = useRef(0);

  const fallbackOrders = useMemo(
    () =>
      storeOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        paymentMethod: order.paymentMethod,
        total: order.total,
        estimatedTime: order.estimatedTime,
        createdAt: order.createdAt,
      })),
    [storeOrders]
  );

  useEffect(() => {
    let active = true;
    let debounceTimer: number | null = null;
    let requestSequence = 0;

    const refreshOrders = async () => {
      const requestId = ++requestSequence;
      const rows = await fetchPublicOrderBoard().catch(() => null);
      if (!active || !rows || requestId !== requestSequence) return;
      setLiveOrders(rows);

      // Play sound notification when new ready orders appear
      const readyOrders = rows.filter((order) => order.status === 'ready');
      if (readyOrders.length > previousReadyCount.current) {
        playReadySound();
      }
      previousReadyCount.current = readyOrders.length;
    };

    const scheduleRefresh = () => {
      if (!active) return;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        void refreshOrders();
      }, 120);
    };

    void refreshOrders();
    const unsubscribeRealtime = subscribePublicOrderRealtime(scheduleRefresh);
    const timer = window.setInterval(() => {
      void refreshOrders();
    }, 5000);

    return () => {
      active = false;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      unsubscribeRealtime();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const orders = liveOrders.length > 0 ? liveOrders : fallbackOrders;

  // Limit queue display to MAX_QUEUE_DISPLAY per status
  const preparing = orders
    .filter((order) => order.status === 'preparing')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, MAX_QUEUE_DISPLAY);

  const serving = orders
    .filter((order) => order.status === 'ready')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, MAX_QUEUE_DISPLAY);

  const renderBoard = (title: string, tone: 'prepare' | 'serve', list: typeof orders, emptyText: string) => {
    const isPrepare = tone === 'prepare';

    return (
      <section
        className={`rounded-[1.8rem] border p-4 sm:p-6 shadow-xl backdrop-blur-xl ${
          isPrepare
            ? 'bg-gradient-to-br from-[#FFF8F1] via-white to-[#F6EDE2] border-[#E8D4BB]'
            : 'bg-gradient-to-br from-[#EDFFF6] via-white to-[#DFF7EA] border-emerald-200'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPrepare ? <Coffee size={20} className="text-[#4D0E13]" /> : <PackageCheck size={20} className="text-emerald-700" />}
            <h2 className={`text-xl sm:text-2xl font-serif ${isPrepare ? 'text-[#4D0E13]' : 'text-emerald-700'}`}>{title}</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isPrepare ? 'bg-[#4D0E13] text-[#F6EDE2]' : 'bg-emerald-600 text-white'
            }`}
          >
            {list.length}
          </span>
        </div>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center">
            <p className="text-sm text-[#4D0E13]/55">{emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <AnimatePresence mode="popLayout">
              {list.map((order, index) => {
                const highlighted = orderId && order.id === orderId;
                const isReady = tone === 'serve';
                
                return (
                  <motion.div
                    layout
                    key={order.id}
                    initial={{ opacity: 0, y: 18, scale: 0.95 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: 1,
                      boxShadow: isReady && !highlighted ? '0 0 24px rgba(16, 185, 129, 0.3)' : '0 4px 20px rgba(0,0,0,0.08)',
                    }}
                    exit={{ opacity: 0, y: -18, scale: 0.95 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 320, 
                      damping: 28, 
                      delay: Math.min(index * 0.025, 0.12),
                      boxShadow: { duration: 0.3 },
                    }}
                    className={`rounded-2xl border px-4 py-4 relative ${
                      highlighted
                        ? 'border-[#4D0E13] bg-[#4D0E13] text-[#EEE4DA] shadow-lg'
                        : isPrepare
                        ? 'border-[#E2CBAF] bg-white/90 text-[#4D0E13]'
                        : isReady ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white text-emerald-800' : 'border-emerald-200 bg-white/90 text-emerald-800'
                    }`}
                  >
                    {isReady && !highlighted && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-2xl border border-emerald-400"
                      />
                    )}
                    
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">Order Number</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          highlighted ? 'bg-[#EEE4DA]/20 text-[#EEE4DA]' : isReady ? 'bg-emerald-100/70 text-emerald-700 animate-pulse' : 'bg-white/70 text-[#4D0E13]/65'
                        }`}
                      >
                        Now {isPrepare ? 'Preparing' : 'Serving'}
                      </span>
                    </div>

                    <p className="font-serif text-4xl sm:text-5xl leading-none tracking-tight">{order.orderNumber}</p>

                    <div className="mt-3 text-right text-[11px] font-semibold opacity-75">
                      <span>{new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#fff6ec_0%,#f8fafc_48%,#eef7f1_100%)]">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
          <header className="mb-6 sm:mb-8 rounded-[1.8rem] border border-white/80 bg-white/75 p-4 sm:p-6 shadow-lg backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#4D0E13] tracking-tight">Please Wait for Your Order Number</h1>
                <p className="mt-1 text-sm sm:text-base text-[#4D0E13]/65">Thank You for Your Patience While We Prepare Your Order.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-[#E8D4BB] bg-[#FFF6EC] px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/60">Preparing</p>
                  <p className="text-xl font-serif text-[#4D0E13]">{preparing.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">Serving</p>
                  <p className="text-xl font-serif text-emerald-700">{serving.length}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#4D0E13]/65">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 border border-[#E8D4BB]">
                <BellRing size={13} className="text-emerald-600" /> Live Updates
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 border border-[#E8D4BB]">
                <Clock3 size={13} className="text-[#4D0E13]" /> {new Date(now).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            {renderBoard('Now Preparing', 'prepare', preparing, 'No Orders Are Currently Being Prepared.')}
            {renderBoard('Now Serving', 'serve', serving, 'No Orders Are Ready for Pickup Yet.')}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
