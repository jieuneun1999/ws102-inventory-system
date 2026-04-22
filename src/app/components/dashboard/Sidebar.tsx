import { motion } from 'framer-motion';
import { LayoutDashboard, Box, ShoppingBag, BarChart3, Settings, Users, History, BookOpenText } from 'lucide-react';
import { useAppStore } from '../../store';

export type DashboardView = 'overview' | 'inventory' | 'orders' | 'products' | 'analytics' | 'history' | 'settings' | 'users';

interface SidebarProps {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
}

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const { userRole, orders } = useAppStore();
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

  const navItems = [
    { id: 'overview' as DashboardView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory' as DashboardView, label: 'Inventory', icon: Box },
    { id: 'orders' as DashboardView, label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
    { id: 'products' as DashboardView, label: 'Products', icon: BookOpenText },
    { id: 'analytics' as DashboardView, label: 'Analytics', icon: BarChart3 },
    { id: 'history' as DashboardView, label: 'History', icon: History },
    ...(userRole === 'admin' ? [{ id: 'users' as DashboardView, label: 'Users', icon: Users, badge: null }] : []),
    { id: 'settings' as DashboardView, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-[260px] shrink-0 h-[calc(100vh-10rem)] rounded-[2rem] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(77,14,19,0.04)] flex flex-col pt-8 pb-6 px-4 sticky top-32">
      {/* Nav */}
      <nav className="flex flex-col gap-1.5 flex-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`relative flex items-center justify-between w-full px-5 py-3.5 rounded-2xl transition-all duration-300 text-sm font-medium ${
                isActive 
                  ? 'text-[#EEE4DA]' 
                  : 'text-[#4D0E13]/70 hover:text-[#4D0E13] hover:bg-white/40'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute inset-0 bg-[#4D0E13] rounded-2xl shadow-lg shadow-[#4D0E13]/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              
              <div className="relative z-10 flex items-center gap-3">
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#EEE4DA]' : 'text-[#4D0E13]/50'} />
                {item.label}
              </div>
              
              {item.badge != null && item.badge > 0 && (
                <span className={`relative z-10 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-[#EEE4DA]' : 'bg-[#4D0E13] text-[#EEE4DA]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}