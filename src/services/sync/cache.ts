/**
 * Central registry for in-memory caches so they can be cleared atomically on
 * logout / user switch.
 *
 * The chat and stats hooks keep module-level `Map`s keyed by user id. Without a
 * way to clear them, switching accounts on the same tab would leak the previous
 * user's session list and stats into the new account. Hooks register a clearer
 * here on load; {@link clearAllCaches} invokes every registered clearer.
 *
 * This deliberately lives in the sync/ folder (not stores/) to avoid import
 * cycles — the hooks import this, and authStore imports it for logout.
 */

type Clearer = () => void;
const clearers = new Set<Clearer>();

/** Register a cache-clearing function. Returns an unregister handle. */
export function registerCacheClearer(fn: Clearer): () => void {
  clearers.add(fn);
  return () => clearers.delete(fn);
}

/** Invoke every registered clearer (used on logout). */
export function clearAllCaches(): void {
  for (const fn of clearers) {
    try {
      fn();
    } catch (err) {
      console.warn('[cache] clearer threw:', err);
    }
  }
}
