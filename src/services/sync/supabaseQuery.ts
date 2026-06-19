/**
 * Cloud-write helper with automatic retry and queueing.
 *
 * Cloud-first write pattern used across the app:
 *   1. Apply the change to the local cache immediately (optimistic UI).
 *   2. Call {@link syncWrite} to persist to Supabase.
 *   3. On transient failure (offline / 5xx / network), the write is enqueued
 *      to the localStorage-backed queue and replayed when connectivity returns.
 *   4. On permanent failure (RLS / 4xx), a toast surfaces and the write is
 *      dropped (retrying would fail identically).
 *
 * The optional `dedupeKey` lets rapid edits coalesce: sliding a setting back and
 * forth only ever produces one queued write for that record.
 */

import { toast } from 'sonner';
import { enqueue } from './queue';

export interface SyncWriteOptions {
  /**
   * Stable key used to dedupe queued writes for the same record, e.g.
   * `user_settings:<userId>` or `memory:<id>`. When omitted the write is not
   * deduped (use for genuinely unique one-shot writes).
   */
  dedupeKey?: string;
  /** Toast label shown if the write fails permanently. Defaults to 'Sync failed'. */
  label?: string;
}

/**
 * Execute a cloud write. Resolves once the write has EITHER succeeded OR been
 * safely queued for later retry. Only rejects on permanent (non-retryable)
 * failures, so callers generally don't need try/catch.
 */
export async function syncWrite(
  operation: () => Promise<void>,
  options: SyncWriteOptions = {},
): Promise<void> {
  const { dedupeKey, label = 'Sync failed' } = options;

  try {
    await operation();
    return;
  } catch (err) {
    if (isTransient(err)) {
      // Queue for retry — preserves the write across reloads/reconnect.
      if (dedupeKey) {
        enqueue(dedupeKey, undefined, async () => {
          await operation();
        });
      } else {
        // No dedupe key — still queue, but with a unique key so entries don't
        // coalesce (e.g. distinct message saves).
        enqueue(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, undefined, async () => {
          await operation();
        });
      }
      return;
    }
    // Permanent failure — surface to the user and drop.
    console.error(`[syncWrite] ${label}:`, err);
    toast.error(label, {
      description: (err as Error)?.message ?? 'The change could not be saved.',
    });
  }
}

/** Transient = offline, network error, or server-side (5xx). Anything else is permanent. */
function isTransient(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/fetch|network|failed to fetch|NetworkError|timeout|ECONN/i.test(msg)) return true;
  const status = (err as { status?: number; code?: string | number })?.status;
  if (typeof status === 'number') {
    return status >= 500 || status === 408 || status === 429;
  }
  // PostgREST errors carry code strings like 'PGAXXXX' or HTTP-style; default
  // unknown errors to transient so we retry rather than silently drop user data.
  return true;
}
