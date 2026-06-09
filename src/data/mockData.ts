import type { LanguageLower } from '@/types';

/**
 * Static reference data for the Language Learning mode.
 *
 * Note: the former `MOCK_RESPONSES` and `INTERVIEW_QUESTIONS` exports were
 * removed when entertainment chat, interviews, and language tutoring became
 * real Gemini-powered features. This is genuine UI metadata (display names,
 * flags, localized greetings), not simulated AI output.
 */
export const LANGUAGE_DATA: Record<LanguageLower, { name: string; flag: string; greeting: string }> = {
    english: { name: 'English', flag: '🇺🇸', greeting: 'Hello! Welcome to your English learning session.' },
    tamil: { name: 'Tamil', flag: '🇮🇳', greeting: 'வணக்கம்! உங்கள் தமிழ் கற்றல் அமர்வுக்கு வரவேற்கிறோம்.' },
    sinhala: { name: 'Sinhala', flag: '🇱🇰', greeting: 'ආයුබෝවන්! ඔබේ සිංහල ඉගෙනුම් සැසියට සාදරයෙන් පිළිගනිමු.' },
};
