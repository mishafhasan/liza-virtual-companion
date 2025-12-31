
export type Language = 'English' | 'Sinhala' | 'Tamil';

// Emotion types for intelligent mood detection
export type EmotionType = 
  | 'neutral'     // Default calm state
  | 'happy'       // Excited, joyful, positive
  | 'sad'         // Down, upset, melancholic
  | 'romantic'    // Flirty, intimate, loving
  | 'stressed'    // Anxious, overwhelmed, worried
  | 'playful'     // Teasing, joking, fun
  | 'supportive'  // Comforting, caring, nurturing
  | 'curious'     // Engaged, interested, questioning
  | 'tired';      // Low energy, sleepy, drained

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
}

export interface MemoryItem {
  id: string;
  fact: string;
}

export interface ConversationTurn {
    user?: string;
    liza?: string;
    userEmotion?: EmotionType;  // Detected emotion from user
    lizaEmotion?: EmotionType;  // Liza's emotional response
}
