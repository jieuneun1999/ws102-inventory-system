import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { useEffect, useRef } from 'react';
import { useAppStore, type SyncTrigger } from './store';
import { bootstrapSupabaseDemo, fetchPublicCatalog, reconcileSupabaseOrders, syncSupabaseHistoryEvents } from './lib/supabaseSync';
import { getStoredAuthUser, refreshSupabaseUser } from './lib/supabaseAuth';
import { subscribeDashboardRealtime, subscribePublicCatalogRealtime } from './lib/supabaseRealtime';
import { toast } from 'sonner';

const STORAGE_KEY = 'aura-cafe-storage';

export default function App() {
  const hydrateRemoteData = useAppStore((state) => state.hydrateRemoteData);
  const hydrateAuthSession = useAppStore((state) => state.hydrateAuthSession);
  const historyEvents = useAppStore((state) => state.historyEvents);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const userRole = useAppStore((state) => state.userRole);
  const isStaff = isAuthenticated && (userRole === 'admin' || userRole === 'barista');
  const syncedHistoryEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Prevent framer-motion useScroll offset calculation warning
    document.documentElement.style.position = 'relative';
    document.body.style.position = 'relative';

    let active = true;
    let debounceTimer: number | null = null;
    let followUpTimer: number | null = null;
    let syncInFlight = false;
    let queuedSource: SyncTrigger | null = null;

    const syncSnapshot = async (source: SyncTrigger = 'initial') => {
      if (!active) return;
      if (syncInFlight) {
        queuedSource = source;
        return;
      }

      syncInFlight = true;

      try {
        if (isStaff) {
          const localState = useAppStore.getState();
          const snapshot = await bootstrapSupabaseDemo().catch(() => null);
          if (!snapshot || !active) return;

          const reconcileResult = await reconcileSupabaseOrders(
            localState.orders,
            snapshot.orders.map((order) => ({ id: order.id, status: order.status })),
            localState.receipts
          ).catch(() => ({ created: 0, updated: 0 }));

          if ((reconcileResult.created + reconcileResult.updated) > 0) {
            toast.success(
              `Recovered ${reconcileResult.created} missing order(s) and replayed ${reconcileResult.updated} update(s) to Supabase.`,
              { duration: 5000 }
            );
          }

          hydrateRemoteData({
            products: snapshot.products,
            productRecipes: snapshot.productRecipes,
            inventory: snapshot.inventory,
            orders: snapshot.orders,
            receipts: snapshot.receipts,
            historyEvents: snapshot.historyEvents,
            inventoryAdjustments: snapshot.inventoryAdjustments,
            wasteLogs: snapshot.wasteLogs,
            supplierContacts: snapshot.supplierContacts,
            supplierRequests: snapshot.supplierRequests,
          }, { source });
          return;
        }

        const catalog = await fetchPublicCatalog().catch(() => null);
        if (!catalog || !active) return;
        hydrateRemoteData({ products: catalog }, { source });
      } finally {
        syncInFlight = false;
        if (queuedSource) {
          const nextSource = queuedSource;
          queuedSource = null;
          void syncSnapshot(nextSource);
        }
      }
    };

    const scheduleSync = (source: SyncTrigger, debounceMs = 140, includeFollowUp = false, followUpMs = 1100) => {
      if (!active) return;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        void syncSnapshot(source);
      }, debounceMs);

      if (includeFollowUp) {
        if (followUpTimer) {
          window.clearTimeout(followUpTimer);
        }
        followUpTimer = window.setTimeout(() => {
          void syncSnapshot(source);
        }, followUpMs);
      }
    };

    void (async () => {
      const refreshedSession = await refreshSupabaseUser().catch(() => null);
      const authUser = refreshedSession?.user ?? getStoredAuthUser();
      const role = authUser?.user_metadata?.role ?? authUser?.app_metadata?.role;
      if (authUser && (role === 'admin' || role === 'barista')) {
        hydrateAuthSession({ role, accountId: authUser.id });
      }

      await syncSnapshot('initial');
    })();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleSync('visibility', 140, true, 1100);
      }
    };

    const onFocus = () => scheduleSync('focus', 140, true, 1100);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      scheduleSync('storage', 80, true, 900);
    };
    const onAppSyncSignal = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason ?? 'manual';
      const isOrderWrite = reason.startsWith('order-');
      scheduleSync('realtime', isOrderWrite ? 240 : 100, true, isOrderWrite ? 900 : 1100);
    };

    const onSyncError = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; error?: string }>).detail ?? {};
      const msg = detail.error || detail.label || 'Sync failed';
      toast.error(`Supabase sync failed: ${msg}`, { duration: 5000 });
      console.warn('[Sync Error]', detail);
    };

    const realtimeUnsubscribe = isStaff
      ? subscribeDashboardRealtime(() => scheduleSync('realtime', 100, true, 1100))
      : subscribePublicCatalogRealtime(() => scheduleSync('realtime', 100, true, 1100));
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      scheduleSync('interval', 140);
    }, 30000);

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    window.addEventListener('aura-cafe-sync', onAppSyncSignal as EventListener);
    window.addEventListener('aura-cafe-sync-error', onSyncError as EventListener);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      if (followUpTimer) {
        window.clearTimeout(followUpTimer);
      }
      realtimeUnsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('aura-cafe-sync', onAppSyncSignal as EventListener);
      window.removeEventListener('aura-cafe-sync-error', onSyncError as EventListener);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hydrateRemoteData, hydrateAuthSession, isStaff]);

  useEffect(() => {
    if (!isStaff || historyEvents.length === 0) return;

    const unsyncedEvents = historyEvents.filter((event) => !syncedHistoryEventIds.current.has(event.id));
    if (unsyncedEvents.length === 0) return;

    void (async () => {
      const synced = await syncSupabaseHistoryEvents(unsyncedEvents);
      if (!synced) return;
      unsyncedEvents.forEach((event) => syncedHistoryEventIds.current.add(event.id));
    })();
  }, [historyEvents, isStaff]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </>
  );
}
