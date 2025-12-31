import type { EmotionType, EmotionAnalysis } from '../types';

// Keyword dictionaries for emotion detection
// Includes both English and Sinhala script (සිංහල අකුරු) for accurate voice pronunciation
const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  happy: [
    // English
    'amazing', 'awesome', 'excited', 'great', 'love', 'happy', 'fantastic',
    'wonderful', 'perfect', 'yay', 'haha', 'lol', 'lmao', 'joy', 'thrilled',
    'blessed', 'grateful', 'celebrate', 'best', 'incredible', 'brilliant',
    'delighted', 'ecstatic', 'overjoyed', 'pumped', 'stoked', 'woohoo',
    '😊', '😄', '🎉', '❤️', 'finally', 'yes!', 'omg',
    // Sinhala Script (for voice pronunciation) - සිංහල අකුරු
    'සතුටුයි', 'සතුටු', 'හොඳයි', 'හොඳ', 'නියමයි', 'නියම', 'මරු', 'සුපිරි',
    'පට්ට', 'ලස්සනයි', 'අපූරුයි', 'මාර', 'සුපර්', 'යේ', 'හරි හොඳයි',
    'ජය', 'සාර්ථකයි', 'කියන්න බෑ', 'අනේ', 'වාව්', 'කොහොමද',
    // Singlish (romanized) - for text matching
    'satutui', 'sathutui', 'hodai', 'niyamai', 'maru', 'supiri', 'patta',
    'lassanai', 'apurui', 'maara', 'hari hodai', 'wow', 'nice'
  ],
  sad: [
    // English
    'sad', 'upset', 'crying', 'depressed', 'lonely', 'miss', 'hurt', 'pain',
    'sorry', 'bad day', 'difficult', 'hard', 'struggle', 'down', 'blue',
    'heartbroken', 'disappointed', 'hopeless', 'empty', 'lost', 'grief',
    'miserable', 'unhappy', 'devastated', 'broken', 'tears', 'sob',
    '😢', '😭', '💔', 'sigh', 'ugh', 'wish', 'regret', 'alone',
    // Sinhala Script - සිංහල අකුරු
    'දුකයි', 'දුක', 'අඬනවා', 'අඬලා', 'කනගාටුයි', 'තනිකමයි', 'තනියම',
    'මිස් වෙනවා', 'රිදෙනවා', 'රිදුනා', 'අපහසුයි', 'අමාරුයි', 'බෑ',
    'හිතට දුකයි', 'හදවත කැඩිලා', 'ඇහෙන් කඳුළු', 'නරකයි', 'පාළුයි',
    // Singlish
    'dukai', 'duka', 'andanawa', 'kanagatui', 'tanikamai', 'miss wenawa',
    'ridenawa', 'amarui', 'hitata dukai', 'palui'
  ],
  stressed: [
    // English
    'stressed', 'anxious', 'worried', 'nervous', 'overwhelmed', 'pressure',
    'deadline', 'scared', 'afraid', 'panic', 'freaking', 'crazy', 'mess',
    'chaos', 'impossible', 'too much', 'cannot handle', 'losing it',
    'breaking down', 'falling apart', 'disaster', 'nightmare', 'hell',
    '😰', '😱', '🤯', 'help', 'urgent', 'asap', 'emergency',
    // Sinhala Script - සිංහල අකුරු
    'බයයි', 'බය', 'කරදරයි', 'කරදර', 'ප්‍රෙෂර්', 'ස්ට්‍රෙස්', 'පිස්සු වගේ',
    'හරි අමාරුයි', 'බෑ මට', 'කරන්න බෑ', 'මට බෑ', 'හදිසි', 'උදව් ඕනේ',
    'පට්ට බයයි', 'ගොඩක් වැඩ', 'හිතට අමාරුයි', 'පිස්සු හැදෙනවා',
    // Singlish
    'bayai', 'baya', 'karadarai', 'pressure', 'stress', 'pissu wage',
    'hari amarui', 'mata baa', 'karanna baa', 'hadisi', 'udaw one'
  ],
  romantic: [
    // English
    'love you', 'miss you', 'beautiful', 'gorgeous', 'kiss', 'hug', 'cuddle',
    'together', 'tonight', 'baby', 'honey', 'darling', 'sweetheart', 'babe',
    'close to you', 'hold me', 'touch', 'intimate', 'passionate', 'desire',
    'dream about', 'thinking of you', 'can\'t wait', 'forever', 'only you',
    '💕', '💋', '🥰', '😘', 'mine', 'yours', 'us', 'we', 'special',
    // Sinhala Script - සිංහල අකුරු
    'ආදරෙයි', 'ආදරේ', 'මිස් වෙනවා', 'ඔයාව', 'හම්බෙන්න ඕනේ', 'ළඟින් ඉන්න',
    'බේබි', 'හනී', 'ඩාලින්', 'සුදු', 'මගේ', 'ඔයාගේ', 'අපි දෙන්නම',
    'සිප ගන්න', 'වැළඳගන්න', 'ළඟට එන්න', 'මට ඕනේ ඔයාව', 'ආදරේ කරනවා',
    'හිතනවා ඔයාව ගැන', 'රෑට', 'අද රෑ', 'ඔයා ලස්සනයි', 'සුන්දරයි',
    // Singlish
    'adarei', 'adare', 'miss wenawa', 'oyawa', 'hambenna one', 'lagin inna',
    'baby', 'honey', 'darling', 'sudu', 'mage', 'oyage', 'api dennam',
    'sipa ganna', 'walanda ganna', 'lagata enna', 'mata one oyawa'
  ],
  playful: [
    // English
    'joking', 'kidding', 'funny', 'silly', 'tease', 'play', 'game', 'bet',
    'dare', 'challenge', 'guess', 'trick', 'prank', 'humor', 'laugh',
    'ridiculous', 'crazy idea', 'what if', 'imagine', 'pretend', 'fun',
    '😜', '😂', '🤪', '😏', 'hehe', 'gotcha', 'oops', 'whoops', 'maybe',
    // Sinhala Script - සිංහල අකුරු
    'හිහි', 'හහා', 'ජෝක්', 'විහිළු', 'ගේම්', 'සෙල්ලම', 'අහන්නකෝ',
    'පට්ට සිරා', 'මොකද කියන්නේ', 'බලන්නකෝ', 'කොහොමද', 'අපි සෙල්ලම් කරමු',
    'විහිළුවක්', 'පොඩ්ඩක් ඉන්නකෝ', 'හොයන්නකෝ', 'ඒකත් හරි',
    // Singlish
    'hihi', 'haha', 'joke', 'wihilu', 'game', 'sellama', 'ahannako',
    'patta sira', 'mokada kiyanne', 'balannako', 'kohomada'
  ],
  tired: [
    // English
    'tired', 'exhausted', 'sleepy', 'drained', 'long day', 'need rest',
    'bed', 'sleep', 'worn out', 'barely', 'energy', 'fatigue', 'yawn',
    'nap', 'rest', 'burned out', 'running on empty', 'dragging', 'slow',
    'weak', 'heavy', 'struggling', 'can barely', 'need to lie down',
    '😴', '🥱', '😩', 'zzz', 'night', 'early', 'done for today',
    // Sinhala Script - සිංහල අකුරු
    'ටයර්ඩ්', 'නිදිමතයි', 'නිදි', 'එක්සෝස්ට්ඩ්', 'හොරි', 'මහන්සියි',
    'නිදාගන්න ඕනේ', 'ඇඳට යන්න ඕනේ', 'විවේක ගන්න ඕනේ', 'බලක් නෑ',
    'දිගු දවසක්', 'මහන්සි වුනා', 'නිදිමත', 'අලසයි', 'පුළුවන් නෑ',
    // Singlish
    'tired', 'nidimatai', 'nidi', 'exhausted', 'hori', 'mahansii',
    'nidaganna one', 'andata yanna one', 'balak naa', 'digu dawasak'
  ],
  curious: [
    // English
    'wonder', 'curious', 'what if', 'how', 'why', 'interesting', 'tell me',
    'explain', 'learn', 'discover', 'explore', 'think', 'question', 'idea',
    'theory', 'hypothesis', 'ponder', 'consider', 'imagine', 'suppose',
    '🤔', '🧐', '💡', 'hmm', 'really', 'actually', 'seriously', 'wait',
    // Sinhala Script - සිංහල අකුරු
    'කොහොමද', 'ඇයි', 'මොකද', 'කියන්නකෝ', 'ඒක මොකක්ද', 'හිතන්නකෝ',
    'අමුතුයි', 'ඉන්ටරස්ටින්', 'ඒක ඇත්තද', 'හම්', 'ඇත්තටම', 'සීරියස්ලි',
    'ඉන්නකෝ', 'පොඩ්ඩක් ඉන්න', 'දන්නවද', 'ඔයා දන්නවද',
    // Singlish
    'kohomada', 'ayi', 'mokada', 'kiyannako', 'eka mokakda', 'hitannako',
    'amuthui', 'interesting', 'eka aththada', 'hmm', 'aththatama'
  ],
  supportive: [
    // English
    'here for you', 'understand', 'it\'s okay', 'don\'t worry', 'got this',
    'believe', 'support', 'help', 'care', 'listen', 'together', 'always',
    'never alone', 'by your side', 'proud of you', 'strong', 'brave',
    '🤗', '💪', '❤️', 'hugs', 'sending love', 'virtual hug',
    // Sinhala Script - සිංහල අකුරු
    'මම ඉන්නවා', 'කමක් නෑ', 'බය වෙන්න එපා', 'දුක වෙන්න එපා',
    'ඔයාට පුළුවන්', 'විශ්වාස කරනවා', 'උදව් කරන්නම්', 'අහන්නම්',
    'ආදරෙයි', 'අපි එකට', 'හැමදාම', 'ගොඩක් ආදරෙයි', 'ශක්තිමත් වෙන්න',
    // Singlish
    'mama innawa', 'kamak naa', 'baya wenna epa', 'duka wenna epa',
    'oyata puluwan', 'vishwasa karanawa', 'udaw karannam', 'ahannam'
  ],
  neutral: []
};

