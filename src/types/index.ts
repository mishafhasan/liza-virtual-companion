// ============================================
// LIZA VIRTUAL COMPANION - TYPE DEFINITIONS
// Merged: Original functional types + New UI types
// ============================================

// ============================================
// AUTHENTICATION TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  lastLoginAt: Date;
  bio?: string;
  location?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ============================================
// MODE SYSTEM TYPES
// ============================================

export type AppMode = 'entertainment' | 'language' | 'interview' | null;

export type AppPage = 'landing' | 'auth' | 'mode-selection' | 'entertainment' | 'language-onboarding' | 'language-learn' | 'language-summary' | 'interview-setup' | 'interview-session' | 'interview-history' | 'interview-summary' | 'settings';

export interface ModeTheme {
  primary: string;
  secondary: string;
  gradient: string;
  accent: string;
  background: string;
}

export const MODE_THEMES: Record<Exclude<AppMode, null>, ModeTheme> = {
  entertainment: {
    primary: 'purple-500',
    secondary: 'pink-500',
    gradient: 'from-purple-500 to-pink-500',
    accent: 'purple-600',
    background: 'bg-gradient-to-br from-purple-50 to-pink-50',
  },
  language: {
    primary: 'blue-500',
    secondary: 'teal-500',
    gradient: 'from-blue-500 to-teal-500',
    accent: 'blue-600',
    background: 'bg-gradient-to-br from-blue-50 to-teal-50',
  },
  interview: {
    primary: 'green-500',
    secondary: 'emerald-500',
    gradient: 'from-green-500 to-emerald-500',
    accent: 'green-600',
    background: 'bg-gradient-to-br from-green-50 to-emerald-50',
  },
};

// ============================================
// LANGUAGE TYPE (Unified)
// Internal functional code uses capitalized ('English' | 'Sinhala' | 'Tamil')
// New UI uses lowercase ('english' | 'sinhala' | 'tamil')
// We keep BOTH for compatibility
// ============================================

/** Language type used in the core system (system instructions, emotion analyzer, constants) */
export type Language = 'English' | 'Sinhala' | 'Tamil';

/** Lowercase language type used in UI components */
export type LanguageLower = 'english' | 'sinhala' | 'tamil';

/** Convert between language formats */
export function toLanguageUpper(lang: LanguageLower): Language {
  const map: Record<LanguageLower, Language> = {
    english: 'English',
    sinhala: 'Sinhala',
    tamil: 'Tamil',
  };
  return map[lang];
}

export function toLanguageLower(lang: Language): LanguageLower {
  return lang.toLowerCase() as LanguageLower;
}

// ============================================
// EMOTION TYPES (from original functional project)
// ============================================

export type EmotionType =
  | 'neutral' | 'happy' | 'sad' | 'romantic' | 'stressed'
  | 'playful' | 'supportive' | 'curious' | 'tired';

// Emotion state tracking for real-time adaptation
export interface EmotionState {
  userMood: EmotionType;
  lizaEmotion: EmotionType;
  confidence: number;       // 0-1 how confident in detection
  intensity: number;        // 0-100 intensity level
  emotionHistory: EmotionType[]; // Recent emotions for smoothing
  lastUpdated: number;      // Timestamp of last update
}

