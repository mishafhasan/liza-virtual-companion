import { useState, useRef, useCallback, useEffect } from 'react';
import StreamingAvatar, { 
  AvatarQuality, 
  StreamingEvents, 
  TaskType,
  TaskMode,
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

  const startSession = useCallback(async () => {
    if (sessionIdRef.current || isInitializingRef.current) return;
    
    if (!apiKey) {
      setSessionState('error');
      onError?.(new Error('HeyGen API key is required'));
      return;
    }

    isInitializingRef.current = true;
    setSessionState('connecting');

    try {
      const avatar = new StreamingAvatar({ token: apiKey });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        if (event.detail) setVideoStream(event.detail);
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setSessionState('closed');
        setVideoStream(null);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setIsAvatarSpeaking(true);
        onAvatarSpeaking?.(true);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setIsAvatarSpeaking(false);
        onAvatarSpeaking?.(false);
      });

      const sessionData = await avatar.createStartAvatar({
        avatarName: avatarId,
        quality: AvatarQuality.High,
        voice: { rate: 1.0 },
      });

      sessionIdRef.current = sessionData.session_id;
      setSessionState('connected');
    } catch (error) {
      console.error('Failed to start HeyGen session:', error);
      setSessionState('error');
      onError?.(error as Error);
    } finally {
      isInitializingRef.current = false;
    }
  }, [apiKey, avatarId, onAvatarSpeaking, onError]);

  const speak = useCallback(async (text: string, _emotion?: VoiceEmotion) => {
    if (!avatarRef.current || !sessionIdRef.current) return;

    try {
      await avatarRef.current.speak({
        text,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC,
      });
    } catch (error) {
      console.error('Failed to speak:', error);
      onError?.(error as Error);
    }
  }, [onError]);

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

  const interrupt = useCallback(async () => {
    if (!avatarRef.current || !sessionIdRef.current) return;

    try {
      await avatarRef.current.interrupt();
    } catch (error) {
      console.error('Failed to interrupt:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (sessionIdRef.current) stopSession();
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
