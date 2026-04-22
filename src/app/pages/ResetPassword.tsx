import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { confirmPasswordReset } from '../lib/supabaseAuth';

export function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  // Parse token from URL hash (Supabase sends it as #access_token=...&type=recovery)
  const [token, setToken] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1); // Remove the '#'
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const tokenType = params.get('type');
    
    setToken(accessToken);
    setType(tokenType);

    if (tokenType !== 'recovery' || !accessToken) {
      setError('Invalid or expired reset link. Please request a new one.');
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      if (!token) {
        throw new Error('No reset token found');
      }

      await confirmPasswordReset(token, newPassword);
      setIsSuccess(true);
      toast.success('Password reset successfully!', {
        style: { background: '#4D0E13', color: '#EEE4DA', border: 'none' },
      });

      setTimeout(() => navigate('/auth'), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
      toast.error('Could not reset password', {
        style: { background: '#DC2626', color: '#FFF', border: 'none' },
      });
    } finally {
      setIsLoading(false);
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
        {!isSuccess ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif text-[#4D0E13] mb-2">Set New Password</h2>
              <p className="text-gray-700 text-sm">Enter your new password below</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
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
                <label className="text-sm font-medium text-[#4D0E13]">New Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#C8A49F] transition-all text-[#4D0E13]"
                    placeholder="••••••••"
                    minLength={8}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-gray-600">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#4D0E13]">Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#C8A49F] transition-all text-[#4D0E13]"
                    placeholder="••••••••"
                    minLength={8}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#4D0E13] text-white py-4 rounded-xl font-medium shadow-md shadow-[#4D0E13]/20 hover:bg-[#3a0a0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4">
            <CheckCircle size={48} className="text-green-600 mx-auto" />
            <h2 className="text-2xl font-serif text-[#4D0E13]">Password Reset!</h2>
            <p className="text-gray-700 text-sm">Your password has been reset successfully.</p>
            <p className="text-gray-600 text-xs">Redirecting to login in a moment...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
