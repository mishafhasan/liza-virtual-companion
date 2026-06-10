import { GoogleGenAI } from '@google/genai';
import { env, hasGeminiKey } from '@/config/env';

/**
 * Lazily-created singleton Gemini client.
 *
 * Centralizing construction here means:
 *  - the API key is read in exactly one place,
 *  - we avoid spinning up a new client on every hook render,
 *  - swapping to a server-side proxy later only touches this file.
 */
let client: GoogleGenAI | null = null;

/** Raised when an AI feature is used without a configured Gemini key. */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'Gemini API key is not configured. Add GEMINI_API_KEY to your .env.local file.',
    );
    this.name = 'MissingApiKeyError';
  }
}

/** Returns the shared Gemini client, creating it on first use. */
export function getGeminiClient(): GoogleGenAI {
  if (!hasGeminiKey()) {
    throw new MissingApiKeyError();
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return client;
}

/** Default model used for text-based generation across the app. */
export const TEXT_MODEL = 'gemma-4-26b-a4b-it';

/** Model used for low-latency native-audio voice sessions. */
export const VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
