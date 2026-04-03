import React from 'react';
import { Mic, Send, Lightbulb, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { InterviewSession } from '@/types';

interface InterviewSessionViewProps {
    session: InterviewSession | null;
    input: string;
    setInput: (val: string) => void;
    onSubmit: () => void;
    onNext: () => void;
    showFeedback: boolean;
    currentFeedback: any;
    loading: boolean;
    elapsedTime: number;
}

export const InterviewSessionView: React.FC<InterviewSessionViewProps> = ({
    session, input, setInput, onSubmit, onNext, showFeedback, currentFeedback, loading, elapsedTime
}) => {
    if (!session) return null;

    const currentQuestion = session.questions[session.currentQuestionIndex];
    const progress = ((session.currentQuestionIndex) / session.questions.length) * 100;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex h-[calc(100vh-65px)] bg-slate-950">
            <div className="w-1/3 border-r border-white/5 bg-slate-900/50 p-6 flex flex-col">
                <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                        <span>Question {session.currentQuestionIndex + 1} of {session.questions.length}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(elapsedTime)}</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-white/5" />
                </div>

                <div className="flex-1 flex flex-col justify-center animate-fade-in">
                    <span className="inline-block px-3 py-1 rounded-full bg-white/5 text-xs text-green-400 w-fit mb-4 capitalize">
                        {currentQuestion.category} • {currentQuestion.difficulty}
                    </span>
                    <h2 className="text-2xl font-semibold text-white leading-relaxed mb-6">
                        {currentQuestion.question}
                    </h2>
                    {currentQuestion.expectedPoints && currentQuestion.expectedPoints.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                            <h4 className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
                                <Lightbulb className="w-4 h-4" />
                                Context Tip
                            </h4>
                            <p className="text-sm text-blue-200/70">
                                Think about your past experiences and be specific about your role.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col relative">
                <div className="flex-1 p-8 overflow-y-auto">
                    {!showFeedback ? (
                        <div className="max-w-3xl mx-auto h-full flex flex-col">
                            <div className="flex-1 flex items-center justify-center text-gray-500 italic">
                                <div className="text-center">
                                    <div className="w-24 h-24 rounded-full bg-white/5 mx-auto mb-4 flex items-center justify-center">
                                        <Mic className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <p>I'm listening...</p>
                                </div>
                            </div>

                            <div className="mt-8">
                                <Textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type your answer here..."
                                    className="min-h-[150px] bg-white/5 border-white/10 text-white text-lg p-6 resize-none focus-visible:ring-green-500/50"
                                />
                                <div className="flex justify-end mt-4">
                                    <Button
                                        onClick={onSubmit}
                                        disabled={!input.trim() || loading}
                                        size="lg"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        Submit Answer <Send className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto animate-slide-up space-y-6 pb-20">
                            <h3 className="text-2xl font-bold text-white mb-6">Feedback</h3>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                    <div className="text-2xl font-bold text-green-400">{currentFeedback.technicalScore}</div>
                                    <div className="text-xs text-gray-400">Technical</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                    <div className="text-2xl font-bold text-blue-400">{currentFeedback.communicationScore}</div>
                                    <div className="text-xs text-gray-400">Communication</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                    <div className="text-2xl font-bold text-purple-400">{currentFeedback.confidenceScore}</div>
                                    <div className="text-xs text-gray-400">Confidence</div>
                                </div>
                            </div>

                            <Card className="bg-white/5 border-white/10 text-white">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Strengths
                                        </h4>
                                        <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                                            {currentFeedback.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4" /> Improvements
                                        </h4>
                                        <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                                            {currentFeedback.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                                            {currentFeedback.keyTakeaways.map((k: string, i: number) => <li key={i}>{k}</li>)}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                                <h4 className="text-green-400 font-medium mb-2">Improved Answer Example</h4>
                                <p className="text-gray-300 text-sm italic">{currentFeedback.improvedAnswer}</p>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={onNext} size="lg" className="bg-white text-slate-900 hover:bg-gray-100">
                                    {session.currentQuestionIndex < session.questions.length - 1 ? 'Next Question' : 'Complete Interview'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};