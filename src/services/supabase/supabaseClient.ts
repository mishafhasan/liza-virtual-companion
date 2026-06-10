import type { SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '@/config/env';

/**
 * Optional, lazily-loaded Supabase client.
 *
 * The app is fully functional without Supabase (auth + persistence fall back to
 * local storage, AI calls go directly to Gemini). When `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` are provided, this dynamically imports the SDK and
 * returns a configured client.
 *
 * The dynamic `import()` keeps the (sizeable) Supabase SDK out of the main
 * bundle for users running in local-only mode — it's only fetched on demand.
 *
 * Returns `null` (rather than throwing) when unconfigured, so callers can
 * degrade gracefully.
 */
let cached: SupabaseClient | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!hasSupabase()) return null;
  if (!cached) {
    const { createClient } = await import('@supabase/supabase-js');
    cached = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cached;
}

/**
 * Synchronous check for whether the cloud backend is configured.
 * Use this for control flow; use {@link getSupabaseClient} to obtain the client.
 */
export const isSupabaseEnabled = hasSupabase;
