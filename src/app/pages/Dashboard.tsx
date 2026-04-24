import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Box, ShoppingBag, BookOpenText, BarChart3, History, Users, Settings } from 'lucide-react';
import { Sidebar, type DashboardView } from '../components/dashboard/Sidebar';
import { OverviewView } from '../components/dashboard/OverviewView';
import { InventoryView } from '../components/dashboard/InventoryView';
import { OrdersView } from '../components/dashboard/OrdersView';
import { ProductsView } from '../components/dashboard/ProductsView';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { HistoryView } from '../components/dashboard/HistoryView';
import { UsersView } from '../components/dashboard/UsersView';
import { SettingsView } from '../components/dashboard/SettingsView';
import { useAppStore } from '../store';
import { toast } from 'sonner';

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const { isAuthenticated, userRole, orders } = useAppStore();
  const navigate = useNavigate();

  // Track previous order count to detect new orders
  const prevOrderCount = useRef(orders.length);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  // Notify staff when a new order arrives
  useEffect(() => {
    if (orders.length > prevOrderCount.current) {
      const newOrder = orders[0]; // newest is at index 0
      toast(`🔔 New order received: #${newOrder?.orderNumber ?? ''}`, {
        description: `${newOrder?.items.length ?? 0} item(s) · ₱${newOrder?.total.toFixed(2) ?? '0'} · ${newOrder?.orderType === 'delivery' ? 'Delivery' : 'Pickup'}`,
        duration: 6000,
        style: {
          background: '#4D0E13',
          color: '#EEE4DA',
          border: 'none',
        },
        action: {
          label: 'View Orders',
          onClick: () => setActiveView('orders'),
        },
      });
    }
    prevOrderCount.current = orders.length;
  }, [orders.length]);

  if (!isAuthenticated) {
    return null;
  }

  const mobileNavItems: Array<{ id: DashboardView; label: string; icon: any; adminOnly?: boolean }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Box },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'products', label: 'Products', icon: BookOpenText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ].filter((item) => !item.adminOnly || userRole === 'admin');

  return (
    <div className="relative z-10 flex min-h-screen max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 gap-0 lg:gap-8 pb-6 lg:pb-10">
      {/* Fixed Left Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <div className="lg:hidden sticky top-0 z-20 bg-[#F5EFE6]/90 backdrop-blur-md border-b border-[#D8C4AC]/35 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2.5 mb-3">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-colors ${
                    active
                      ? 'bg-[#4D0E13] text-[#EEE4DA]'
                      : 'bg-white/70 text-[#4D0E13]/70 border border-[#D8C4AC]/40'
                  }`}
                >
                  <Icon size={14} /> {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeView === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <OverviewView onNavigate={setActiveView} />
            </motion.div>
          )}

          {activeView === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <InventoryView />
            </motion.div>
          )}

          {activeView === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <OrdersView />
            </motion.div>
          )}

          {activeView === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <ProductsView />
            </motion.div>
          )}

          {activeView === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <AnalyticsView />
            </motion.div>
          )}

          {activeView === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <HistoryView />
            </motion.div>
          )}

          {activeView === 'users' && userRole === 'admin' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <UsersView />
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full pt-4"
            >
              <SettingsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}