/**
 * Boot-time wiring for the cloud-sync write queue.
 *
 * `operation` functions can't survive localStorage serialization, so after a
 * reload a queued entry only carries its (key, payload). This module rebuilds
 * the executable operations from the registered resolvers and kicks off the
 * first flush.
 *
 * Resolvers are keyed by record type and reconstruct the Supabase call from the
 * payload that was captured at enqueue time. New write paths that opt into
 * queueing must register a resolver here (or pass their operation inline, which
 * works within a single session without reload).
 */

import { flushQueue, registerSyncResolver } from './queue';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';

export interface UserSettingsPayload {
  userId: string;
  language?: string;
  voice_name?: string;
  flirt_intensity?: number;
  emotion_intensity?: number;
  video_mode?: boolean;
  avatar_id?: string;
}

export interface CharacterProfilePayload {
  userId: string;
  name: string;
  personality: string;
  avatar_image: string | null;
}

export interface MemoryPayload {
  userId: string;
  fact: string;
  importance?: number;
  category?: string;
}

export interface MemoryDeletePayload {
  userId: string;
  id: string;
}

let initialized = false;

/**
 * Register all cloud-write resolvers and start the flush worker. Idempotent —
 * safe to call from every entry point (main.tsx + auth bootstrap). Call this
 * once the user is authenticated so queued writes replay against the right
 * Supabase client.
 */
export function initSyncQueue(): void {
  if (initialized) return;
  initialized = true;

  registerSyncResolver('user_settings:', async (payload) => {
    const p = payload as UserSettingsPayload;
    const supabase = await getSupabaseClient();
    await supabase.from('user_settings').upsert(
      {
        user_id: p.userId,
        language: p.language,
        voice_name: p.voice_name,
        flirt_intensity: p.flirt_intensity,
        emotion_intensity: p.emotion_intensity,
        video_mode: p.video_mode,
        avatar_id: p.avatar_id,
      },
      { onConflict: 'user_id' },
    );
  });

  registerSyncResolver('character_profiles:', async (payload) => {
    const p = payload as CharacterProfilePayload;
    const supabase = await getSupabaseClient();
    await supabase.from('character_profiles').upsert(
      {
        user_id: p.userId,
        name: p.name,
        personality: p.personality,
        avatar_image: p.avatar_image,
      },
      { onConflict: 'user_id' },
    );
  });

  registerSyncResolver('memory_upsert:', async (payload) => {
    const p = payload as MemoryPayload;
    const supabase = await getSupabaseClient();
    // Re-embed on replay — the embedding edge function must run again because
    // embeddings aren't part of the serializable payload.
    const { data: emb } = await supabase.functions.invoke('generate-embedding', {
      body: { text: p.fact },
    });
    await supabase.from('memories').upsert(
      {
        user_id: p.userId,
        fact: p.fact,
        embedding: emb?.embedding ?? null,
        importance: p.importance ?? 0.5,
        category: p.category ?? 'other',
      },
      { onConflict: 'user_id,fact' },
    );
  });

  registerSyncResolver('memory_delete:', async (payload) => {
    const p = payload as MemoryDeletePayload;
    const supabase = await getSupabaseClient();
    await supabase.from('memories').delete().eq('id', p.id).eq('user_id', p.userId);
  });

  // Kick off the first flush for any writes left over from a previous session.
  flushQueue();
}

/** Flush now (e.g. when the user comes back online). */
export function flushSyncQueue(): void {
  flushQueue();
}