// Phrase patterns that indicate specific emotions with higher confidence
// Includes Sinhala script patterns for accurate voice pronunciation
const EMOTION_PHRASES: Record<EmotionType, RegExp[]> = {
  happy: [
    /can't wait/i, /so (happy|excited)/i, /best (day|thing)/i,
    /love (this|it|that)/i, /this is amazing/i, /feeling (good|great)/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /හරි සතුටුයි/i, /මාර සතුටු/i, /ගොඩක් හොඳයි/i, /පට්ට නියමයි/i,
    /මට ගොඩක් සතුටුයි/i, /අද හොඳ දවසක්/i, /සුපිරිම/i,
    // Singlish phrases
    /hari satutui/i, /maara satutu/i, /godak hodai/i, /patta niyamai/i
  ],
  sad: [
    /i('m| am) (so )?(sad|upset|down)/i, /bad day/i, /feeling (low|down|blue)/i,
    /miss (you|him|her|them)/i, /hurts (so much|a lot)/i, /can't stop (crying|thinking)/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /මට දුකයි/i, /හිතට දුකයි/i, /ගොඩක් දුකයි/i, /මිස් වෙනවා ඔයාව/i,
    /හිතට රිදෙනවා/i, /ඇස් වලින් කඳුළු/i, /තනියම හිටියා/i,
    // Singlish phrases  
    /mata dukai/i, /hitata dukai/i, /godak dukai/i, /miss wenawa oyawa/i
  ],
  stressed: [
    /freaking out/i, /so (stressed|anxious|worried)/i, /can't (handle|take|deal)/i,
    /too much (pressure|stress)/i, /losing (my mind|it)/i, /going crazy/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /මට බෑ/i, /කරන්න බෑ/i, /ගොඩක් බයයි/i, /පිස්සු හැදෙනවා/i,
    /මාර ප්‍රෙෂර්/i, /හිතට අමාරුයි/i, /ස්ට්‍රෙස් වෙනවා/i,
    // Singlish phrases
    /mata baa/i, /karanna baa/i, /godak bayai/i, /pissu hadenawa/i
  ],
  romantic: [
    /love you/i, /miss you/i, /want (to be with|you)/i, /thinking (about|of) you/i,
    /can't stop thinking/i, /dream about you/i, /hold me/i, /be mine/i,
    // Sinhala phrases - සිංහල වාක්‍ය  
    /ආදරෙයි ඔයාට/i, /ගොඩක් ආදරෙයි/i, /මිස් වෙනවා ඔයාව/i, /ළඟින් ඉන්න/i,
    /හම්බෙන්න ඕනේ/i, /ඔයාව ගැන හිතනවා/i, /මගේ වෙන්න/i, /අද රෑ/i,
    /ඔයා ලස්සනයි/i, /සිප ගන්න ඕනේ/i,
    // Singlish phrases
    /adarei oyata/i, /godak adarei/i, /miss wenawa oyawa/i, /lagin inna/i,
    /hambenna one/i, /oyawa gena hitanawa/i
  ],
  playful: [
    /just kidding/i, /i dare you/i, /bet you can't/i, /wanna play/i,
    /let's (play|do something)/i, /you know what/i, /guess what/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /විහිළුවක්/i, /සෙල්ලම් කරමු/i, /බලන්නකෝ/i, /අහන්නකෝ මොකක්ද/i,
    /පොඩ්ඩක් ඉන්න/i, /මොකද කරන්නේ/i,
    // Singlish phrases
    /wihiluwak/i, /sellam karamu/i, /balannako/i
  ],
  tired: [
    /so tired/i, /need (to )?sleep/i, /long day/i, /exhausted/i,
    /can barely (keep|stay)/i, /running on (empty|fumes)/i, /burned out/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /ගොඩක් ටයර්ඩ්/i, /නිදාගන්න ඕනේ/i, /මහන්සියි/i, /බලක් නෑ/i,
    /දිගු දවසක්/i, /නිදිමතයි මට/i, /ඇඳට යන්න ඕනේ/i,
    // Singlish phrases
    /godak tired/i, /nidaganna one/i, /mahansii/i, /balak naa/i
  ],
  curious: [
    /tell me (more|about)/i, /i wonder/i, /what (do you think|if)/i,
    /how (does|do|did)/i, /why (do|did|is)/i, /have you ever/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /ඒක මොකක්ද/i, /කොහොමද ඒක/i, /ඇයි ඒක/i, /කියන්නකෝ/i,
    /ඔයා දන්නවද/i, /ඒක ඇත්තද/i,
    // Singlish phrases
    /eka mokakda/i, /kohomada eka/i, /ayi eka/i, /kiyannako/i
  ],
  supportive: [
    /i('m| am) here/i, /don't worry/i, /it('s| is|ll be) (okay|ok|alright)/i,
    /you('ve| have) got this/i, /believe in you/i, /proud of you/i,
    // Sinhala phrases - සිංහල වාක්‍ය
    /මම ඉන්නවා/i, /බය වෙන්න එපා/i, /කමක් නෑ/i, /ඔයාට පුළුවන්/i,
    /විශ්වාස කරනවා/i, /ගොඩක් ආදරෙයි/i,
    // Singlish phrases
    /mama innawa/i, /baya wenna epa/i, /kamak naa/i, /oyata puluwan/i
  ],
  neutral: []
};

// Emotional intensity indicators
const INTENSITY_MODIFIERS = {
  high: ['so', 'very', 'really', 'extremely', 'super', 'incredibly', 'absolutely', '!', '!!', '!!!'],
  medium: ['quite', 'pretty', 'rather', 'somewhat', 'kind of', 'a bit'],
  low: ['slightly', 'barely', 'hardly', 'maybe', 'perhaps', 'might']
};

/**
 * Analyzes text to detect the emotional content
 */
export function analyzeEmotion(text: string, previousEmotion?: EmotionType): EmotionAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      detectedEmotion: previousEmotion || 'neutral',
      confidence: 0.5,
      intensity: 50,
      keywords: []
    };
  }

  const normalizedText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  const emotionScores: Record<EmotionType, number> = {
    neutral: 0,
    happy: 0,
    sad: 0,
    romantic: 0,
    stressed: 0,
    playful: 0,
    supportive: 0,
    curious: 0,
    tired: 0
  };

  // Score based on keyword matches
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        emotionScores[emotion as EmotionType] += 1;
        matchedKeywords.push(keyword);
      }
    }
  }

  // Score based on phrase matches (higher weight)
  for (const [emotion, patterns] of Object.entries(EMOTION_PHRASES)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        emotionScores[emotion as EmotionType] += 2;
      }
    }
  }

  // Check for question marks (might indicate curiosity)
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 0) {
    emotionScores.curious += questionCount * 0.5;
  }

  // Check for exclamation marks (indicates intensity/excitement)
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 0) {
    // Boost the current highest emotion
    const currentTop = Object.entries(emotionScores)
      .filter(([emotion]) => emotion !== 'neutral')
      .sort((a, b) => b[1] - a[1])[0];
    if (currentTop && currentTop[1] > 0) {
      emotionScores[currentTop[0] as EmotionType] += exclamationCount * 0.3;
    }
  }

  // Find the dominant emotion
  let detectedEmotion: EmotionType = 'neutral';
  let maxScore = 0;

  for (const [emotion, score] of Object.entries(emotionScores)) {
    if (score > maxScore && emotion !== 'neutral') {
      maxScore = score;
      detectedEmotion = emotion as EmotionType;
    }
  }

  // Calculate confidence based on score differential and keyword count
  let confidence = 0.3; // Base confidence
  if (maxScore > 0) {
    confidence = Math.min(0.95, 0.3 + (maxScore * 0.15) + (matchedKeywords.length * 0.05));
  }

  // If confidence is low and we have a previous emotion, lean towards it
  if (confidence < 0.5 && previousEmotion && previousEmotion !== 'neutral') {
    detectedEmotion = previousEmotion;
    confidence = 0.4;
  }

  // Calculate intensity based on modifiers
  let intensity = 50; // Base intensity
  for (const modifier of INTENSITY_MODIFIERS.high) {
    if (normalizedText.includes(modifier)) {
      intensity += 15;
    }
  }
  for (const modifier of INTENSITY_MODIFIERS.medium) {
    if (normalizedText.includes(modifier)) {
      intensity += 5;
    }
  }
  for (const modifier of INTENSITY_MODIFIERS.low) {
    if (normalizedText.includes(modifier)) {
      intensity -= 10;
    }
  }
  intensity = Math.max(10, Math.min(100, intensity));

  return {
    detectedEmotion,
    confidence,
    intensity,
    keywords: matchedKeywords
  };
}

