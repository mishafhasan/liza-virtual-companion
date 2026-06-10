import { getGeminiClient, TEXT_MODEL } from './geminiClient';
import { hasGeminiKey } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';

/** A single conversational turn passed to the model as history. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateTextParams {
  /** System instruction that sets the assistant's behavior/persona. */
  systemInstruction: string;
  /** Prior conversation turns (most recent last). The latest user turn is the prompt. */
  history: ChatTurn[];
  /** Hard cap on response length. Defaults to 500 tokens. */
  maxOutputTokens?: number;
  /** Sampling temperature (0–2). Defaults to 0.9 for natural conversation. */
  temperature?: number;
}

/** Maps our internal role names to the Gemini `contents` role names. */
function toGeminiContents(history: ChatTurn[]) {
  return history.map((turn) => ({
    role: turn.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: turn.content }],
  }));
}

async function generateChatReplyDirect(
  systemInstruction: string,
  history: ChatTurn[],
  maxOutputTokens: number,
  temperature: number,
): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: toGeminiContents(history),
    config: {
      systemInstruction,
      maxOutputTokens,
      temperature,
    },
  });

  return response.text?.trim() || '';
}

/**
 * Generates a free-form text reply from a conversation history.
 *
 * When Supabase is configured, the request is proxied through the
 * `proxy-gemini-chat` Edge Function (keeping the API key server-side). Otherwise
 * it calls Gemini directly from the client. Throws on failure so callers can
 * decide how to surface it.
 */
export async function generateChatReply(params: GenerateTextParams): Promise<string> {
  const {
    systemInstruction,
    history,
    maxOutputTokens = 500,
    temperature = 0.9,
  } = params;

  // Preferred path: server-side proxy via Supabase Edge Function.
  const supabase = await getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('proxy-gemini-chat', {
      body: {
        messages: history,
        systemInstruction,
        maxTokens: maxOutputTokens,
        temperature,
      },
    });
    if (!error) {
      return (data?.content ?? '').trim();
    }

    if (!hasGeminiKey()) {
      throw error;
    }

    console.warn('[chatService] Gemini proxy failed; falling back to direct client:', error.message);
    return generateChatReplyDirect(systemInstruction, history, maxOutputTokens, temperature);
  }

  // Fallback path: call Gemini directly from the client.
  return generateChatReplyDirect(systemInstruction, history, maxOutputTokens, temperature);
}

/**
 * Generates a single text completion from a prompt + system instruction.
 * Convenience wrapper around {@link generateChatReply} for one-shot prompts.
 */
export async function generateText(
  systemInstruction: string,
  prompt: string,
  options?: { maxOutputTokens?: number; temperature?: number },
): Promise<string> {
  return generateChatReply({
    systemInstruction,
    history: [{ role: 'user', content: prompt }],
    maxOutputTokens: options?.maxOutputTokens,
    temperature: options?.temperature,
  });
}

/** Strips ```json fences and surrounding prose from a model response. */
function extractJsonPayload(raw: string): string {
  let text = raw.trim();

  // Remove fenced code blocks (```json ... ``` or ``` ... ```).
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Fall back to slicing from the first bracket to the last matching one.
  const firstBrace = text.search(/[[{]/);
  const lastBrace = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

/**
 * Generates a structured JSON object of type `T`.
 *
 * Asks Gemini for JSON output, then defensively parses it (models sometimes
 * wrap JSON in prose or code fences). Throws if the payload can't be parsed.
 */
export async function generateJson<T>(
  systemInstruction: string,
  prompt: string,
  options?: { temperature?: number; maxOutputTokens?: number },
): Promise<T> {
  const temperature = options?.temperature ?? 0.7;
  const maxOutputTokens = options?.maxOutputTokens ?? 2048;

  let raw: string;

  // Preferred path: server-side proxy via Supabase Edge Function.
  const supabase = await getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('proxy-gemini-generate', {
      body: { systemInstruction, prompt, temperature, maxTokens: maxOutputTokens, json: true },
    });
    if (!error) {
      raw = data?.content ?? '';
    } else if (hasGeminiKey()) {
      console.warn('[chatService] Gemini JSON proxy failed; falling back to direct client:', error.message);
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
        },
      });
      raw = response.text ?? '';
    } else {
      throw error;
    }
  } else {
    // Fallback path: call Gemini directly from the client.
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    });
    raw = response.text ?? '';
  }

  if (!raw) {
    throw new Error('Empty response from the AI model.');
  }

  try {
    return JSON.parse(extractJsonPayload(raw)) as T;
  } catch (error) {
    console.error('Failed to parse AI JSON response:', raw, error);
    throw new Error('The AI returned a malformed response. Please try again.');
  }
}
