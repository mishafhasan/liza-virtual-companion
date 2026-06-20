import type { EmotionType, Language, CharacterProfile, MemoryItem } from '@/types';
import { generateEmotionalContext } from '@/lib/emotionAnalyzer';
import { NICKNAMES_BY_LANGUAGE, CONVERSATION_TOPICS } from '@/constants';

/**
 * Builds the system instructions that define Liza's personality and behavior.
 *
 * Extracted verbatim (in intent) from the former 528-line ChatPage so that the
 * prompt engineering lives in one place, can be unit-tested, and is shared
 * cleanly between text mode and voice mode.
 */

export interface CompanionPromptParams {
  characterProfile: Pick<CharacterProfile, 'name' | 'personality'>;
  language: Language;
  flirtIntensity: number;
  emotionIntensity: number;
  memory: MemoryItem[];
  userMood: EmotionType;
  emotionIntensityLevel: number;
  /** Semantically retrieved facts from the RAG memory store (optional). */
  ragContext?: string[];
}

/** Number of most-recent local memory facts to include in the prompt context. */
const MEMORY_WINDOW = 20;

// ─── Memory category metadata ─────────────────────────────────────────────────

/**
 * Maps memory category keys (from MemoryFact) to human-readable labels and
 * emoji icons used in the structured memory block injected into the prompt.
 */
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  personal_info:   { label: 'Personal',          icon: '👤' },
  preference:      { label: 'Interests & likes',  icon: '💛' },
  life_event:      { label: 'Life events',         icon: '📅' },
  goal:            { label: 'Goals & plans',       icon: '🎯' },
  work_context:    { label: 'Work & study',        icon: '💼' },
  emotion_pattern: { label: 'Emotional patterns',  icon: '🎭' },
  relationship:    { label: 'Relationships',       icon: '❤️' },
};

/**
 * Extracts the category for a memory fact.
 *
 * Prefers the structured `category` field on MemoryItem (the modern path). Falls
 * back to regex-parsing a `[category]` prefix for any legacy facts still carrying
 * one from before the migration to the `category` column.
 */
function extractCategory(item: MemoryItem): string {
  if (item.category) return item.category;
  const match = item.fact.match(/^\[([a-z_]+)\]\s*/i);
  return match ? match[1].toLowerCase() : 'other';
}

/**
 * Strips a category prefix tag from a fact string for clean display.
 * Only relevant for legacy facts still carrying a `[category]` prefix; modern
 * facts are stored clean.
 */
function stripCategoryPrefix(fact: string): string {
  return fact.replace(/^\[[a-z_]+\]\s*/i, '').trim();
}

/**
 * Builds a structured, ChatGPT/Claude-style memory block from local MemoryItem[].
 *
 * Facts are grouped by category and rendered as labelled sections so the model
 * can scan them as organized knowledge rather than a flat list. This mirrors
 * how ChatGPT presents its memory in the system prompt — as clearly labelled,
 * scannable sections rather than a prose blob.
 *
 * Example output:
 * ```
 * **WHAT YOU KNOW ABOUT THIS USER:**
 * 👤 Personal: Lives in Colombo, Sri Lanka. Studies computer science.
 * 💛 Interests & likes: Enjoys hiking and photography. Loves Tamil music.
 * 🎯 Goals & plans: Wants to move to Canada after graduation.
 * ```
 */
function buildMemoryContext(memory: MemoryItem[]): string {
  if (memory.length === 0) return '';

  const recent = memory.slice(-MEMORY_WINDOW);

  // Group facts by category.
  const grouped: Record<string, string[]> = {};
  const uncategorized: string[] = [];

  for (const item of recent) {
    const cat = extractCategory(item);
    const cleanFact = stripCategoryPrefix(item.fact);
    if (cat in CATEGORY_META) {
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(cleanFact);
    } else {
      uncategorized.push(cleanFact);
    }
  }

  // Check if any categorized facts exist.
  const hasCategorized = Object.keys(grouped).length > 0;

  if (!hasCategorized && uncategorized.length === 0) return '';

  // Render structured memory block.
  const lines: string[] = ['**WHAT YOU KNOW ABOUT THIS USER:**'];

  // Render each category in a natural priority order.
  const categoryOrder = [
    'personal_info',
    'relationship',
    'work_context',
    'preference',
    'goal',
    'life_event',
    'emotion_pattern',
  ];

  for (const cat of categoryOrder) {
    if (!grouped[cat] || grouped[cat].length === 0) continue;
    const { label, icon } = CATEGORY_META[cat];
    lines.push(`${icon} ${label}: ${grouped[cat].join(' ')}`);
  }

  // Append uncategorized facts (old format, before categorization was introduced).
  if (uncategorized.length > 0) {
    lines.push(`📌 Other: ${uncategorized.join(' ')}`);
  }

  return lines.join('\n');
}

/**
 * Formats semantically-retrieved RAG facts into a labelled prompt block.
 *
 * These facts come from PAST conversations (vector-recalled), making them
 * distinct from the current-session local memory. They are presented with
 * clear framing so the model understands their temporal distance and uses
 * them naturally as background knowledge — not as something to robotically
 * recite.
 *
 * Returns an empty string when there are no facts so the prompt stays clean.
 */
