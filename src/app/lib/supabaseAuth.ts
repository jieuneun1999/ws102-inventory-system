type SupabaseAuthUser = {
  id: string;
  email: string;
  user_metadata?: {
    role?: 'admin' | 'barista';
    name?: string;
  };
  app_metadata?: {
    role?: 'admin' | 'barista';
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
