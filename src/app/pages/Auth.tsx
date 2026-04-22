import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { signInWithSupabase } from '../lib/supabaseAuth';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { hydrateAuthSession } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const session = await signInWithSupabase(email, password);
      const role = session.user.user_metadata?.role ?? session.user.app_metadata?.role;

      if (role !== 'admin' && role !== 'barista') {
        setError('Your account is missing a role. Set user_metadata.role to admin or barista in Supabase Auth.');
        toast.error('Missing role metadata', {
          style: { background: '#DC2626', color: '#FFF', border: 'none' },
        });
        return;
      }

      hydrateAuthSession({ role, accountId: session.user.id });
      toast.success(`Welcome back, ${role === 'admin' ? 'Admin' : 'Barista'}!`, {
        style: { background: '#4D0E13', color: '#EEE4DA', border: 'none' },
      });
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
      toast.error('Invalid credentials', {
        style: { background: '#DC2626', color: '#FFF', border: 'none' },
      });
    }
  };

  return (
    <div className="container mx-auto px-6 flex items-center justify-center min-h-[calc(100vh-12rem)] md:min-h-[calc(100vh-16rem)] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D8C4AC] rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#C8A49F] rounded-full mix-blend-multiply filter blur-3xl opacity-30" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto bg-[#D8C4AC]/40 backdrop-blur-xl border border-[#D8C4AC]/50 p-8 md:p-12 rounded-[2rem] shadow-xl relative z-10"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif text-[#4D0E13] mb-2">Staff Login</h2>
          <p className="text-gray-700 text-sm">Access the dashboard and manage operations.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4D0E13]">Email Address</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#C8A49F] transition-all text-[#4D0E13]"
                placeholder="barista@aura.cafe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4D0E13]">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#C8A49F] transition-all text-[#4D0E13]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#4D0E13] text-white py-4 rounded-xl font-medium shadow-md shadow-[#4D0E13]/20 hover:bg-[#3a0a0e] transition-colors flex items-center justify-center gap-2 group"
          >
            <LogIn size={18} className="group-hover:translate-x-1 transition-transform" /> Sign In
          </button>

          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="w-full text-[#4D0E13] text-sm font-medium py-2 hover:text-[#3a0a0e] transition-colors"
          >
            Forgot your password?
          </button>
        </form>

        <div className="mt-8 p-4 bg-white/50 rounded-xl border border-[#D8C4AC]/30">
          <p className="text-xs text-gray-600 mb-3 font-medium">Demo Accounts:</p>
          <div className="space-y-1 text-xs text-gray-700">
            <p>• Use the two Supabase Auth users you created: one admin, one barista</p>
            <p>• Make sure each user has user_metadata.role set correctly</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}