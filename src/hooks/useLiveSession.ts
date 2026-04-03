import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { encode, decode, decodeAudioData } from '@/lib/audioUtils';
import type { ConversationTurn } from '@/types';

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

interface UseLiveSessionProps {
  systemInstruction: string;
  voiceName: string;
  onTurnComplete: (turn: ConversationTurn) => void;
}

export const useLiveSession = ({ systemInstruction, voiceName, onTurnComplete }: UseLiveSessionProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [userTranscription, setUserTranscription] = useState('');
  const [lizaTranscription, setLizaTranscription] = useState('');
  
  const sessionRef = useRef<LiveSession | null>(null);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const stopAudioProcessing = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
     if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
  }, []);

  const cleanupSession = useCallback(() => {
      stopAudioProcessing();
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      sessionPromiseRef.current = null;
      setConnectionState('closed');
      setIsListening(false);
  }, [stopAudioProcessing]);

  const startSession = useCallback(async () => {
    if (sessionRef.current || connectionState === 'connecting') return;

    setConnectionState('connecting');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' } },
          },
        },
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
            setIsListening(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputTranscriptionRef.current += text;
              setUserTranscription(currentInputTranscriptionRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputTranscriptionRef.current += text;
              setLizaTranscription(currentOutputTranscriptionRef.current);
            }
            
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const oac = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, oac.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), oac, 24000, 1);
              const source = oac.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(oac.destination);
              source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.turnComplete) {
              const turn = {
                user: currentInputTranscriptionRef.current,
                liza: currentOutputTranscriptionRef.current,
              };
              if (turn.user || turn.liza) {
                  onTurnComplete(turn);
              }
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
              setUserTranscription('');
              setLizaTranscription('');
            }
          },
          onclose: () => {
            cleanupSession();
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setConnectionState('error');
            cleanupSession();
          },
        },
      });
      
      sessionPromiseRef.current = sessionPromise;
      sessionRef.current = await sessionPromise;
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    } catch (error) {
      console.error('Failed to start session:', error);
      setConnectionState('error');
      cleanupSession();
    }
  }, [systemInstruction, voiceName, cleanupSession, onTurnComplete]);
  
  const startAudioInput = useCallback(async () => {
      if (!audioContextRef.current) return;
      const context = audioContextRef.current;
      
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = context.createMediaStreamSource(mediaStreamRef.current);
        const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
            }
            const pcmBlob: GenAIBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromiseRef.current?.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(context.destination);
        scriptProcessorRef.current = scriptProcessor;
      } catch(err) {
        console.error("Error getting user media", err);
        setConnectionState('error');
      }
  }, []);

  useEffect(() => {
    if (isListening && connectionState === 'connected') {
        startAudioInput();
    } else {
        if(mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
    }
  }, [isListening, connectionState, startAudioInput]);

  const stopSession = useCallback(() => {
    cleanupSession();
  }, [cleanupSession]);

  const toggleListening = () => {
      setIsListening(prev => !prev);
  }
  
  const sendText = useCallback((text: string) => {
    if (sessionRef.current && text) {
      sessionRef.current.sendRealtimeInput({ text });
       onTurnComplete({ user: text });
    }
  }, [onTurnComplete]);

  return { connectionState, isListening, userTranscription, lizaTranscription, startSession, stopSession, toggleListening, sendText };
};
