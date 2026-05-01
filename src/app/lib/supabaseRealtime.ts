import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getStoredSession } from './supabaseAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isConfigured
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

const withRealtimeAuth = async () => {
  if (!supabase) return;
  const accessToken = getStoredSession()?.access_token;
  if (!accessToken) return;
  await supabase.realtime.setAuth(accessToken);
};

const trackedTables = [
  'orders',
  'order_items',
  'products',
  'product_recipes',
  'inventory_items',
  'inventory_adjustments',
  'waste_logs',
  'system_history_events',
  'supplier_requests',
  'supplier_contacts',
] as const;

export const subscribeDashboardRealtime = (onChanged: () => void): (() => void) => {
  if (!supabase) return () => {};

  const channelName = `dashboard-sync-${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase.channel(channelName);

  trackedTables.forEach((table) => {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
      },
      () => {
        onChanged();
      }
    );
  });

  void (async () => {
    await withRealtimeAuth();
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onChanged();
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error('Dashboard realtime channel error');
        onChanged();
      }
    });
  })();

  return () => {
    void supabase.removeChannel(channel);
  };
};

export const subscribePublicOrderRealtime = (onChanged: () => void): (() => void) => {
  if (!supabase) return () => {};

  const channelName = `public-orders-${Math.random().toString(36).slice(2, 9)}`;
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      () => {
        onChanged();
      }
    );

  channel.subscribe();
  onChanged();

  return () => {
    void supabase.removeChannel(channel);
  };
};

export const subscribePublicCatalogRealtime = (onChanged: () => void): (() => void) => {
  if (!supabase) return () => {};

  const channelName = `public-catalog-${Math.random().toString(36).slice(2, 9)}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
      },
      () => {
        onChanged();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'product_recipes',
      },
      () => {
        onChanged();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onChanged();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};
