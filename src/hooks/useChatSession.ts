import { useState, useCallback, useRef } from 'react';
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
} from '@/services/supabase/conversationService';
import { addXP, updateRecentActivity, XP_REWARDS } from '@/services/supabase/userStatsService';
import { useSettingsStore } from '@/stores/settingsStore';
import { toast } from 'sonner';
import type { Conversation, Message, AIPersonality } from '@/types';

interface UseChatSessionOptions {
    systemInstructionOverride?: string;
}

/**
 * Real chat session hook using Google Gemini 2.5 Flash.
 *
 * Conversation sessions and turns are persisted to Supabase when configured.
 * In local-only mode everything stays in memory exactly as before.
 */
export const useChatSession = (options?: UseChatSessionOptions) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [input, setInput] = useState('');
    const [personality, setPersonality] = useState<AIPersonality>('friendly');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Tracks the active Supabase session UUID for the current conversation.
    const dbSessionId = useRef<string | null>(null);

    // ─── Mid-conversation memory summarization ───────────────────────────
    //
    // Counts user messages in the current session. Every 5 messages the
    // messages sent since the last summarization are passed to Gemini and
    // the resulting memory fact is saved both locally (settingsStore.memory)
    // and to the Supabase RAG pipeline (when configured).
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
    const loadHistory = useCallback(async (selectId?: string) => {
        const sessions = await loadSessions('entertainment', 30);
        if (sessions.length === 0) return;

        const convs: Conversation[] = sessions.map((s) => ({
            id: s.id,
            title: s.title ?? 'Conversation',
            messages: [],          // turns loaded lazily on selectConversation
            createdAt: new Date(s.started_at),
            updatedAt: new Date(s.ended_at ?? s.started_at),
            mode: 'entertainment',
        }));
        setConversations(convs);

        // Determine which conversation to select
        const targetId = selectId ?? (convs.length > 0 ? convs[0].id : undefined);
        if (!targetId) return;

        const target = convs.find((c) => c.id === targetId) ?? convs[0];
        dbSessionId.current = target.id;

        // Load turns so the chat area shows messages immediately
        const turns = await loadTurns(target.id);
        if (turns.length > 0) {
            const messages: Message[] = turns.map((t) => ({
                id: t.id,
                role: t.speaker === 'user' ? 'user' : 'assistant',
                content: t.content,
                timestamp: new Date(t.created_at),
            }));
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

            // Persist both turns together.
            if (dbSessionId.current) {
                await saveTurnPair(dbSessionId.current, content, aiText);
                // Award XP for sending a message
                await addXP(XP_REWARDS.MESSAGE_SENT, 'entertainment');
                // Update recent activity
                await updateRecentActivity('entertainment', dbSessionId.current);
            }

            // ── Mid-conversation memory summarization (every 5 messages) ──
            userMessageCountRef.current += 1;
            if (
                userMessageCountRef.current % 5 === 0 &&
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

    // ─── Select an existing conversation (lazy-loads turns) ──────────────
    const selectConversation = useCallback(async (id: string) => {
        // Close current session and reset mid-conversation counters.
        if (dbSessionId.current && dbSessionId.current !== id) {
            await closeSession(dbSessionId.current);
        }
        userMessageCountRef.current = 0;
        lastSummarizedIndexRef.current = 0;
        isSummarizingRef.current = false;

        // Try to find from local state first
        let conv = conversations.find(c => c.id === id);

        // If not found in local state, try to load from DB directly (e.g., Resume from dashboard)
        if (!conv) {
            const turns = await loadTurns(id);
            const messages: Message[] = turns.map(t => ({
                id: t.id,
                role: t.speaker === 'user' ? 'user' : 'assistant',
                content: t.content,
                timestamp: new Date(t.created_at),
            }));
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

        // If messages haven't been loaded yet, fetch from DB.
        if (conv.messages.length === 0) {
            const turns = await loadTurns(id);
            if (turns.length > 0) {
                const messages: Message[] = turns.map(t => ({
                    id: t.id,
                    role: t.speaker === 'user' ? 'user' : 'assistant',
                    content: t.content,
                    timestamp: new Date(t.created_at),
                }));
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

// ─── Helper: summarize unprocessed user messages into a memory fact ────────────

/**
 * Takes the last `startIndex` unsummarized user messages from the conversation,
 * sends them to Gemini for summarization, saves the result as a local memory
 * fact, and also stores it in the RAG pipeline when Supabase is available.
 *
 * @returns The new "lastSummarizedIndex" (total user message count) on success,
 *          or `null` if summarization was skipped (e.g. no new messages).
 */
async function summarizeRecentContext(
    messages: Message[],
    startIndex: number,
): Promise<number | null> {
    // Collect user messages that haven't been summarized yet.
    const userMessages = messages
        .filter((m) => m.role === 'user')
        .slice(startIndex);

    if (userMessages.length === 0) return null;

    const texts = userMessages.map((m) => m.content);

    // Summarize via Gemini — returns null if AI is unavailable.
    const summary = await summarizeMessageBatch(texts);
    if (!summary) return null;

    // Save to local Zustand memory (works in all modes).
    const addMemory = useSettingsStore.getState().addMemory;
    addMemory({ id: 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), fact: summary });

    // Notify the user that key facts have been stored for future context.
    toast.success('Memory saved', {
      description: "This conversation's key facts are now stored for future context.",
    });

    // Return the new index (total user messages processed so far) so the
    // caller can advance lastSummarizedIndexRef. Count all user messages
    // (not just the slice) for a clean running index.
    const allUserMessages = messages.filter((m) => m.role === 'user');
    return allUserMessages.length;
}
