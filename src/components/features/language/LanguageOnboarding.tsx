import React from 'react';
import { Brain, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { LanguageLower as Language, ProficiencyLevel, LearningGoal } from '@/types';
import { LANGUAGE_DATA } from '@/data/mockData';

interface LanguageOnboardingProps {
    step: number;
    setStep: (step: number) => void;
    selectedLanguage: Language;
    setSelectedLanguage: (lang: Language) => void;
    selectedLevel: ProficiencyLevel;
    setSelectedLevel: (level: ProficiencyLevel) => void;
    selectedGoal: LearningGoal;
    setSelectedGoal: (goal: LearningGoal) => void;
    onStart: () => void;
}

export const LanguageOnboarding: React.FC<LanguageOnboardingProps> = ({
    step, setStep,
    selectedLanguage, setSelectedLanguage,
    selectedLevel, setSelectedLevel,
    selectedGoal, setSelectedGoal,
    onStart
}) => {
    const languages: Language[] = ['english', 'tamil', 'sinhala'];
    const levels: ProficiencyLevel[] = ['beginner', 'intermediate', 'advanced', 'fluent'];
    const goals: LearningGoal[] = ['daily-practice', 'travel', 'work', 'study'];

    return (
        <div className="max-w-xl mx-auto w-full">
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                    <Brain className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Configure Your Session</h1>
                <p className="text-gray-400">Step {step} of 3</p>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                <Progress value={step * 33.33} className="h-2 bg-white/5 mb-8" />

                <div className="min-h-[300px]">
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <h2 className="text-xl font-semibold text-white mb-6">Select a Language</h2>
                            <div className="grid gap-3">
                                {languages.map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => setSelectedLanguage(lang)}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedLanguage === lang
                                            ? 'bg-blue-500/20 border-blue-500/50 text-white'
                                            : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="text-2xl">{LANGUAGE_DATA[lang].flag}</span>
                                        <div className="text-left">
                                            <div className="font-semibold">{LANGUAGE_DATA[lang].name}</div>
                                            <div className="text-xs opacity-60">{LANGUAGE_DATA[lang].greeting}</div>
                                        </div>
                                        {selectedLanguage === lang && <div className="ml-auto w-2 h-2 rounded-full bg-blue-400" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <h2 className="text-xl font-semibold text-white mb-6">Your Proficiency Level</h2>
                            <div className="grid gap-3">
                                {levels.map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setSelectedLevel(level)}
                                        className={`p-4 rounded-xl border text-left transition-all ${selectedLevel === level
                                            ? 'bg-blue-500/20 border-blue-500/50 text-white'
                                            : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="font-semibold capitalize mb-1">{level}</div>
                                        <div className="text-xs opacity-60">
                                            {level === 'beginner' && 'I know basic words and greetings'}
                                            {level === 'intermediate' && 'I can have simple conversations'}
                                            {level === 'advanced' && 'I can express complex ideas'}
                                            {level === 'fluent' && 'I speak like a native'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            <h2 className="text-xl font-semibold text-white mb-6">Learning Goal</h2>
                            <div className="grid gap-3">
                                {goals.map((goal) => (
                                    <button
                                        key={goal}
                                        onClick={() => setSelectedGoal(goal)}
                                        className={`p-4 rounded-xl border text-left transition-all ${selectedGoal === goal
                                            ? 'bg-blue-500/20 border-blue-500/50 text-white'
                                            : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="font-semibold capitalize mb-1">{goal.replace('-', ' ')}</div>
                                        <div className="text-xs opacity-60">
                                            {goal === 'daily-practice' && 'Improve general fluency and vocabulary'}
                                            {goal === 'travel' && 'Navigate airports, hotels, and restaurants'}
                                            {goal === 'work' && 'Professional communication and business terms'}
                                            {goal === 'study' && 'Academic vocabulary and grammar'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-gray-400">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
                        <Button onClick={() => setStep(step + 1)} className="bg-gradient-to-r from-blue-500 to-teal-500 text-white">
                            Continue
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={onStart} className="bg-gradient-to-r from-blue-500 to-teal-500 text-white">
                            Start Session
                            <Brain className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};