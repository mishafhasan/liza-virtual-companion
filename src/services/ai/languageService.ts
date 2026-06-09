import { generateJson } from './chatService';
import type { LanguageLower, ProficiencyLevel, LearningGoal } from '@/types';

/**
 * AI-powered language-tutor service.
 *
 * Replaces the previous random/simulated corrections with real Gemini-based
 * tutoring: it corrects the learner's message, explains the correction, and
 * continues the conversation with a natural follow-up.
 */

const LANGUAGE_NAMES: Record<LanguageLower, string> = {
  english: 'English',
  tamil: 'Tamil',
  sinhala: 'Sinhala',
};

export interface TutorTurnParams {
  language: LanguageLower;
  level: ProficiencyLevel;
  goal: LearningGoal;
  userMessage: string;
}

/** Structured tutor reply for a single learner message. */
export interface TutorReply {
  /** Whether the learner's message contained mistakes. */
  hasCorrection: boolean;
  /** The learner's original phrasing (echoed for display). */
  original: string;
  /** Corrected phrasing (equals original when no mistakes). */
  corrected: string;
  /** Plain-language explanation of the correction. */
  explanation: string;
  /** Encouraging conversational reply + follow-up question to keep practicing. */
  reply: string;
  /** New vocabulary words the tutor introduced this turn. */
  newVocabulary: string[];
}

/**
 * Runs one tutoring turn: correct, explain, and continue the conversation.
 * Throws on AI failure so the hook can fall back gracefully.
 */
export async function tutorRespond(params: TutorTurnParams): Promise<TutorReply> {
  const { language, level, goal, userMessage } = params;
  const languageName = LANGUAGE_NAMES[language];

  const systemInstruction = `You are a warm, encouraging ${languageName} language tutor.
You help learners improve through natural conversation. You gently correct mistakes, explain
the grammar/vocabulary rule simply, and always keep the conversation going with a follow-up
question appropriate to the learner's level. Return ONLY valid JSON.`;

  const prompt = `Learner level: ${level}. Learning goal: ${goal.replace(/-/g, ' ')}.
The learner wrote (in ${languageName}): "${userMessage}"

Assess their message and respond. Return JSON with exactly this shape:
{
  "hasCorrection": true | false,
  "original": "the learner's phrasing that needed fixing, or their full message if correct",
  "corrected": "the corrected phrasing, or the same text if already correct",
  "explanation": "a short, simple explanation of the correction (empty string if none)",
  "reply": "an encouraging conversational reply in ${languageName} appropriate to a ${level} learner, ending with a follow-up question",
  "newVocabulary": ["any new word you introduced", "..."]
}`;

  const result = await generateJson<Partial<TutorReply>>(systemInstruction, prompt, {
    temperature: 0.7,
  });

  return {
    hasCorrection: Boolean(result.hasCorrection),
    original: result.original || userMessage,
    corrected: result.corrected || userMessage,
    explanation: result.explanation || '',
    reply: result.reply || 'Great effort! Keep going — tell me more.',
    newVocabulary: Array.isArray(result.newVocabulary) ? result.newVocabulary : [],
  };
}

/**
 * Generates a personalized end-of-session summary with scores and improvement
 * areas based on the actual corrections collected during the session.
 */
export interface SessionAssessmentParams {
  language: LanguageLower;
  level: ProficiencyLevel;
  messageCount: number;
  corrections: { original: string; corrected: string; explanation: string }[];
}

export interface SessionAssessment {
  grammarScore: number;
  vocabularyScore: number;
  fluencyScore: number;
  overallScore: number;
  improvements: string[];
}

function clampScore(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function assessSession(
  params: SessionAssessmentParams,
): Promise<SessionAssessment> {
  const { language, level, messageCount, corrections } = params;
  const languageName = LANGUAGE_NAMES[language];

  const systemInstruction = `You are a ${languageName} language assessor. Based on a practice
session, you produce fair scores and actionable improvement tips. Return ONLY valid JSON.`;

  const prompt = `Session summary for a ${level} learner of ${languageName}:
- Messages exchanged: ${messageCount}
- Number of corrections needed: ${corrections.length}
- Correction details: ${corrections.length ? JSON.stringify(corrections.slice(0, 10)) : 'none'}

Return JSON with exactly this shape:
{
  "grammarScore": 0-100,
  "vocabularyScore": 0-100,
  "fluencyScore": 0-100,
  "overallScore": 0-100,
  "improvements": ["actionable tip", "..."]
}`;

  const result = await generateJson<Partial<SessionAssessment>>(systemInstruction, prompt, {
    temperature: 0.5,
  });

  const grammarScore = clampScore(result.grammarScore, Math.max(60, 100 - corrections.length * 5));
  const vocabularyScore = clampScore(result.vocabularyScore, Math.min(95, 70 + messageCount * 2));
  const fluencyScore = clampScore(result.fluencyScore, Math.min(95, 65 + messageCount * 1.5));
  const overallScore = clampScore(
    result.overallScore,
    Math.round((grammarScore + vocabularyScore + fluencyScore) / 3),
  );

  return {
    grammarScore,
    vocabularyScore,
    fluencyScore,
    overallScore,
    improvements: result.improvements?.length
      ? result.improvements
      : ['Keep practicing daily to build fluency.'],
  };
}
