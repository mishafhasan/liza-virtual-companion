import { useState } from 'react';
import { toast } from 'sonner';
import type {
    LanguageLower as Language, ProficiencyLevel, LearningGoal, Message, LanguageSession
} from '@/types';
import { LANGUAGE_DATA } from '@/data/mockData';

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
    const [stats, setStats] = useState({
        corrections: [] as { original: string; corrected: string; explanation: string }[],
        newVocabulary: [] as string[],
        grammarErrors: 0,
        messagesCount: 0,
    });

    // Page state managed here or in the component depending on arch. 
    // Let's expose a 'view' state: 'onboarding' | 'session' | 'summary'
    const [view, setView] = useState<'onboarding' | 'session' | 'summary'>('onboarding');

    const startSession = () => {
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
        setView('session');
        toast.success('Learning session started!');
    };

    const simulateLanguageCorrection = (text: string, lang: Language, _level: ProficiencyLevel) => {
        const hasErrors = Math.random() > 0.6;
        if (!hasErrors) {
            return {
                hasErrors: false,
                original: text,
                corrected: text,
                explanation: '',
                followUp: 'Keep practicing! Try describing your daily routine.',
            };
        }

        const corrections: Record<string, { original: string; corrected: string; explanation: string }> = {
            english: { original: 'I am go to school', corrected: 'I am going to school', explanation: 'Use present continuous for actions happening now or planned.' },
            tamil: { original: 'நான் பள்ளிக்கு செல்லுகிறேன்', corrected: 'நான் பள்ளிக்கு செல்கிறேன்', explanation: 'Use present tense for general statements.' },
            sinhala: { original: 'මම පාසල් යනවා', corrected: 'මම පාසලට යනවා', explanation: 'Use correct preposition.' },
        };

        const correction = corrections[lang] || corrections.english;
        return {
            hasErrors: true,
            ...correction,
            followUp: 'Now try using this structure in a complete sentence about your plans.',
        };
    };

    const sendMessage = () => {
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

        setTimeout(() => {
            const corrections = simulateLanguageCorrection(content, selectedLanguage, selectedLevel);

            let responseText = '';
            if (corrections.hasErrors) {
                responseText = `Good attempt! Here's a correction:\n\n❌ "${corrections.original}"\n✅ "${corrections.corrected}"\n\n${corrections.explanation}\n\n`;
                setStats(prev => ({
                    ...prev,
                    corrections: [...prev.corrections, corrections],
                    grammarErrors: prev.grammarErrors + 1,
                }));
            } else {
                responseText = 'Excellent! Your grammar and vocabulary are on point. ';
            }

            responseText += corrections.followUp;

            const aiMessage: Message = {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);
        }, 1500);
    };

    const generateImprovements = (grammar: number, vocab: number, fluency: number) => {
        const improvements: string[] = [];
        if (grammar < 80) improvements.push('Focus on grammar rules - practice verb tenses daily');
        if (vocab < 80) improvements.push('Expand vocabulary - learn 5 new words each day');
        if (fluency < 80) improvements.push('Practice speaking more - try shadowing native speakers');
        if (improvements.length === 0) improvements.push('Great job! Keep practicing to maintain your skills');
        return improvements;
    };

    const endSession = () => {
        if (!currentSession) return;

        const endTime = new Date();
        const grammarScore = Math.max(60, 100 - stats.grammarErrors * 5);
        const vocabularyScore = Math.min(95, 70 + stats.messagesCount * 2);
        const fluencyScore = Math.min(95, 65 + stats.messagesCount * 1.5);
        const overallScore = Math.round((grammarScore + vocabularyScore + fluencyScore) / 3);

        const completedSession: LanguageSession = {
            ...currentSession,
            endTime,
            grammarScore,
            vocabularyScore,
            fluencyScore,
            overallScore,
            improvements: generateImprovements(grammarScore, vocabularyScore, fluencyScore),
            corrections: stats.corrections,
        };

        setHistory(prev => [completedSession, ...prev]);
        setCurrentSession(completedSession);
        setView('summary');
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
        startSession,
        sendMessage,
        endSession
    };
};