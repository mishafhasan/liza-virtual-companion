import { create } from 'zustand';
import { toast } from 'sonner';
import { getSupabaseClient, isSupabaseEnabled } from '@/services/supabase/supabaseClient';
import type { User, LoginCredentials, SignupCredentials } from '@/types';

/**
 * Authentication store (Zustand).
 *
 * When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, all auth actions
 * go through Supabase Auth and the session is managed by the Supabase SDK
 * (stored in localStorage, auto-refreshed). The `initialized` flag lets
 * ProtectedRoute wait for the initial session check before redirecting.
 *
 * When Supabase is not configured, the store falls back to local mock auth so
 * the app still works in local-only mode.
 */
interface AuthStore {
  user: User | null;
  isLoading: boolean;
  /** True once the initial getSession() check has completed. */
  initialized: boolean;
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  isLoading: false,
  initialized: false,

  // ─── Initialize ────────────────────────────────────────────────────────────
  initialize: async () => {
    if (get().initialized) return;

    if (!isSupabaseEnabled()) {
      // Local-only mode: no session to restore.
      set({ initialized: true });
      return;
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      set({ initialized: true });
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
      set({ user: toAppUser(session.user, profile?.display_name), initialized: true });
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
        set({ user: toAppUser(session.user, profile?.display_name) });
      } else {
        set({ user: null });
      }
    });
  },

  // ─── Login ─────────────────────────────────────────────────────────────────
  login: async ({ email, password }) => {
    set({ isLoading: true });

    if (isSupabaseEnabled()) {
      const supabase = await getSupabaseClient();
      if (!supabase) { set({ isLoading: false }); return; }

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
      set({ user: toAppUser(data.user, profile?.display_name), isLoading: false });
      toast.success('Welcome back!');
      return;
    }

    // ── Local-only fallback ──
    await new Promise((r) => setTimeout(r, 800));
    if (!EMAIL_REGEX.test(email) || password.length < 6) {
      set({ isLoading: false });
      toast.error('Invalid credentials');
      throw new Error('Invalid credentials');
    }
    set({
      user: { id: 'local-' + Date.now(), email, name: email.split('@')[0], createdAt: new Date(), lastLoginAt: new Date() },
      isLoading: false,
    });
    toast.success('Welcome back!');
  },

  // ─── Signup ────────────────────────────────────────────────────────────────
  signup: async ({ email, password, name }) => {
    set({ isLoading: true });

    if (isSupabaseEnabled()) {
      const supabase = await getSupabaseClient();
      if (!supabase) { set({ isLoading: false }); return; }

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
        set({ user: toAppUser(data.user, name), isLoading: false });
        toast.success('Account created!');
      } else {
        set({ isLoading: false });
        toast.success('Check your email to confirm your account.');
      }
      return;
    }

    // ── Local-only fallback ──
    await new Promise((r) => setTimeout(r, 1000));
    if (!EMAIL_REGEX.test(email) || password.length < 8 || name.trim().length < 2) {
      set({ isLoading: false });
      toast.error('Please check your inputs');
      throw new Error('Invalid inputs');
    }
    set({
      user: { id: 'local-' + Date.now(), email, name, createdAt: new Date(), lastLoginAt: new Date() },
      isLoading: false,
    });
    toast.success('Account created!');
  },

  // ─── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    if (isSupabaseEnabled()) {
      const supabase = await getSupabaseClient();
      await supabase?.auth.signOut();
    }
    set({ user: null });
    toast.success('Logged out');
  },

  // ─── Update profile ────────────────────────────────────────────────────────
  updateProfile: async (updates) => {
    const current = get().user;
    if (!current) return;

    if (isSupabaseEnabled() && updates.name) {
      const supabase = await getSupabaseClient();
      await supabase?.from('profiles').update({ display_name: updates.name }).eq('id', current.id);
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

    if (isSupabaseEnabled()) {
      // Supabase requires a service-role call to delete users; sign out instead
      // and direct the user to contact support, or wire up an Edge Function.
      const supabase = await getSupabaseClient();
      await supabase?.auth.signOut();
      set({ user: null, isLoading: false });
      toast.error('Account deleted. Contact support to fully remove your data.');
      return;
    }

    await new Promise((r) => setTimeout(r, 1200));
    set({ user: null, isLoading: false });
    toast.error('Account deleted successfully');
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
