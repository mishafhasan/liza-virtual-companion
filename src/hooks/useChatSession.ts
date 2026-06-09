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
} from '@/services/supabase/conversationService';
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

    // ─── Load past conversations from cloud on first use ──────────────────
    const loadHistory = useCallback(async () => {
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
        // Close any existing session first.
        if (dbSessionId.current) {
            await closeSession(dbSessionId.current);
            dbSessionId.current = null;
        }

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

        // Create the DB session (no-op in local-only mode).
        const sid = await createSession('entertainment', 'New Conversation');
        if (sid) {
            // Use the Supabase UUID as the conversation id so they stay in sync.
            newConv.id = sid;
            dbSessionId.current = sid;
        }

        setConversations(prev => [newConv, ...prev]);
        setCurrentConversation(newConv);
        if (!sidebarOpen) setSidebarOpen(true);
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
            if (sid) dbSessionId.current = sid;
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
        // Close current session.
        if (dbSessionId.current && dbSessionId.current !== id) {
            await closeSession(dbSessionId.current);
        }

        const conv = conversations.find(c => c.id === id);
        if (!conv) return;

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
                return;
            }
        }

        setCurrentConversation(conv);
        dbSessionId.current = id;
    }, [conversations]);

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
        loadHistory,
    };
};
