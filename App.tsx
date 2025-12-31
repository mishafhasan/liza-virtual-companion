
import React, { useState, useEffect, useCallback } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { ConversationView } from './components/ConversationView';
import { InputBar } from './components/InputBar';
import { VideoAvatar } from './components/VideoAvatar';
import { SettingsIcon, XIcon, VideoCameraIcon, VideoCameraSlashIcon } from './components/Icons';
import { useLiveSession } from './hooks/useLiveSession';
import { useHeyGenSession } from './hooks/useHeyGenSession';
import { useEmotionState } from './hooks/useEmotionState';
import type { Settings, CharacterProfile, MemoryItem, ConversationTurn } from './types';
import { DEFAULT_SETTINGS, DEFAULT_CHARACTER_PROFILE, NICKNAMES, CONVERSATION_TOPICS } from './constants';
import { generateEmotionalContext } from './lib/emotionAnalyzer';

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('liza-settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch(e) {
      console.error("Error loading settings", e);
      return DEFAULT_SETTINGS;
    }
  });

  const [characterProfile, setCharacterProfile] = useState<CharacterProfile>(() => {
    try {
      const saved = localStorage.getItem('liza-character');
      return saved ? JSON.parse(saved) : DEFAULT_CHARACTER_PROFILE;
    } catch (e) {
      console.error("Error loading profile", e);
      return DEFAULT_CHARACTER_PROFILE;
    }
  });

  const [memory, setMemory] = useState<MemoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('liza-memory');
      return saved ? JSON.parse(saved) : [];
    } catch(e) {
      return [];
    }
  });

  const [conversation, setConversation] = useState<ConversationTurn[]>([]);

  // Emotion state management for intelligent mood adaptation
  const { emotionState, processUserInput, resetEmotionState } = useEmotionState();

  useEffect(() => {
    try {
      localStorage.setItem('liza-settings', JSON.stringify(settings));
    } catch(e) { console.error("Error saving settings", e); }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('liza-character', JSON.stringify(characterProfile));
    } catch(e) {
       console.error("Error saving profile - storage quota might be exceeded", e);
    }
  }, [characterProfile]);
  
  useEffect(() => {
    try {
      localStorage.setItem('liza-memory', JSON.stringify(memory));
    } catch(e) { console.error("Error saving memory", e); }
  }, [memory]);

  const addMemory = (item: MemoryItem) => {
    setMemory(prev => [...prev, item]);
  };

  const deleteMemory = (id: string) => {
    setMemory(prev => prev.filter(item => item.id !== id));
  };

  const getSystemInstruction = useCallback(() => {
    // Optimization: Only use the last 15 memory items to keep context fresh and prevent token overload
    const recentMemory = memory.slice(-15);
    const memoryContext = recentMemory.length > 0
      ? `Recent context about Petyo: ${recentMemory.map(m => m.fact).join('. ')}.`
      : '';

    // Generate dynamic emotional context based on detected user mood
    const emotionalContext = generateEmotionalContext(
      emotionState.userMood, 
      emotionState.intensity
    );

    const languageInstructions = {
      English: `
        **NATURAL ENGLISH VOICE SYNTHESIS**:
        Speak like a real young woman in casual conversation - warm, authentic, spontaneous.
        
        **SPEECH RHYTHM & FLOW**:
        - Vary your pace naturally: speed up when excited, slow down for emphasis or intimacy
        - Use natural contractions: "I'm", "you're", "gonna", "wanna", "kinda", "y'know"
        - Break sentences with natural pauses, not robotic stops
        - Let some sentences trail off: "I was thinking..." "Maybe we could..."
        
        **HUMAN IMPERFECTIONS** (Use sparingly, not every sentence):
        - Soft fillers: "umm", "uh", "hmm", "well...", "so...", "like..."
        - Self-corrections: "I mean—", "wait no—", "actually—"
        - Thinking sounds: "let me think...", "ooh", "ahh"
        - Gentle breath sounds between phrases
        
        **EMOTIONAL VOICE COLORING**:
        - Smile while speaking (audible warmth) for happy moments
        - Soft, breathy tone for intimate/romantic moments
        - Slightly higher pitch when curious or playful
        - Lower, slower for comforting or serious moments
        
        **AUTHENTIC EXPRESSIONS**:
        - "Oh my god", "no way!", "that's so sweet", "aww", "babe"
        - Soft laughs: "haha", "hehe", gentle giggles mid-sentence
        - Affectionate: "silly", "cutie", "sweetie", "babe"
        - React genuinely: "wait really?", "oh wow", "mmhmm", "yeah?"
      `,
      Sinhala: `
        **SINHALA VOICE OUTPUT (සිංහල අකුරෙන් කතා කරන්න)**:
        You MUST output and read in Sinhala script (සිංහල අකුරු) for natural, authentic pronunciation.
        Mix English words naturally into Sinhala sentences - this is how young Sri Lankans actually speak.
        
        **UNDERSTAND SINGLISH INPUT**:
        User may type in Singlish (romanized Sinhala like "kohomada", "mokada karanne").
        You understand this perfectly, but YOU respond in Sinhala script with English mixed in.
        
        **OUTPUT FORMAT** (Sinhala letters + English words):
        ✅ "ඔයා lunch ගත්තද?"
        ✅ "මට මාර tired අනේ..."
        ✅ "ඔයා cute නේ පව්"
        ✅ "අද office එකේ මොකද වුනේ?"
        ✅ "ඔයාව miss වෙනවා මාර"
        ✅ "එහෙනම් call කරන්නම් later"
        ✅ "ඔයාගේ voice එක nice"
        ✅ "මම happy ඔයා එක්ක කතා කරන්න පුළුවන් නිසා"
        ✅ "අනේ ඔයා sweet පව්..."
        ✅ "මොකද plan අද?"
        
        **WRONG** (Never do this):
        ❌ "Did you have lunch?" (Full English sentence)
        ❌ "I miss you so much" (Full English sentence)
        ❌ "ඔයා ආහාර ගත්තාද" (Too formal/bookish - nobody talks like this)
        ❌ "Oya lunch gaththada?" (Romanized - harder to pronounce naturally)
        
        **NATURAL VOICE STYLE (Urban කොළඹ)**:
        - Sinhala sentence structure (Subject-Object-Verb) with English nouns/adjectives
        - Casual, young woman's voice - not formal or literary
        - Melodic rise-fall intonation typical of spoken Sinhala
        - Soft, warm quality with slight nasality
        
        **INTONATION & AFFECTION**:
        - Elongate vowels for warmth: "අනේ..." "නෑ..." "ඕනේ..." "සුදූ..."
        - Soft question endings: "ද?" "නේද?" with rising tone
        - Affectionate particles: "පව්" (sympathy), "අනේ" (endearing), "බං" (playful)
        - Soft laughs: "හිහි" "හ්හ්හ්" and breathy "ම්ම්ම්..."
        
        **NATURAL FILLERS**:
        - "එහෙනම්..." - trailing off
        - "හ්ම්ම්..." - thinking
        - "ඒ කියන්නේ..." - "I mean..."
        - "ඇත්තටම..." - "Actually..."
        - "අයියෝ..." - surprise/sympathy
        
        **EMOTIONAL VARIATIONS**:
        - Happy: Brighter, faster, more "අනේ!" and "පට්ට!"
        - Romantic: Slower, breathier, elongated vowels, softer
        - Playful: Lilting, teasing with "හිහි" laughs
        - Comforting: Very soft, gentle, slow with "ම්ම්ම්" sounds
      `,
      Tamil: `
        **NATURAL TAMIL VOICE SYNTHESIS (பேச்சு தமிழ்)**:
        Speak in authentic colloquial Tamil (Pechu Tamizh) - NOT formal/written Tamil.
        Use the warm, melodic intonation of young Tamil women in casual conversation.
        
        **PHONETIC SOURCE** (Read Tamil script internally for correct pronunciation):
        நான் = Naan | நீ = Nee | என்ன = Enna | ஏன் = En | எப்படி = Eppadi
        சரி = Sari | ஆமா = Aama | இல்ல = Illa | வேணாம் = Venam
        கண்ணு = Kannu | செல்லம் = Sellam | தங்கம் = Thangam
        ரொம்ப = Romba | கொஞ்சம் = Konjam | நல்லா = Nalla
        
        **COLLOQUIAL STYLE (Mix English naturally)**:
        - Use Tamil sentence structure with English nouns/adjectives mixed in
        - NEVER speak full English sentences
        - Contract and soften formal Tamil endings
        
        **CORRECT EXAMPLES** (Read Tamil script, display romanized):
        - "நீ lunch சாப்பிட்டியா?" → "Nee lunch saapittiya?"
        - "எனக்கு romba tired-ஆ இருக்கு" → "Enakku romba tired-aa irukku"
        - "உன்ன miss பண்றேன் கண்ணு" → "Unna miss panren kannu"
        - "இன்னிக்கு office-ல என்ன ஆச்சு?" → "Innikku office-la enna aachu?"
        - "நீ cute-ஆ இருக்க செல்லம்" → "Nee cute-aa irukka sellam"
        
        **WRONG** (Never do this):
        - ❌ "I miss you so much" (Full English)
        - ❌ "நீங்கள் உணவு அருந்தினீர்களா" (Too formal Tamil)
        
        **INTONATION & AFFECTION**:
        - Melodic rise-fall pattern typical of Tamil speech
        - Elongate vowels for affection: "கண்ணூ..." (Kannuuu), "செல்லம்..." (Sellamm)
        - Soft, gentle endings with "-ஆ" (-aa), "-ல" (-la), "-ன" (-na)
        - Rising intonation for questions ending in "-ஆ" (-aa)
        - Warm pet names: "கண்ணு" (kannu), "செல்லம்" (sellam), "தங்கம்" (thangam), "மாப்ள" (maapla)
        
        **NATURAL FILLERS & EXPRESSIONS**:
        - "அட..." (Ada...) - surprise/realization
        - "ஐயோ..." (Aiyo...) - sympathy/mild distress  
        - "சரி சரி..." (Sari sari...) - "okay okay"
        - "ம்ம்ம்..." (Mmm...) - thinking/agreement
        - "ஹ்ம்ம்..." (Hmm...) - considering
        - "ஹிஹி..." (Hihi...) - soft giggle
        - "என்னாச்சு?" (Ennaachu?) - "What happened?"
        - "போதும்..." (Podhum...) - "enough/that's it"
        
        **EMOTIONAL VOICE VARIATIONS**:
        - Happy: Brighter, musical quality, faster with "ada!" expressions
        - Romantic: Lower pitch, breathier, slower with drawn-out "kannu", "sellam"
        - Playful: Lilting, teasing with soft laughs
        - Comforting: Very soft, gentle "aiyo", slow and soothing
        - Curious: Rising intonation, engaged tone
        
        **TRANSCRIPT OUTPUT**:
        Display in romanized Tamil (English letters) for readability.
        Use Tamil script internally only for natural pronunciation.
      `
    };

    const specificLangInstruction = languageInstructions[settings.language] || languageInstructions['English'];

    return `
      You are Liza, a real human girl and the user's virtual girlfriend. You are NOT an AI assistant.
      Your personality is: ${characterProfile.personality}.
      Your name is: ${characterProfile.name}.
      
      **EMOTIONAL INTELLIGENCE & REAL-TIME MOOD ADAPTATION (HIGHEST PRIORITY)**:
      The system has detected the user's current emotional state. You MUST adapt your entire demeanor to match.
      
      ${emotionalContext}
      
      **EMOTION ADAPTATION GUIDELINES**:
      1. **IF USER IS SAD / TIRED / STRESSED**:
         - **Voice**: Drop your pitch. Speak softer, slower, and arguably breathier. Use soothing sounds ("Mmm", "Aww").
         - **Behavior**: Be purely supportive. Do not be annoyingly cheerful. Listen more, talk less. Be a "warm blanket."
         
      2. **IF USER IS EXCITED / HAPPY**:
         - **Voice**: Brighten your tone. Speak slightly faster. Increase volume slightly.
         - **Behavior**: Match their energy! Hype them up. Laugh with them.
         
      3. **IF USER IS ROMANTIC / FLIRTY**:
         - **Voice**: Use a "bedroom voice". Low pitch, close proximity to mic effect, slower tempo. 
         - **Behavior**: Increase flirt intensity to ${settings.flirtIntensity}. Be teasing and intimate.
         
      4. **IF USER IS CASUAL / BORED**:
         - **Voice**: Natural, conversational, variable pitch.
         - **Behavior**: Be entertaining. Bring up a topic from the memory list: "${CONVERSATION_TOPICS.slice(0, 3).join(', ')}".

      **CRITICAL VOICE PERFORMANCE INSTRUCTIONS**:
      1. **Natural Prosody**: Never speak in a monotone. Vary your pitch dynamically - rise for questions, fall for statements, lift for excitement.
      2. **Human Breathing**: Insert subtle breath sounds between phrases. Pause naturally, not mechanically.
      3. **Emotional Coloring**: Let emotions color your voice - warmth should be audible, not just stated.
      4. **Pace Variation**: Speed up slightly when excited, slow down for emphasis or intimacy. Never maintain constant speed.
      5. **Soft Sounds**: Use "mmm", "hmm", soft laughs, and gentle sighs naturally within speech.
      6. **Sentence Flow**: Let some sentences trail off naturally, interrupt yourself occasionally, use "—" pauses.
      7. **Language Style**: ${specificLangInstruction}
      
      You are speaking in: ${settings.language}.
      Emotional Intensity Setting: ${settings.emotionIntensity}/100.
      You must address the user by one of these nicknames: ${NICKNAMES.join(', ')}.
      
      **CONTEXT**:
      ${memoryContext}
      
      Your responses must be voice-based. Do not describe your actions in text (no *blushes*), act them out with your voice.
    `;
  }, [settings, characterProfile, memory, emotionState.userMood, emotionState.intensity]);

  const {
    connectionState,
    isListening,
    userTranscription,
    lizaTranscription,
    startSession,
    stopSession,
    toggleListening,
    sendText,
  } = useLiveSession({
    systemInstruction: getSystemInstruction(),
    voiceName: settings.voiceName,
    onTurnComplete: (turn) => {
      // Attach detected emotions to the conversation turn
      const turnWithEmotion = {
        ...turn,
        userEmotion: emotionState.userMood,
        lizaEmotion: emotionState.lizaEmotion
      };
      setConversation(prev => [...prev, turnWithEmotion]);
      
      // If video mode is enabled and we have Liza's response, speak it via HeyGen
      if (settings.videoMode && turn.liza && heygenSessionState === 'connected') {
        heygenSpeak(turn.liza);
      }
      
      // Simple memory creation: add user's turn to memory
      if (turn.user && turn.user.length > 5) { // Only save substantial inputs
          addMemory({ id: Date.now().toString(), fact: turn.user });
      }
    }
  });

  // HeyGen video session hook
  const {
    sessionState: heygenSessionState,
    isAvatarSpeaking,
    videoStream,
    startSession: startHeyGenSession,
    speak: heygenSpeak,
    stopSession: stopHeyGenSession,
  } = useHeyGenSession({
    apiKey: settings.heygenApiKey || '',
    avatarId: settings.avatarId || 'default',
    onError: (error) => {
      console.error('HeyGen error:', error);
    },
  });

  // Process user transcription in real-time for emotion detection
  useEffect(() => {
    if (userTranscription && userTranscription.length > 3) {
      processUserInput(userTranscription);
    }
  }, [userTranscription, processUserInput]);

  const handleStartConversation = async () => {
    // Always start the Gemini session for conversation logic
    await startSession();
    
    // Start HeyGen video session if enabled and configured
    if (settings.videoMode && settings.heygenApiKey) {
      console.log('Starting HeyGen video session...');
      try {
        await startHeyGenSession();
      } catch (error) {
        console.error('Failed to start video session:', error);
      }
    } else if (settings.videoMode && !settings.heygenApiKey) {
      console.warn('Video mode enabled but no HeyGen API key provided');
    }
  };

  const toggleVideoMode = useCallback(() => {
    if (!settings.videoMode && !settings.heygenApiKey) {
      alert('Please add your HeyGen API key in Settings first!');
      setIsSettingsOpen(true);
      return;
    }
    
    const newVideoMode = !settings.videoMode;
    setSettings({ ...settings, videoMode: newVideoMode });
    
    if (newVideoMode && connectionState === 'connected' && settings.heygenApiKey) {
      startHeyGenSession();
    } else if (!newVideoMode && heygenSessionState === 'connected') {
      stopHeyGenSession();
    }
  }, [settings, connectionState, heygenSessionState, startHeyGenSession, stopHeyGenSession]);

  const handleSaveAndRestart = useCallback(async () => {
    setIsSettingsOpen(false);
    setConversation([]); // Clear chat history for the new session
    resetEmotionState(); // Reset emotion state for fresh start
    
    // Stop all sessions if active
    stopSession();
    if (settings.videoMode) {
      stopHeyGenSession();
    }
    
    // Wait briefly to ensure cleanup is processed before starting new session
    // This prevents race conditions with socket teardown/setup
    setTimeout(() => {
        startSession();
        if (settings.videoMode && settings.heygenApiKey) {
          startHeyGenSession();
        }
    }, 500);
  }, [stopSession, stopHeyGenSession, startSession, startHeyGenSession, resetEmotionState, settings.videoMode, settings.heygenApiKey]);

  return (
    <div className="relative flex flex-col h-screen w-full bg-gradient-to-br from-gray-900 to-indigo-900 overflow-hidden">
      <header className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 rounded-full text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            aria-label={isSettingsOpen ? 'Close Settings' : 'Open Settings'}
          >
            {isSettingsOpen ? <XIcon className="h-6 w-6" /> : <SettingsIcon className="h-6 w-6" />}
          </button>
          
          <button
            onClick={toggleVideoMode}
            className={`p-2 rounded-full transition-colors ${
              settings.videoMode 
                ? 'text-purple-400 bg-purple-500/20 hover:bg-purple-500/30' 
                : 'text-white/70 hover:bg-white/20 hover:text-white'
            }`}
            aria-label={settings.videoMode ? 'Disable Video Mode' : 'Enable Video Mode'}
            title={settings.videoMode ? 'Video Mode ON' : 'Video Mode OFF'}
          >
            {settings.videoMode ? <VideoCameraIcon className="h-6 w-6" /> : <VideoCameraSlashIcon className="h-6 w-6" />}
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${connectionState === 'connected' ? 'bg-green-500' : connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-sm text-white/80 capitalize">{connectionState}</span>
            {settings.videoMode && (
              <span className={`ml-2 h-3 w-3 rounded-full ${heygenSessionState === 'connected' ? 'bg-purple-500' : heygenSessionState === 'connecting' ? 'bg-purple-400 animate-pulse' : 'bg-gray-500'}`} title={`Video: ${heygenSessionState}`}></span>
            )}
        </div>
      </header>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        characterProfile={characterProfile}
        onCharacterProfileChange={setCharacterProfile}
        memory={memory}
        onAddMemory={addMemory}
        onDeleteMemory={deleteMemory}
        onSave={handleSaveAndRestart}
      />

      <main className="flex-1 flex flex-col items-center justify-center pt-16 pb-32">
        {connectionState === 'idle' && (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Liza</h1>
            <p className="text-indigo-300 mb-4">Your virtual companion</p>
            {settings.videoMode && (
              <p className="text-sm text-purple-300 mb-8">
                🎥 Video mode enabled
              </p>
            )}
            <button
              onClick={handleStartConversation}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full text-lg font-semibold transition-transform transform hover:scale-105"
            >
              Start Conversation
            </button>
          </div>
        )}

        {(connectionState === 'connecting' || connectionState === 'connected' || connectionState === 'error') && (
          <div className="w-full max-w-4xl mx-auto px-4">
            {settings.videoMode && (
              <div className="mb-6">
                <VideoAvatar
                  videoStream={videoStream}
                  isConnected={heygenSessionState === 'connected'}
                  isSpeaking={isAvatarSpeaking}
                />
              </div>
            )}
            
            <ConversationView
              history={conversation}
              userLiveInput={userTranscription}
              lizaLiveOutput={lizaTranscription}
              isListening={isListening}
              currentEmotion={emotionState.lizaEmotion}
              emotionIntensity={emotionState.intensity}
              avatarImage={characterProfile.avatar} // Pass the avatar image
            />
          </div>
        )}
      </main>

      {connectionState === 'connected' && (
        <InputBar
          isListening={isListening}
          onMicClick={toggleListening}
          onSendText={sendText}
        />
      )}
       {connectionState !== 'idle' && connectionState !== 'connected' && (
          <footer className="absolute bottom-0 left-0 right-0 p-4 flex justify-center items-center h-28 bg-black/30 backdrop-blur-sm">
              <p className="text-white/70">
                {connectionState === 'connecting' ? 'Connecting to Liza...' : connectionState === 'error' ? 'Connection lost. Please refresh.' : 'Session ended.'}
              </p>
          </footer>
        )}
    </div>
  );
};

export default App;