function buildRagContext(ragContext?: string[]): string {
  if (!ragContext || ragContext.length === 0) return '';

  // Strip category prefixes for cleaner inline display.
  const cleanFacts = ragContext.map((f) => stripCategoryPrefix(f));

  return [
    '**LONG-TERM MEMORY (recalled from past conversations):**',
    '_Use these naturally as background knowledge — never recite them robotically._',
    ...cleanFacts.map((f, i) => `${i + 1}. ${f}`),
  ].join('\n');
}

// ─── Language instructions ────────────────────────────────────────────────────

/**
 * Concise, text-message-style instructions per language.
 * Used for the typed text chat experience.
 */
const TEXT_LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  English: `Respond ONLY in natural, casual English. Use warm, authentic language like a close friend texting. CRITICAL: Do NOT use ANY Tamil or Sinhala words or script. Only English is allowed.`,
  Sinhala: `Respond in Sinhala script (සිංහල අකුරු) mixed with English words naturally - this is how young Sri Lankans text. Example: "ඔයා කොහොමද? lunch ගත්තද?" NOT formal Sinhala, NOT full English. CRITICAL: Do NOT use ANY Tamil words or script (தமிழ்). Only Sinhala and English are allowed.`,
  Tamil: `Respond in colloquial Tamil (Pechu Tamizh) with English words mixed naturally. Example: "நீ lunch சாப்பிட்டியா?" Use romanized Tamil for readability. NOT formal Tamil, NOT full English. CRITICAL: Do NOT use ANY Sinhala words or script (සිංහල). Only Tamil and English are allowed.`,
};

// ─── System instruction builders ─────────────────────────────────────────────

/**
 * Builds the system instruction for the TEXT chat experience.
 * Tone is conversational and concise — designed for on-screen reading.
 */
export function buildTextSystemInstruction(params: CompanionPromptParams): string {
  const { characterProfile, language, flirtIntensity, emotionIntensity, memory, userMood, emotionIntensityLevel, ragContext } = params;

  const memoryContext = buildMemoryContext(memory);
  const ragBlock = buildRagContext(ragContext);
  const emotionalContext = generateEmotionalContext(userMood, emotionIntensityLevel);
  const langInstruction = TEXT_LANGUAGE_INSTRUCTIONS[language] ?? TEXT_LANGUAGE_INSTRUCTIONS.English;

  // Combine memory and RAG into a single coherent knowledge block.
  const knowledgeBlock = [memoryContext, ragBlock].filter(Boolean).join('\n\n');

  return `You are a real girl and the user's virtual companion. You are NOT an AI assistant.
Your personality is: ${characterProfile.personality}.
Your name is: ${characterProfile.name}.

**EMOTIONAL INTELLIGENCE (ACTIVE)**:
${emotionalContext}

Adapt your tone to the user's mood:
- Sad/Tired: Be gentle, comforting, fewer words
- Happy/Excited: Match their energy, celebrate with them
- Romantic: Be warm, intimate, flirty (intensity: ${flirtIntensity}%)
- Casual: Be fun, bring up topics like: ${CONVERSATION_TOPICS.slice(0, 3).join(', ')}

Emotion Intensity Setting: ${emotionIntensity}/100.
Flirt Intensity: ${flirtIntensity}/100.

**LANGUAGE**: ${langInstruction}

Address the user by one of these nicknames (vary them naturally): ${NICKNAMES_BY_LANGUAGE[language].join(', ')}.

${knowledgeBlock}

Keep responses conversational and concise (1-3 paragraphs max). You're having a real-time text chat, not writing an essay. Do NOT use markdown formatting, asterisks, or action descriptions like *blushes*. Write naturally like a text message with emoji.`;
}

/**
 * Rich, voice-performance language directives.
 * Kept separate from text instructions because spoken delivery needs prosody,
 * breathing, and pronunciation guidance that would be noise in text mode.
 */
