import React, { useEffect, useRef, useState } from 'react';
import { Mic, PhoneOff, Send, Volume2, Video, VideoOff, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EMOTION_COLORS, EMOTION_LABELS } from '@/constants';
import type { EmotionType, ConversationTurn } from '@/types';

interface VoiceModeOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    isConnected: boolean;
    isListening: boolean;
    onToggleListening: () => void;
    userTranscription: string;
    lizaTranscription: string;
    currentEmotion: EmotionType;
    emotionIntensity: number;
    language: string;
    isVideoMode?: boolean;
    videoStream?: MediaStream | null;
    heygenSessionState?: string;
    isAvatarSpeaking?: boolean;
    onSendText?: (text: string) => void;
    conversationHistory?: ConversationTurn[];
    characterAvatar?: string;
    characterName?: string;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
    isOpen, onClose, isConnected, isListening,
    onToggleListening, userTranscription, lizaTranscription,
    currentEmotion, emotionIntensity, language,
    isVideoMode, videoStream, heygenSessionState,
    isAvatarSpeaking, onSendText, conversationHistory = [],
    characterAvatar, characterName = 'Liza',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [textInput, setTextInput] = useState('');
    const [callSeconds, setCallSeconds] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    const rgbToRgba = (rgb: string, alpha: number) => {
        return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    };

    const emotionColor = EMOTION_COLORS[currentEmotion] || EMOTION_COLORS.neutral;

    // Attach video stream
    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    // Auto-scroll conversation
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversationHistory.length, lizaTranscription, userTranscription]);

    // Call timer
    useEffect(() => {
        if (!isOpen || !isConnected) {
            setCallSeconds(0);
            return;
        }
        const timer = window.setInterval(() => {
            setCallSeconds((prev) => prev + 1);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [isOpen, isConnected]);

    // Animated orb visualizer
    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        const size = characterAvatar ? 64 : 300;
        canvas.width = size;
        canvas.height = size;

        let phase = 0;
        const baseRadius = characterAvatar ? 20 : 70;
        const intensity = emotionIntensity / 100;

        const draw = () => {
            ctx.clearRect(0, 0, size, size);
            const cx = size / 2;
            const cy = size / 2;

            // Outer glow rings
            for (let i = 4; i >= 0; i--) {
                const r = baseRadius + i * (characterAvatar ? 8 : 25) + Math.sin(phase + i * 0.5) * (characterAvatar ? 4 : 12) * intensity;
                const alpha = 0.06 - i * 0.01;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = rgbToRgba(emotionColor.primary, alpha);
                ctx.fill();
            }

            // Main orb gradient
            const mainRadius = baseRadius + Math.sin(phase * 2) * (characterAvatar ? 3 : 10) * intensity;
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, mainRadius);
            gradient.addColorStop(0, emotionColor.primary);
            gradient.addColorStop(0.5, rgbToRgba(emotionColor.primary, 0.8));
            gradient.addColorStop(1, rgbToRgba(emotionColor.primary, 0));
            ctx.beginPath();
            ctx.arc(cx, cy, mainRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Listening pulse ring
            if (isListening) {
                const pulseR = baseRadius + (characterAvatar ? 15 : 45) + Math.sin(phase * 4) * (characterAvatar ? 6 : 20);
                ctx.beginPath();
                ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
                ctx.strokeStyle = rgbToRgba(emotionColor.primary, 0.4);
                ctx.lineWidth = characterAvatar ? 2 : 3;
                ctx.stroke();
            }

            phase += 0.04;
            animationFrameRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isOpen, currentEmotion, emotionIntensity, isListening, characterAvatar, emotionColor]);

    const handleSendText = () => {
        if (!textInput.trim() || !onSendText) return;
        onSendText(textInput.trim());
        setTextInput('');
    };

    const formatDuration = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    const showVideo = isVideoMode && videoStream && heygenSessionState === 'connected';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0c0f1a] via-[#151b2e] to-[#0d1117]">
                {/* Floating orbs */}
                <div 
                    className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 animate-pulse-slow"
                    style={{ background: `radial-gradient(circle, ${emotionColor.glow} 0%, transparent 70%)` }}
                />
                <div 
                    className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-25 animate-pulse-slow"
                    style={{ background: `radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)`, animationDelay: '2s' }}
                />
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            {/* Main Container */}
            <div className="relative w-full max-w-md h-full max-h-[95vh] sm:max-h-[90vh] mx-2 sm:mx-0 flex flex-col rounded-3xl sm:rounded-[40px] overflow-hidden shadow-2xl border border-white/10"
                 style={{ background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 26, 0.98) 100%)' }}>
                
                {/* Glass overlay */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.03] via-transparent to-black/30" />

                {/* ===== HEADER ===== */}
                <div className="relative z-10 px-5 pt-5 pb-3">
                    <div className="flex items-center justify-between">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm">
                            <span className={`relative flex h-2.5 w-2.5`}>
                                <span className={`absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75 animate-ping`} />
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            </span>
                            <span className="text-sm font-medium text-white/90 tracking-wide">
                                {isConnected ? 'Connected' : 'Connecting...'}
                            </span>
                        </div>

                        {/* Header Actions */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ===== MAIN CONTENT ===== */}
                <div className="relative z-10 flex-1 flex flex-col px-5 py-2 overflow-hidden">
                    
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center mt-2 mb-4">
                        {/* Avatar Container */}
                        <div className="relative">
                            {/* Animated rings */}
                            <div 
                                className="absolute -inset-3 rounded-full opacity-60"
                                style={{ 
                                    background: `conic-gradient(from 0deg, ${emotionColor.glow}, rgba(139, 92, 246, 0.4), ${emotionColor.glow})`,
                                    animation: 'spin 12s linear infinite'
                                }}
                            />
                            <div 
                                className="absolute -inset-2 rounded-full opacity-40"
                                style={{ 
                                    background: `conic-gradient(from 180deg, rgba(139, 92, 246, 0.5), ${emotionColor.glow}, rgba(139, 92, 246, 0.5))`,
                                    animation: 'spin 18s linear infinite reverse'
                                }}
                            />
                            
                            {/* Avatar */}
                            <div 
                                className="relative w-44 h-44 rounded-full overflow-hidden border-[5px] border-white/10 z-10"
                                style={{ boxShadow: `0 0 50px ${emotionColor.glow}, inset 0 0 30px rgba(0,0,0,0.3)` }}
                            >
                                {showVideo ? (
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                ) : characterAvatar ? (
                                    <img src={characterAvatar} alt={characterName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-pink-900/30 flex items-center justify-center">
                                        <canvas ref={canvasRef} className="w-full h-full" />
                                    </div>
                                )}
                            </div>

                            {/* Speaking/Listening Indicator */}
                            {(isListening || isAvatarSpeaking) && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500/90 border border-emerald-400/50 z-20">
                                    <span className="text-[10px] font-semibold text-white uppercase tracking-wider">
                                        {isAvatarSpeaking ? 'Speaking' : 'Listening'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Name & Status */}
                        <div className="text-center mt-6">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{characterName}</h2>
                            <div className="mt-2 flex items-center justify-center gap-3">
                                {/* Audio Waves */}
                                <div className="flex items-end gap-0.5 h-4">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <span
                                            key={i}
                                            className="w-1 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400"
                                            style={{
                                                height: `${[10, 18, 14, 22, 16][i]}px`,
                                                animation: isListening || isAvatarSpeaking ? `typingDot 1s ease-in-out ${i * 0.15}s infinite` : 'none',
                                                opacity: isListening || isAvatarSpeaking ? 1 : 0.3
                                            }}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm text-white/60 font-medium">
                                    {isAvatarSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Ready'}
                                </span>
                            </div>
                        </div>

                        {/* Info Bar */}
                        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/50">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-mono">{formatDuration(callSeconds)}</span>
                            </div>
                            <div className="w-px h-3 bg-white/20" />
                            <span>{language}</span>
                            <div className="w-px h-3 bg-white/20" />
                            <span className={emotionColor.text}>{EMOTION_LABELS[currentEmotion]}</span>
                        </div>
                    </div>

                    {/* Live Transcription */}
                    {(lizaTranscription || userTranscription) && (
                        <div className="mb-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                            {lizaTranscription && (
                                <p className="text-sm text-purple-200">
                                    <span className="text-purple-400 font-semibold">{characterName}: </span>
                                    {lizaTranscription}
                                </p>
                            )}
                            {userTranscription && (
                                <p className="text-sm text-gray-300 mt-1.5">
                                    <span className="text-gray-400 font-semibold">You: </span>
                                    {userTranscription}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Chat History */}
                    {conversationHistory.length > 0 && (
                        <div className="flex-1 min-h-0 mb-3 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden">
                            <div className="px-4 py-2 border-b border-white/5">
                                <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Conversation</span>
                            </div>
                            <div ref={scrollRef} className="h-full overflow-y-auto p-3 space-y-3 scrollbar-thin">
                                {conversationHistory.map((turn, i) => (
                                    <div key={i} className="space-y-2">
                                        {turn.user && (
                                            <div className="flex justify-end">
                                                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
                                                    <p className="text-sm text-white/90">{turn.user}</p>
                                                </div>
                                            </div>
                                        )}
                                        {turn.liza && (
                                            <div className="flex justify-start">
                                                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
                                                    <p className="text-sm text-purple-100">{turn.liza}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== CONTROLS ===== */}
                <div className="relative z-10 px-5 pb-6 pt-3">
                    {/* Text Input */}
                    {onSendText && (
                        <div className="relative mb-4">
                            <Input
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                                placeholder="Type a message..."
                                className="h-12 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/30 pl-5 pr-14 text-sm focus:border-purple-500/50 focus:ring-purple-500/20"
                            />
                            <Button
                                onClick={handleSendText}
                                disabled={!textInput.trim()}
                                size="icon"
                                className="absolute right-1.5 top-1.5 h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white border-0 shadow-lg shadow-purple-500/25 disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* Main Controls */}
                    <div className="flex items-center justify-center gap-5">
                        {/* Mute Button */}
                        <button
                            onClick={onToggleListening}
                            className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                isListening
                                    ? 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-violet-400/50 shadow-lg shadow-violet-500/20'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                            }`}
                        >
                            <Mic className={`w-6 h-6 transition-colors ${isListening ? 'text-violet-300' : 'text-white/70'}`} />
                            {isListening && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0f1419]" />
                            )}
                        </button>

                        {/* End Call Button */}
                        <button
                            onClick={onClose}
                            className="relative w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 transition-all duration-300 shadow-xl shadow-red-500/30 hover:scale-105 active:scale-95"
                        >
                            <PhoneOff className="w-7 h-7 text-white" />
                        </button>

                        {/* Speaker Button */}
                        <button
                            className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
                        >
                            <Volume2 className="w-6 h-6 text-white/70" />
                        </button>
                    </div>

                    {/* Helper Text */}
                    <p className="text-center text-[11px] text-white/30 mt-4">
                        Tap the mic to {isListening ? 'mute' : 'unmute'} • Press red button to end call
                    </p>
                </div>
            </div>
        </div>
    );
};
