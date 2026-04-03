import React from 'react';
import { CheckCircle, RotateCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { LanguageSession } from '@/types';
import { LANGUAGE_DATA } from '@/data/mockData';

interface LanguageSummaryProps {
    session: LanguageSession;
    onRestart: () => void;
}

const ScoreCard = ({ label, score, color = "blue" }: { label: string; score: number; color?: string }) => (
    <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
        <div className={`text-3xl font-bold mb-1 text-${color}-400`}>{score}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
);

export const LanguageSummary: React.FC<LanguageSummaryProps> = ({ session, onRestart }) => {
    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="text-center mb-12 animate-fade-in">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 mb-6 shadow-xl shadow-blue-500/30">
                    <TrendingUp className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">Session Complete!</h1>
                <p className="text-gray-400">Here's how you performed in your {LANGUAGE_DATA[session.language].name} practice</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
                <ScoreCard label="Grammar" score={session.grammarScore} color="blue" />
                <ScoreCard label="Vocabulary" score={session.vocabularyScore} color="teal" />
                <ScoreCard label="Fluency" score={session.fluencyScore} color="emerald" />
            </div>

            <div className="space-y-6">
                <Card className="bg-white/[0.02] border-white/10 text-white animate-fade-up" style={{ animationDelay: '200ms' }}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            Key Improvements
                        </CardTitle>
                        <CardDescription className="text-gray-400">Focus on these areas to reach the next level</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {session.improvements.map((imp, i) => (
                                <li key={i} className="flex items-start gap-3 text-gray-300">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                                    {imp}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {session.corrections.length > 0 && (
                    <Card className="bg-white/[0.02] border-white/10 text-white animate-fade-up" style={{ animationDelay: '300ms' }}>
                        <CardHeader>
                            <CardTitle>Corrections Review</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {session.corrections.map((curr, i) => (
                                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="text-red-400 line-through text-sm mb-1">{curr.original}</div>
                                    <div className="text-green-400 font-medium mb-2">{curr.corrected}</div>
                                    <div className="text-gray-400 text-xs italic border-l-2 border-white/10 pl-3">{curr.explanation}</div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="flex justify-center mt-12 animate-fade-up" style={{ animationDelay: '400ms' }}>
                <Button onClick={onRestart} size="lg" className="bg-white text-slate-900 hover:bg-gray-100">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start New Session
                </Button>
            </div>
        </div>
    );
};