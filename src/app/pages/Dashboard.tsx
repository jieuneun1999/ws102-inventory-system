import { useState, useEffect, useRef, useMemo, useTransition, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Box, ShoppingBag, BookOpenText, BarChart3, History, Users, Settings, Moon, Sun, Inbox } from 'lucide-react';
import { Sidebar, type DashboardView } from '../components/dashboard/Sidebar';
import { useAppStore } from '../store';
import { toast } from 'sonner';

const OverviewView = lazy(() => import('../components/dashboard/OverviewView').then((m) => ({ default: m.OverviewView })));
const InventoryView = lazy(() => import('../components/dashboard/InventoryView').then((m) => ({ default: m.InventoryView })));
const SupplierView = lazy(() => import('../components/dashboard/SupplierView').then((m) => ({ default: m.SupplierView })));
const OrdersView = lazy(() => import('../components/dashboard/OrdersView').then((m) => ({ default: m.OrdersView })));
const ProductsView = lazy(() => import('../components/dashboard/ProductsView').then((m) => ({ default: m.ProductsView })));
const AnalyticsView = lazy(() => import('../components/dashboard/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
const HistoryView = lazy(() => import('../components/dashboard/HistoryView').then((m) => ({ default: m.HistoryView })));
const UsersView = lazy(() => import('../components/dashboard/UsersView').then((m) => ({ default: m.UsersView })));
const SettingsView = lazy(() => import('../components/dashboard/SettingsView').then((m) => ({ default: m.SettingsView })));

const MOBILE_NAV_ITEMS: Array<{ id: DashboardView; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Box },
  { id: 'supplier', label: 'Supplier', icon: Inbox },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: BookOpenText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const syncSourceLabel = (source: string | null) => {
  if (!source) return 'Unknown';
  if (source === 'realtime') return 'Realtime event';
  if (source === 'interval') return 'Auto interval poll';
  if (source === 'focus') return 'Window focus';
  if (source === 'visibility') return 'Tab visible';
  if (source === 'storage') return 'Storage update';
  if (source === 'initial') return 'Initial load';
  return 'Manual trigger';
};

function SyncAgeBadge({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastSyncedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [lastSyncedAt]);

  if (!lastSyncedAt) return <span>Last synced: waiting for data...</span>;

  const elapsedSeconds = Math.max(0, Math.floor((now - lastSyncedAt) / 1000));
  let label = 'Last synced: just now';
  if (elapsedSeconds >= 60) {
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    label = elapsedMinutes < 60
      ? `Last synced: ${elapsedMinutes}m ago`
      : `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (elapsedSeconds >= 5) {
    label = `Last synced: ${elapsedSeconds}s ago`;
  }

  return <span>{label}</span>;
}

function ViewSkeleton({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="theme-fade h-full min-h-[32rem] pt-4">
      <div className={`h-full rounded-[1.6rem] border p-5 ${darkMode ? 'border-[#6E4853]/35 bg-[#23161C]/55' : 'border-white/60 bg-white/45'}`}>
        <div className="animate-pulse space-y-4">
          <div className={`h-5 w-40 rounded-full ${darkMode ? 'bg-[#6E4853]/35' : 'bg-[#D8C4AC]/45'}`} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={`h-28 rounded-2xl ${darkMode ? 'bg-[#6E4853]/18' : 'bg-white/75'}`} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`h-80 rounded-[1.4rem] ${darkMode ? 'bg-[#6E4853]/18' : 'bg-white/75'}`} />
            <div className={`h-80 rounded-[1.4rem] ${darkMode ? 'bg-[#6E4853]/18' : 'bg-white/75'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

const prefetchViewChunk = (view: DashboardView) => {
  switch (view) {
    case 'overview':
      return import('../components/dashboard/OverviewView');
    case 'inventory':
      return import('../components/dashboard/InventoryView');
    case 'supplier':
      return import('../components/dashboard/SupplierView');
    case 'orders':
      return import('../components/dashboard/OrdersView');
    case 'products':
      return import('../components/dashboard/ProductsView');
    case 'analytics':
      return import('../components/dashboard/AnalyticsView');
    case 'history':
      return import('../components/dashboard/HistoryView');
    case 'users':
      return import('../components/dashboard/UsersView');
    case 'settings':
      return import('../components/dashboard/SettingsView');
    default:
      return Promise.resolve();
  }
};

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [isPending, startTransition] = useTransition();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('aura-dashboard-theme') === 'dark';
  });
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const userRole = useAppStore((state) => state.userRole);
  const lastSyncedAt = useAppStore((state) => state.lastSyncedAt);
  const lastSyncSource = useAppStore((state) => state.lastSyncSource);
  const navigate = useNavigate();
  const isStaff = userRole === 'admin' || userRole === 'barista';
  const [showSyncDetail, setShowSyncDetail] = useState(false);
  const syncDetailRef = useRef<HTMLDivElement | null>(null);
  const mobileNavItems = useMemo(
    () => MOBILE_NAV_ITEMS.filter((item) => !item.adminOnly || userRole === 'admin'),
    [userRole]
  );
  const handleViewChange = (view: DashboardView) => {
    startTransition(() => {
      setActiveView(view);
    });
  };

  useEffect(() => {
    if (!isAuthenticated || !isStaff) {
      navigate('/auth');
    }
  }, [isAuthenticated, isStaff, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('aura-dashboard-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const warmViews: DashboardView[] = ['overview', 'orders', 'inventory', 'analytics'];
    const preload = window.requestIdleCallback
      ? window.requestIdleCallback(() => {
          warmViews.forEach((view) => {
            void prefetchViewChunk(view);
          });
        })
      : window.setTimeout(() => {
          warmViews.forEach((view) => {
            void prefetchViewChunk(view);
          });
        }, 0);

    return () => {
      if (typeof preload === 'number') {
        window.clearTimeout(preload);
      } else if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(preload);
      }
    };
  }, []);

  useEffect(() => {
    const warmAdjacentViews: DashboardView[] = activeView === 'overview'
      ? ['orders', 'inventory', 'analytics']
      : activeView === 'analytics'
        ? ['history', 'inventory']
        : activeView === 'orders'
          ? ['overview', 'supplier']
          : [];

    warmAdjacentViews.forEach((view) => {
      void prefetchViewChunk(view);
    });
  }, [activeView]);

  useEffect(() => {
    if (!showSyncDetail) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (syncDetailRef.current?.contains(targetNode)) return;
      setShowSyncDetail(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowSyncDetail(false);
    };

    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showSyncDetail]);

  if (!isAuthenticated || !isStaff) {
    return null;
  }

  return (
    <div className={`dashboard-theme-scope dashboard-pro-ui theme-fade relative flex min-h-screen max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 pt-3 sm:pt-4 lg:pt-5 gap-0 lg:gap-10 pb-8 lg:pb-12 transition-colors ${darkMode ? 'dashboard-dark text-[#EDE7DF]' : ''}`}>
      <div className="fixed left-3 sm:left-4 bottom-24 md:bottom-6 z-[120] pointer-events-auto">
        <button
          onClick={() => {
            setDarkMode((prev) => !prev);
            toast.success(darkMode ? 'Light mode enabled' : 'Dark mode enabled');
          }}
          type="button"
          aria-pressed={darkMode}
          className={`theme-fade inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-md border ${
            darkMode
              ? 'bg-[#3A1D22] border-[#6E4853] text-[#EDE7DF]'
              : 'bg-white/85 border-[#D8C4AC]/60 text-[#4D0E13]'
          }`}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      <div className={`theme-fade fixed inset-0 -z-10 transition-colors ${darkMode ? 'bg-[radial-gradient(circle_at_50%_44%,#3A2129_0%,#201319_42%,#13151C_100%)]' : 'bg-[radial-gradient(circle_at_50%_44%,#FFF8EE_0%,#F7ECDF_38%,#ECDDCC_70%,#E3CCB8_100%)]'}`} />
      {!darkMode && (
        <>
          <div className="pointer-events-none fixed -z-10 top-[48%] left-[50%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fffdf9_0%,rgba(255,255,255,0)_72%)] opacity-85" />
          <div className="pointer-events-none fixed -z-10 top-[50%] left-[50%] h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#f4e6d7_0%,rgba(244,230,215,0)_74%)] opacity-58" />
          <div className="pointer-events-none fixed -z-10 bottom-[-8rem] right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,#c8a49f_0%,rgba(200,164,159,0)_72%)] opacity-30" />
        </>
      )}
      {/* Fixed Left Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activeView={activeView} setActiveView={setActiveView} darkMode={darkMode} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        <div ref={syncDetailRef} className="absolute right-0 -top-1 z-30">
          <button
            type="button"
            onClick={() => setShowSyncDetail((prev) => !prev)}
            className={`theme-fade inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold border shadow-sm ${
              darkMode
                ? 'bg-[#2B1C23]/90 text-[#EDE7DF] border-[#6E4853]/50'
                : 'bg-white/80 text-[#4D0E13] border-[#D8C4AC]/50'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${lastSyncedAt ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <SyncAgeBadge lastSyncedAt={lastSyncedAt} />
          </button>
          <AnimatePresence>
            {showSyncDetail && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={`mt-2 w-64 rounded-2xl border px-3 py-2.5 text-[11px] font-semibold shadow-xl ${
                  darkMode
                    ? 'bg-[#23161C]/95 text-[#EDE7DF] border-[#6E4853]/45'
                    : 'bg-white/95 text-[#4D0E13] border-[#D8C4AC]/55'
                }`}
              >
                <p className="uppercase tracking-wider text-[10px] opacity-65">Database Sync Details</p>
                <p className="mt-1">
                  Time:{' '}
                  {lastSyncedAt
                    ? new Date(lastSyncedAt).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Waiting for first successful sync'}
                </p>
                <p className="mt-1">Trigger: {syncSourceLabel(lastSyncSource)}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className={`theme-fade lg:hidden sticky top-0 z-20 backdrop-blur-md border-b -mx-3 sm:-mx-4 px-3 sm:px-4 py-2.5 mb-3 transition-colors ${
          darkMode ? 'bg-[#20161B]/90 border-[#6E4853]/45' : 'bg-[#F5EFE6]/90 border-[#D8C4AC]/35'
        }`}>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                    onClick={() => handleViewChange(item.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-colors ${
                    active
                      ? darkMode
                        ? 'bg-[#EDE7DF] text-[#2D171C]'
                        : 'bg-[#4D0E13] text-[#EEE4DA]'
                      : darkMode
                      ? 'bg-[#2B1C23] text-[#EDE7DF]/75 border border-[#6E4853]/45'
                      : 'bg-white/70 text-[#4D0E13]/70 border border-[#D8C4AC]/40'
                  }`}
                >
                  <Icon size={14} /> {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`theme-fade relative flex-1 rounded-[2rem] border shadow-[0_16px_42px_rgba(77,14,19,0.1)] backdrop-blur-2xl overflow-hidden ${darkMode ? 'bg-[#261920]/58 border-[#876471]/40' : 'bg-white/34 border-white/50'}`}>
        <div className={`pointer-events-none absolute inset-0 ${darkMode ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0)_50%)]' : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.16)_38%,rgba(255,255,255,0.02)_100%)]'}`} />
        <div className="theme-fade relative z-10 h-full p-3 sm:p-4 lg:p-5 xl:p-6">
        <Suspense
          fallback={
            <ViewSkeleton darkMode={darkMode} />
          }
        >
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className={`theme-fade h-full pt-4 ${activeView === 'settings' ? '' : ''}`}
          >
            {isPending && (
              <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${darkMode ? 'bg-[#3A1D22] text-[#EDE7DF]' : 'bg-white/75 text-[#4D0E13]'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Switching view
              </div>
            )}
            {activeView === 'overview' && <OverviewView onNavigate={handleViewChange} />}
            {activeView === 'inventory' && <InventoryView />}
            {activeView === 'supplier' && <SupplierView />}
            {activeView === 'orders' && <OrdersView />}
            {activeView === 'products' && <ProductsView />}
            {activeView === 'analytics' && <AnalyticsView />}
            {activeView === 'history' && <HistoryView />}
            {activeView === 'users' && userRole === 'admin' && <UsersView />}
            {activeView === 'settings' && <SettingsView />}
          </motion.div>
        </Suspense>
        </div>
        </div>
      </main>
    </div>
  );
}