/**
 * Conversation persistence service.
 *
 * Wraps all Supabase reads/writes for `conversation_sessions` and
 * `conversation_turns`, plus the RAG memory pipeline. Supabase is required —
 * callers are behind the auth gate, so these functions assume the client and
 * user are available.
 */

import { getSupabaseClient } from './supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import { generateText, generateJson } from '@/services/ai/chatService';
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

/** A structured memory fact extracted from conversation. */
export interface MemoryFact {
  /** The fact itself — concise, third-person, max ~20 words. */
  fact: string;
  /**
   * Semantic category used to group memories in the system prompt.
   * Maps directly to ChatGPT/Claude-style memory sections.
   */
  category:
    | 'personal_info'    // name, age, location, nationality
    | 'preference'       // likes, dislikes, hobbies, favourites
    | 'life_event'       // milestones, major events, experiences
    | 'goal'             // plans, aspirations, things they want
    | 'work_context'     // job, study, career, projects
    | 'emotion_pattern'  // recurring moods, emotional tendencies
    | 'relationship'     // family, friends, romantic life
    | 'other';           // legacy / uncategorized
  /**
   * Importance score (0–1) used when writing to the RAG `memories` table.
   * Higher = more likely to surface in future retrieval.
   */
  importance: number;
}

/** Return type for multi-fact summarization calls. */
export interface MemoryBatchResult {
  facts: MemoryFact[];
  persisted: boolean;
}

/** Minimal conversation turn type used for memory extraction. */
export interface MemoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Reads the current user id from the auth store (synchronous, no network call).
 * Throws if there's no authenticated user — every write requires one.
 */
function requireUserId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) throw new Error('No authenticated user.');
  return userId;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/**
 * Creates a new session row and returns its UUID, or null if it could not be
 * created (auth or DB error). Callers treat null as "no persistence this run".
 */
