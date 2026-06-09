import { generateJson } from './chatService';
import type {
  InterviewRole,
  InterviewDifficulty,
  InterviewType,
  InterviewQuestion,
} from '@/types';

/**
 * AI-powered mock-interview service.
 *
 * Replaces the previous hardcoded question bank and `Math.random()` scoring
 * with real Gemini-generated questions and answer evaluation. All model output
 * is requested as JSON and defensively parsed by {@link generateJson}.
 */

export interface GenerateQuestionsParams {
  role: InterviewRole;
  customRole?: string;
  difficulty: InterviewDifficulty;
  interviewType: InterviewType;
  companyName?: string;
  jobDescription?: string;
  resumeText?: string;
  count?: number;
}

/** Shape of a single answer evaluation returned by the model. */
export interface AnswerEvaluation {
  strengths: string[];
  weaknesses: string[];
  improvedAnswer: string;
  keyTakeaways: string[];
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
}

function resolveRoleLabel(role: InterviewRole, customRole?: string): string {
  if (role === 'custom' && customRole?.trim()) return customRole.trim();
  return role.replace(/-/g, ' ');
}

/**
 * Generates a tailored set of interview questions for the given role/context.
 * Falls back to a small built-in set if the AI call fails, so the session can
 * always start.
 */
export async function generateInterviewQuestions(
  params: GenerateQuestionsParams,
): Promise<InterviewQuestion[]> {
  const {
    role,
    customRole,
    difficulty,
    interviewType,
    companyName,
    jobDescription,
    resumeText,
    count = 6,
  } = params;

  const roleLabel = resolveRoleLabel(role, customRole);

  const systemInstruction = `You are an expert technical recruiter and interviewer.
You generate realistic, high-quality interview questions tailored to a candidate's role,
seniority, and the specific job. Return ONLY valid JSON.`;

  const prompt = `Generate ${count} interview questions for a ${difficulty} ${roleLabel} role.
Interview type: ${interviewType} (behavioral, technical, or a mix).
${companyName ? `Company: ${companyName}.` : ''}
${jobDescription ? `Job description: ${jobDescription}.` : ''}
${resumeText ? `Candidate resume highlights: ${resumeText.slice(0, 2000)}.` : ''}

Mix question categories appropriately for the interview type. For technical interviews favor
technical questions; for behavioral favor behavioral; for mixed, balance them.

Return a JSON array where each item has exactly this shape:
{
  "question": "the question text",
  "category": "short category label, e.g. 'System Design' or 'Teamwork'",
  "type": "technical" | "behavioral",
  "expectedPoints": ["key point a strong answer covers", "..."]
}`;

  const raw = await generateJson<
    Array<{
      question: string;
      category: string;
      type?: 'technical' | 'behavioral';
      expectedPoints?: string[];
    }>
  >(systemInstruction, prompt, { temperature: 0.8 });

  return raw.map((q, index) => ({
    id: `q-${Date.now()}-${index}`,
    question: q.question,
    category: q.category || 'General',
    difficulty,
    type: q.type === 'behavioral' ? 'behavioral' : 'technical',
    expectedPoints: Array.isArray(q.expectedPoints) ? q.expectedPoints : [],
    followUpQuestions: [],
  }));
}

/** Clamps a numeric score into the 0–100 range, defaulting to 70 if invalid. */
function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Evaluates a candidate's answer to a question and returns structured feedback
 * with realistic, content-aware scoring.
 */
export async function evaluateAnswer(
  question: InterviewQuestion,
  answer: string,
  roleLabel: string,
): Promise<AnswerEvaluation> {
  const systemInstruction = `You are a fair but rigorous interview coach. You evaluate candidate
answers honestly, highlighting concrete strengths and specific, actionable improvements.
Scores reflect real interview standards. Return ONLY valid JSON.`;

  const prompt = `Role: ${roleLabel}.
Question (${question.category}): "${question.question}"
${question.expectedPoints.length ? `A strong answer would cover: ${question.expectedPoints.join('; ')}.` : ''}

Candidate's answer:
"""
${answer}
"""

Evaluate the answer. Return JSON with exactly this shape:
{
  "strengths": ["specific strength", "..."],
  "weaknesses": ["specific area to improve", "..."],
  "improvedAnswer": "a concise, model answer the candidate could give",
  "keyTakeaways": ["short actionable tip", "..."],
  "technicalScore": 0-100,
  "communicationScore": 0-100,
  "confidenceScore": 0-100
}`;

  const result = await generateJson<Partial<AnswerEvaluation>>(systemInstruction, prompt, {
    temperature: 0.6,
  });

  return {
    strengths: result.strengths?.length ? result.strengths : ['Provided a relevant response.'],
    weaknesses: result.weaknesses?.length ? result.weaknesses : ['Add more concrete detail and examples.'],
    improvedAnswer: result.improvedAnswer || 'Consider structuring your answer with a clear situation, action, and result.',
    keyTakeaways: result.keyTakeaways?.length ? result.keyTakeaways : ['Be specific', 'Use examples'],
    technicalScore: clampScore(result.technicalScore),
    communicationScore: clampScore(result.communicationScore),
    confidenceScore: clampScore(result.confidenceScore),
  };
}

/** A minimal fallback question set used when AI generation is unavailable. */
export const FALLBACK_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'fallback-1',
    question: 'Tell me about yourself and your background.',
    category: 'Introduction',
    difficulty: 'mid',
    type: 'behavioral',
    expectedPoints: ['Relevant experience', 'Career motivation', 'Fit for the role'],
    followUpQuestions: [],
  },
  {
    id: 'fallback-2',
    question: 'Describe a challenging project you worked on and how you handled it.',
    category: 'Problem Solving',
    difficulty: 'mid',
    type: 'behavioral',
    expectedPoints: ['Clear problem', 'Your specific actions', 'Measurable outcome'],
    followUpQuestions: [],
  },
  {
    id: 'fallback-3',
    question: 'What are your greatest strengths and how do they apply to this role?',
    category: 'Self Awareness',
    difficulty: 'junior',
    type: 'behavioral',
    expectedPoints: ['Concrete strengths', 'Evidence', 'Relevance to role'],
    followUpQuestions: [],
  },
];