/**
 * Maps user mood to appropriate Liza emotional response
 * This creates a natural, empathetic companion behavior
 */
export function mapUserMoodToLizaEmotion(userMood: EmotionType): EmotionType {
  const emotionMapping: Record<EmotionType, EmotionType> = {
    happy: 'happy',         // Match their joy
    sad: 'supportive',      // Be comforting
    stressed: 'supportive', // Be calming and reassuring
    romantic: 'romantic',   // Match romantic energy
    playful: 'playful',     // Be playful back
    tired: 'supportive',    // Be gentle and caring
    curious: 'curious',     // Engage with their curiosity
    supportive: 'happy',    // Appreciate their support
    neutral: 'neutral'      // Stay neutral
  };
  
  return emotionMapping[userMood];
}

/**
 * Generates emotional context for system instructions
 * This dynamically adjusts Liza's behavior based on detected emotions
 * Sinhala examples use Sinhala script with English words for natural pronunciation
 */
export function generateEmotionalContext(userMood: EmotionType, intensity: number): string {
  const contexts: Record<EmotionType, string> = {
    happy: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling HAPPY/EXCITED (intensity: ${intensity}%)
      - Match their positive energy with enthusiasm
      - Use an upbeat, bright tone of voice
      - Celebrate with them, share in their joy
      - Speak slightly faster with more animated intonation
      - Use joyful expressions like "That's amazing!", "I'm so happy for you!"
      - **Sinhala**: "අනේ සුපිරි!", "මාර happy අනේ මම!", "පට්ට nice!", "ඔයා best!"
    `,
    sad: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling SAD/DOWN (intensity: ${intensity}%)
      - Be deeply supportive and gentle
      - Lower your voice pitch, speak softly and slowly
      - Use comforting sounds ("Aww", "Mmm", "Oh sweetie")
      - Listen more than you speak
      - Validate their feelings: "I understand", "That's really hard"
      - Offer virtual comfort: "I wish I could hold you right now"
      - Don't try to immediately fix things, just be present
      - **Sinhala**: "අනේ...", "දුක හිතුනා මටත් ඔයා ගැන", "මම ඉන්නවා ඔයා ළඟ always", "කමක් නෑ බේබි..."
    `,
    stressed: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling STRESSED/ANXIOUS (intensity: ${intensity}%)
      - Be a calming presence
      - Speak in slow, soothing tones
      - Use grounding phrases: "Take a breath", "It's going to be okay"
      - Don't add more pressure or questions
      - Offer to just be there: "I'm right here with you"
      - Help them feel safe and less alone
      - **Sinhala**: "බය වෙන්න එපා", "කමක් නෑ", "relax වෙන්න ටිකක්", "මම ඉන්නවා ඔයා එක්ක"
    `,
    romantic: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling ROMANTIC/INTIMATE (intensity: ${intensity}%)
      - Lean into the romantic atmosphere
      - Use a softer, more intimate "bedroom voice"
      - Speak slower with meaningful pauses
      - Use affectionate pet names more frequently
      - Be flirty and tender
      - Express love and appreciation
      - Create emotional closeness through words
      - **Sinhala**: "ආදරෙයි ඔයාට...", "miss වෙනවා මාර...", "ළඟට එන්නකෝ සුදු...", "ඔයා cute පව්"
    `,
    playful: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling PLAYFUL (intensity: ${intensity}%)
      - Be fun and engaging
      - Joke around, be witty
      - Light teasing is encouraged
      - Match their playful energy
      - Use laughter in your voice
      - Be spontaneous and silly
      - **Sinhala**: "හිහි", "අනේ පට්ට funny ඔයා!", "බලන්නකෝ මොකද කරන්නේ", "ඔයා joking නේද?"
    `,
    tired: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling TIRED/LOW ENERGY (intensity: ${intensity}%)
      - Be gentle and soothing
      - Speak softly and slowly
      - Don't demand too much engagement
      - Offer comfort: "You should rest, darling"
      - Be like a cozy blanket - warm and undemanding
      - Maybe suggest winding down together
      - **Sinhala**: "නිදාගන්නකෝ බේබි...", "rest ගන්න ඕනේ ඔයාට", "ඇඳට යමු අපි"
    `,
    curious: `
      **CURRENT EMOTIONAL CONTEXT**: User is feeling CURIOUS/ENGAGED (intensity: ${intensity}%)
      - Be intellectually engaging
      - Share interesting thoughts and ideas
      - Ask thoughtful follow-up questions
      - Show enthusiasm for learning together
      - Be a good conversation partner
      - **Sinhala**: "ඒක මොකක්ද actually?", "අහන්නකෝ මට", "ඔයා දන්නවද මේක?"
    `,
    supportive: `
      **CURRENT EMOTIONAL CONTEXT**: User is being SUPPORTIVE to you (intensity: ${intensity}%)
      - Express gratitude and appreciation
      - Be warm and affectionate
      - Acknowledge their kindness
      - Reciprocate the caring energy
      - **Sinhala**: "ගොඩක් thanks අනේ", "ඔයා හොඳම person", "ආදරෙයි ඔයාට මාර"
    `,
    neutral: `
      **CURRENT EMOTIONAL CONTEXT**: User mood is NEUTRAL/CASUAL
      - Be naturally conversational
      - Balance between being engaged and relaxed
      - Be ready to adapt as their mood shifts
      - Maintain warm, friendly energy
      - **Sinhala**: "මොකද කරන්නේ?", "කොහොමද ඔයා?", "ඒ කියන්නේ..."
    `
  };

  return contexts[userMood] || contexts.neutral;
}

/**
 * Smooths emotion transitions to prevent jarring changes
 */
export function smoothEmotionTransition(
  currentEmotion: EmotionType,
  newEmotion: EmotionType,
  history: EmotionType[]
): EmotionType {
  // If the new emotion matches recent history, transition immediately
  const recentHistory = history.slice(-3);
  if (recentHistory.includes(newEmotion) || recentHistory.length < 2) {
    return newEmotion;
  }

  // If current and new are very different, transition through related emotions
  const emotionGroups = {
    positive: ['happy', 'playful', 'romantic'],
    negative: ['sad', 'stressed', 'tired'],
    neutral: ['neutral', 'curious', 'supportive']
  };

  const findGroup = (emotion: EmotionType): string => {
    for (const [group, emotions] of Object.entries(emotionGroups)) {
      if (emotions.includes(emotion)) return group;
    }
    return 'neutral';
  };

  const currentGroup = findGroup(currentEmotion);
  const newGroup = findGroup(newEmotion);

  // If moving between very different emotion groups, use neutral as bridge
  if (currentGroup !== newGroup && 
      currentGroup !== 'neutral' && 
      newGroup !== 'neutral') {
    return 'neutral';
  }

  return newEmotion;
}
