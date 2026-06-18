/**
 * Centralized, typed environment configuration.
 *
 * This is the single source of truth for every API key and backend toggle in
 * the app. Nothing else in the codebase should read `process.env` or
 * `import.meta.env` directly — import from here instead. That keeps key access
 * auditable and makes it trivial to swap to a server-proxied backend later.
 *
 * Two key sources exist for historical reasons:
 *  - `process.env.*`  -> injected at build time by Vite `define` (see vite.config.ts).
 *                        Used for the AI provider keys (Gemini, Pollinations).
 *  - `import.meta.env.VITE_*` -> standard Vite client env. Used for Supabase,
 *                        which is safe to expose (protected by Row Level Security).
 *
 * Supabase is REQUIRED to run the app — there is no local-only fallback.
 * Gemini/Pollinations remain optional (AI calls degrade gracefully when missing).
 */

/** Read a `process.env` value injected via Vite `define`, tolerating undefined. */
function readProcessEnv(key: string): string {
  try {
    // `process` only exists here because vite.config.ts `define`s these keys.
    return (process.env as Record<string, string | undefined>)?.[key] ?? '';
  } catch {
    return '';
  }
}

/** Read a standard Vite client env var (`import.meta.env.VITE_*`). */
function readViteEnv(key: keyof ImportMetaEnv): string {
  return (import.meta.env?.[key] as string | undefined) ?? '';
}

export const env = {
  /** Google Gemini API key — powers text chat, voice, language and interview AI. */
  geminiApiKey: readProcessEnv('GEMINI_API_KEY') || readProcessEnv('API_KEY'),

  /** Pollinations.ai key — optional. When absent, the free public endpoint is used. */
  pollinationsApiKey: readProcessEnv('POLLINATIONS_API_KEY'),

  /** Supabase project URL (safe to expose; RLS protects the data). */
  supabaseUrl: readViteEnv('VITE_SUPABASE_URL'),

  /** Supabase anon key (safe to expose; RLS protects the data). */
  supabaseAnonKey: readViteEnv('VITE_SUPABASE_ANON_KEY'),
} as const;

/** True when a Gemini key is configured and AI features can run. */
export const hasGeminiKey = (): boolean => env.geminiApiKey.length > 0;

/** True when Supabase is configured. Used by UI gates to show a config-error screen. */
export const hasSupabase = (): boolean =>
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;

/**
 * Throws if Supabase is not configured. Supabase is REQUIRED — there is no
 * local-only mode anymore. Use this in services/stores where the absence of a
 * backend is a programmer/deployment error, not a recoverable state.
 */
export function requireSupabaseConfig(): void {
  if (!hasSupabase()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
        'in your environment. The app cannot run without a backend.',
    );
  }
}
