type SupabaseAuthUser = {
  id: string;
  email: string;
  user_metadata?: {
    role?: 'admin' | 'barista' | 'cashier' | 'kitchen' | 'supplier';
    name?: string;
  };
  app_metadata?: {
    role?: 'admin' | 'barista' | 'cashier' | 'kitchen' | 'supplier';
  };
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: SupabaseAuthUser;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_KEY = 'aura-cafe-supabase-session';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const authHeaders = {
  apikey: SUPABASE_ANON_KEY ?? '',
  Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  'Content-Type': 'application/json',
};

const authFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  if (!isConfigured) {
    throw new Error('Supabase environment variables are not configured.');
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
};

export const isSupabaseSessionExpired = (session = getStoredSession(), graceSeconds = 120) => {
  if (!session?.access_token) return true;
  const payload = decodeJwtPayload(session.access_token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now() + graceSeconds * 1000;
};

export const getStoredSession = (): SupabaseSession | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
};

export const clearStoredSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const signInWithSupabase = async (email: string, password: string) => {
  const session = await authFetch<SupabaseSession>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const refreshSupabaseUser = async () => {
  const session = getStoredSession();
  if (!session) return null;

  const user = await authFetch<SupabaseAuthUser>('/auth/v1/user', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const nextSession = { ...session, user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  return nextSession;
};

export const refreshSupabaseSession = async () => {
  const session = getStoredSession();
  if (!session?.refresh_token || !isConfigured) return null;

  const nextSession = await authFetch<SupabaseSession>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  return nextSession;
};

export const signOutOfSupabase = async () => {
  const session = getStoredSession();
  if (session && isConfigured) {
    try {
      await authFetch('/auth/v1/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    } catch {
      // Ignore logout errors for demo continuity.
    }
  }

  clearStoredSession();
};

export const getStoredAuthRole = () => {
  const session = getStoredSession();
  return session?.user.user_metadata?.role ?? session?.user.app_metadata?.role ?? null;
};

// Fetch user role from profiles table (new RBAC system)
export const fetchUserRoleFromProfiles = async (userId: string, accessToken: string): Promise<'admin' | 'cashier' | 'kitchen' | 'supplier' | null> => {
  try {
    if (!isConfigured) {
      throw new Error('Supabase is not configured');
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
      method: 'GET',
      headers: {
        ...authHeaders,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // If fetch fails, return null and let fallback handle it
      return null;
    }

    const data = (await response.json()) as Array<{ role: string }>;
    if (data.length > 0) {
      return (data[0].role as any) ?? 'cashier';
    }

    // Profile doesn't exist, create default cashier profile
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: userId, role: 'cashier' }),
      });
    } catch {
      // Silently fail if profile creation fails
    }

    return 'cashier';
  } catch (err) {
    console.warn('Failed to fetch user role from profiles:', err);
    return null;
  }
};

// Enhanced sign-in that fetches role from profiles table
export const signInWithSupabaseAndFetchRole = async (email: string, password: string) => {
  const session = await signInWithSupabase(email, password);
  
  // Try to fetch role from profiles table
  const profileRole = await fetchUserRoleFromProfiles(session.user.id, session.access_token);
  
  // Fallback to metadata if profiles table fetch failed
  const role = profileRole ?? (session.user.user_metadata?.role ?? session.user.app_metadata?.role);
  
  return { ...session, role };
};

export const getStoredAuthUser = () => getStoredSession()?.user ?? null;

export const requestPasswordReset = async (email: string) => {
  const redirectTo = `${window.location.origin}/reset-password`;

  return authFetch<{ success: boolean }>('/auth/v1/recover', {
    method: 'POST',
    body: JSON.stringify({ email, redirect_to: redirectTo }),
  });
};

export const confirmPasswordReset = async (accessToken: string, newPassword: string) => {
  const session = getStoredSession();
  return authFetch<SupabaseSession>('/auth/v1/user', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });
};