// Emotion analysis result from text
export interface EmotionAnalysis {
  detectedEmotion: EmotionType;
  confidence: number;
  intensity: number;
  keywords: string[];       // Matched keywords that led to detection
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface Settings {
  language: Language;
  voiceName: string;
  flirtIntensity: number; // 0-100
  emotionIntensity: number; // 0-100
  videoMode: boolean; // Enable video avatar with HeyGen
  heygenApiKey?: string; // HeyGen API key for video mode
  avatarId?: string; // HeyGen avatar ID
}

export interface CharacterProfile {
  name: string;
  personality: string;
  avatar?: string; // Base64 encoded image string
  bio?: string;
  tone?: string;
}

/**
 * Memory categories used by the extraction AI and stored in the `memories`
 * table's `category` column. Kept in sync with the union in
 * conversationService.ts (MemoryFact['category']).
 */
export type MemoryCategory =
  | 'personal_info'    // name, age, location, nationality
  | 'preference'       // likes, dislikes, hobbies, favourites
  | 'life_event'       // milestones, major events, experiences
  | 'goal'             // plans, aspirations, things they want
  | 'work_context'     // job, study, career, projects
  | 'emotion_pattern'  // recurring moods, emotional tendencies
  | 'relationship'     // family, friends, romantic life
  | 'other';           // legacy / uncategorized facts

export interface MemoryItem {
  id: string;
  /** Clean fact text, never prefixed with a category tag. */
  fact: string;
  /** Category from the extraction AI (or 'other' for legacy/manual facts). */
  category?: MemoryCategory;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'English',
  voiceName: 'Kore',
  flirtIntensity: 70,
  emotionIntensity: 80,
  videoMode: false,
  heygenApiKey: '',
  avatarId: 'default',
};

// ============================================
// CONVERSATION TYPES
// ============================================

export interface ConversationTurn {
  user?: string;
  liza?: string;
  userEmotion?: EmotionType;
  lizaEmotion?: EmotionType;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  grammarCorrections?: GrammarCorrection[];
  confidence?: number;
  processingTime?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  mode: AppMode;
}

// ============================================
// ENTERTAINMENT MODE TYPES
// ============================================

export type AIPersonality = 'friendly' | 'professional' | 'witty' | 'empathetic' | 'analytical';

export interface EntertainmentSession {
  id: string;
  personality: AIPersonality;
  mood: 'funny' | 'serious' | 'creative' | 'supportive';
  topic?: string;
}

// ============================================
// LANGUAGE LEARNING MODE TYPES
// ============================================

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'fluent';

export type LearningGoal = 'conversation' | 'business' | 'travel' | 'academic' | 'exam' | 'work' | 'study' | 'daily-practice';

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanation: string;
  rule?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface LanguageProfile {
  targetLanguage: LanguageLower;
  nativeLanguage: LanguageLower;
  proficiencyLevel: ProficiencyLevel;
  goal: LearningGoal;
  dailyGoalMinutes: number;
  streakDays: number;
}

export interface LanguageSession {
  id: string;
  language: LanguageLower;
  level: ProficiencyLevel;
  goal: LearningGoal;
  startTime: Date;
  endTime?: Date;
  messages: Message[];
  grammarScore: number;
  vocabularyScore: number;
  fluencyScore: number;
  overallScore: number;
  improvements: string[];
  corrections: { original: string; corrected: string; explanation: string }[];
}

// ============================================
// MOCK INTERVIEW MODE TYPES
// ============================================

export type InterviewType = 'behavioral' | 'technical' | 'mixed';
export type InterviewDifficulty = 'junior' | 'mid' | 'senior' | 'lead' | 'basic' | 'intermediate' | 'advanced' | 'expert';

export type InterviewRole =
  | 'frontend' | 'backend' | 'fullstack' | 'devops'
  | 'data-scientist' | 'product-manager' | 'software-engineer'
  | 'ux-designer' | 'custom';

export type InterviewStatus = 'setup' | 'in-progress' | 'paused' | 'completed' | 'cancelled';

export interface InterviewConfig {
  role: InterviewRole;
  difficulty: InterviewDifficulty;
  jobDescription: string;
  resumeText: string;
  durationMinutes: number;
  focusAreas: string[];
}

export interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: InterviewDifficulty;
  expectedPoints: string[];
  followUpQuestions?: string[];
  type?: 'behavioral' | 'technical';
}

export interface InterviewAnswer {
  questionId: string;
  answer: string;
  duration: number;
  timestamp: Date;
}

export interface InterviewFeedback {
  questionId: string;
  strengths: string[];
  weaknesses: string[];
  improvedAnswer: string;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  keyTakeaways: string[];
}

export interface InterviewSession {
  id: string;
  config: InterviewConfig;
  status: InterviewStatus;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  feedbacks: InterviewFeedback[];
  currentQuestionIndex: number;
  startTime?: Date;
  endTime?: Date;
  overallScore?: number;
}

export interface InterviewSummary {
  sessionId: string;
  role: InterviewRole;
  difficulty: InterviewDifficulty;
  date: Date;
  duration: number;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  totalQuestions: number;
  answeredQuestions: number;
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
}

// ============================================
// UI / COMPONENT TYPES
// ============================================

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  mode: AppMode;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// ============================================
// UTILITY TYPES
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';
