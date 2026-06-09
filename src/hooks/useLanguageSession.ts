import { useState, useRef } from 'react';
import { toast } from 'sonner';
import type {
    LanguageLower as Language, ProficiencyLevel, LearningGoal, Message, LanguageSession
} from '@/types';
import { LANGUAGE_DATA } from '@/data/mockData';
import { tutorRespond, assessSession } from '@/services/ai/languageService';
import {
    createSession,
    closeSession,
    saveTurnPair,
} from '@/services/supabase/conversationService';
import { hasGeminiKey, hasSupabase } from '@/config/env';

/** AI is available if we can reach Gemini directly or via the Supabase proxy. */
const aiAvailable = (): boolean => hasGeminiKey() || hasSupabase();

/**
 * Language-learning session hook — now powered by real Gemini AI tutoring.
 *
 * Each learner message is corrected and explained by the model, which also
 * continues the conversation naturally. The end-of-session summary is an
 * AI-generated assessment grounded in the corrections actually made.
 * The public API matches the original mock so the views are unchanged.
 */
export const useLanguageSession = () => {
    // Onboarding state
    const [step, setStep] = useState(1);
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
    const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel>('beginner');
    const [selectedGoal, setSelectedGoal] = useState<LearningGoal>('daily-practice');

    // Session state
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentSession, setCurrentSession] = useState<LanguageSession | null>(null);
    const [history, setHistory] = useState<LanguageSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        corrections: [] as { original: string; corrected: string; explanation: string }[],
        newVocabulary: [] as string[],
        grammarErrors: 0,
        messagesCount: 0,
    });

    const [view, setView] = useState<'onboarding' | 'session' | 'summary'>('onboarding');

    // Supabase session UUID for this language session.
    const dbSessionId = useRef<string | null>(null);

    const startSession = async () => {
        const session: LanguageSession = {
            id: 'lang-' + Date.now(),
            language: selectedLanguage,
            level: selectedLevel,
            goal: selectedGoal,
            startTime: new Date(),
            messages: [{
                id: 'welcome-' + Date.now(),
                role: 'assistant',
                content: LANGUAGE_DATA[selectedLanguage].greeting + `\n\nI'll help you practice ${LANGUAGE_DATA[selectedLanguage].name} at a ${selectedLevel} level, focusing on ${selectedGoal.replace('-', ' ')}. Let's begin!\n\nHow would you introduce yourself?`,
                timestamp: new Date(),
            }],
            grammarScore: 0,
            vocabularyScore: 0,
            fluencyScore: 0,
            overallScore: 0,
            improvements: [],
            corrections: [],
        };
        setCurrentSession(session);
        setMessages(session.messages);
        setStats({ corrections: [], newVocabulary: [], grammarErrors: 0, messagesCount: 0 });

        // Create DB session row.
        const sid = await createSession('language', `${LANGUAGE_DATA[selectedLanguage].name} Practice`, {
            language: selectedLanguage,
            level: selectedLevel,
            goal: selectedGoal,
        });
        if (sid) dbSessionId.current = sid;

        setView('session');
        toast.success('Learning session started!');
    };

    const sendMessage = async () => {
        if (!input.trim() || !currentSession) return;
        const content = input;
        setInput('');

        const userMessage: Message = {
            id: 'msg-' + Date.now(),
            role: 'user',
            content,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setStats(prev => ({ ...prev, messagesCount: prev.messagesCount + 1 }));
        setLoading(true);

        try {
            if (!aiAvailable()) throw new Error('AI not configured');

            const tutor = await tutorRespond({
                language: selectedLanguage,
                level: selectedLevel,
                goal: selectedGoal,
                userMessage: content,
            });

            let responseText = '';
            if (tutor.hasCorrection) {
                responseText = `Good attempt! Here's a correction:\n\n❌ "${tutor.original}"\n✅ "${tutor.corrected}"\n\n${tutor.explanation}\n\n`;
                setStats(prev => ({
                    ...prev,
                    corrections: [...prev.corrections, {
                        original: tutor.original,
                        corrected: tutor.corrected,
                        explanation: tutor.explanation,
                    }],
                    grammarErrors: prev.grammarErrors + 1,
                    newVocabulary: [...prev.newVocabulary, ...tutor.newVocabulary],
                }));
            } else if (tutor.newVocabulary.length > 0) {
                setStats(prev => ({
                    ...prev,
                    newVocabulary: [...prev.newVocabulary, ...tutor.newVocabulary],
                }));
            }
            responseText += tutor.reply;

            const aiMessage: Message = {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);

            // Persist the user + tutor pair.
            if (dbSessionId.current) {
                await saveTurnPair(dbSessionId.current, content, responseText);
            }
        } catch (error) {
            console.error('Language tutor failed:', error);
            const aiMessage: Message = {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: "I'm having trouble responding right now. Let's keep going — try saying that another way!",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);
            toast.message('Tutor is offline', { description: 'AI tutoring is temporarily unavailable.' });
        } finally {
            setLoading(false);
        }
    };

    const endSession = async () => {
        if (!currentSession) return;
        setLoading(true);

        const endTime = new Date();
        let assessment;
        try {
            if (!aiAvailable()) throw new Error('AI not configured');
            assessment = await assessSession({
                language: selectedLanguage,
                level: selectedLevel,
                messageCount: stats.messagesCount,
                corrections: stats.corrections,
            });
        } catch (error) {
            console.error('Session assessment failed, using heuristic scores:', error);
            const grammarScore = Math.max(60, 100 - stats.grammarErrors * 5);
            const vocabularyScore = Math.min(95, 70 + stats.messagesCount * 2);
            const fluencyScore = Math.min(95, 65 + stats.messagesCount * 1.5);
            assessment = {
                grammarScore,
                vocabularyScore,
                fluencyScore,
                overallScore: Math.round((grammarScore + vocabularyScore + fluencyScore) / 3),
                improvements: ['Keep practicing daily to build fluency.'],
            };
        }

        const completedSession: LanguageSession = {
            ...currentSession,
            endTime,
            grammarScore: assessment.grammarScore,
            vocabularyScore: assessment.vocabularyScore,
            fluencyScore: assessment.fluencyScore,
            overallScore: assessment.overallScore,
            improvements: assessment.improvements,
            corrections: stats.corrections,
        };

        setHistory(prev => [completedSession, ...prev]);
        setCurrentSession(completedSession);
        setLoading(false);
        setView('summary');

        // Close the DB session with summary scores.
        if (dbSessionId.current) {
            await closeSession(dbSessionId.current, {
                grammarScore: assessment.grammarScore,
                vocabularyScore: assessment.vocabularyScore,
                fluencyScore: assessment.fluencyScore,
                overallScore: assessment.overallScore,
            });
            dbSessionId.current = null;
        }

        toast.success('Session completed! View your summary.');
    };

    return {
        view, setView,
        step, setStep,
        selectedLanguage, setSelectedLanguage,
        selectedLevel, setSelectedLevel,
        selectedGoal, setSelectedGoal,
        input, setInput,
        messages,
        currentSession,
        stats,
        history,
        loading,
        startSession,
        sendMessage,
        endSession,
    };
};
