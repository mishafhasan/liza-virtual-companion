import { useState, useCallback, useRef, useEffect } from 'react';
import { generateChatReply, type ChatTurn } from '@/services/ai/chatService';
import {
    createSession,
    closeSession,
    updateSessionTitle,
    saveTurnPair,
    loadSessions,
    loadTurns,
    retrieveRelevantMemories,
    summarizeMessageBatch,
    deleteSession,
    type MemoryTurn,
} from '@/services/supabase/conversationService';
import { addXP, updateRecentActivity, XP_REWARDS } from '@/services/supabase/userStatsService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { getSupabaseClient, isSupabaseEnabled } from '@/services/supabase/supabaseClient';
import { toast } from 'sonner';
import type { Conversation, Message, AIPersonality, MessageRole } from '@/types';

interface UseChatSessionOptions {
    systemInstructionOverride?: string;
}

// ─── Module-level cache for sessions and turns ──────────────────────────────
// Shared across all hook instances so navigating between pages re-uses data.
// Each entry is keyed by user ID so switching accounts never leaks data.
//
// Keying policy:
//   - `'local'` when Supabase is not configured.
//   - `PENDING_USER_KEY` when Supabase is configured but the user/session is
//     not yet available. Caches under this key are NEVER persisted (see
//     `setSessionsCache`) so a stale first fetch doesn't lock in "no chats".
//   - The real Supabase `user.id` otherwise.

const CACHE_TTL_MS = 30_000;
const PENDING_USER_KEY = '__pending__';

interface SessionsCache {
    sessions: Conversation[];
    timestamp: number;
    userId: string;
}

interface TurnsCache {
    messages: Message[];
    timestamp: number;
    userId: string;
}

const cachedSessionsByUser = new Map<string, SessionsCache>();
const cachedTurnsByUser = new Map<string, Map<string, TurnsCache>>();

/**
 * Resolves the current cache key from the real Supabase session, falling
 * back to the Auth Zustand store when Supabase isn't usable. Reads auth
 * synchronously when it can; only awaits Supabase when no other option.
 */
function getCurrentUserIdSync(): string {
    const authUser = useAuthStore.getState().user?.id;
    if (authUser) return authUser;
    if (!isSupabaseEnabled()) return 'local';
    return PENDING_USER_KEY;
}

async function resolveCacheKey(): Promise<string> {
    const sync = getCurrentUserIdSync();
    if (sync !== PENDING_USER_KEY) return sync;
    // Supabase is configured but the Zustand user is empty. Probe the SDK
    // to grab the real user id; bail to PENDING if it's still unavailable.
    const supabase = await getSupabaseClient();
    if (!supabase) return PENDING_USER_KEY;
    try {
        const { data } = await supabase.auth.getUser();
        return data?.user?.id ?? PENDING_USER_KEY;
    } catch {
        return PENDING_USER_KEY;
    }
}

function getSessionsCache(userId: string): SessionsCache | null {
    const cache = cachedSessionsByUser.get(userId);
    if (!cache) return null;
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) {
        cachedSessionsByUser.delete(userId);
        return null;
    }
    return cache;
}

/**
 * Only persist a sessions cache under a stable, real key. A first fetch that
 * raced past auth hydration must NOT poison subsequent mounts with an empty
 * list — those are debounced by `getSessionsCache`'s TTL otherwise.
 */
function setSessionsCache(userId: string, sessions: Conversation[]) {
    if (userId === PENDING_USER_KEY) return;
    cachedSessionsByUser.set(userId, { sessions, timestamp: Date.now(), userId });
}

function getTurnsCache(userId: string, sessionId: string): TurnsCache | null {
    const userCache = cachedTurnsByUser.get(userId);
    if (!userCache) return null;
    const cache = userCache.get(sessionId);
    if (!cache) return null;
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) {
        userCache.delete(sessionId);
        return null;
    }
    return cache;
}

function setTurnsCache(userId: string, sessionId: string, messages: Message[]) {
    if (userId === PENDING_USER_KEY) return;
    let userCache = cachedTurnsByUser.get(userId);
    if (!userCache) {
        userCache = new Map();
        cachedTurnsByUser.set(userId, userCache);
    }
    userCache.set(sessionId, { messages, timestamp: Date.now(), userId });
}