export async function createSession(
  mode: AppMode,
  title?: string,
  metadata?: Record<string, unknown>,
): Promise<string | null> {
  const userId = requireUserId();
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('conversation_sessions')
    .insert({
      user_id: userId,
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
  if (!sessionId) return;
  const supabase = await getSupabaseClient();

  const update: Record<string, unknown> = { ended_at: new Date().toISOString() };
  if (metadata) update.metadata = metadata;

  const { error } = await supabase
    .from('conversation_sessions')
    .update(update)
    .eq('id', sessionId);

  if (error) {
    console.error('[conversationService] closeSession error:', error.message);
  }

  // Fire-and-forget: summarize the session and store it as RAG memories.
  // This replaces per-turn embeddings with a rich set of facts per conversation.
  summarizeAndStoreSessionMemory(sessionId).catch((err) =>
    console.warn('[conversationService] session memory skipped:', (err as Error).message),
  );
}

/**
 * Deletes a session and all its turns (cascade delete).
 * Throws on any Supabase error so callers can handle it with try/catch.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) throw new Error('No session ID provided');
  const supabase = await getSupabaseClient();

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
  if (!sessionId) return;
  const supabase = await getSupabaseClient();

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
  if (!sessionId) return;
  const userId = requireUserId();
  const supabase = await getSupabaseClient();

  const { error } = await supabase.from('conversation_turns').insert({
    session_id: sessionId,
    user_id: userId,
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
 * Note: RAG memory is no longer generated per-turn. A single rich set of facts
 * is extracted and stored when the session is closed (see closeSession) or
 * mid-conversation every N messages.
 */
export async function saveTurnPair(
  sessionId: string,
  userContent: string,
  lizaContent: string,
  emotion?: string,
): Promise<void> {
  if (!sessionId) return;
  const userId = requireUserId();
  const supabase = await getSupabaseClient();

  const { error } = await supabase.from('conversation_turns').insert([
    { session_id: sessionId, user_id: userId, speaker: 'user', content: userContent, emotion: null },
    { session_id: sessionId, user_id: userId, speaker: 'liza', content: lizaContent, emotion: emotion ?? null },
  ]);

  if (error) {
    console.error('[conversationService] saveTurnPair error:', error.message);
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
 * Returns an empty array on any error so the caller can proceed without memory
 * context rather than failing the whole reply.
 */
export async function retrieveRelevantMemories(
  query: string,
  matchCount = 6,
  matchThreshold = 0.62,
): Promise<string[]> {
  if (!query.trim()) return [];
  const userId = requireUserId();
  const supabase = await getSupabaseClient();

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
      filter_user_id: userId,
    });

    if (rpcError || !memories) return [];

    // 3. Return just the fact strings; the RPC already orders by relevance.
    return (memories as Array<{ fact: string }>).map((m) => m.fact);
  } catch (err) {
    console.warn('[conversationService] retrieveRelevantMemories failed:', (err as Error).message);
    return [];
  }
}

// ─── Memory Extraction Prompts ────────────────────────────────────────────────

/**
 * ChatGPT/Claude-style multi-fact memory extraction system prompt.
 *
 * Designed to:
 * - Extract 2–7 distinct, lasting facts per conversation chunk
 * - Categorize each fact for structured rendering in the companion prompt
 * - Score importance so high-signal facts surface more often in RAG retrieval
 * - Ignore transient/generic/session-only information
 * - Process BOTH sides of the conversation for richer context
 */
const MEMORY_EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction AI for a virtual companion app. Your job is to read a conversation and extract important, lasting facts about the USER that the companion should remember for future conversations.

RULES:
1. Extract 2–7 distinct facts. Each must be unique and independently useful.
2. Write each fact in third-person, concisely (max 20 words). Start directly with the fact.
3. Assign a category from this list ONLY:
   - "personal_info"   → name, age, location, nationality, physical traits
   - "preference"      → likes, dislikes, hobbies, favourite things, pet peeves
   - "life_event"      → milestones, major events, experiences shared
   - "goal"            → plans, aspirations, things they want to do/achieve
   - "work_context"    → job, study, career, projects, schedule
   - "emotion_pattern" → recurring moods, emotional tendencies, triggers
   - "relationship"    → family, friends, romantic life, pets
4. Assign importance (0.0–1.0):
   - 0.9 → core personal identity (name, location, profession)
   - 0.8 → significant life facts, goals, relationships
   - 0.7 → hobbies, strong preferences
   - 0.6 → emotional patterns, recurring themes
   - 0.4 → minor context, one-off mentions

DO NOT extract:
- Generic facts ("the user chatted with the AI")
- Facts about the AI/companion ("Liza said...")
- Highly transient states ("the user is hungry right now")
- Rephrased duplicates of the same fact

If there are truly no meaningful facts, return an empty array.

Return ONLY a valid JSON array with this exact shape:
[
  {"fact": "...", "category": "personal_info", "importance": 0.9},
  {"fact": "...", "category": "preference", "importance": 0.7}
]`;

/**
 * Fallback single-fact extraction for backward compatibility
 * (used when generateJson is unavailable or fails).
 */
const MEMORY_FALLBACK_SYSTEM_PROMPT =
  'You are a concise memory extraction AI. Given a conversation, extract ONE short sentence (max 20 words) capturing the single most important lasting fact about the user. Third person. No extra words. No JSON.';

// ─── Core memory extraction ───────────────────────────────────────────────────

/**
 * Generates an embedding for the given text and stores a memory fact in the
 * `memories` table.
 *
 * Now stores the `category` column (previously the category was stuffed as a
 * `[category]` prefix into the fact text, which caused a dual-write divergence
 * between the RAG pipeline and the UI list). Manual additions also route
 * through here so EVERY memory gets an embedding and becomes RAG-retrievable.
 *
 * @param fact       Clean fact text — NO category prefix.
 * @param importance 0–1 importance score.
 * @param category   Memory category (defaults to 'other').
 */
export async function embedAndStoreMemory(
  fact: string,
  importance = 0.7,
  category: MemoryFact['category'] = 'other',
): Promise<boolean> {
  const userId = requireUserId();
  const supabase = await getSupabaseClient();

  try {
    const { data: embData, error: embError } = await supabase.functions.invoke(
      'generate-embedding',
      { body: { text: fact } },
    );

    if (embError || !embData?.embedding) {
      console.warn('[conversationService] embed memory embedding failed:', embError?.message);
      return false;
    }

    // Upsert so duplicate facts (same user + same fact text) silently update
    // rather than returning a 409 conflict from PostgREST.
    const { error: insertError } = await supabase.from('memories').upsert(
      {
        user_id: userId,
        fact,
        embedding: embData.embedding,
        importance,
        category,
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
 * Extracts multiple categorized memory facts from a conversation using Gemini,
 * then embeds and stores each one in the RAG pipeline.
 *
 * This is the SINGLE writer of extracted memories to the cloud. Callers (chat
 * hooks) push the returned facts into the local cache themselves — they no
 * longer call `addMemory` with a prefixed string, which previously caused a
 * duplicate, divergent row.
 *
 * @param turns   Full conversation turns (user + assistant), newest last.
 * @param options Optional overrides for the default importance multiplier.
 * @returns       Extraction result with all facts and persistence status.
 */
export async function summarizeMessageBatch(
  turns: MemoryTurn[],
  options?: { importanceMultiplier?: number },
): Promise<MemoryBatchResult | null> {
  if (!turns.length) return null;

  // Format conversation for the prompt (limit to ~3000 chars to stay within token budget).
  const formatted = turns
    .map((t) => `${t.role === 'user' ? 'User' : 'Liza'}: ${t.content}`)
    .join('\n')
    .slice(0, 3000);

  if (!formatted.trim()) return null;

  const multiplier = options?.importanceMultiplier ?? 1.0;

  let facts: MemoryFact[] = [];

  try {
    // Primary path: structured JSON extraction for rich multi-fact output.
    facts = await generateJson<MemoryFact[]>(
      MEMORY_EXTRACTION_SYSTEM_PROMPT,
      `Conversation to analyze:\n\n${formatted}\n\nExtract memory facts now.`,
      { temperature: 0.2, maxOutputTokens: 512 },
    );

    // Validate and sanitize the response.
    if (!Array.isArray(facts)) facts = [];
    facts = facts.filter(
      (f) =>
        typeof f.fact === 'string' &&
        f.fact.trim().length > 0 &&
        typeof f.importance === 'number',
    );
  } catch (jsonErr) {
    // Fallback: single-fact text extraction keeps the system working even if
    // the model doesn't produce valid JSON.
    console.warn('[conversationService] JSON extraction failed, falling back to single-fact mode:', (jsonErr as Error).message);
    try {
      const fallbackText = await generateText(
        MEMORY_FALLBACK_SYSTEM_PROMPT,
        `Conversation:\n\n${formatted}\n\nExtract one key fact about the user.`,
        { maxOutputTokens: 60, temperature: 0.3 },
      );
      if (fallbackText?.trim()) {
        facts = [{ fact: fallbackText.trim(), category: 'personal_info', importance: 0.7 }];
      }
    } catch (fallbackErr) {
      console.warn('[conversationService] fallback extraction also failed:', (fallbackErr as Error).message);
      return null;
    }
  }

  if (!facts.length) return null;

  // Apply importance multiplier and clamp to [0, 1].
  const scaledFacts = facts.map((f) => ({
    ...f,
    importance: Math.min(1.0, Math.max(0.0, f.importance * multiplier)),
  }));

  // Embed and store each fact individually so each gets its own vector for
  // recall. embedAndStoreMemory is resilient (returns false on failure) so one
  // bad embedding doesn't abort the whole batch.
  const results = await Promise.all(
    scaledFacts.map((f) => embedAndStoreMemory(f.fact, f.importance, f.category)),
  );
  const anyPersisted = results.some(Boolean);

  return {
    facts: scaledFacts,
    persisted: anyPersisted,
  };
}

/**
 * Loads all turns for a session, extracts rich memory facts using Gemini,
 * generates embeddings, and stores each fact in the `memories` table for
 * future RAG retrieval.
 *
 * Called automatically when a session is closed (see closeSession). Silently
 * skips sessions with fewer than 3 turns (too short to be meaningful).
 */
export async function summarizeAndStoreSessionMemory(
  sessionId: string,
): Promise<void> {
  if (!sessionId) return;
  const supabase = await getSupabaseClient();

  const dbTurns = await loadTurns(sessionId);
  if (dbTurns.length < 3) return;

  // Convert DB turns to MemoryTurn format (both sides of the conversation).
  const memoryTurns: MemoryTurn[] = dbTurns.map((t) => ({
    role: t.speaker === 'user' ? 'user' : 'assistant',
    content: t.content,
  }));

  const result = await summarizeMessageBatch(memoryTurns, { importanceMultiplier: 1.0 });

  if (result && result.facts.length > 0) {
    if (result.persisted) {
      toast.success(`${result.facts.length} memory fact${result.facts.length > 1 ? 's' : ''} saved`, {
        description: "This conversation's key details are stored for future context.",
      });
    } else {
      toast.error('Memory not stored in Supabase', {
        description: 'Facts were extracted, but the Supabase insert failed. Check the console for embedding or RLS errors.',
      });
    }
  }
}

// ─── History helpers ──────────────────────────────────────────────────────────

/**
 * Loads past sessions for the current user, newest first.
 */
export async function loadSessions(
  mode?: AppMode,
  limit = 20,
): Promise<DBSession[]> {
  const userId = requireUserId();
  const supabase = await getSupabaseClient();

  let query = supabase
    .from('conversation_sessions')
    .select('id, title, mode, started_at, ended_at, metadata')
    .eq('user_id', userId)
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
  if (!sessionId) return [];
  const supabase = await getSupabaseClient();

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
