import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Lock, Camera, Check,
  Eye, EyeOff, LogOut, ShieldCheck, ShieldAlert,
  BadgeCheck, AlertTriangle, Save, KeyRound,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { toast } from 'sonner';

type Tab = 'profile' | 'email' | 'password' | 'security';

// ─── Shared Field label ──────────────────────────────────────────────────────
function Field({ label, children }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-[#4D0E13]/40">{label}</label>
      {children}
    </div>
  );
}

// ─── Shared Input ────────────────────────────────────────────────────────────
function Input({ value, onChange, placeholder, type = 'text', rightSlot }: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#FAF6F0]/80 border border-[#D8C4AC]/40 rounded-xl px-4 py-2.5 text-base text-[#4D0E13] placeholder:text-[#4D0E13]/25 focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/40 transition-all ${rightSlot ? 'pr-11' : ''}`}
      />
      {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
    </div>
  );
}

// ─── Save button ─────────────────────────────────────────────────────────────
function SaveBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2 bg-[#4D0E13] text-[#EEE4DA] rounded-full text-sm font-bold shadow-md shadow-[#4D0E13]/20 hover:bg-[#3a0a0e] transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-[#EEE4DA]/30 border-t-[#EEE4DA] rounded-full animate-spin" />
        : <Save size={15} />}
      Save
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-[#D8C4AC]/25 my-5" />;
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function SettingsView() {
  const { currentAccountId, userRole, accounts, updateAccount, logout } = useAppStore();

  const account =
    accounts.find(a => a.id === currentAccountId) ??
    accounts.find(a => a.role === userRole) ??
    null;

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(account?.avatarUrl ?? null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Email
  const [newEmail, setNewEmail] = useState(account?.email ?? '');
  const [verifyCode, setVerifyCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(account?.emailVerified ?? false);
  const [savingEmail, setSavingEmail] = useState(false);
  const MOCK_CODE = '123456';

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  if (!account) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-[#4D0E13]/40 font-serif text-xl">No account found.</p>
    </div>
  );

  const initials = (account.displayName || account.email).slice(0, 2).toUpperCase();

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    setSavingProfile(true);
    setTimeout(() => {
      updateAccount(account.id, { displayName: displayName.trim() || account.displayName, avatarUrl: avatarPreview ?? account.avatarUrl });
      setSavingProfile(false);
      toast.success('Profile updated!', { style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' } });
    }, 700);
  };

  const sendCode = () => {
    setCodeSent(true);
    toast(`Code sent to ${newEmail}`, { description: `Demo: ${MOCK_CODE}`, duration: 8000, style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' } });
  };

  const saveEmail = () => {
    if (!codeSent) { sendCode(); return; }
    if (verifyCode !== MOCK_CODE) { toast.error('Incorrect code.'); return; }
    setSavingEmail(true);
    setTimeout(() => {
      updateAccount(account.id, { email: newEmail, emailVerified: true });
      setEmailVerified(true); setCodeSent(false); setVerifyCode('');
      setSavingEmail(false);
      toast.success('Email updated!', { style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' } });
    }, 800);
  };

  const savePassword = () => {
    if (currentPw !== account.password) { toast.error('Current password is incorrect.'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match.'); return; }
    setSavingPw(true);
    setTimeout(() => {
      updateAccount(account.id, { password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setSavingPw(false);
      toast.success('Password changed!', { style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' } });
    }, 800);
  };

  const pwStrength = (() => {
    if (!newPw) return null;
    if (newPw.length < 6) return { label: 'Weak', color: 'bg-red-400', text: 'text-red-500', w: '25%' };
    if (newPw.length < 8) return { label: 'Fair', color: 'bg-amber-400', text: 'text-amber-500', w: '50%' };
    if (/[A-Z]/.test(newPw) && /[0-9]/.test(newPw) && /[^A-Za-z0-9]/.test(newPw)) return { label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-600', w: '100%' };
    return { label: 'Good', color: 'bg-[#C8A49F]', text: 'text-[#C8A49F]', w: '75%' };
  })();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'security', label: 'Security', icon: KeyRound },
  ];

  return (
    <div className="w-full pt-4 pb-16 pr-2">
      {/* Page title */}
      <header className="mb-5">
        <h2 className="text-[28px] font-serif text-[#4D0E13] tracking-tight">Account Settings</h2>
        <p className="text-[#4D0E13]/40 text-sm mt-0.5">Manage your profile, email, and security.</p>
      </header>

      {/* ── Single card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white/55 backdrop-blur-xl border border-white/70 rounded-[2rem] shadow-[0_8px_40px_rgba(77,14,19,0.06)] overflow-hidden flex max-w-3xl"
        style={{ minHeight: 480 }}
      >
        {/* ── Left panel: avatar + nav ── */}
        <div className="w-52 shrink-0 bg-[#4D0E13]/[0.03] border-r border-[#D8C4AC]/30 flex flex-col py-7 px-4 gap-1">

          {/* Avatar block */}
          <div className="flex flex-col items-center gap-2 mb-6 px-1">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full overflow-hidden border-[3px] border-[#D8C4AC]/50 shadow-md bg-[#D8C4AC]/20 flex items-center justify-center">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="font-serif text-2xl text-[#4D0E13]/50">{initials}</span>}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-[#4D0E13]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera size={15} className="text-white" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div className="text-center">
              <p className="font-serif text-base text-[#4D0E13] truncate max-w-[130px]">{account.displayName || account.email.split('@')[0]}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${account.role === 'admin' ? 'bg-[#4D0E13]/10 text-[#4D0E13]' : 'bg-[#C8A49F]/25 text-[#C8A49F]'}`}>
                {account.role}
              </span>
            </div>
          </div>

          {/* Tab nav */}
          <nav className="flex flex-col gap-1 flex-1">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-base transition-all duration-200 ${
                    active ? 'text-[#EEE4DA]' : 'text-[#4D0E13]/60 hover:text-[#4D0E13] hover:bg-white/40'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="settingsTab"
                      className="absolute inset-0 bg-[#4D0E13] rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <tab.icon size={17} strokeWidth={active ? 2.5 : 2} className="relative z-10 shrink-0" />
                  <span className="relative z-10 font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sign out */}
          <button
            onClick={() => { logout(); toast('Signed out.', { style: { background: '#4D0E13', color: '#EEE4DA', border: 'none' } }); }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition-all mt-2"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        {/* ── Right panel: content ── */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* Profile */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 p-7 flex flex-col"
              >
                <h3 className="font-serif text-xl text-[#4D0E13] mb-1">Profile</h3>
                <p className="text-sm text-[#4D0E13]/40 mb-5">Your name and avatar visible to the team.</p>

                <div className="space-y-4 max-w-sm">
                  <Field label="Display Name">
                    <Input value={displayName} onChange={setDisplayName} placeholder="e.g. Maria Santos" />
                  </Field>
                  <Field label="Account Email">
                    <div className="px-4 py-2.5 bg-[#D8C4AC]/15 border border-[#D8C4AC]/30 rounded-xl text-base text-[#4D0E13]/50 font-medium">
                      {account.email}
                    </div>
                  </Field>
                  <Field label="Member Since">
                    <div className="px-4 py-2.5 bg-[#D8C4AC]/15 border border-[#D8C4AC]/30 rounded-xl text-base text-[#4D0E13]/50 font-medium">
                      {new Date(account.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </Field>
                </div>

                <Divider />
                <div className="flex items-center gap-4">
                  <SaveBtn onClick={saveProfile} loading={savingProfile} />
                  {avatarPreview && (
                    <button onClick={() => setAvatarPreview(null)} className="text-sm text-[#4D0E13]/30 hover:text-red-400 transition-colors">
                      Remove photo
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Email */}
            {activeTab === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 p-7 flex flex-col"
              >
                <h3 className="font-serif text-xl text-[#4D0E13] mb-1">Email Address</h3>
                <p className="text-sm text-[#4D0E13]/40 mb-5">Update and verify your email for account security.</p>

                {/* Verification badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-5 self-start ${
                  emailVerified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {emailVerified ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}
                  {emailVerified ? 'Verified' : 'Not verified'}
                </div>

                <div className="space-y-3 max-w-sm">
                  <Field label="Email Address">
                    <Input
                      value={newEmail}
                      onChange={v => { setNewEmail(v); setCodeSent(false); setEmailVerified(false); }}
                      placeholder="you@aura.cafe"
                      type="email"
                    />
                  </Field>

                  <AnimatePresence>
                    {codeSent && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Field label="Verification Code">
                          <Input
                            value={verifyCode}
                            onChange={setVerifyCode}
                            placeholder="6-digit code"
                            rightSlot={verifyCode === MOCK_CODE ? <Check size={14} className="text-emerald-500" /> : null}
                          />
                          <p className="text-xs text-[#4D0E13]/35 mt-1.5">
                            Demo code: <span className="font-bold text-[#4D0E13]/50">123456</span>
                          </p>
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Divider />
                <div className="flex items-center gap-4">
                  <SaveBtn onClick={saveEmail} loading={savingEmail} />
                  {!codeSent ? (
                    <button onClick={sendCode} className="text-sm font-bold text-[#C8A49F] hover:text-[#4D0E13] transition-colors flex items-center gap-1">
                      <ShieldCheck size={14} /> Send code
                    </button>
                  ) : (
                    <button onClick={sendCode} className="text-sm text-[#4D0E13]/30 hover:text-[#4D0E13] transition-colors">
                      Resend
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Password */}
            {activeTab === 'password' && (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 p-5 flex flex-col"
              >
                <h3 className="font-serif text-xl text-[#4D0E13] mb-0.5">Change Password</h3>
                <p className="text-sm text-[#4D0E13]/40 mb-4">Use a strong password to protect your account.</p>

                <div className="space-y-2 max-w-sm">
                  <Field label="Current Password">
                    <Input value={currentPw} onChange={setCurrentPw} type={showCur ? 'text' : 'password'} placeholder="••••••••"
                      rightSlot={<button onClick={() => setShowCur(v => !v)} className="text-[#4D0E13]/25 hover:text-[#4D0E13] transition-colors">{showCur ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
                    />
                  </Field>
                  <Field label="New Password">
                    <Input value={newPw} onChange={setNewPw} type={showNew ? 'text' : 'password'} placeholder="Min. 8 characters"
                      rightSlot={<button onClick={() => setShowNew(v => !v)} className="text-[#4D0E13]/25 hover:text-[#4D0E13] transition-colors">{showNew ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
                    />
                    {pwStrength && (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="h-0.5 w-full bg-[#D8C4AC]/30 rounded-full overflow-hidden">
                          <motion.div className={`h-full rounded-full ${pwStrength.color}`} animate={{ width: pwStrength.w }} transition={{ duration: 0.3 }} />
                        </div>
                        <p className={`text-[10px] font-bold ${pwStrength.text}`}>{pwStrength.label}</p>
                      </div>
                    )}
                  </Field>
                  <Field label="Confirm Password">
                    <Input value={confirmPw} onChange={setConfirmPw} type={showCon ? 'text' : 'password'} placeholder="Re-enter password"
                      rightSlot={
                        <div className="flex items-center gap-1">
                          {confirmPw && newPw && (confirmPw === newPw ? <Check size={12} className="text-emerald-500" /> : <span className="w-1.5 h-1.5 rounded-full bg-red-400" />)}
                          <button onClick={() => setShowCon(v => !v)} className="text-[#4D0E13]/25 hover:text-[#4D0E13] transition-colors">{showCon ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                        </div>
                      }
                    />
                  </Field>
                </div>

                <div className="border-t border-[#D8C4AC]/25 mt-4 pt-3">
                  <SaveBtn onClick={savePassword} loading={savingPw} />
                </div>
              </motion.div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 p-5 flex flex-col"
              >
                <h3 className="font-serif text-xl text-[#4D0E13] mb-0.5">Security Overview</h3>
                <p className="text-sm text-[#4D0E13]/40 mb-4">A summary of your account's security status.</p>

                <div className="space-y-2 max-w-sm">
                  {[
                    {
                      label: 'Email verification',
                      value: emailVerified ? 'Verified' : 'Not verified',
                      icon: emailVerified ? BadgeCheck : AlertTriangle,
                      ok: emailVerified,
                      action: () => setActiveTab('email'),
                      actionLabel: emailVerified ? null : 'Verify →',
                    },
                    {
                      label: 'Password strength',
                      value: account.password && account.password.length >= 8 ? 'Strong' : 'Weak',
                      icon: account.password && account.password.length >= 8 ? ShieldCheck : ShieldAlert,
                      ok: !!(account.password && account.password.length >= 8),
                      action: () => setActiveTab('password'),
                      actionLabel: !(account.password && account.password.length >= 8) ? 'Update →' : null,
                    },
                    {
                      label: 'Account role',
                      value: account.role === 'admin' ? 'Administrator' : 'Barista',
                      icon: User,
                      ok: true,
                      action: null,
                      actionLabel: null,
                    },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${item.ok ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100'}`}>
                      <item.icon size={17} strokeWidth={1.8} className={item.ok ? 'text-emerald-600' : 'text-amber-600'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4D0E13]/40">{item.label}</p>
                        <p className={`text-sm font-bold truncate ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{item.value}</p>
                      </div>
                      {item.actionLabel && item.action && (
                        <button onClick={item.action} className="text-[10px] font-bold text-[#C8A49F] hover:text-[#4D0E13] transition-colors shrink-0 whitespace-nowrap">
                          {item.actionLabel}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Session info */}
                <div className="mt-4 pt-3 border-t border-[#D8C4AC]/25 flex items-center justify-between">
                  <p className="text-xs text-[#4D0E13]/40">
                    Signed in as <span className="font-bold text-[#4D0E13]/60">{account.email}</span>
                  </p>
                  <button
                    onClick={() => { logout(); toast('Signed out.', { style: { background: '#4D0E13', color: '#EEE4DA', border: 'none' } }); }}
                    className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}