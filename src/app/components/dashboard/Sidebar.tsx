import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Box, ShoppingBag, BarChart3, Settings, Users, History, BookOpenText, Inbox } from 'lucide-react';
import { useAppStore } from '../../store';

export type DashboardView = 'overview' | 'inventory' | 'supplier' | 'orders' | 'products' | 'analytics' | 'history' | 'settings' | 'users';

interface SidebarProps {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  darkMode?: boolean;
}

export function Sidebar({ activeView, setActiveView, darkMode = false }: SidebarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const userRole = useAppStore((state) => state.userRole);
  const orders = useAppStore((state) => state.orders);
  const supplierRequests = useAppStore((state) => state.supplierRequests);
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const pendingSupplierCount = supplierRequests.filter((request) => request.status === 'pending').length;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);

    onScroll();

    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const navItems = [
    { id: 'overview' as DashboardView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory' as DashboardView, label: 'Inventory', icon: Box },
    { id: 'supplier' as DashboardView, label: 'Supplier', icon: Inbox, badge: pendingSupplierCount > 0 ? pendingSupplierCount : null },
    { id: 'orders' as DashboardView, label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
    { id: 'products' as DashboardView, label: 'Products', icon: BookOpenText },
    { id: 'analytics' as DashboardView, label: 'Analytics', icon: BarChart3 },
    { id: 'history' as DashboardView, label: 'History', icon: History },
    ...(userRole === 'admin' ? [{ id: 'users' as DashboardView, label: 'Users', icon: Users, badge: null }] : []),
    { id: 'settings' as DashboardView, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-[260px] shrink-0">
      <aside
        className={`fixed z-20 h-[calc(100vh-7.5rem)] w-[250px] rounded-[2rem] border flex flex-col pt-8 pb-6 px-3 transition-colors duration-300 ${
          isScrolled
            ? darkMode
              ? 'bg-[#241820]/72 backdrop-blur-2xl border-[#6E4853]/46 shadow-[0_14px_34px_rgba(0,0,0,0.32)]'
              : 'bg-white/52 backdrop-blur-2xl border-white/60 shadow-[0_14px_34px_rgba(77,14,19,0.12)]'
            : darkMode
            ? 'bg-[#241820]/64 backdrop-blur-xl border-[#6E4853]/35 shadow-[0_10px_22px_rgba(0,0,0,0.22)]'
            : 'bg-white/45 backdrop-blur-xl border-white/54 shadow-[0_10px_22px_rgba(77,14,19,0.09)]'
        }`}
        style={{
          top: '6.5rem',
          // Keep it farther left so hover expansion does not cover dashboard content.
          left: 'max(1rem, calc((100vw - 1600px) / 2 + 1rem))',
        }}
      >
        {/* Nav */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`relative flex items-center w-full px-4 py-3.5 rounded-2xl transition-all duration-300 text-sm font-medium ${
                  isActive 
                    ? darkMode
                      ? 'text-[#2D171C]'
                      : 'text-[#EEE4DA]'
                    : darkMode
                    ? 'text-[#EDE7DF]/80 hover:text-[#EDE7DF] hover:bg-white/10'
                    : 'text-[#4D0E13]/70 hover:text-[#4D0E13] hover:bg-white/40'
                } justify-between`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveTab"
                    className={`absolute inset-0 rounded-2xl shadow-lg ${
                      darkMode ? 'bg-[#EDE7DF] shadow-[#EDE7DF]/15' : 'bg-[#4D0E13] shadow-[#4D0E13]/20'
                    }`}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                <div className="relative z-10 flex items-center gap-3 min-w-0">
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={
                      isActive
                        ? darkMode
                          ? 'text-[#2D171C]'
                          : 'text-[#EEE4DA]'
                        : darkMode
                        ? 'text-[#EDE7DF]/65'
                        : 'text-[#4D0E13]/50'
                    }
                  />
                  <span className="whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100 max-w-[140px]">
                    {item.label}
                  </span>
                </div>
                
                {item.badge != null && item.badge > 0 && (
                  <span className={`relative z-10 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? darkMode
                        ? 'bg-[#2D171C]/10 text-[#2D171C]'
                        : 'bg-white/20 text-[#EEE4DA]'
                      : darkMode
                      ? 'bg-[#EDE7DF] text-[#2D171C]'
                      : 'bg-[#4D0E13] text-[#EEE4DA]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}