import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { requestPasswordReset } from '../lib/supabaseAuth';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setEmailSent(true);
      toast.success('Reset email sent! Check your inbox.', {
        style: { background: '#4D0E13', color: '#EEE4DA', border: 'none' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      toast.error('Could not send reset email', {
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
        {!emailSent ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif text-[#4D0E13] mb-2">Reset Password</h2>
              <p className="text-gray-700 text-sm">
                Enter your email and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-6">
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
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
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
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#4D0E13] text-white py-4 rounded-xl font-medium shadow-md shadow-[#4D0E13]/20 hover:bg-[#3a0a0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 group"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <button
              onClick={() => navigate('/auth')}
              className="mt-6 w-full text-[#4D0E13] font-medium flex items-center justify-center gap-2 hover:gap-3 transition-all text-sm"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </>
        ) : (
          <div className="text-center space-y-4">
            <CheckCircle size={48} className="text-green-600 mx-auto" />
            <h2 className="text-2xl font-serif text-[#4D0E13]">Check Your Email</h2>
            <p className="text-gray-700 text-sm">
              We've sent a password reset link to <span className="font-medium">{email}</span>
            </p>
            <p className="text-gray-600 text-xs">
              Click the link in the email to set a new password. The link expires in 1 hour.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="mt-8 w-full bg-[#4D0E13] text-white py-3 rounded-xl font-medium shadow-md shadow-[#4D0E13]/20 hover:bg-[#3a0a0e] transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
