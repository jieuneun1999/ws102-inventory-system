import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Coffee, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setUser } = useApp();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Mock authentication - replace with Supabase later
    const mockUsers = [
      { email: 'admin@cafe.com', password: 'admin123', role: 'admin' as const, name: 'Admin' },
      { email: 'barista@cafe.com', password: 'barista123', role: 'barista' as const, name: 'Barista' },
    ];

    const user = mockUsers.find(u => u.email === email && u.password === password);

    if (user) {
      setUser({
        id: Date.now().toString(),
        email: user.email,
        role: user.role,
        name: user.name,
      });
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
    } else {
      toast.error('Invalid credentials. Try admin@cafe.com / admin123 or barista@cafe.com / barista123');
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div
          className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-8 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-burgundy mb-4">
              <Coffee size={32} className="text-white" />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--burgundy)' }}>
              Staff Login
            </h1>
            <p style={{ color: 'var(--coffee-brown)', opacity: 0.8, marginTop: '0.5rem' }}>
              Barista & Admin Access Only
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block mb-2" style={{ color: 'var(--coffee-brown)', fontWeight: 500 }}>
                Email
              </label>
              <div className="relative">
                <Mail
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--burgundy)', opacity: 0.6 }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-2xl backdrop-blur-md bg-white/30 border border-white/20 outline-none focus:border-burgundy/30 transition-all"
                  style={{
                    color: 'var(--coffee-brown)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block mb-2" style={{ color: 'var(--coffee-brown)', fontWeight: 500 }}>
                Password
              </label>
              <div className="relative">
                <Lock
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--burgundy)', opacity: 0.6 }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-2xl backdrop-blur-md bg-white/30 border border-white/20 outline-none focus:border-burgundy/30 transition-all"
                  style={{
                    color: 'var(--coffee-brown)',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full px-6 py-4 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all text-lg shadow-lg hover:shadow-xl"
            >
              <span style={{ fontWeight: 600 }}>Sign In</span>
            </button>
          </form>

          <div className="mt-8 p-4 rounded-2xl bg-white/20">
            <p style={{ fontSize: '0.875rem', color: 'var(--coffee-brown)', marginBottom: '0.5rem', fontWeight: 500 }}>
              Demo Credentials:
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--coffee-brown)', opacity: 0.8 }}>
              Admin: admin@cafe.com / admin123
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--coffee-brown)', opacity: 0.8 }}>
              Barista: barista@cafe.com / barista123
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
