import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type {
    InterviewRole, InterviewDifficulty, InterviewType, InterviewSession,
    InterviewQuestion, InterviewAnswer, InterviewFeedback
} from '@/types';
import {
    generateInterviewQuestions,
    evaluateAnswer,
    FALLBACK_QUESTIONS,
} from '@/services/ai/interviewService';
import {
    createSession,
    closeSession,
    saveTurn,
} from '@/services/supabase/conversationService';
import { hasGeminiKey, hasSupabase } from '@/config/env';

/** AI is available if we can reach Gemini directly or via the Supabase proxy. */
const aiAvailable = (): boolean => hasGeminiKey() || hasSupabase();

/**
 * Interview session hook — now powered by real Gemini AI.
 *
 * Questions are generated for the candidate's role/seniority/job context, and
 * each answer is evaluated by the model for content-aware feedback and scoring.
 * The public API is unchanged from the original mock so the view layer is
 * untouched.
 */
export const useInterviewSession = () => {
    const [selectedRole, setSelectedRole] = useState<InterviewRole>('frontend');
    const [customRole, setCustomRole] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState<InterviewDifficulty>('mid');
    const [interviewType, setInterviewType] = useState<InterviewType>('mixed' as InterviewType);

    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [resumeText, setResumeText] = useState('');

    const [input, setInput] = useState('');
    const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
    const [, setHistory] = useState<InterviewSession[]>([]);

    const [showFeedback, setShowFeedback] = useState(false);
    const [currentFeedback, setCurrentFeedback] = useState<InterviewFeedback | null>(null);
    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);

    const [view, setView] = useState<'setup' | 'session' | 'summary'>('setup');

    // Supabase session UUID for this interview.
    const dbSessionId = useRef<string | null>(null);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (view === 'session' && currentSession) {
            interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [view, currentSession]);

    const roleLabel = selectedRole === 'custom' && customRole.trim()
        ? customRole.trim()
        : selectedRole.replace(/-/g, ' ');

    const startSession = async () => {
        setLoading(true);
        let questions: InterviewQuestion[];

        try {
            if (!aiAvailable()) {
                throw new Error('AI not configured');
            }
            questions = await generateInterviewQuestions({
                role: selectedRole,
                customRole,
                difficulty: selectedDifficulty,
                interviewType,
                companyName,
                jobDescription,
                resumeText,
            });
            if (questions.length === 0) questions = FALLBACK_QUESTIONS;
        } catch (error) {
            console.error('Falling back to built-in questions:', error);
            questions = FALLBACK_QUESTIONS;
            toast.message('Using sample questions', {
                description: 'AI question generation is unavailable, so a starter set is being used.',
            });
        }

        const session: InterviewSession = {
            id: 'int-' + Date.now(),
            config: {
                role: selectedRole,
                difficulty: selectedDifficulty,
                jobDescription,
                resumeText,
                durationMinutes: 30,
                focusAreas: [],
            },
            status: 'in-progress',
            questions,
            answers: [],
            feedbacks: [],
            currentQuestionIndex: 0,
            startTime: new Date(),
        };

        // Create DB session row.
        const title = `${roleLabel} Interview`;
        const sid = await createSession('interview', title, {
            role: selectedRole,
            difficulty: selectedDifficulty,
            interviewType,
            companyName,
        });
        if (sid) {
            session.id = sid;
            dbSessionId.current = sid;
            // Log the first question as a liza turn.
            await saveTurn(sid, 'liza', questions[0].question);
        }

        setCurrentSession(session);
        setElapsedTime(0);
        setLoading(false);
        setView('session');
        toast.success('Interview session started! Good luck!');
    };

    const submitAnswer = async () => {
        if (!input.trim() || !currentSession) return;

        const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex];
        const answerText = input;
        const answer: InterviewAnswer = {
            questionId: currentQuestion.id,
            answer: answerText,
            duration: 0,
            timestamp: new Date(),
        };

        setCurrentSession(prev => prev ? {
            ...prev,
            answers: [...prev.answers, answer],
        } : null);

        setLoading(true);

        let feedback: InterviewFeedback;
        try {
            const evaluation = await evaluateAnswer(currentQuestion, answerText, roleLabel);
            feedback = { questionId: currentQuestion.id, ...evaluation };
        } catch (error) {
            console.error('Answer evaluation failed:', error);
            feedback = buildFallbackFeedback(answerText, currentQuestion.id);
            toast.message('Showing basic feedback', {
                description: 'AI evaluation is unavailable right now.',
            });
        }

        setCurrentFeedback(feedback);
        setCurrentSession(prev => prev ? {
            ...prev,
            feedbacks: [...prev.feedbacks, feedback],
        } : null);
        setShowFeedback(true);
        setLoading(false);

        // Persist: user answer + feedback summary as liza turn.
        if (dbSessionId.current) {
            await saveTurn(dbSessionId.current, 'user', answerText);
            const feedbackSummary = `Scores — Technical: ${feedback.technicalScore}, Communication: ${feedback.communicationScore}, Confidence: ${feedback.confidenceScore}`;
            await saveTurn(dbSessionId.current, 'liza', feedbackSummary);
        }
    };

    const nextQuestion = () => {
        setShowFeedback(false);
        setInput('');

        if (currentSession && currentSession.currentQuestionIndex < currentSession.questions.length - 1) {
            const nextIdx = currentSession.currentQuestionIndex + 1;
            setCurrentSession(prev => prev ? {
                ...prev,
                currentQuestionIndex: nextIdx,
            } : null);
            // Log next question as liza turn.
            if (dbSessionId.current) {
                const nextQ = currentSession.questions[nextIdx];
                saveTurn(dbSessionId.current, 'liza', nextQ.question);
            }
        } else {
            completeSession();
        }
    };

    const completeSession = async () => {
        if (!currentSession) return;
        const endTime = new Date();

        const feedbacks = currentSession.feedbacks;
        const overallScore = feedbacks.length > 0
            ? Math.round(
                feedbacks.reduce((sum, f) => sum + f.technicalScore + f.communicationScore + f.confidenceScore, 0)
                / (feedbacks.length * 3),
            )
            : 0;

        const completed: InterviewSession = {
            ...currentSession,
            endTime,
            status: 'completed',
            overallScore,
        };

        setHistory(prev => [completed, ...prev]);
        setCurrentSession(completed);
        setView('summary');

        // Close the DB session with summary metadata.
        if (dbSessionId.current) {
            await closeSession(dbSessionId.current, { overallScore });
            dbSessionId.current = null;
        }

        toast.success('Interview completed!');
    };

    return {
        view, setView,
        selectedRole, setSelectedRole,
        customRole, setCustomRole,
        selectedDifficulty, setSelectedDifficulty,
        interviewType, setInterviewType,
        companyName, setCompanyName,
        jobDescription, setJobDescription,
        resumeText, setResumeText,
        input, setInput,
        currentSession,
        loading,
        elapsedTime,
        showFeedback,
        currentFeedback,
        startSession,
        submitAnswer,
        nextQuestion,
    };
};

/** Builds heuristic feedback when AI evaluation is unavailable. */
function buildFallbackFeedback(answerText: string, questionId: string): InterviewFeedback {
    const wordCount = answerText.trim().split(/\s+/).length;
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (wordCount > 50) strengths.push('Good level of detail provided');
    else weaknesses.push('Answer could be more detailed');
    if (/\b(example|instance|project|when i|we)\b/i.test(answerText)) {
        strengths.push('Includes concrete examples');
    } else {
        weaknesses.push('Add a specific example to strengthen your answer');
    }

    const base = Math.min(90, 55 + Math.floor(wordCount / 4));
    return {
        questionId,
        strengths: strengths.length ? strengths : ['Stayed on topic'],
        weaknesses: weaknesses.length ? weaknesses : ['Expand with more structure'],
        improvedAnswer: 'Structure your answer using the STAR method: Situation, Task, Action, Result.',
        keyTakeaways: ['Be concise', 'Use real examples'],
        technicalScore: base,
        communicationScore: Math.min(95, base + (wordCount > 40 ? 5 : -5)),
        confidenceScore: Math.min(95, answerText.length > 150 ? base + 5 : base - 5),
    };
}
