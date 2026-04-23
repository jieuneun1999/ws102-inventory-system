import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
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

  return (
    <div className="relative z-10 flex min-h-screen max-w-[1600px] mx-auto px-6 gap-8 pb-10">
      {/* Fixed Left Sidebar */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
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