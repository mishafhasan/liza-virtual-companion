/**
 * Conversation persistence service.
 *
 * Wraps all Supabase reads/writes for `conversation_sessions` and
 * `conversation_turns` so the hooks stay clean. Every function is a no-op
 * (returns null / void silently) when Supabase is not configured, preserving
 * local-only mode without any conditional logic in the calling hooks.
 */

import { getSupabaseClient, isSupabaseEnabled } from './supabaseClient';
import type { AppMode } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DBSession {
  id: string;
  title: string | null;
  mode: AppMode;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
}

export interface DBTurn {
  id: string;
  session_id: string;
  speaker: 'user' | 'liza';
  content: string;
  emotion: string | null;
  created_at: string;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/**
 * Creates a new session row and returns its UUID.
 * Returns null silently when Supabase is unavailable.
 */
export async function createSession(
  mode: AppMode,
  title?: string,
  metadata?: Record<string, unknown>,
): Promise<string | null> {
  if (!isSupabaseEnabled()) return null;
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('conversation_sessions')
    .insert({
      user_id: user.id,
      mode,
      title: title ?? null,
      metadata: metadata ?? {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[conversationService] createSession error:', error.message);
    return null;
  }
  return data.id as string;
}

/**
 * Marks a session as ended and optionally stores summary metadata (scores etc).
 */
export async function closeSession(
  sessionId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseEnabled() || !sessionId) return;
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const update: Record<string, unknown> = { ended_at: new Date().toISOString() };
  if (metadata) update.metadata = metadata;

  const { error } = await supabase
    .from('conversation_sessions')
    .update(update)
    .eq('id', sessionId);

  if (error) {
    console.error('[conversationService] closeSession error:', error.message);
  }
}

/**
 * Updates a session's title (e.g. once the first message is known).
 */
export async function updateSessionTitle(
  sessionId: string,
  title: string,
): Promise<void> {
  if (!isSupabaseEnabled() || !sessionId) return;
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('conversation_sessions')
    .update({ title })
    .eq('id', sessionId);
}

// ─── Turn helpers ─────────────────────────────────────────────────────────────

/**
 * Appends a single turn (user or assistant) to an existing session.
 */
export async function saveTurn(
  sessionId: string,
  speaker: 'user' | 'liza',
  content: string,
  emotion?: string,
): Promise<void> {
  if (!isSupabaseEnabled() || !sessionId) return;
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('conversation_turns').insert({
    session_id: sessionId,
    user_id: user.id,
    speaker,
    content,
    emotion: emotion ?? null,
  });

  if (error) {
    console.error('[conversationService] saveTurn error:', error.message);
  }
}

/**
 * Saves a user turn and an assistant reply together (avoids two round-trips
 * becoming interleaved). After saving, it fires-and-forgets an embedding
 * generation so the exchange lands in the RAG memory store automatically.
 */
export async function saveTurnPair(
  sessionId: string,
  userContent: string,
  lizaContent: string,
  emotion?: string,
): Promise<void> {
  if (!isSupabaseEnabled() || !sessionId) return;
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('conversation_turns').insert([
    { session_id: sessionId, user_id: user.id, speaker: 'user',  content: userContent, emotion: null },
    { session_id: sessionId, user_id: user.id, speaker: 'liza',  content: lizaContent, emotion: emotion ?? null },
  ]);

  if (error) {
    console.error('[conversationService] saveTurnPair error:', error.message);
    return;
  }

  // Fire-and-forget: generate and store an embedding for this exchange so the
  // RAG memory (match_memories) can surface it in future context windows.
  generateAndStoreMemory(supabase, user.id, userContent, lizaContent).catch((err) =>
    console.warn('[conversationService] embedding skipped:', (err as Error).message),
  );
}

// ─── RAG Memory helpers ───────────────────────────────────────────────────────

/**
 * Retrieves the most semantically relevant past conversation facts for a given
 * query string. This is the READ side of the RAG pipeline.
 *
 * Flow:
 *  1. Embed the query via the `generate-embedding` Edge Function.
 *  2. Call the `match_memories` Postgres RPC for cosine-similarity search.
 *  3. Return the top fact strings (already ranked by similarity × importance).
 *
 * Returns an empty array silently when Supabase is unavailable or on any error
 * so the caller can proceed without memory context rather than failing.
 */
export async function retrieveRelevantMemories(
  query: string,
  matchCount = 5,
  matchThreshold = 0.65,
): Promise<string[]> {
  if (!isSupabaseEnabled() || !query.trim()) return [];
  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    // 1. Embed the current user message.
    const { data: embData, error: embError } = await supabase.functions.invoke(
      'generate-embedding',
      { body: { text: query.slice(0, 500) } },
    );
    if (embError || !embData?.embedding) return [];

    // 2. Vector similarity search against the user's stored memories.
    const { data: memories, error: rpcError } = await supabase.rpc('match_memories', {
      query_embedding: embData.embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_user_id: user.id,
    });

    if (rpcError || !memories) return [];

    // 3. Return just the fact strings; the RPC already orders by relevance.
    return (memories as Array<{ fact: string }>).map((m) => m.fact);
  } catch {
    return [];
  }
}

/**
 * Calls the `generate-embedding` Edge Function with a condensed fact string
 * built from the exchange, then upserts the vector into `public.memories`.
 *
 * Runs as a background task (fire-and-forget) so it never blocks the UI.
 * Duplicate facts are silently ignored via the unique constraint.
 */
async function generateAndStoreMemory(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  userId: string,
  userContent: string,
  lizaContent: string,
): Promise<void> {
  if (!supabase) return;

  // Build a compact memory fact from the exchange.
  const fact = `User: ${userContent.slice(0, 300)}\nLiza: ${lizaContent.slice(0, 300)}`;

  // Call the Edge Function to get the embedding vector.
  const { data, error: fnError } = await supabase.functions.invoke('generate-embedding', {
    body: { text: fact },
  });

  if (fnError || !data?.embedding) {
    throw new Error(fnError?.message ?? 'generate-embedding returned no vector');
  }

  const embedding: number[] = data.embedding;

  // Upsert into memories (duplicate facts are ignored by the unique constraint).
  const { error: insertError } = await supabase.from('memories').insert({
    user_id: userId,
    fact,
    embedding,
    importance: 0.5,
  });

  // 23505 = unique_violation — the fact already exists, which is fine.
  if (insertError && insertError.code !== '23505') {
    throw new Error(insertError.message);
  }
}

// ─── History helpers ──────────────────────────────────────────────────────────

/**
 * Loads past sessions for the current user, newest first.
 * Returns an empty array when Supabase is unavailable.
 */
export async function loadSessions(
  mode?: AppMode,
  limit = 20,
): Promise<DBSession[]> {
  if (!isSupabaseEnabled()) return [];
  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('conversation_sessions')
    .select('id, title, mode, started_at, ended_at, metadata')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (mode) query = query.eq('mode', mode);

  const { data, error } = await query;
  if (error) {
    console.error('[conversationService] loadSessions error:', error.message);
    return [];
  }
  return (data ?? []) as DBSession[];
}

/**
 * Loads all turns for a given session, ordered chronologically.
 */
export async function loadTurns(sessionId: string): Promise<DBTurn[]> {
  if (!isSupabaseEnabled() || !sessionId) return [];
  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('conversation_turns')
    .select('id, session_id, speaker, content, emotion, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[conversationService] loadTurns error:', error.message);
    return [];
  }
  return (data ?? []) as DBTurn[];
}
