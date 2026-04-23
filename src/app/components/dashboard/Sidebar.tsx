import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Box, ShoppingBag, BarChart3, Settings, Users, History, BookOpenText } from 'lucide-react';
import { useAppStore } from '../../store';

export type DashboardView = 'overview' | 'inventory' | 'orders' | 'products' | 'analytics' | 'history' | 'settings' | 'users';

interface SidebarProps {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
}

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { userRole, orders } = useAppStore();
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

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
    { id: 'orders' as DashboardView, label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
    { id: 'products' as DashboardView, label: 'Products', icon: BookOpenText },
    { id: 'analytics' as DashboardView, label: 'Analytics', icon: BarChart3 },
    { id: 'history' as DashboardView, label: 'History', icon: History },
    ...(userRole === 'admin' ? [{ id: 'users' as DashboardView, label: 'Users', icon: Users, badge: null }] : []),
    { id: 'settings' as DashboardView, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-[88px] shrink-0">
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed z-20 h-[calc(100vh-8rem)] rounded-[2rem] border flex flex-col pt-8 pb-6 px-3 transition-all duration-300 ${
          isHovered ? 'w-[260px]' : 'w-[88px]'
        } ${
          isScrolled
            ? 'bg-white/60 backdrop-blur-2xl border-white/70 shadow-[0_14px_42px_rgba(77,14,19,0.12)]'
            : 'bg-transparent backdrop-blur-0 border-transparent shadow-none'
        }`}
        style={{
          top: '7rem',
          // Keep it farther left so hover expansion does not cover dashboard content.
          left: 'max(0.9rem, calc((100vw - 1600px) / 2 + 0.9rem))',
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
                    ? 'text-[#EEE4DA]' 
                    : 'text-[#4D0E13]/70 hover:text-[#4D0E13] hover:bg-white/40'
                } ${isHovered ? 'justify-between' : 'justify-center'}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveTab"
                    className="absolute inset-0 bg-[#4D0E13] rounded-2xl shadow-lg shadow-[#4D0E13]/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                <div className="relative z-10 flex items-center gap-3 min-w-0">
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#EEE4DA]' : 'text-[#4D0E13]/50'} />
                  <span
                    className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                      isHovered ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                
                {isHovered && item.badge != null && item.badge > 0 && (
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
      </aside>
    </div>
  );
}