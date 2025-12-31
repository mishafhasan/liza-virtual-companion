import { useState, useCallback, useRef } from 'react';
import type { EmotionType, EmotionState } from '../types';
import { DEFAULT_EMOTION_STATE } from '../constants';
import { 
  analyzeEmotion, 
  mapUserMoodToLizaEmotion, 
  smoothEmotionTransition 
} from '../lib/emotionAnalyzer';

interface UseEmotionStateReturn {
  emotionState: EmotionState;
  processUserInput: (text: string) => void;
  resetEmotionState: () => void;
  getEmotionalContext: () => { userMood: EmotionType; lizaEmotion: EmotionType; intensity: number };
}

const MAX_HISTORY_LENGTH = 10;

export const useEmotionState = (): UseEmotionStateReturn => {
  const [emotionState, setEmotionState] = useState<EmotionState>(DEFAULT_EMOTION_STATE);
  
  // Use a ref for real-time tracking without triggering re-renders
  const lastAnalyzedTextRef = useRef<string>('');

  /**
   * Process user input text to detect and update emotional state
   */
  const processUserInput = useCallback((text: string) => {
    // Skip if text is too short or same as last
    if (!text || text.length < 3 || text === lastAnalyzedTextRef.current) {
      return;
    }
    
    lastAnalyzedTextRef.current = text;

    setEmotionState(prevState => {
      // Analyze the new text
      const analysis = analyzeEmotion(text, prevState.userMood);
      
      // Smooth the transition to prevent jarring emotion changes
      const smoothedUserMood = smoothEmotionTransition(
        prevState.userMood,
        analysis.detectedEmotion,
        prevState.emotionHistory
      );

      // Only update if confidence is high enough or emotion is different
      if (analysis.confidence < 0.35 && smoothedUserMood === prevState.userMood) {
        return prevState;
      }

      // Map user mood to Liza's emotional response
      const lizaEmotion = mapUserMoodToLizaEmotion(smoothedUserMood);

      // Update emotion history
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

  /**
   * Reset emotion state to default
   */
  const resetEmotionState = useCallback(() => {
    setEmotionState(DEFAULT_EMOTION_STATE);
    lastAnalyzedTextRef.current = '';
  }, []);

  /**
   * Get current emotional context for system instructions
   */
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
