import { create } from 'zustand';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import { clearAllCaches } from '@/services/sync/cache';
import { clearQueue } from '@/services/sync/queue';
import { initSyncQueue } from '@/services/sync/syncQueue';
import { useSettingsStore } from '@/stores/settingsStore';
import type { User, LoginCredentials, SignupCredentials } from '@/types';

/**
 * Authentication store (Zustand). Supabase + login are REQUIRED — there is no
 * local-only / mock-auth fallback.
 *
 * The Supabase session is managed by the SDK (persisted in localStorage,
 * auto-refreshed). The `initialized` flag lets ProtectedRoute wait for the
 * initial session check before redirecting.
 *
 * `userId` is cached in the store after login so every downstream service can
 * read it synchronously instead of calling `supabase.auth.getUser()` on every
 * write (a major source of network round-trips).
 *
 * On logout, ALL local state is wiped: the cloud cache (liza-app-state), the
 * in-memory chat/stats caches, and the sync queue. A fresh login re-hydrates
 * purely from the cloud — local is always a faithful cache of the cloud.
 */
interface AuthStore {
  user: User | null;
  /** Cached Supabase user id — read by services to avoid per-write getUser() calls. */
  userId: string | null;
  isLoading: boolean;
  /** True once the initial getSession() check has completed. */
  initialized: boolean;
  /** True when Supabase env vars are missing — the UI gates on this. */
  configError: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Called once at app start to restore an existing session. */
  initialize: () => Promise<void>;
}

/** Map a Supabase user + optional profile row into the app's User shape. */
function toAppUser(supaUser: { id: string; email?: string | null }, displayName?: string): User {
  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    name: displayName ?? supaUser.email?.split('@')[0] ?? 'User',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  userId: null,
  isLoading: false,
  initialized: false,
  configError: false,

  // ─── Initialize ────────────────────────────────────────────────────────────
  initialize: async () => {
    if (get().initialized) return;

    const supabase = await getSupabaseClient().catch(() => null);
    if (!supabase) {
      // Supabase env vars are missing. UI gates will render the config-error
      // screen. Mark initialized so ProtectedRoute doesn't spin forever.
      set({ initialized: true, configError: true });
      return;
    }

    // Restore existing session (e.g. after a page refresh).
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();
      set({
        user: toAppUser(session.user, profile?.display_name),
        userId: session.user.id,
        initialized: true,
      });
      // Replay any writes left in the queue from a previous session.
      initSyncQueue();
    } else {
      set({ initialized: true });
    }

    // Keep the store in sync with Supabase session events (token refresh, sign-out in another tab).
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        set({
          user: toAppUser(session.user, profile?.display_name),
          userId: session.user.id,
        });
      } else {
        set({ user: null, userId: null });
      }
    });
  },

  // ─── Login ─────────────────────────────────────────────────────────────────
  login: async ({ email, password }) => {
    set({ isLoading: true });

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      set({ isLoading: false });
      toast.error(error?.message ?? 'Login failed');
      throw error ?? new Error('Login failed');
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', data.user.id)
      .single();
    set({
      user: toAppUser(data.user, profile?.display_name),
      userId: data.user.id,
      isLoading: false,
    });
    initSyncQueue();
    toast.success('Welcome back!');
  },

  // ─── Signup ────────────────────────────────────────────────────────────────
  signup: async ({ email, password, name }) => {
    set({ isLoading: true });

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error || !data.user) {
      set({ isLoading: false });
      toast.error(error?.message ?? 'Sign up failed');
      throw error ?? new Error('Sign up failed');
    }
    // If email confirmation is disabled the session is live immediately.
    if (data.session) {
      set({
        user: toAppUser(data.user, name),
        userId: data.user.id,
        isLoading: false,
      });
      initSyncQueue();
      toast.success('Account created!');
    } else {
      set({ isLoading: false });
      toast.success('Check your email to confirm your account.');
    }
  },

  // ─── Logout ────────────────────────────────────────────────────────────────
  // Wipes ALL local state so the next user starts from a clean, cloud-only cache.
  logout: async () => {
    const supabase = await getSupabaseClient().catch(() => null);
    await supabase?.auth.signOut();

    // 1. Drop pending sync writes (they belong to the outgoing user).
    clearQueue();
    // 2. Clear in-memory chat/stats caches.
    clearAllCaches();
    // 3. Reset the settings/character/memory store back to defaults.
    useSettingsStore.getState().resetStore();
    // 4. Wipe the localStorage cloud cache (settings/character/memory).
    try {
      localStorage.removeItem('liza-app-state');
    } catch {
      /* ignore */
    }

    set({ user: null, userId: null });
    toast.success('Logged out');
  },

  // ─── Update profile ────────────────────────────────────────────────────────
  updateProfile: async (updates) => {
    const current = get().user;
    if (!current) return;

    if (updates.name) {
      const supabase = await getSupabaseClient();
      await supabase.from('profiles').update({ display_name: updates.name }).eq('id', current.id);
    }

    set({ user: { ...current, ...updates } });
    toast.success('Profile updated!');
  },

  // ─── Delete account ────────────────────────────────────────────────────────
  deleteAccount: async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.',
    );
    if (!confirmed) return;
    set({ isLoading: true });

    // Supabase requires a service-role call to delete users; sign out instead
    // and direct the user to contact support, or wire up an Edge Function.
    const supabase = await getSupabaseClient().catch(() => null);
    await supabase?.auth.signOut();
    clearQueue();
    clearAllCaches();
    useSettingsStore.getState().resetStore();
    try {
      localStorage.removeItem('liza-app-state');
    } catch {
      /* ignore */
    }
    set({ user: null, userId: null, isLoading: false });
    toast.error('Account deleted. Contact support to fully remove your data.');
  },
}));

/**
 * Backwards-compatible hook mirroring the old `useAuth()` Context API.
 * Existing components keep working unchanged.
 */
export const useAuth = () => {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  return { user, isLoading, login, signup, logout, updateProfile, deleteAccount };
};
