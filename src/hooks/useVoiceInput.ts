import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// ── Minimal Web Speech Recognition typings ─────────────────────────────────
// The API is widely supported (Chrome/Edge/Safari) but not yet in lib.dom,
// so we declare just enough of the surface we use here.
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionResult {
    readonly length: number;
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
    error: string;
    message: string;
}

interface SpeechRecognitionLike extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
    onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    }
}

// Map the app's language keys to BCP-47 tags understood by the Web Speech API.
const BCP47: Record<string, string> = {
    english: 'en-US',
    tamil: 'ta-IN',
    sinhala: 'si-LK',
};

export interface UseVoiceInputOptions {
    /** App language key (e.g. 'english'). Falls back to en-US. */
    language?: string;
    /** Called with the full recognized text (base + accumulated + interim). */
    onResult?: (text: string) => void;
}

export interface UseVoiceInputReturn {
    isListening: boolean;
    supported: boolean;
    /** Begin listening. `baseText` is prepended to the recognized transcript. */
    start: (baseText?: string) => void;
    stop: () => void;
    /** Toggle listening on/off, preserving `baseText` when starting. */
    toggle: (baseText?: string) => void;
}

/**
 * Browser-native speech-to-text for a single text input.
 *
 * Uses the Web Speech Recognition API (no deps, no API key). While listening,
 * `onResult` fires with the live transcript so the bound input updates in real
 * time. On unsupported browsers `supported` is false and `start` shows a toast.
 */
export const useVoiceInput = ({
    language = 'english',
    onResult,
}: UseVoiceInputOptions = {}): UseVoiceInputReturn => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const onResultRef = useRef(onResult);
    // Text present in the input when listening began — prepended to transcript.
    const baseRef = useRef('');
    // Accumulated *final* transcript chunks across continuous results.
    const accumulatedRef = useRef('');

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    const supported = typeof window !== 'undefined'
        && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    const stop = useCallback(() => {
        const rec = recognitionRef.current;
        if (rec) {
            try { rec.stop(); } catch { /* ignore — already stopped */ }
        }
        setIsListening(false);
    }, []);

    const start = useCallback((baseText = '') => {
        const Ctor = typeof window !== 'undefined'
            ? (window.SpeechRecognition || window.webkitSpeechRecognition)
            : undefined;

        if (!Ctor) {
            toast.error('Voice input is not supported', {
                description: 'Try Chrome or Edge for microphone speech recognition.',
            });
            return;
        }

        // Tear down any previous instance before starting a fresh one.
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* ignore */ }
        }

        const rec = new Ctor();
        rec.lang = BCP47[language] ?? 'en-US';
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;

        baseRef.current = baseText;
        accumulatedRef.current = '';

        rec.onstart = () => setIsListening(true);

        rec.onend = () => {
            setIsListening(false);
            // Emit the final accumulated text so the input keeps the last value.
            const finalText = baseRef.current + accumulatedRef.current;
            onResultRef.current?.(finalText.trim());
        };

        rec.onerror = (ev) => {
            setIsListening(false);
            if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
                toast.error('Microphone permission denied', {
                    description: 'Allow microphone access in your browser to use voice input.',
                });
            } else if (ev.error === 'no-speech' || ev.error === 'aborted') {
                // Benign — no user-visible action needed.
            } else {
                toast.error('Voice input error', { description: ev.error });
            }
        };

        rec.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0]?.transcript ?? '';
                if (result.isFinal) {
                    accumulatedRef.current += transcript;
                } else {
                    interim += transcript;
                }
            }
            const composed = baseRef.current + accumulatedRef.current + interim;
            onResultRef.current?.(composed.replace(/\s+/g, ' ').trim());
        };

        try {
            rec.start();
            recognitionRef.current = rec;
        } catch {
            // Some browsers throw if start() is called immediately after stop().
            toast.error('Could not start voice input', {
                description: 'Please wait a moment and try again.',
            });
        }
    }, [language]);

    const toggle = useCallback((baseText?: string) => {
        if (isListening) stop();
        else start(baseText);
    }, [isListening, start, stop]);

    // Abort any in-flight recognition when the component unmounts.
    useEffect(() => () => {
        const rec = recognitionRef.current;
        if (rec) {
            try { rec.abort(); } catch { /* ignore */ }
        }
    }, []);

    return { isListening, supported, start, stop, toggle };
};
