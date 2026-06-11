/**
 * Conversation persistence service.
 *
 * Wraps all Supabase reads/writes for `conversation_sessions` and
 * `conversation_turns` so the hooks stay clean. Every function is a no-op
 * (returns null / void silently) when Supabase is not configured, preserving
 * local-only mode without any conditional logic in the calling hooks.
 */

import { getSupabaseClient, isSupabaseEnabled } from './supabaseClient';
import { generateText } from '@/services/ai/chatService';
import { toast } from 'sonner';
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

export interface MemorySummaryResult {
  summary: string;
  persisted: boolean;
  supabaseConfigured: boolean;
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

  // Fire-and-forget: summarize the session and store it as a RAG memory.
  // This replaces per-turn embeddings with a single, precise memory per
  // conversation.
  summarizeAndStoreSessionMemory(sessionId).catch((err) =>
    console.warn('[conversationService] session memory skipped:', (err as Error).message),
  );
}

/**
 * Deletes a session and all its turns (cascade delete).
 * Throws on any Supabase error so callers can handle it with try/catch.
 * In local-only mode (no Supabase) this is a no-op and resolves successfully.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) throw new Error('No session ID provided');
  if (!isSupabaseEnabled()) return; // local-only mode: state is handled by caller

  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('conversation_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('[conversationService] deleteSession error:', error.message);
    throw new Error(error.message); // re-throw so the caller knows it failed
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
 * becoming interleaved).
 *
 * Note: RAG memory is no longer generated per-turn. A single summary
 * embedding is created when the session is closed (see closeSession).
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
 * Shared summarization prompt for extracting memory facts from user messages.
 * Used by both session-end and mid-conversation (every-5-messages) summarization.
 */
const MEMORY_SUMMARIZATION_SYSTEM_PROMPT =
  'You are a concise memory extraction AI. Given a user\'s messages, extract exactly ONE short sentence (max 20 words) capturing the single most important fact about the user. Third person. No extra words.';

/**
 * Generates an embedding for the given text and stores a memory fact in the
 * `memories` table. Silently skips when Supabase is unavailable.
 *
 * Exported so mid-conversation summarization (every-5-messages) can reuse
 * the same RAG pipeline without duplicating the embedding & insert logic.
 */
export async function embedAndStoreMemory(
  fact: string,
  importance = 0.7,
): Promise<boolean> {
  if (!isSupabaseEnabled()) return false;
  const supabase = await getSupabaseClient();
  if (!supabase) return false;

  try {
    const { data: embData, error: embError } = await supabase.functions.invoke(
      'generate-embedding',
      { body: { text: fact } },
    );

    if (embError || !embData?.embedding) {
      console.warn('[conversationService] embed memory embedding failed:', embError?.message);
      return false;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('[conversationService] embed memory auth failed:', authError?.message);
      return false;
    }

    // Upsert so duplicate facts (same user + same fact text) silently update
    // rather than returning a 409 conflict from PostgREST.
    const { error: insertError } = await supabase.from('memories').upsert(
      {
        user_id: user.id,
        fact,
        embedding: embData.embedding,
        importance,
      },
      { onConflict: 'user_id,fact' },
    );

    if (insertError) {
      console.warn('[conversationService] embed memory store failed:', insertError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[conversationService] embed memory skipped:', (err as Error).message);
    return false;
  }
}

/**
 * Summarizes a batch of user message texts into a concise memory fact using
 * Gemini, then stores it via {@link embedAndStoreMemory}.
 *
 * Used by mid-conversation summarization (every N messages).
 *
 * @returns The summary text plus whether it was persisted to Supabase, or null if skipped/errored.
 */
export async function summarizeMessageBatch(
  userMessages: string[],
  options?: { importance?: number },
): Promise<MemorySummaryResult | null> {
  if (!userMessages.length) return null;

  const text = userMessages.join('\n').slice(0, 2000);
  if (!text.trim()) return null;

  try {
    const summary = await generateText(
      MEMORY_SUMMARIZATION_SYSTEM_PROMPT,
      `Conversation messages from the user:\n${text}\n\nExtract ONE short sentence (max 20 words) with the most important fact about the user.`,
      { maxOutputTokens: 40, temperature: 0.3 },
    );

    if (!summary) return null;

    const supabaseConfigured = isSupabaseEnabled();
    const persisted = supabaseConfigured
      ? await embedAndStoreMemory(summary, options?.importance ?? 0.7)
      : false;

    return { summary, persisted, supabaseConfigured };
  } catch (err) {
    console.warn('[conversationService] summarizeMessageBatch skipped:', (err as Error).message);
    return null;
  }
}

/**
 * Loads all turns for a session, uses Gemini to summarize the user's messages
 * into a concise memory fact, generates an embedding, and stores it in the
 * memories table for future RAG retrieval.
 *
 * Called automatically when a session is closed (see closeSession). Silently
 * skips sessions with fewer than 2 turns (too short to be meaningful).
 */
export async function summarizeAndStoreSessionMemory(
  sessionId: string,
): Promise<void> {
  if (!isSupabaseEnabled() || !sessionId) return;
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const turns = await loadTurns(sessionId);
  if (turns.length < 2) return;

  const userMessages = turns
    .filter((t) => t.speaker === 'user')
    .map((t) => t.content);

  if (!userMessages.length) return;

  // Reuse the batch summarization logic (embedAndStoreMemory handles the RAG insert
  // and silently skips if Supabase is unavailable).
  const result = await summarizeMessageBatch(userMessages);

  if (result?.summary) {
    if (result.persisted) {
      toast.success('Memory saved', {
        description: 'This conversation\'s key facts are now stored for future context.',
      });
    } else {
      toast.error('Memory not stored in Supabase', {
        description: 'The memory was summarized locally, but the Supabase insert failed. Check the console for embedding or RLS errors.',
      });
    }
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
