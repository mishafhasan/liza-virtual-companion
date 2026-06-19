import type { SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '@/config/env';

/**
 * Lazily-loaded Supabase client. Supabase is REQUIRED — there is no local-only
 * mode. If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, this
 * throws rather than returning null. UI gates (ProtectedRoute, AuthPage) call
 * {@link isSupabaseEnabled} to render a friendly config-error screen before any
 * of these throwing paths can be reached.
 *
 * The dynamic `import()` keeps the Supabase SDK out of the main bundle — it's
 * only fetched on demand. Concurrent callers share one in-flight
 * `clientPromise` so the first mount of /dashboard (and /chat) cannot race past
 * the import — they all await the same instance.
 */
let cached: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (!hasSupabase()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (cached) return cached;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        cached = createClient(env.supabaseUrl, env.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        return cached;
      } catch (err) {
        console.error('[supabaseClient] failed to initialize:', (err as Error).message);
        clientPromise = null; // allow a retry on the next call
        throw err;
      } finally {
        // Clear once resolved; future callers hit `cached`.
        clientPromise = null;
      }
    })();
  }
  return clientPromise;
}

/**
 * Synchronous check for whether the cloud backend is configured. UI gates use
 * this to decide whether to render the config-error screen. Code paths behind
 * those gates may assume the client is available and should NOT call this.
 */
export const isSupabaseEnabled = hasSupabase;
