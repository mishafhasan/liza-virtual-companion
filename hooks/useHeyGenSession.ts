import { useState, useRef, useCallback, useEffect } from 'react';
import StreamingAvatar, { 
  AvatarQuality, 
  StreamingEvents, 
  TaskType,
  VoiceEmotion 
} from '@heygen/streaming-avatar';

type SessionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

interface UseHeyGenSessionProps {
  apiKey: string;
  avatarId?: string;
  onAvatarSpeaking?: (isPlaying: boolean) => void;
  onError?: (error: Error) => void;
}

export const useHeyGenSession = ({ 
  apiKey, 
  avatarId = 'default',
  onAvatarSpeaking,
  onError 
}: UseHeyGenSessionProps) => {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);

  // Initialize HeyGen session
  const startSession = useCallback(async () => {
    if (sessionIdRef.current || isInitializingRef.current) {
      console.log('Session already exists or initializing');
      return;
    }
    
    if (!apiKey) {
      console.error('No HeyGen API key provided');
      setSessionState('error');
      onError?.(new Error('HeyGen API key is required'));
      return;
    }

    isInitializingRef.current = true;
    setSessionState('connecting');
    console.log('Initializing HeyGen session with API key:', apiKey.substring(0, 10) + '...');

    try {
      // Create new StreamingAvatar instance
      console.log('Creating StreamingAvatar instance...');
      const avatar = new StreamingAvatar({ token: apiKey });
      avatarRef.current = avatar;
      console.log('StreamingAvatar instance created');

      // Set up event listeners
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        console.log('Stream ready:', event);
        if (event.detail) {
          setVideoStream(event.detail);
        }
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log('Stream disconnected');
        setSessionState('closed');
        setVideoStream(null);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        console.log('Avatar started talking');
        setIsAvatarSpeaking(true);
        onAvatarSpeaking?.(true);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        console.log('Avatar stopped talking');
        setIsAvatarSpeaking(false);
        onAvatarSpeaking?.(false);
      });

      // Create and start avatar session
      console.log('Creating avatar with ID:', avatarId);
      const sessionData = await avatar.createStartAvatar({
        avatarName: avatarId,
        quality: AvatarQuality.High,
        voice: {
          rate: 1.0,
        },
      });

      sessionIdRef.current = sessionData.session_id;
      setSessionState('connected');
      console.log('✅ HeyGen session started successfully:', sessionData.session_id);
      console.log('Session data:', sessionData);

    } catch (error) {
      console.error('Failed to start HeyGen session:', error);
      setSessionState('error');
      onError?.(error as Error);
    } finally {
      isInitializingRef.current = false;
    }
  }, [apiKey, avatarId, onAvatarSpeaking, onError]);

  // Speak with the avatar
  const speak = useCallback(async (text: string, emotion?: VoiceEmotion) => {
    if (!avatarRef.current || !sessionIdRef.current) {
      console.warn('No active session');
      return;
    }

    try {
      await avatarRef.current.speak({
        text,
        taskType: TaskType.REPEAT,
        taskMode: 'sync',
      });
    } catch (error) {
      console.error('Failed to speak:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Stop the avatar session
  const stopSession = useCallback(async () => {
    if (!avatarRef.current || !sessionIdRef.current) return;

    try {
      await avatarRef.current.stopAvatar();
      avatarRef.current = null;
      sessionIdRef.current = null;
      setSessionState('closed');
      setVideoStream(null);
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  }, []);

  // Interrupt current speech
  const interrupt = useCallback(async () => {
    if (!avatarRef.current || !sessionIdRef.current) return;

    try {
      await avatarRef.current.interrupt();
    } catch (error) {
      console.error('Failed to interrupt:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        stopSession();
      }
    };
  }, [stopSession]);

  return {
    sessionState,
    isAvatarSpeaking,
    videoStream,
    startSession,
    speak,
    stopSession,
    interrupt,
  };
};
