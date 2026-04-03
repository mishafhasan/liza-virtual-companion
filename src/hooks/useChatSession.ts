import { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Conversation, Message, AIPersonality } from '@/types';

interface UseChatSessionOptions {
    /** Override the system instruction with a custom one (e.g. language/emotion-aware) */
    systemInstructionOverride?: string;
}

/**
 * Real chat session hook using Google Gemini 2.5 Flash for text conversations.
 * Replaces the mock implementation with actual AI responses.
 */
export const useChatSession = (options?: UseChatSessionOptions) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [input, setInput] = useState('');
    const [personality, setPersonality] = useState<AIPersonality>('friendly');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const getPersonalityPrompt = useCallback((p: AIPersonality): string => {
        const prompts: Record<AIPersonality, string> = {
            friendly: "You are Liza, a warm, supportive, and cheerful AI companion. You use friendly language, add emojis occasionally, and make the user feel valued and heard. You're like a close friend who's always happy to chat.",
            professional: "You are Liza, a knowledgeable and articulate AI assistant. You provide well-structured, clear, and insightful responses. You maintain a respectful and polished tone while still being approachable.",
            witty: "You are Liza, a clever and humorous AI companion. You use wordplay, witty observations, and light sarcasm. You make conversations entertaining while still being helpful and engaging.",
            empathetic: "You are Liza, a deeply empathetic and emotionally intelligent AI companion. You focus on understanding the user's feelings, validate their emotions, and provide gentle, supportive responses. You're a comforting presence.",
            analytical: "You are Liza, a logical and analytical AI companion. You break down topics systematically, provide data-driven insights, and help users think through problems methodically. You're thorough but concise.",
        };
        return prompts[p];
    }, []);

    const createConversation = useCallback(() => {
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
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversation(newConv);
        if (!sidebarOpen) setSidebarOpen(true);
    }, [sidebarOpen]);

    const sendMessage = useCallback(async () => {
        if (!input.trim()) return;
        const content = input;
        setInput('');

        let conversation = currentConversation;
        if (!conversation) {
            const newConv: Conversation = {
                id: 'conv-' + Date.now(),
                title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                mode: 'entertainment',
            };
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

        setChatLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Build conversation history for context
            const history = updatedMessages.slice(-20).map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: m.content }]
            }));

            // Remove the last user message from history since we pass it as the prompt
            const contextHistory = history.slice(0, -1);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    ...contextHistory,
                    { role: 'user', parts: [{ text: content }] }
                ],
                config: {
                    systemInstruction: options?.systemInstructionOverride 
                        ? options.systemInstructionOverride + "\n\nKeep responses conversational and concise (1-3 paragraphs max). You're having a real-time text chat, not writing an essay. Do NOT use markdown formatting, asterisks, or action descriptions like *blushes*. Write naturally like a text message."
                        : getPersonalityPrompt(personality) + 
                          "\n\nKeep responses conversational and concise (1-3 paragraphs max). You're having a real-time chat, not writing an essay.",
                    maxOutputTokens: 500,
                    temperature: 0.9,
                }
            });

            const aiText = response.text || "Sorry, I couldn't process that. Could you try again?";
            
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
    }, [input, currentConversation, personality, getPersonalityPrompt]);

    const selectConversation = useCallback((id: string) => {
        const conv = conversations.find(c => c.id === id);
        if (conv) setCurrentConversation(conv);
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
        selectConversation
    };
};
