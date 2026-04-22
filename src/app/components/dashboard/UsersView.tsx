import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store';
import { UserPlus, Trash2, Shield, Coffee, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

export function UsersView() {
  const { accounts, addAccount, deleteAccount, userRole } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (userRole !== 'admin') {
    return (
      <div className="h-[600px] flex items-center justify-center bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-sm">
        <p className="text-[#4D0E13]/50 font-serif text-xl">Access Restricted.</p>
      </div>
    );
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    addAccount({ email: newEmail, password: newPassword, role: 'barista' });
    toast.success('Barista account created successfully');
    setIsAdding(false);
    setNewEmail('');
    setNewPassword('');
  };

  const handleDelete = (id: string, email: string) => {
    if (confirm(`Are you sure you want to delete ${email}?`)) {
      deleteAccount(id);
      toast.success('Account deleted');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif text-[#4D0E13]">Team Members</h2>
          <p className="text-gray-600 mt-1">Manage barista access and roles.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#4D0E13] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm hover:bg-[#3a0a0e] transition-colors flex items-center gap-2"
        >
          <UserPlus size={18} /> Add Barista
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAdd} className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm mb-4">
              <h3 className="font-serif text-[#4D0E13] text-lg mb-4">New Barista Account</h3>
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium text-[#4D0E13]">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A49F] transition-all text-[#4D0E13]"
                      placeholder="barista@aura.cafe"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium text-[#4D0E13]">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8A49F]" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A49F] transition-all text-[#4D0E13]"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-[#4D0E13] text-white px-6 py-2 rounded-xl font-medium hover:bg-[#3a0a0e] transition-colors h-[42px]"
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-[#4D0E13]/5 border-b border-[#4D0E13]/10">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-[#4D0E13]">User</th>
              <th className="px-6 py-4 text-sm font-semibold text-[#4D0E13]">Role</th>
              <th className="px-6 py-4 text-sm font-semibold text-[#4D0E13]">Added</th>
              <th className="px-6 py-4 text-sm font-semibold text-[#4D0E13] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8C4AC]/30">
            {accounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-white/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${acc.role === 'admin' ? 'bg-[#C8A49F]/20 text-[#4D0E13]' : 'bg-[#D8C4AC]/20 text-[#4D0E13]'}`}>
                      {acc.role === 'admin' ? <Shield size={18} /> : <Coffee size={18} />}
                    </div>
                    <div>
                      <p className="font-medium text-[#4D0E13]">{acc.email}</p>
                      <p className="text-xs text-gray-500">ID: {acc.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                    acc.role === 'admin' ? 'bg-[#C8A49F]/30 text-[#4D0E13]' : 'bg-[#D8C4AC]/40 text-gray-700'
                  }`}>
                    {acc.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(acc.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  {acc.role !== 'admin' && (
                    <button
                      onClick={() => handleDelete(acc.id, acc.email)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete account"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}