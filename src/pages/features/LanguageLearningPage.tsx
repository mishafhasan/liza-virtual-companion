import React from 'react';
import { useLanguageSession } from '@/hooks/useLanguageSession';
import { LanguageOnboarding } from '@/components/features/language/LanguageOnboarding';
import { LanguageSessionView } from '@/components/features/language/LanguageSessionView';
import { LanguageSummary } from '@/components/features/language/LanguageSummary';

export const LanguageLearningPage: React.FC = () => {
    const {
        view, setView,
        step, setStep,
        selectedLanguage, setSelectedLanguage,
        selectedLevel, setSelectedLevel,
        selectedGoal, setSelectedGoal,
        input, setInput,
        messages,
        currentSession,
        startSession,
        sendMessage,
        endSession
    } = useLanguageSession();

    if (view === 'onboarding') {
        return (
            <div className="min-h-[calc(100vh-65px)] bg-slate-950 flex items-center justify-center p-6">
                <LanguageOnboarding
                    step={step}
                    setStep={setStep}
                    selectedLanguage={selectedLanguage}
                    setSelectedLanguage={setSelectedLanguage}
                    selectedLevel={selectedLevel}
                    setSelectedLevel={setSelectedLevel}
                    selectedGoal={selectedGoal}
                    setSelectedGoal={setSelectedGoal}
                    onStart={startSession}
                />
            </div>
        );
    }

    if (view === 'session') {
        return (
            <LanguageSessionView
                session={currentSession}
                messages={messages}
                input={input}
                setInput={setInput}
                onSend={sendMessage}
                onEndSession={endSession}
            />
        );
    }

    if (view === 'summary') {
        return (
            <div className="min-h-[calc(100vh-65px)] bg-slate-950 p-6">
                <LanguageSummary
                    session={currentSession!}
                    onRestart={() => {
                        setView('onboarding');
                        setStep(1);
                    }}
                />
            </div>
        );
    }

    return null;
};
