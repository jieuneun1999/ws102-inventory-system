import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Inbox, Mail, Search, Ban, Clock3, RefreshCcw, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { useAppStore, type SupplierContact, type SupplierRequest, type SupplierRequestStatus } from '../../store';
import { bootstrapSupabaseDemo } from '../../lib/supabaseSync';

const STATUS_OPTIONS: Array<{ value: 'all' | SupplierRequestStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'void', label: 'Void' },
];

const STATUS_STYLES: Record<SupplierRequestStatus, { chip: string; dot: string; label: string }> = {
  pending: { chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', label: 'Pending' },
  approved: { chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', label: 'Approved' },
  void: { chip: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500', label: 'Void' },
};

const ACTION_META: Record<'approved' | 'void', { title: string; body: string; buttonClass: string }> = {
  approved: {
    title: 'Approve Supplier Request',
    body: 'This will mark the request as approved and sync it live across active dashboards.',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  void: {
    title: 'Void Supplier Request',
    body: 'This will mark the request as void and sync it live across active dashboards.',
    buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
};

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function SupplierView() {
  const supplierRequests = useAppStore((state) => state.supplierRequests);
  const supplierContacts = useAppStore((state) => state.supplierContacts);
  const hydrateRemoteData = useAppStore((state) => state.hydrateRemoteData);
  const addSupplierContact = useAppStore((state) => state.addSupplierContact);
  const toggleSupplierContactActive = useAppStore((state) => state.toggleSupplierContactActive);
  const deleteSupplierContact = useAppStore((state) => state.deleteSupplierContact);
  const updateSupplierRequestStatus = useAppStore((state) => state.updateSupplierRequestStatus);
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierRequestStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierDisplayName, setSupplierDisplayName] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [supplierActive, setSupplierActive] = useState(true);
  const [confirming, setConfirming] = useState<{ id: string; action: 'approved' | 'void' } | null>(null);

  const summary = useMemo(() => {
    const pending = supplierRequests.filter((request) => request.status === 'pending').length;
    const approved = supplierRequests.filter((request) => request.status === 'approved').length;
    const voided = supplierRequests.filter((request) => request.status === 'void').length;
    return { total: supplierRequests.length, pending, approved, voided };
  }, [supplierRequests]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...supplierRequests]
      .filter((request) => statusFilter === 'all' ? true : request.status === statusFilter)
      .filter((request) => {
        if (!query) return true;
        return (
          request.itemName.toLowerCase().includes(query) ||
          request.supplierEmail.toLowerCase().includes(query) ||
          String(request.quantity).includes(query)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [supplierRequests, searchQuery, statusFilter]);

  const sortedContacts = useMemo(
    () => [...supplierContacts].sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt - a.createdAt),
    [supplierContacts]
  );

  const contactSummary = useMemo(() => ({
    total: supplierContacts.length,
    active: supplierContacts.filter((contact) => contact.active).length,
  }), [supplierContacts]);

  useEffect(() => {
    if (supplierRequests.length > 0) return;

    let active = true;
    void (async () => {
      const snapshot = await bootstrapSupabaseDemo().catch(() => null);
      if (!active || !snapshot) return;

      hydrateRemoteData(
        {
          supplierRequests: snapshot.supplierRequests,
          supplierContacts: snapshot.supplierContacts,
        },
        { source: 'manual' }
      );
    })();

    return () => {
      active = false;
    };
  }, [hydrateRemoteData, supplierRequests.length]);

  useEffect(() => {
    let active = true;

    const syncNow = async () => {
      const snapshot = await bootstrapSupabaseDemo().catch(() => null);
      if (!active || !snapshot) return;

      hydrateRemoteData(
        {
          supplierRequests: snapshot.supplierRequests,
          supplierContacts: snapshot.supplierContacts,
        },
        { source: 'manual' }
      );
    };

    void syncNow();
    const timer = window.setInterval(() => {
      void syncNow();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hydrateRemoteData]);

  const adminApi = import.meta.env.VITE_ADMIN_API_URL?.replace(/\/$/, '');

  const refreshSupplierSnapshot = useCallback(async () => {
    const snapshot = await bootstrapSupabaseDemo().catch(() => null);
    if (!snapshot) return;

    hydrateRemoteData(
      {
        supplierRequests: snapshot.supplierRequests,
        supplierContacts: snapshot.supplierContacts,
      },
      { source: 'manual' }
    );
  }, [hydrateRemoteData]);

  const handleStatusChange = async (request: SupplierRequest, status: SupplierRequestStatus) => {
    if (request.status === status) return;

    if (adminApi) {
      try {
        const response = await fetch(`${adminApi}/supplier_requests/${encodeURIComponent(request.id)}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || `Admin API responded ${response.status}`);
        }

        await refreshSupplierSnapshot();
        toast.success(`${request.itemName} marked ${STATUS_STYLES[status].label.toLowerCase()}.`);
        return;
      } catch (error) {
        console.error('Supplier status update via admin API failed:', error);
      }
    }

    updateSupplierRequestStatus(request.id, status);
    toast.success(`${request.itemName} marked ${STATUS_STYLES[status].label.toLowerCase()}.`);
  };

  const handleAddSupplierContact = () => {
    const email = supplierEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid supplier email.');
      return;
    }

    const doLocalUpdate = () => {
      // update local store so UI reflects immediately
      addSupplierContact({
        email,
        displayName: supplierDisplayName,
        notes: supplierNotes,
        active: supplierActive,
      });
      setSupplierEmail('');
      setSupplierDisplayName('');
      setSupplierNotes('');
      setSupplierActive(true);
      toast.success(supplierDisplayName ? `${supplierDisplayName} saved.` : 'Supplier email saved.');
    };

    if (adminApi) {
      // Try admin service first (service-role upsert). In dev you can run admin server with ADMIN_MODE=dev.
      fetch(`${adminApi}/supplier_contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: supplierDisplayName, notes: supplierNotes, active: supplierActive }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(txt || `Admin API responded ${res.status}`);
          }

          // Refresh snapshot from Supabase to ensure store is authoritative
          const snapshot = await bootstrapSupabaseDemo().catch(() => null);
          if (snapshot) {
            hydrateRemoteData({ supplierContacts: snapshot.supplierContacts }, { source: 'manual' });
            toast.success('Supplier email saved and synced.');
          } else {
            // Fallback to local update
            doLocalUpdate();
          }
        })
        .catch((err) => {
          console.error('Admin API upsert failed:', err?.message ?? err);
          // fallback to local update which will try to sync via existing sync path
          doLocalUpdate();
        });
    } else {
      // No admin API configured — use existing client-side flow
      doLocalUpdate();
    }
  };

  const handleToggleContact = (contact: SupplierContact) => {
    toggleSupplierContactActive(contact.id, !contact.active);
    toast.success(`${contact.email} ${contact.active ? 'disabled' : 'enabled'}.`);
  };

  const handleDeleteContact = (contact: SupplierContact) => {
    deleteSupplierContact(contact.id);
    toast.success(`${contact.email} removed.`);
  };

  return (
    <div className="w-full flex flex-col gap-6 h-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C4AC]/40 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#4D0E13]/65">
            <Inbox size={14} /> Supplier Dashboard
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">Supplier Requests</h2>
          <p className="mt-1 text-sm font-medium text-[#4D0E13]/60 max-w-2xl">
            Incoming supplier emails are parsed by the backend and stored as pending requests here. Change the status to approved, pending, or void and it will sync to Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md px-4 py-3 shadow-sm min-w-[140px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D0E13]/45">Pending</p>
            <p className="mt-1 text-2xl font-serif text-[#4D0E13]">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md px-4 py-3 shadow-sm min-w-[140px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D0E13]/45">Approved</p>
            <p className="mt-1 text-2xl font-serif text-[#4D0E13]">{summary.approved}</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md px-4 py-3 shadow-sm min-w-[140px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D0E13]/45">Void</p>
            <p className="mt-1 text-2xl font-serif text-[#4D0E13]">{summary.voided}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="flex items-center gap-2 bg-white/55 border border-[#D8C4AC]/35 rounded-2xl px-3.5 py-3 backdrop-blur-md shadow-sm">
          <Search size={16} className="text-[#4D0E13]/55" />
          <input
            type="text"
            placeholder="Search item, supplier email, or quantity"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#4D0E13] placeholder:text-[#4D0E13]/35 outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors border ${
                  active
                    ? 'bg-[#4D0E13] text-[#EEE4DA] border-[#4D0E13] shadow-sm'
                    : 'bg-white/55 text-[#4D0E13]/70 border-[#D8C4AC]/35 hover:bg-white/80'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/60 bg-white/50 backdrop-blur-xl shadow-[0_14px_34px_rgba(77,14,19,0.08)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#D8C4AC]/25 bg-white/45">
          <div>
            <h3 className="font-serif text-xl text-[#4D0E13]">Request Queue</h3>
            <p className="text-xs sm:text-sm text-[#4D0E13]/55 font-medium">
              {summary.total} request{summary.total === 1 ? '' : 's'} in the system
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4D0E13]/55">
            <Clock3 size={14} /> Auto-polls every 10s
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <AnimatePresence mode="popLayout">
            {filteredRequests.length > 0 ? (
              <div className="w-full">
                <ul className="divide-y divide-[#EFE7DF]">
                  {filteredRequests.map((request) => {
                    const tone = STATUS_STYLES[request.status];
                    return (
                      <motion.li
                        key={request.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                        className="px-2 py-2.5 sm:px-3"
                      >
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-2.5 items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${tone.chip}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                                {tone.label}
                              </span>
                              <span className="text-[22px] sm:text-[24px] font-serif font-bold tracking-tight text-[#3B1014] tabular-nums leading-none">
                                {request.quantity}
                                <span className="ml-1 text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.06em] text-[#4D0E13]/75">{request.unit ?? ''}</span>
                              </span>
                              <span className="text-[18px] sm:text-[20px] font-semibold text-[#2b1a18] font-serif break-words leading-none">
                                {request.inventoryItemName ?? request.itemName}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-[#E6D8CB] bg-[#FCF8F3] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#4D0E13]/55 font-semibold">
                                {formatDate(request.createdAt)}
                              </span>
                            </div>

                            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-1.5 sm:gap-x-3 text-xs text-[#4D0E13]/65">
                              <p className="truncate">
                                Supplier: <span className="font-medium">{request.supplierEmail}</span>
                              </p>
                              <p className="sm:text-right">
                                Linked: <span className="font-medium">{request.inventoryItemName ?? request.itemName}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 xl:justify-end xl:self-center">
                            <button
                              type="button"
                              onClick={() => { void handleStatusChange(request, 'pending'); }}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold tracking-[0.08em] ${
                                request.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-white text-[#4D0E13]/85 border-[#D8C4AC]/45 hover:bg-[#FBF7F2]'
                              }`}
                            >
                              <RefreshCcw size={13} /> Pending
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming({ id: request.id, action: 'approved' })}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold tracking-[0.08em] ${
                                request.status === 'approved'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming({ id: request.id, action: 'void' })}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold tracking-[0.08em] ${
                                request.status === 'void'
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <Ban size={13} /> Void
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F5EFE6] text-[#4D0E13]/40">
                  <Inbox size={28} />
                </div>
                <h4 className="font-serif text-2xl text-[#4D0E13]">No supplier requests found</h4>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#4D0E13]/55 font-medium">
                  New Gmail requests will appear here as pending once the backend listener picks them up.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/60 bg-white/50 backdrop-blur-xl shadow-[0_14px_34px_rgba(77,14,19,0.08)] overflow-hidden">
        <div className="flex flex-col gap-4 px-4 sm:px-6 py-4 border-b border-[#D8C4AC]/25 bg-white/45">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl text-[#4D0E13]">Supplier Email Registry</h3>
              <p className="text-xs sm:text-sm text-[#4D0E13]/55 font-medium max-w-2xl">
                Add supplier inboxes here. The backend listener reads this list from Supabase, so any active address will start producing pending requests without editing env files.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[#4D0E13]/55">
              <span className="rounded-full border border-[#D8C4AC]/35 bg-white/70 px-3 py-2">{contactSummary.active} active</span>
              <span className="rounded-full border border-[#D8C4AC]/35 bg-white/70 px-3 py-2">{contactSummary.total} total</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr_1fr_auto] gap-3">
            <input
              type="email"
              value={supplierEmail}
              onChange={(e) => setSupplierEmail(e.target.value)}
              placeholder="supplier@example.com"
              className="rounded-2xl border border-[#D8C4AC]/35 bg-white/80 px-4 py-3 text-sm text-[#4D0E13] placeholder:text-[#4D0E13]/35 outline-none"
            />
            <input
              type="text"
              value={supplierDisplayName}
              onChange={(e) => setSupplierDisplayName(e.target.value)}
              placeholder="Supplier name"
              className="rounded-2xl border border-[#D8C4AC]/35 bg-white/80 px-4 py-3 text-sm text-[#4D0E13] placeholder:text-[#4D0E13]/35 outline-none"
            />
            <input
              type="text"
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              placeholder="Notes or branch"
              className="rounded-2xl border border-[#D8C4AC]/35 bg-white/80 px-4 py-3 text-sm text-[#4D0E13] placeholder:text-[#4D0E13]/35 outline-none"
            />
            <button
              type="button"
              onClick={handleAddSupplierContact}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4D0E13] px-4 py-3 text-sm font-bold text-[#EEE4DA] shadow-sm transition-colors hover:bg-[#3f0c10]"
            >
              <Plus size={16} /> Save Email
            </button>
          </div>

          <p className="text-xs text-[#4D0E13]/55 font-medium">
            Only active emails in this registry are allowed to send Restock Approval requests.
          </p>

          <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4D0E13]/60">
            <input
              type="checkbox"
              checked={supplierActive}
              onChange={(e) => setSupplierActive(e.target.checked)}
              className="h-4 w-4 rounded border-[#D8C4AC] text-[#4D0E13]"
            />
            Start active
          </label>
        </div>

        <div className="p-4 sm:p-6">
          {sortedContacts.length > 0 ? (
            <ul className="divide-y divide-[#EFE7DF] rounded-2xl border border-[#E7D9CC]/70 bg-white/80 overflow-hidden">
              {sortedContacts.map((contact) => (
                <li key={contact.id} className="px-3.5 py-3 sm:px-4">
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-2.5 items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${contact.active ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${contact.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {contact.active ? 'Active' : 'Disabled'}
                        </span>
                        <span className="text-sm sm:text-[15px] font-semibold text-[#2b1a18] font-serif truncate">
                          {contact.displayName || 'Unnamed supplier'}
                        </span>
                      </div>

                      <p className="mt-1 flex items-center gap-2 text-sm text-[#4D0E13]/65 break-all">
                        <Mail size={14} className="shrink-0" />
                        <span>{contact.email}</span>
                      </p>
                      {contact.notes ? <p className="mt-0.5 text-xs text-[#4D0E13]/45 font-medium truncate">{contact.notes}</p> : null}
                    </div>

                    <div className="flex items-center gap-1.5 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => handleToggleContact(contact)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                          contact.active
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-white text-[#4D0E13] border-[#D8C4AC]/40 hover:bg-[#FBF7F2]'
                        }`}
                      >
                        {contact.active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                        {contact.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact)}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors bg-white text-[#4D0E13] border-[#D8C4AC]/40 hover:bg-[#FBF7F2]"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-14 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F5EFE6] text-[#4D0E13]/40">
                <Mail size={28} />
              </div>
              <h4 className="font-serif text-2xl text-[#4D0E13]">No supplier emails added yet</h4>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#4D0E13]/55 font-medium">
                Add the supplier inboxes you want the backend listener to accept. Active contacts will start generating pending requests automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(confirming)} onOpenChange={(open) => { if (!open) setConfirming(null); }}>
        {confirming ? (
          <DialogContent className="max-w-md rounded-2xl border-[#D8C4AC]/65 bg-white p-0 shadow-[0_18px_48px_rgba(77,14,19,0.16)]">
            <DialogHeader className="px-5 pt-5 pb-2 text-left">
              <DialogTitle className="font-serif text-3xl leading-none text-[#4D0E13] tracking-tight">
                {ACTION_META[confirming.action].title}
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm font-medium leading-relaxed text-[#4D0E13]/65">
                {ACTION_META[confirming.action].body}
              </DialogDescription>
            </DialogHeader>

            <div className="mx-5 mb-2 rounded-xl border border-[#E6D8CB] bg-[#FCF8F3] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.13em] font-bold text-[#4D0E13]/45">Selected request</p>
              <p className="mt-1 font-serif text-lg font-semibold text-[#3B1014]">
                {supplierRequests.find((entry) => entry.id === confirming.id)?.inventoryItemName ?? supplierRequests.find((entry) => entry.id === confirming.id)?.itemName}
              </p>
            </div>

            <div className="px-5 pb-5 pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-full border border-[#D8C4AC]/60 bg-white px-4 py-2 text-sm font-semibold text-[#4D0E13] hover:bg-[#FBF7F2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const req = supplierRequests.find((entry) => entry.id === confirming.id);
                  if (req) {
                    void handleStatusChange(req, confirming.action);
                  }
                  setConfirming(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold ${ACTION_META[confirming.action].buttonClass}`}
              >
                Confirm {confirming.action === 'approved' ? 'Approval' : 'Void'}
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
