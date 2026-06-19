/**
 * localStorage-backed write queue for cloud sync.
 *
 * The app is cloud-first: every mutation is applied to the local cache
 * immediately (for instant UI), then handed to {@link withSyncRetry} which
 * tries the cloud write right away. When the write fails transiently (offline,
 * 5xx, network error) it lands here, persisted across reloads, and is replayed
 * by the flush worker once connectivity returns.
 *
 * Entries are deduped by `key` — rapid edits to the same record (e.g. dragging
 * a slider) coalesce into the latest payload rather than queueing N writes.
 * Permanent failures (RLS denial, 4xx) are NOT queued — they surface a toast
 * and are dropped, since retrying would fail identically.
 */

const STORAGE_KEY = 'liza-sync-queue';
const MAX_ENTRIES = 50;

export interface QueueEntry<TPayload = unknown> {
  /** Dedupe key, e.g. `user_settings:<userId>`, `memories:<fact>` or `memory_delete:<id>`. */
  key: string;
  /** Replays the write against Supabase. Resolves on success, rejects on failure. */
  operation: (payload: TPayload) => Promise<void>;
  payload: TPayload;
  attempts: number;
  /** Unix ms timestamp of the next allowed retry (exponential backoff). */
  nextRetry: number;
}

let queue: QueueEntry[] = [];
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

/** Subscribe to queue-size changes (e.g. to show a "syncing…" indicator). */
export function onQueueChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current number of pending writes (0 when fully synced). */
export function getPendingCount(): number {
  return queue.length;
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) queue = JSON.parse(raw) as QueueEntry[];
    // NOTE: `operation` functions cannot survive serialization — callers must
    // re-register handlers via registerOperationResolver before flushing.
  } catch {
    queue = [];
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    // Persist WITHOUT the operation fn (not serializable). On reload, the flush
    // worker rebuilds operations from (key, payload) via the resolver registry.
    const serializable = queue.map(({ key, payload, attempts, nextRetry }) => ({
      key,
      payload,
      attempts,
      nextRetry,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Quota errors etc. — drop the oldest entry and retry once.
    if (queue.length > 0) {
      queue.shift();
      persist();
    }
  }
}

/**
 * Add (or coalesce) a write. If an entry with the same key exists, its payload
 * is replaced and attempts reset — the latest write wins.
 */
export function enqueue<TPayload>(
  key: string,
  payload: TPayload,
  operation: (payload: TPayload) => Promise<void>,
): void {
  hydrate();
  const existingIdx = queue.findIndex((e) => e.key === key);
  const entry: QueueEntry<TPayload> = {
    key,
    payload,
    operation: operation as (payload: unknown) => Promise<void>,
    attempts: 0,
    nextRetry: Date.now() + backoffMs(0),
  };
  if (existingIdx >= 0) {
    queue[existingIdx] = entry as QueueEntry;
  } else {
    queue.push(entry as QueueEntry);
    // Cap size — drop the OLDEST entries (FIFO) when over capacity.
    if (queue.length > MAX_ENTRIES) queue.splice(0, queue.length - MAX_ENTRIES);
  }
  persist();
  notify();
  scheduleFlush();
}

function backoffMs(attempts: number): number {
  // 2s, 4s, 8s, 16s, 32s, capped at 60s.
  return Math.min(60_000, 2000 * 2 ** Math.min(attempts, 5));
}

/**
 * Operation resolver registry. Because functions can't be serialized, after a
 * reload the queue entries only carry (key, payload). The app registers a
 * resolver that maps a key back to an executable operation during boot.
 */
const resolvers = new Map<string, (payload: unknown) => Promise<void>>();

export function registerSyncResolver(
  keyPrefix: string,
  resolver: (payload: unknown) => Promise<void>,
): void {
  resolvers.set(keyPrefix, resolver);
}

function resolveOperation(
  key: string,
): ((payload: unknown) => Promise<void>) | null {
  // Match by the longest registered prefix contained in the key.
  let best: ((p: unknown) => Promise<void>) | null = null;
  let bestLen = 0;
  for (const [prefix, fn] of resolvers) {
    if (key.startsWith(prefix) && prefix.length > bestLen) {
      best = fn;
      bestLen = prefix.length;
    }
  }
  return best;
}

/**
 * Attempt to replay all due entries. Called automatically on a timer and on
 * connectivity events. Safe to call concurrently — a guard prevents re-entry.
 */
export async function flushQueue(): Promise<void> {
  if (isFlushing) return;
  hydrate();
  if (queue.length === 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  isFlushing = true;
  try {
    const now = Date.now();
    // Snapshot keys to avoid mutation-during-iteration issues.
    const dueKeys = queue
      .filter((e) => e.nextRetry <= now)
      .map((e) => e.key);

    for (const key of dueKeys) {
      const idx = queue.findIndex((e) => e.key === key);
      if (idx === -1) continue; // coalesced away
      const entry = queue[idx];
      const op =
        (entry.operation as ((p: unknown) => Promise<void>) | undefined) ??
        resolveOperation(entry.key);
      if (!op) {
        // No resolver registered yet (e.g. still booting). Leave for next flush.
        continue;
      }
      try {
        await op(entry.payload);
        // Success — remove from queue.
        queue = queue.filter((e) => e.key !== key);
        persist();
        notify();
      } catch (err) {
        const isPermanent = isPermanentError(err);
        if (isPermanent) {
          console.error('[syncQueue] dropping permanently-failed write:', key, err);
          queue = queue.filter((e) => e.key !== key);
          persist();
          notify();
          continue;
        }
        // Transient — bump attempts, reschedule.
        entry.attempts += 1;
        entry.nextRetry = Date.now() + backoffMs(entry.attempts);
        persist();
      }
    }
  } finally {
    isFlushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  hydrate();
  if (queue.length === 0) return;
  const nextDue = Math.min(...queue.map((e) => e.nextRetry));
  const delay = Math.max(500, nextDue - Date.now());
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, delay);
}

/** Permanent (non-retryable) errors: RLS denials, validation, auth. */
function isPermanentError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? String(err);
  // Supabase/PostgREST error codes for permission/validation issues.
  if (/42501|23505|PGRST|permission denied|violates|JWT|not authenticated/i.test(msg)) {
    return true;
  }
  // 4xx HTTP status carried on the error.
  const status = (err as { status?: number; code?: string | number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return true;
  return false;
}

/** Remove all queued writes (used on logout). */
export function clearQueue(): void {
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  notify();
}

// ─── Wire up connectivity events once on module load ──────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) flushQueue();
  });
}
