import type { AIPersonality, LanguageLower, InterviewQuestion } from '@/types';

export const MOCK_RESPONSES: Record<AIPersonality, string[]> = {
    friendly: [
        "That's really interesting! Tell me more about it.",
        "I love hearing about that! What else is on your mind?",
        "Thanks for sharing that with me!",
        "Wow, that's fascinating!",
    ],
    professional: [
        "I understand. Let me provide you with some insights.",
        "That's a valid point. Let me analyze this.",
        "I appreciate you bringing this up.",
        "Noted. Here's my perspective.",
    ],
    witty: [
        "Well, isn't that a plot twist!",
        "Ah, the classic dilemma!",
        "I'd make a joke about that...",
        "Fascinating! My circuits are buzzing.",
    ],
    empathetic: [
        "I can sense this matters to you.",
        "That sounds challenging.",
        "I hear you, and your feelings are valid.",
        "It takes courage to share that.",
    ],
    analytical: [
        "Let me break this down.",
        "Based on the data patterns...",
        "Interesting. If we analyze this...",
        "The logical conclusion would be...",
    ],
};

export const LANGUAGE_DATA: Record<LanguageLower, { name: string; flag: string; greeting: string }> = {
    english: { name: 'English', flag: '🇺🇸', greeting: 'Hello! Welcome to your English learning session.' },
    tamil: { name: 'Tamil', flag: '🇮🇳', greeting: 'வணக்கம்! உங்கள் தமிழ் கற்றல் அமர்வுக்கு வரவேற்கிறோம்.' },
    sinhala: { name: 'Sinhala', flag: '🇱🇰', greeting: 'ආයුබෝවන්! ඔබේ සිංහල ඉගෙනුම් සැසියට සාදරයෙන් පිළිගනිමු.' },
};

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
    {
        id: '1',
        question: 'Tell me about yourself and your background.',
        category: 'Introduction',
        difficulty: 'junior',
        expectedPoints: [],
        followUpQuestions: []
    },
    {
        id: '2',
        question: 'Describe a challenging project you worked on and how you handled it.',
        category: 'Problem Solving',
        difficulty: 'mid',
        expectedPoints: [],
        followUpQuestions: []
    },
    {
        id: '3',
        question: 'What are your strengths and weaknesses?',
        category: 'Self Awareness',
        difficulty: 'junior',
        expectedPoints: [],
        followUpQuestions: []
    },
    {
        id: '4',
        question: 'Explain the difference between REST and GraphQL.',
        category: 'API Design',
        difficulty: 'mid',
        expectedPoints: [],
        followUpQuestions: []
    },
    {
        id: '5',
        question: 'How do you handle state management in large applications?',
        category: 'Architecture',
        difficulty: 'senior',
        expectedPoints: [],
        followUpQuestions: []
    },
    {
        id: '6',
        question: 'Describe a time when you had a conflict with a team member.',
        category: 'Teamwork',
        difficulty: 'mid',
        expectedPoints: [],
        followUpQuestions: []
    },
];
