import { Outlet, NavLink } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { Cart } from './Cart';
import { ShoppingBag, Coffee, LogIn, User, LayoutDashboard, Home } from 'lucide-react';
import { useState, useEffect } from 'react';
import { signOutOfSupabase } from '../lib/supabaseAuth';

export function Layout() {
  const { cart, setCartOpen, isAuthenticated } = useAppStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Menu', path: '/menu', icon: Coffee },
    { name: 'Orders', path: '/track', icon: ShoppingBag },
  ];

  if (isAuthenticated) {
    navLinks.push({ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
  }

  return (
    <div className="min-h-screen bg-[#EEE4DA] text-gray-800 relative overflow-hidden flex flex-col font-sans">
      {/* Background abstract blobs */}
      <div className="absolute blur-[60px] -z-10 opacity-60 bg-[#D8C4AC]/40 w-[60vw] h-[60vw] rounded-full top-[-10%] left-[-10%]" />
      <div className="absolute blur-[60px] -z-10 opacity-60 bg-[#C8A49F]/30 w-[50vw] h-[50vw] rounded-full bottom-[-10%] right-[-10%]" />

      {/* Desktop Navigation */}
      <header className={`fixed top-0 w-full z-30 transition-all duration-300 hidden md:block ${scrolled ? 'py-2' : 'py-6'}`}>
        <div className="container mx-auto px-6">
          <nav className={`grid grid-cols-3 items-center px-8 py-4 rounded-3xl transition-all duration-300 ${scrolled ? 'bg-white/50 backdrop-blur-xl border border-white/30 shadow-lg shadow-[#D8C4AC]/30' : 'bg-transparent'}`}>
            {/* Logo - Left */}
            <div className="flex items-center">
              <NavLink to="/" className="text-2xl font-serif text-[#4D0E13] font-bold tracking-tight">
                Aura <span className="font-light italic text-[#C8A49F]">Café</span>
              </NavLink>
            </div>

            {/* Links - Center */}
            <div className="flex items-center justify-center gap-8">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-[#4D0E13] relative ${
                      isActive ? 'text-[#4D0E13]' : 'text-gray-700'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.name}
                      {isActive && (
                        <motion.div
                          layoutId="nav-underline"
                          className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#4D0E13] rounded-full"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Actions - Right */}
            <div className="flex items-center justify-end gap-6">
              {!isAuthenticated ? (
                <NavLink to="/auth" className="text-sm font-medium text-gray-700 hover:text-[#4D0E13] transition-colors flex items-center gap-2">
                  <User size={18} /> Login
                </NavLink>
              ) : (
                <button 
                  onClick={async () => {
                    await signOutOfSupabase();
                    useAppStore.getState().logout();
                  }}
                  className="text-sm font-medium text-gray-700 hover:text-red-800 transition-colors flex items-center gap-2"
                >
                  <LogIn size={18} className="rotate-180" /> Logout
                </button>
              )}

              <div className="h-4 w-px bg-[#D8C4AC] opacity-50" />

              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 text-gray-700 hover:text-[#4D0E13] transition-colors group flex items-center gap-2"
              >
                <ShoppingBag size={22} />
                {totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-[#4D0E13] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md group-hover:bg-[#C8A49F] transition-colors"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-28 md:pb-0 md:pt-32 relative z-10 w-full overflow-x-hidden">
        {/* Mobile Header */}
        <div className="md:hidden w-full flex items-center justify-between px-6 pt-8 pb-4 relative z-20">
          <NavLink to="/" className="text-2xl font-serif text-[#4D0E13] font-bold tracking-tight">
            Aura <span className="font-light italic text-[#C8A49F]">Café</span>
          </NavLink>
          {!isAuthenticated ? (
            <NavLink to="/auth" className="text-gray-700 hover:text-[#4D0E13] bg-white/50 p-2 rounded-full shadow-sm border border-[#D8C4AC]/30 transition-colors">
              <User size={18} />
            </NavLink>
          ) : (
            <button 
              onClick={async () => {
                await signOutOfSupabase();
                useAppStore.getState().logout();
              }}
              className="text-gray-700 hover:text-red-800 bg-white/50 p-2 rounded-full shadow-sm border border-[#D8C4AC]/30 transition-colors"
            >
              <LogIn size={18} className="rotate-180" />
            </button>
          )}
        </div>
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>

      {/* Mobile Navigation (Floating) */}
      <nav className="fixed bottom-6 left-6 right-6 md:hidden bg-white/70 backdrop-blur-xl shadow-2xl shadow-[#D8C4AC]/40 border border-[#D8C4AC]/50 rounded-[2rem] px-6 py-4 z-30 pb-safe">
        <div className="flex justify-between items-center">
          {navLinks.slice(0, 4).map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center justify-center transition-colors ${
                  isActive ? 'text-[#4D0E13]' : 'text-gray-500'
                }`
              }
            >
              <link.icon size={22} />
            </NavLink>
          ))}
          
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center justify-center text-gray-500 hover:text-[#4D0E13] relative"
          >
            <div className="relative">
              <ShoppingBag size={22} />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#4D0E13] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-md">
                  {totalItems}
                </span>
              )}
            </div>
          </button>
        </div>
      </nav>

      <Cart />
    </div>
  );
}