function invalidateSessionsCache(userId: string) {
    if (userId === PENDING_USER_KEY) {
        // Drop any pending cache inherited from a race.
        cachedSessionsByUser.delete(PENDING_USER_KEY);
        return;
    }
    cachedSessionsByUser.delete(userId);
}

function invalidateTurnsCache(userId: string, sessionId: string) {
    if (userId === PENDING_USER_KEY) return;
    const userCache = cachedTurnsByUser.get(userId);
    if (userCache) userCache.delete(sessionId);
}

/**
 * Real chat session hook using Google Gemini 2.5 Flash.
 *
 * Conversation sessions and turns are persisted to Supabase when configured.
 * In local-only mode everything stays in memory exactly as before.
 *
 * Session and turn lists are cached with a 30-second TTL so navigating back
 * to /chat from /settings or /dashboard shows history instantly.
 */
export const useChatSession = (options?: UseChatSessionOptions) => {
    // Initial state is read from the cache using a sync-stable key. On first
    // mount the Zustand auth store may not yet have a user id; the sync resolver
    // returns 'local' for local-only mode and '__pending__' otherwise. Either
    // way we hydrate from whatever the cache currently holds (PENDING slots
    // are never written, so they'll be empty here — the effect above retries).
    const [conversations, setConversations] = useState<Conversation[]>(
        getSessionsCache(getCurrentUserIdSync())?.sessions ?? []
    );
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [input, setInput] = useState('');
    const [personality, setPersonality] = useState<AIPersonality>('friendly');
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 768;
        }
        return true;
    });

    // Tracks the active Supabase session UUID for the current conversation.
    const dbSessionId = useRef<string | null>(null);

    /** Guard to prevent state updates after unmount. */
    const isMountedRef = useRef(true);

    // ─── Mid-conversation memory summarization ───────────────────────────
    //
    // Counts user messages in the current session. Every 6 messages the turns
    // since the last summarization are passed to Gemini and the resulting
    // memory facts (2–7 per batch) are saved both locally (settingsStore.memory)
    // and to the Supabase RAG pipeline (when configured).
    // Using full conversation turns (user + assistant) gives richer context
    // than user-only messages, matching the ChatGPT/Claude memory approach.
    const userMessageCountRef = useRef(0);
    const lastSummarizedIndexRef = useRef(0);
    /** Guard to prevent overlapping summarizations when messages are sent rapidly. */
    const isSummarizingRef = useRef(false);

    // ─── Load past conversations from cloud and auto-select one ───────────
    //
    // Accepts an optional `selectId` — when provided, that specific session is
    // selected and its turns are loaded. Otherwise the most recent conversation
    // is auto-selected. This ensures the chat area shows real content
    // immediately when the page mounts (or remounts on route navigation).
    //
    // Uses a 30-second module-level cache so navigating back to /chat from
    // another page shows the sidebar instantly without refetching.
    //
    // Resolves the cache key from the real Supabase session first; only falls
    // back to a `__pending__` sentinel if Supabase isn't usable yet, in which
    // case neither the session nor turn cache is written — this prevents the
    // first race-mounted nav from freezing an empty sidebar for 30s.
    const loadHistory = useCallback(async (selectId?: string) => {
        let convs: Conversation[];
        const userId = await resolveCacheKey();
        const sessionsCache = getSessionsCache(userId);

        if (sessionsCache) {
            convs = sessionsCache.sessions;
        } else {
            const sessions = await loadSessions('entertainment', 30);
            if (sessions.length === 0) {
                if (isMountedRef.current) {
                    setConversations([]);
                    setCurrentConversation(null);
                }
                // Don't cache an empty result so the next mount retries cleanly.
                invalidateSessionsCache(userId);
                return;
            }
            convs = sessions.map((s) => ({
                id: s.id,
                title: s.title ?? 'Conversation',
                messages: [],          // turns loaded lazily on selectConversation
                createdAt: new Date(s.started_at),
                updatedAt: new Date(s.ended_at ?? s.started_at),
                mode: 'entertainment',
            }));
            setSessionsCache(userId, convs);
        }

        if (!isMountedRef.current) return;
        setConversations(convs);

        // Determine which conversation to select
        const targetId = selectId ?? (convs.length > 0 ? convs[0].id : undefined);
        if (!targetId) return;

        const target = convs.find((c) => c.id === targetId) ?? convs[0];
        dbSessionId.current = target.id;

        // Load turns — use cached turns if fresh, otherwise hit the DB.
        const turnsCache = getTurnsCache(userId, target.id);

        if (turnsCache) {
            if (isMountedRef.current) {
                setCurrentConversation({ ...target, messages: turnsCache.messages });
            }
            return;
        }

        const turns = await loadTurns(target.id);
        if (!isMountedRef.current) return;
        if (turns.length > 0) {
            const messages: Message[] = turns.map((t) => ({
                id: t.id,
                role: (t.speaker === 'user' ? 'user' : 'assistant') as MessageRole,
                content: t.content,
                timestamp: new Date(t.created_at),
            }));
            setTurnsCache(userId, target.id, messages);
            setCurrentConversation({ ...target, messages });
        } else {
            setCurrentConversation(target);
        }
    }, []);

    const getPersonalityPrompt = useCallback((p: AIPersonality): string => {
        const prompts: Record<AIPersonality, string> = {
            friendly:     "You are Liza, a warm, supportive, and cheerful AI companion. You use friendly language, add emojis occasionally, and make the user feel valued and heard. You're like a close friend who's always happy to chat.",
            professional: "You are Liza, a knowledgeable and articulate AI assistant. You provide well-structured, clear, and insightful responses. You maintain a respectful and polished tone while still being approachable.",
            witty:        "You are Liza, a clever and humorous AI companion. You use wordplay, witty observations, and light sarcasm. You make conversations entertaining while still being helpful and engaging.",
            empathetic:   "You are Liza, a deeply empathetic and emotionally intelligent AI companion. You focus on understanding the user's feelings, validate their emotions, and provide gentle, supportive responses. You're a comforting presence.",
            analytical:   "You are Liza, a logical and analytical AI companion. You break down topics systematically, provide data-driven insights, and help users think through problems methodically. You're thorough but concise.",
        };
        return prompts[p];
    }, []);

    // ─── Create new conversation ──────────────────────────────────────────
    const createConversation = useCallback(async () => {
        const oldDbSessionId = dbSessionId.current;

        const newConv: Conversation = {
            id: 'conv-' + Date.now(),
            title: 'New Conversation',
            messages: [{
                id: 'welcome-' + Date.now(),
                role: 'assistant',
                content: "Hey there! I'm Liza, your friendly AI companion. How's your day going? 💜",
                timestamp: new Date(),
            }],
            createdAt: new Date(),
            updatedAt: new Date(),
            mode: 'entertainment',
        };

        // Optimistically update UI
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversation(newConv);
        if (!sidebarOpen) setSidebarOpen(true);

        // Invalidate the sessions cache so the next loadHistory sees the new chat.
        // Resolve async so we hit the real user slot, not the pending sentinel.
        invalidateSessionsCache(await resolveCacheKey());

        try {
            // Close any existing session in the background
            if (oldDbSessionId) {
                dbSessionId.current = null;
                // Fire and forget
                closeSession(oldDbSessionId).catch(err => console.error(err));
            }

            // Reset mid-conversation counters for the new session.
            userMessageCountRef.current = 0;
            lastSummarizedIndexRef.current = 0;
            isSummarizingRef.current = false;

            // Create the DB session
            const sid = await createSession('entertainment', 'New Conversation');
            if (sid) {
                // Keep UI in sync with DB ID
                const updatedConv = { ...newConv, id: sid };
                dbSessionId.current = sid;
                setConversations(prev => prev.map(c => c.id === newConv.id ? updatedConv : c));
                setCurrentConversation(updatedConv);

                // Award XP and track activity
                await addXP(XP_REWARDS.CONVERSATION_STARTED, 'entertainment');
                await updateRecentActivity('entertainment', sid);
            }
        } catch (error) {
            console.error('Failed to create DB session:', error);
        }
    }, [sidebarOpen]);

    // ─── Send message ─────────────────────────────────────────────────────
    const sendMessage = useCallback(async () => {
        if (!input.trim()) return;
        const content = input;
        setInput('');

        let conversation = currentConversation;

        // Auto-create a conversation if none is active.
        if (!conversation) {
            const title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
            const sid = await createSession('entertainment', title);
        const newConv: Conversation = {
            id: sid ?? ('conv-' + Date.now()),
            title,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            mode: 'entertainment',
        };
        if (sid) {
            dbSessionId.current = sid;
            // Award XP for starting a conversation
            await addXP(XP_REWARDS.CONVERSATION_STARTED, 'entertainment');
            // Track as recent activity
            await updateRecentActivity('entertainment', sid);
        }
        // New conversation must not be hidden by stale cache.
        invalidateSessionsCache(await resolveCacheKey());
        conversation = newConv;
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversation(newConv);
        }

        const userMessage: Message = {
            id: 'msg-' + Date.now(),
            role: 'user',
            content,
            timestamp: new Date(),
        };

        const updatedMessages = [...conversation.messages, userMessage];
        const updatedConv = { ...conversation, messages: updatedMessages, updatedAt: new Date() };
        setCurrentConversation(updatedConv);
        setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));

        // Keep the sessions cache updated so sidebar ordering stays fresh.
        // Resolve once per send so both reads and writes hit the same key.
        const cacheKey = await resolveCacheKey();
        const sessionsCache = getSessionsCache(cacheKey);
        if (sessionsCache) {
            setSessionsCache(
                cacheKey,
                sessionsCache.sessions.map(c =>
                    c.id === updatedConv.id ? { ...c, updatedAt: updatedConv.updatedAt } : c,
                ),
            );
        }

        // Update title from first real message if still generic.
        if (
            conversation.title === 'New Conversation' &&
            dbSessionId.current
        ) {
            const title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
            await updateSessionTitle(dbSessionId.current, title);
            setCurrentConversation(c => c ? { ...c, title } : c);
            setConversations(prev =>
                prev.map(c => c.id === updatedConv.id ? { ...c, title } : c),
            );
            // Keep the sessions cache in sync so the sidebar title is fresh.
            const titleCacheKey = await resolveCacheKey();
            const sessionsCache = getSessionsCache(titleCacheKey);
            if (sessionsCache) {
                setSessionsCache(
                    titleCacheKey,
                    sessionsCache.sessions.map(c =>
                        c.id === updatedConv.id ? { ...c, title } : c,
                    ),
                );
            }
        }

        setChatLoading(true);

        try {
            const history: ChatTurn[] = updatedMessages.slice(-20).map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
            }));

            // Fetch semantically relevant memories in parallel with AI call setup.
            // Falls back to [] silently when Supabase is not configured.
            const ragFacts = await retrieveRelevantMemories(content);

            const baseInstruction = options?.systemInstructionOverride
                ?? getPersonalityPrompt(personality) +
                   '\n\nKeep responses conversational and concise (1-3 paragraphs max).';

            // Append RAG context block when there are relevant past memories.
            const systemInstruction = ragFacts.length > 0
                ? `${baseInstruction}\n\n**LONG-TERM MEMORY (from past conversations — use naturally, never robotically):**\n${ragFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
                : baseInstruction;

            const aiText = (await generateChatReply({ systemInstruction, history }))
                || "Sorry, I couldn't process that. Could you try again?";

            const aiMessage: Message = {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: aiText,
                timestamp: new Date(),
            };

            const finalMessages = [...updatedMessages, aiMessage];
            const finalConv = { ...updatedConv, messages: finalMessages };
            setCurrentConversation(finalConv);
            setConversations(prev => prev.map(c => c.id === finalConv.id ? finalConv : c));

            // Keep the turns cache in sync so navigation back shows the latest messages.
            if (dbSessionId.current) {
                setTurnsCache(await resolveCacheKey(), dbSessionId.current, finalMessages);
            }

            // Persist both turns together.
            if (dbSessionId.current) {
                await saveTurnPair(dbSessionId.current, content, aiText);
                // Award XP for sending a message
                await addXP(XP_REWARDS.MESSAGE_SENT, 'entertainment');
                // Update recent activity
                await updateRecentActivity('entertainment', dbSessionId.current);
            }

            // ── Mid-conversation memory summarization (every 6 messages) ──
            userMessageCountRef.current += 1;
            if (
                userMessageCountRef.current % 6 === 0 &&
                !isSummarizingRef.current
            ) {
                isSummarizingRef.current = true;
                // Fire-and-forget so the UI isn't blocked.
                summarizeRecentContext(
                    finalMessages,
                    lastSummarizedIndexRef.current,
                ).then((newIndex) => {
                    if (newIndex !== null) {
                        lastSummarizedIndexRef.current = newIndex;
                    }
                }).finally(() => {
                    isSummarizingRef.current = false;
                });
            }
        } catch (error) {
            console.error('Gemini API error:', error);
            const errorMessage: Message = {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: "Hmm, I'm having trouble connecting right now. Could you try again in a moment? 🙏",
                timestamp: new Date(),
            };
            const finalMessages = [...updatedMessages, errorMessage];
            const finalConv = { ...updatedConv, messages: finalMessages };
            setCurrentConversation(finalConv);
            setConversations(prev => prev.map(c => c.id === finalConv.id ? finalConv : c));
        } finally {
            setChatLoading(false);
        }
    }, [input, currentConversation, personality, getPersonalityPrompt, options?.systemInstructionOverride]);

    // ─── Cleanup on unmount ─────────────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ─── Select an existing conversation (lazy-loads turns) ──────────────
    const selectConversation = useCallback(async (id: string) => {
        // Close current session and reset mid-conversation counters.
        if (dbSessionId.current && dbSessionId.current !== id) {
            await closeSession(dbSessionId.current);
        }
        userMessageCountRef.current = 0;
        lastSummarizedIndexRef.current = 0;
        isSummarizingRef.current = false;

        // Resolve the real user id so cache writes target the right slot.
        const userId = await resolveCacheKey();

        // Try to find from local state first
        let conv = conversations.find(c => c.id === id);

        // If not found in local state, try to load from DB directly (e.g., Resume from dashboard)
        if (!conv) {
            const turnsCache = getTurnsCache(userId, id);
            const messages: Message[] = turnsCache
                ? turnsCache.messages
                : (await loadTurns(id)).map(t => ({
                    id: t.id,
                    role: (t.speaker === 'user' ? 'user' : 'assistant') as MessageRole,
                    content: t.content,
                    timestamp: new Date(t.created_at),
                }));

            if (!turnsCache && messages.length > 0) {
                setTurnsCache(userId, id, messages);
            }

            const fetchedConv: Conversation = {
                id,
                title: 'Conversation',
                messages,
                createdAt: new Date(),
                updatedAt: new Date(),
                mode: 'entertainment',
            };
            setConversations(prev => {
                const exists = prev.some(c => c.id === id);
                return exists ? prev.map(c => c.id === id ? { ...c, messages } : c) : [fetchedConv, ...prev];
            });
            setCurrentConversation(fetchedConv);
            dbSessionId.current = id;
            await updateRecentActivity('entertainment', id);
            return;
        }

        // If messages haven't been loaded yet, use cache or fetch from DB.
        if (conv.messages.length === 0) {
            const turnsCache = getTurnsCache(userId, id);

            if (turnsCache) {
                const loaded = { ...conv, messages: turnsCache.messages };
                setConversations(prev => prev.map(c => c.id === id ? loaded : c));
                setCurrentConversation(loaded);
                dbSessionId.current = id;
                await updateRecentActivity('entertainment', id);
                return;
            }

            const turns = await loadTurns(id);
            if (turns.length > 0) {
                const messages: Message[] = turns.map(t => ({
                    id: t.id,
                    role: (t.speaker === 'user' ? 'user' : 'assistant') as MessageRole,
                    content: t.content,
                    timestamp: new Date(t.created_at),
                }));
                setTurnsCache(userId, id, messages);
                const loaded = { ...conv, messages };
                setConversations(prev => prev.map(c => c.id === id ? loaded : c));
                setCurrentConversation(loaded);
                dbSessionId.current = id;

                // Update recent activity when selecting a conversation
                await updateRecentActivity('entertainment', id);
                return;
            }
        }

        setCurrentConversation(conv);
        dbSessionId.current = id;

        // Update recent activity
        await updateRecentActivity('entertainment', id);
    }, [conversations]);

    // ─── Delete a conversation ─────────────────────────────────────────────────
    const deleteConversation = useCallback(async (id: string) => {
        // Save a snapshot so we can revert if the DB delete fails
        const snapshot = conversations;

        // Optimistically remove it from the list immediately
        setConversations(prev => prev.filter(c => c.id !== id));

        // If the deleted chat is currently open, clear the view
        if (currentConversation?.id === id || dbSessionId.current === id) {
            setCurrentConversation(null);
            dbSessionId.current = null;
        }

        // Invalidate caches so the next loadHistory doesn't show the deleted chat.
        // Resolved async to target the right user's slot.
        const cacheKey = await resolveCacheKey();
        invalidateSessionsCache(cacheKey);
        invalidateTurnsCache(cacheKey, id);

        try {
            await deleteSession(id);
            toast.success('Chat deleted', {
                description: 'The conversation has been permanently deleted.',
            });
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            // Revert the optimistic update so the user doesn't lose their chat list
            setConversations(snapshot);
            toast.error('Failed to delete chat', {
                description: 'Could not delete the conversation. Please try again.',
            });
        }
    }, [conversations, currentConversation?.id]);

    return {
        conversations,
        currentConversation,
        chatLoading,
        input,
        setInput,
        personality,
        setPersonality,
        sidebarOpen,
        setSidebarOpen,
        createConversation,
        sendMessage,
        selectConversation,
        deleteConversation,
        loadHistory,
    };
};

// ─── Helper: extract multi-fact memory from unsummarized conversation ──────────

/**
 * ChatGPT/Claude-style memory extraction for mid-conversation summarization.
 *
 * Collects the full conversation turns (both user and assistant) that haven't
 * been summarized yet, sends them to Gemini for structured multi-fact extraction,
 * saves each fact locally (settingsStore.memory) with its category prefix for
 * structured rendering, and stores each in the Supabase RAG pipeline when
 * configured.
 *
 * Key improvements over the old single-fact approach:
 * - Processes FULL conversation (user + assistant) for richer context
 * - Extracts 2–7 distinct categorized facts per batch (not just 1)
 * - Persists each fact as a separate embedding for fine-grained recall
 * - Category prefix stored with each fact enables structured memory display
 *
 * @param messages   Full conversation message list (user + assistant turns).
 * @param startIndex The message index from which to start (unsummarized portion).
 * @returns          The new lastSummarizedIndex on success, or `null` if skipped.
 */
async function summarizeRecentContext(
    messages: Message[],
    startIndex: number,
): Promise<number | null> {
    // Slice the unsummarized portion of the conversation (both sides).
    // We use message index (not just user-message index) for a clean window.
    const unsummarizedMessages = messages.slice(startIndex);

    // Need at least a few turns to extract meaningful facts.
    if (unsummarizedMessages.length < 2) return null;

    // Convert to MemoryTurn format expected by the new summarizeMessageBatch.
    const turns: MemoryTurn[] = unsummarizedMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
    }));

    // Summarize via Gemini — returns null if AI is unavailable.
    const result = await summarizeMessageBatch(turns);
    if (!result || !result.facts.length) return null;

    // Save each extracted fact to local Zustand memory with its category prefix
    // so buildMemoryContext can render them in structured sections.
    const addMemory = useSettingsStore.getState().addMemory;
    for (const factItem of result.facts) {
        const taggedFact = `[${factItem.category}] ${factItem.fact}`;
        addMemory({
            id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            fact: taggedFact,
        });
    }

    // Notify the user based on the actual Supabase persistence result.
    const count = result.facts.length;
    if (result.persisted) {
        toast.success(`${count} memory fact${count > 1 ? 's' : ''} saved`, {
            description: "Key details from this conversation are stored for future context.",
        });
    } else if (result.supabaseConfigured) {
        toast.error('Memory not stored in Supabase', {
            description: 'Facts were extracted locally, but the Supabase insert failed. Check the console for embedding or RLS errors.',
        });
    } else {
        toast.success(`${count} memory fact${count > 1 ? 's' : ''} saved locally`, {
            description: 'Supabase is not configured, so memories are only stored in this browser.',
        });
    }

    // Return the new message index boundary so the caller advances
    // lastSummarizedIndexRef to avoid re-processing the same messages.
    return messages.length;
}
