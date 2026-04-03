import React from 'react';
import { RotateCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InterviewSession } from '@/types';

interface InterviewSummaryProps {
    session: InterviewSession;
    onRestart: () => void;
}

const ScoreRing = ({ score, label, color = "green" }: { score: number; label: string; color?: string }) => (
    <div className="flex flex-col items-center">
        <div className={`relative w-24 h-24 rounded-full border-4 border-${color}-900 flex items-center justify-center mb-3`}>
            <span className={`text-2xl font-bold text-${color}-400`}>{score}%</span>
            <div className={`absolute inset-0 rounded-full border-4 border-${color}-500 border-l-transparent rotate-45 transform`} style={{ opacity: 0.5 }} />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
    </div>
);

export const InterviewSummary: React.FC<InterviewSummaryProps> = ({ session, onRestart }) => {
    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 mb-6 shadow-xl shadow-green-500/30">
                    <TrendingUp className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">Interview Complete</h1>
                <p className="text-gray-400">Great job! Here is your performance analysis.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
                <h2 className="text-xl font-semibold text-white mb-8 text-center">Performance Overview</h2>
                <div className="flex justify-center gap-12 flex-wrap">
                    <ScoreRing score={session.overallScore || 0} label="Overall" color="green" />
                </div>
            </div>

            <div className="text-center">
                <Button onClick={onRestart} size="lg" className="bg-white text-slate-900 hover:bg-gray-100">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start New Interview
                </Button>
            </div>
        </div>
    );
};