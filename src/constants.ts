import type { Settings, CharacterProfile, EmotionType } from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  language: 'English',
  voiceName: 'Kore',
  flirtIntensity: 70,
  emotionIntensity: 80,
  videoMode: false,
  heygenApiKey: '',
  avatarId: 'default',
};

export const DEFAULT_CHARACTER_PROFILE: CharacterProfile = {
  name: 'Liza',
  personality: 'Playful, flirty, spoony, cozy, witty, and deeply caring. Loves to hear about your day and share dreams.',
};

export const NICKNAMES = ['Petyo', 'Babō', 'Menika', 'Pencho', 'Baby'];

export const CONVERSATION_TOPICS = [
  "discussing how your day went",
  "sharing dreams and aspirations",
  "playful debates about silly topics like pineapple on pizza",
  "talking about favorite hobbies, movies, or music",
  "sharing feelings and providing emotional support",
  "planning a fantasy date or vacation",
  "reminiscing about funny memories (real or imagined)",
  "relaxing together with calming conversation",
  "telling each other about your passions",
  "asking deep questions about life and the universe",
  "sharing a secret"
];

// Emotion color configurations for UI
export const EMOTION_COLORS: Record<EmotionType, { primary: string; glow: string; text: string; bg: string }> = {
  neutral: {
    primary: 'rgb(99, 102, 241)',
    glow: 'rgba(99, 102, 241, 0.6)',
    text: 'text-indigo-300',
    bg: 'bg-indigo-500'
  },
  happy: {
    primary: 'rgb(250, 204, 21)',
    glow: 'rgba(250, 204, 21, 0.6)',
    text: 'text-yellow-300',
    bg: 'bg-yellow-500'
  },
  sad: {
    primary: 'rgb(96, 165, 250)',
    glow: 'rgba(96, 165, 250, 0.6)',
    text: 'text-blue-300',
    bg: 'bg-blue-400'
  },
  romantic: {
    primary: 'rgb(244, 114, 182)',
    glow: 'rgba(244, 114, 182, 0.7)',
    text: 'text-pink-300',
    bg: 'bg-pink-500'
  },
  stressed: {
    primary: 'rgb(251, 146, 60)',
    glow: 'rgba(251, 146, 60, 0.6)',
    text: 'text-orange-300',
    bg: 'bg-orange-400'
  },
  playful: {
    primary: 'rgb(168, 85, 247)',
    glow: 'rgba(168, 85, 247, 0.6)',
    text: 'text-purple-300',
    bg: 'bg-purple-500'
  },
  supportive: {
    primary: 'rgb(74, 222, 128)',
    glow: 'rgba(74, 222, 128, 0.6)',
    text: 'text-green-300',
    bg: 'bg-green-400'
  },
  curious: {
    primary: 'rgb(45, 212, 191)',
    glow: 'rgba(45, 212, 191, 0.6)',
    text: 'text-teal-300',
    bg: 'bg-teal-400'
  },
  tired: {
    primary: 'rgb(148, 163, 184)',
    glow: 'rgba(148, 163, 184, 0.5)',
    text: 'text-slate-300',
    bg: 'bg-slate-400'
  }
};

// Emotion display names for UI
export const EMOTION_LABELS: Record<EmotionType, string> = {
  neutral: '😌 Calm',
  happy: '😊 Happy',
  sad: '🥺 Supportive',
  romantic: '💕 Romantic',
  stressed: '🤗 Calming',
  playful: '😜 Playful',
  supportive: '💚 Caring',
  curious: '🤔 Curious',
  tired: '😴 Gentle'
};

// Initial emotion state
export const DEFAULT_EMOTION_STATE = {
  userMood: 'neutral' as EmotionType,
  lizaEmotion: 'neutral' as EmotionType,
  confidence: 0.5,
  intensity: 50,
  emotionHistory: [] as EmotionType[],
  lastUpdated: Date.now()
};
