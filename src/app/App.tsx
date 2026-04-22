import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { useAppStore } from './store';
import { bootstrapSupabaseDemo } from './lib/supabaseSync';
import { getStoredAuthUser, refreshSupabaseUser } from './lib/supabaseAuth';

export default function App() {
  const hydrateRemoteData = useAppStore((state) => state.hydrateRemoteData);
  const hydrateAuthSession = useAppStore((state) => state.hydrateAuthSession);

  useEffect(() => {
    // Prevent framer-motion useScroll offset calculation warning
    document.documentElement.style.position = 'relative';
    document.body.style.position = 'relative';

    void (async () => {
      const refreshedSession = await refreshSupabaseUser().catch(() => null);
      const authUser = refreshedSession?.user ?? getStoredAuthUser();
      const role = authUser?.user_metadata?.role ?? authUser?.app_metadata?.role;
      if (authUser && (role === 'admin' || role === 'barista')) {
        hydrateAuthSession({ role, accountId: authUser.id });
      }

      const snapshot = await bootstrapSupabaseDemo();
      if (!snapshot) return;

      hydrateRemoteData({
        products: snapshot.products,
        inventory: snapshot.inventory,
        orders: snapshot.orders,
        inventoryAdjustments: snapshot.inventoryAdjustments,
        wasteLogs: snapshot.wasteLogs,
      });
    })();
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </>
  );
}
