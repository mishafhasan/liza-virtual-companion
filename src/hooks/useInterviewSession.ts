import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type {
    InterviewRole, InterviewDifficulty, InterviewType, InterviewSession,
    InterviewQuestion, InterviewAnswer
} from '@/types';
import { INTERVIEW_QUESTIONS } from '@/data/mockData';

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
    const [currentFeedback, setCurrentFeedback] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);

    const [view, setView] = useState<'setup' | 'session' | 'summary'>('setup');

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (view === 'session' && currentSession) {
            interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [view, currentSession]);

    const generateInterviewQuestions = (): InterviewQuestion[] => {
        let filtered = INTERVIEW_QUESTIONS;
        if (interviewType === 'behavioral') {
            filtered = INTERVIEW_QUESTIONS.filter(q => q.category === 'Behavioral' || q.type === 'behavioral');
        } else if (interviewType === 'technical') {
            filtered = INTERVIEW_QUESTIONS.filter(q => q.type === 'technical');
        }

        const roleQuestions: InterviewQuestion[] = [
            { id: 'role-1', question: `As a ${selectedRole === 'custom' ? customRole : selectedRole}, how do you approach code reviews?`, category: 'Best Practices', difficulty: 'mid', expectedPoints: [], type: 'technical' },
            { id: 'role-2', question: 'Describe your experience with agile development methodologies.', category: 'Process', difficulty: 'mid', expectedPoints: [], type: 'behavioral' },
        ];

        return [...filtered.slice(0, 4), ...roleQuestions];
    };

    const startSession = () => {
        setLoading(true);
        setTimeout(() => {
            const questions = generateInterviewQuestions();
            const session: InterviewSession = {
                id: 'int-' + Date.now(),
                config: {
                    role: selectedRole,
                    difficulty: selectedDifficulty,
                    jobDescription,
                    resumeText,
                    durationMinutes: 30,
                    focusAreas: []
                },
                status: 'in-progress',
                questions,
                answers: [],
                feedbacks: [],
                currentQuestionIndex: 0,
                startTime: new Date()
            };

            setCurrentSession(session);
            setElapsedTime(0);
            setLoading(false);
            setView('session');
            toast.success('Interview session started! Good luck!');
        }, 1500);
    };

    const submitAnswer = () => {
        if (!input.trim() || !currentSession) return;

        const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex];
        const answer: InterviewAnswer = {
            questionId: currentQuestion.id,
            answer: input,
            duration: 0,
            timestamp: new Date(),
        };

        setCurrentSession(prev => prev ? {
            ...prev,
            answers: [...prev.answers, answer],
        } : null);

        setLoading(true);

        setTimeout(() => {
            const feedback = generateFeedback(input, currentQuestion);
            setCurrentFeedback(feedback);

            setCurrentSession(prev => prev ? {
                ...prev,
                feedbacks: [...prev.feedbacks, feedback]
            } : null);

            setShowFeedback(true);
            setLoading(false);
        }, 2000);
    };

    const generateFeedback = (answerText: string, question: InterviewQuestion) => {
        const wordCount = answerText.split(' ').length;
        const strengths = [];
        const weaknesses = [];

        if (wordCount > 50) strengths.push('Good level of detail provided');
        else weaknesses.push('Answer could be more detailed');

        const technicalScore = Math.round(70 + Math.random() * 25);
        const communicationScore = Math.round(wordCount > 40 ? 75 + Math.random() * 20 : 60 + Math.random() * 20);
        const confidenceScore = Math.round(answerText.length > 150 ? 70 + Math.random() * 25 : 55 + Math.random() * 25);

        return {
            questionId: question.id,
            strengths,
            weaknesses,
            improvedAnswer: "Here is a better answer...",
            keyTakeaways: ["Keep it concise", "Use examples"],
            technicalScore,
            communicationScore,
            confidenceScore
        };
    };

    const nextQuestion = () => {
        setShowFeedback(false);
        setInput('');

        if (currentSession && currentSession.currentQuestionIndex < currentSession.questions.length - 1) {
            setCurrentSession(prev => prev ? {
                ...prev,
                currentQuestionIndex: prev.currentQuestionIndex + 1
            } : null);
        } else {
            completeSession();
        }
    };

    const completeSession = () => {
        if (!currentSession) return;
        const endTime = new Date();

        const feedbacks = currentSession.feedbacks;
        const overallScore = feedbacks.length > 0
            ? Math.round(feedbacks.reduce((sum, f) => sum + f.technicalScore + f.communicationScore + f.confidenceScore, 0) / (feedbacks.length * 3))
            : 0;

        const completed: InterviewSession = {
            ...currentSession,
            endTime,
            status: 'completed',
            overallScore
        };

        setHistory(prev => [completed, ...prev]);
        setCurrentSession(completed);
        setView('summary');
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
        nextQuestion
    };
};