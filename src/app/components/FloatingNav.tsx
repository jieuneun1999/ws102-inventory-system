import { Link, useLocation } from 'react-router-dom';
import { Home, Menu, ShoppingCart, User, LayoutDashboard, LogOut, Bell } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { motion } from 'framer-motion';
import { useAppStore } from '../store';

export function FloatingNav() {
  const location = useLocation();
  const { user, cart, orders, setUser } = useApp();
  const setCartOpen = useAppStore((state) => state.setCartOpen);

  const isActive = (path: string) => location.pathname === path;

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full backdrop-blur-md bg-white/25 border border-white/18 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-8">
        <Link to="/" className="mr-4">
          <span className="font-serif italic" style={{ color: 'var(--burgundy)', fontSize: '1.25rem', fontWeight: 600 }}>
            Café
          </span>
        </Link>

        <Link
          to="/"
          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all relative ${
            isActive('/') ? '' : 'hover:bg-white/20'
          }`}
          style={{ color: isActive('/') ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
        >
          {isActive('/') && (
            <motion.div
              layoutId="nav-bubble"
              className="absolute inset-0 rounded-full bg-white/40 -z-10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Home size={18} />
          <span className="hidden sm:inline">Home</span>
        </Link>

        <Link
          to="/menu"
          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all relative ${
            isActive('/menu') ? '' : 'hover:bg-white/20'
          }`}
          style={{ color: isActive('/menu') ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
        >
          {isActive('/menu') && (
            <motion.div
              layoutId="nav-bubble"
              className="absolute inset-0 rounded-full bg-white/40 -z-10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Menu size={18} />
          <span className="hidden sm:inline">Menu</span>
        </Link>

        <button
          onClick={() => setCartOpen(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all relative ${
            isActive('/cart') ? '' : 'hover:bg-white/20'
          }`}
          style={{ color: isActive('/cart') ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
        >
          {isActive('/cart') && (
            <motion.div
              layoutId="nav-bubble"
              className="absolute inset-0 rounded-full bg-white/40 -z-10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <ShoppingCart size={18} />
          <span className="hidden sm:inline">Cart</span>
          {cartItemsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-burgundy text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {cartItemsCount}
            </span>
          )}
        </button>

        {user?.role === 'admin' || user?.role === 'barista' ? (
          <>
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all relative ${
                isActive('/dashboard') ? '' : 'hover:bg-white/20'
              }`}
              style={{ color: isActive('/dashboard') ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
            >
              {isActive('/dashboard') && (
                <motion.div
                  layoutId="nav-bubble"
                  className="absolute inset-0 rounded-full bg-white/40 -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Dashboard</span>
              {pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 bg-burgundy text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingOrders}
                </span>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-white/20 transition-all relative"
              style={{ color: 'var(--coffee-brown)' }}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all relative ${
              isActive('/login') ? '' : 'hover:bg-white/20'
            }`}
            style={{ color: isActive('/login') ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
          >
            {isActive('/login') && (
              <motion.div
                layoutId="nav-bubble"
                className="absolute inset-0 rounded-full bg-white/40 -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <User size={18} />
            <span className="hidden sm:inline">Login</span>
          </Link>
        )}
      </div>
    </motion.nav>
  );
}