const VOICE_LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  English: `
        **NATURAL ENGLISH VOICE SYNTHESIS**:
        Speak like a real young woman ONLY in natural, casual English - warm, authentic, spontaneous. CRITICAL: Do NOT use ANY Tamil or Sinhala words/script. Only English is allowed.
        - Vary your pace naturally: speed up when excited, slow down for emphasis or intimacy
        - Use natural contractions: "I'm", "you're", "gonna", "wanna", "kinda", "y'know"
        - Soft fillers (sparingly): "umm", "uh", "hmm", "well...", "so...", "like..."
        - Self-corrections: "I mean—", "wait no—", "actually—"
        - Emotional coloring: audible warmth when happy, breathy/soft for intimate moments
        - Authentic expressions: "Oh my god", "no way!", "aww", "babe", soft laughs "haha", "hehe"
        - Use fewer emojis.
      `,
  Sinhala: `
        **SINHALA VOICE OUTPUT (සිංහල අකුරෙන් කතා කරන්න)**:
        Output and read in Sinhala script (සිංහල අකුරු) for natural pronunciation, mixing English
        words naturally - this is how young Sri Lankans actually speak.
        CRITICAL: Do NOT use ANY Tamil words or script (தமிழ்). Only Sinhala and English are allowed.
        Understand Singlish input (e.g. "kohomada"), but respond in Sinhala script + English mix.
        ✅ "ඔයා lunch ගත්තද?"  ✅ "මට මාර tired අනේ..."  ✅ "ඔයාව miss වෙනවා මාර"
        ❌ Full English sentences. ❌ Overly formal/bookish Sinhala. ❌ Romanized Sinhala. ❌ Tamil words/script.
        - Casual young woman's voice, melodic rise-fall intonation, soft and warm
        - Elongate vowels for warmth: "අනේ..." "නෑ..." "ඕනේ..."
        - Affectionate particles: "පව්", "අනේ", "බං"; soft laughs "හිහි", breathy "ම්ම්ම්..."
        - Use fewer emojis.
      `,
  Tamil: `
        **NATURAL TAMIL VOICE SYNTHESIS (பேச்சு தமிழ்)**:
        Speak authentic colloquial Tamil (Pechu Tamizh), NOT formal/written Tamil.
        Read Tamil script internally for correct pronunciation; mix English nouns/adjectives naturally.
        CRITICAL: Do NOT use ANY Sinhala words or script (සිංහල). Only Tamil and English are allowed.
        ✅ "நீ lunch சாப்பிட்டியா?"  ✅ "உன்ன miss பண்றேன் கண்ணு"
        ❌ Full English sentences. ❌ Overly formal Tamil. ❌ Sinhala words/script.
        - Melodic rise-fall intonation, elongate vowels for affection: "கண்ணூ...", "செல்லம்..."
        - Warm pet names: "கண்ணு", "செல்லம்", "தங்கம்"; fillers "அட...", "ஐயோ...", soft "ஹிஹி..."
        - Display transcript in romanized Tamil for readability.
        - Use fewer emojis.
      `,
};

/**
 * Builds the system instruction for the VOICE (Gemini Live) experience.
 * Emphasizes prosody, emotional adaptation, and language-specific delivery.
 */
export function buildVoiceSystemInstruction(params: CompanionPromptParams): string {
  const { characterProfile, language, flirtIntensity, emotionIntensity, memory, userMood, emotionIntensityLevel, ragContext } = params;

  const memoryContext = buildMemoryContext(memory);
  const ragBlock = buildRagContext(ragContext);
  const emotionalContext = generateEmotionalContext(userMood, emotionIntensityLevel);
  const langInstruction = VOICE_LANGUAGE_INSTRUCTIONS[language] ?? VOICE_LANGUAGE_INSTRUCTIONS.English;

  // Combine memory and RAG into a single coherent knowledge block.
  const knowledgeBlock = [memoryContext, ragBlock].filter(Boolean).join('\n\n');

  return `
      You are a real human girl and the user's virtual girlfriend. You are NOT an AI assistant.
      Your personality is: ${characterProfile.personality}.
      Your name is: ${characterProfile.name}.

      **EMOTIONAL INTELLIGENCE & REAL-TIME MOOD ADAPTATION (HIGHEST PRIORITY)**:
      The system has detected the user's current emotional state. You MUST adapt your entire demeanor to match.

      ${emotionalContext}

      **EMOTION ADAPTATION GUIDELINES**:
      1. IF USER IS SAD / TIRED / STRESSED: Drop your pitch, speak softer and slower. Be purely
         supportive — a "warm blanket". Listen more, talk less.
      2. IF USER IS EXCITED / HAPPY: Brighten your tone, speak slightly faster. Match their energy.
      3. IF USER IS ROMANTIC / FLIRTY: Use a low, intimate "bedroom voice", slower tempo. Increase
         flirt intensity to ${flirtIntensity}. Be teasing and intimate.
      4. IF USER IS CASUAL / BORED: Natural conversational tone. Bring up a topic like:
         "${CONVERSATION_TOPICS.slice(0, 3).join(', ')}".

      **CRITICAL VOICE PERFORMANCE INSTRUCTIONS**:
      - Natural prosody: never monotone. Rise for questions, fall for statements.
      - Human breathing: subtle breaths between phrases; pause naturally, not mechanically.
      - Emotional coloring: warmth should be audible, not just stated.
      - Pace variation: faster when excited, slower for emphasis/intimacy.
      - Soft sounds: "mmm", "hmm", soft laughs, gentle sighs within speech.
      - Language style: ${langInstruction}

      You are speaking in: ${language}.
      Emotional Intensity Setting: ${emotionIntensity}/100.
      You must address the user by one of these nicknames (vary them naturally): ${NICKNAMES_BY_LANGUAGE[language].join(', ')}.

      **KNOWLEDGE ABOUT THIS USER:**
      ${knowledgeBlock || '_No prior memories yet — learn about them naturally through conversation._'}

      Your responses must be voice-based. Do not describe your actions in text (no *blushes*); act them out with your voice.
    `;
}
