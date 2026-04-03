import { useState, useCallback, useRef } from 'react';
import type { EmotionType, EmotionState } from '@/types';
import { DEFAULT_EMOTION_STATE } from '@/constants';
import { 
  analyzeEmotion, 
  mapUserMoodToLizaEmotion, 
  smoothEmotionTransition 
} from '@/lib/emotionAnalyzer';

interface UseEmotionStateReturn {
  emotionState: EmotionState;
  processUserInput: (text: string) => void;
  resetEmotionState: () => void;
  getEmotionalContext: () => { userMood: EmotionType; lizaEmotion: EmotionType; intensity: number };
}

const MAX_HISTORY_LENGTH = 10;

export const useEmotionState = (): UseEmotionStateReturn => {
  const [emotionState, setEmotionState] = useState<EmotionState>(DEFAULT_EMOTION_STATE);
  
  const lastAnalyzedTextRef = useRef<string>('');

  const processUserInput = useCallback((text: string) => {
    if (!text || text.length < 3 || text === lastAnalyzedTextRef.current) {
      return;
    }
    
    lastAnalyzedTextRef.current = text;

    setEmotionState(prevState => {
      const analysis = analyzeEmotion(text, prevState.userMood);
      
      const smoothedUserMood = smoothEmotionTransition(
        prevState.userMood,
        analysis.detectedEmotion,
        prevState.emotionHistory
      );

      if (analysis.confidence < 0.35 && smoothedUserMood === prevState.userMood) {
        return prevState;
      }

      const lizaEmotion = mapUserMoodToLizaEmotion(smoothedUserMood);

      const newHistory = [...prevState.emotionHistory, smoothedUserMood];
      if (newHistory.length > MAX_HISTORY_LENGTH) {
        newHistory.shift();
      }

      return {
        userMood: smoothedUserMood,
        lizaEmotion,
        confidence: analysis.confidence,
        intensity: analysis.intensity,
        emotionHistory: newHistory,
        lastUpdated: Date.now()
      };
    });
  }, []);

  const resetEmotionState = useCallback(() => {
    setEmotionState(DEFAULT_EMOTION_STATE);
    lastAnalyzedTextRef.current = '';
  }, []);

  const getEmotionalContext = useCallback(() => {
    return {
      userMood: emotionState.userMood,
      lizaEmotion: emotionState.lizaEmotion,
      intensity: emotionState.intensity
    };
  }, [emotionState.userMood, emotionState.lizaEmotion, emotionState.intensity]);

  return {
    emotionState,
    processUserInput,
    resetEmotionState,
    getEmotionalContext
  };
};
