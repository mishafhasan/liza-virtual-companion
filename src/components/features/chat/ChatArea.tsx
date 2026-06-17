import React, { useRef, useEffect, useState } from 'react';
import { Send, Plus, Video, Phone, Settings, MoreVertical, Globe, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LizaLogo } from '@/components/shared/LizaLogo';
import { EMOTION_COLORS, EMOTION_LABELS } from '@/constants';
import type { Conversation, AIPersonality, User, EmotionType, Language } from '@/types';
import { VideoAvatar } from '@/components/VideoAvatar';

interface ChatAreaProps {
    conversation: Conversation | null;
    loading: boolean;
    input: string;
    setInput: (val: string) => void;
    onSend: () => void;
    onNewChat: () => void;
    user: User | null;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    isVideoMode: boolean;
    setIsVideoMode: (mode: boolean) => void;
    onVoiceMode: () => void;
    onSettings: () => void;
    personality: AIPersonality;
    setPersonality: (p: AIPersonality) => void;
    videoStream?: MediaStream | null;
    heygenState?: "idle" | "error" | "closed" | "connecting" | "connected";
    onStartHeyGen?: () => void;
    // Emotion & Language props
    currentEmotion?: EmotionType;
    emotionIntensity?: number;
    language?: Language;
    onLanguageChange?: (lang: Language) => void;
    characterProfile?: { name: string; avatar?: string };
}

export const ChatArea: React.FC<ChatAreaProps> = ({
    conversation, loading, input, setInput, onSend, onNewChat, user,
    sidebarOpen, setSidebarOpen, isVideoMode, setIsVideoMode,
    onVoiceMode, onSettings, personality, setPersonality,
    videoStream, heygenState, onStartHeyGen,
    currentEmotion = 'neutral', emotionIntensity = 50, language = 'English', onLanguageChange,
    characterProfile
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversation?.messages, loading]);

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative h-full">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white md:hidden">
                        <Menu className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white hidden md:flex">
                        <Menu className="w-5 h-5" />
                    </Button>
                    {conversation ? (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-gray-300 text-sm font-medium">Liza is online</span>
                        </div>
                    ) : (
                        <span className="text-gray-400 text-sm font-medium">Select a conversation</span>
                    )}
                </div>

                {/* Action Buttons (Video & Phone always visible) */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setIsVideoMode(!isVideoMode)}
                        className={`${isVideoMode ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 hover:text-white'}`}
                        title="Toggle Video Avatar">
                        <Video className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onVoiceMode} className="text-gray-400 hover:text-white" title="Start Call">
                        <div className="relative">
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <Phone className="w-5 h-5" />
                        </div>
                    </Button>

                    <div className="h-6 w-[1px] bg-white/10 mx-1" />

                    {/* Desktop specific buttons */}
                    <div className="hidden md:flex items-center gap-2">
                        {/* Emotion Indicator */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 transition-all"
                             title={`Detected mood: ${EMOTION_LABELS[currentEmotion]}`}>
                            <div className="w-2 h-2 rounded-full animate-pulse" 
                                 style={{ backgroundColor: EMOTION_COLORS[currentEmotion]?.primary || EMOTION_COLORS.neutral.primary }} />
                            <span className="text-xs text-gray-400">{EMOTION_LABELS[currentEmotion]}</span>
                        </div>

                        {/* Quick Language Switcher */}
                        <Select value={language} onValueChange={(v) => onLanguageChange?.(v as Language)}>
                            <SelectTrigger className="w-[90px] bg-white/5 border-white/10 text-white text-xs h-8 gap-1">
                                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10">
                                <SelectItem value="English" className="text-white text-xs">English</SelectItem>
                                <SelectItem value="Sinhala" className="text-white text-xs">සිංහල</SelectItem>
                                <SelectItem value="Tamil" className="text-white text-xs">தமிழ்</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="h-6 w-[1px] bg-white/10" />

                        <Button variant="ghost" size="icon" onClick={onSettings} className="text-gray-400 hover:text-white" title="Settings">
                            <Settings className="w-5 h-5" />
                        </Button>
                        <div className="h-6 w-[1px] bg-white/10 mx-1" />
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">Personality:</span>
                            <Select value={personality} onValueChange={(v) => setPersonality(v as AIPersonality)}>
                                <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white text-sm h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="friendly" className="text-white">Friendly</SelectItem>
                                    <SelectItem value="professional" className="text-white">Professional</SelectItem>
                                    <SelectItem value="witty" className="text-white">Witty</SelectItem>
                                    <SelectItem value="empathetic" className="text-white">Empathetic</SelectItem>
                                    <SelectItem value="analytical" className="text-white">Analytical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Mobile Options (Popover) */}
                    <div className="flex md:hidden items-center">
                        <Popover open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                                    <MoreVertical className="w-5 h-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 bg-slate-900 border-white/10 text-white p-3 flex flex-col gap-3" align="end">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">Emotion</span>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                                        <div className="w-2 h-2 rounded-full animate-pulse" 
                                             style={{ backgroundColor: EMOTION_COLORS[currentEmotion]?.primary || EMOTION_COLORS.neutral.primary }} />
                                        <span className="text-xs text-gray-300">{EMOTION_LABELS[currentEmotion]}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">Language</span>
                                    <Select value={language} onValueChange={(v) => onLanguageChange?.(v as Language)}>
                                        <SelectTrigger className="w-[100px] bg-white/5 border-white/10 text-white text-xs h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10">
                                            <SelectItem value="English" className="text-white text-xs">English</SelectItem>
                                            <SelectItem value="Sinhala" className="text-white text-xs">සිංහල</SelectItem>
                                            <SelectItem value="Tamil" className="text-white text-xs">தமிழ்</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">Personality</span>
                                    <Select value={personality} onValueChange={(v) => setPersonality(v as AIPersonality)}>
                                        <SelectTrigger className="w-[100px] bg-white/5 border-white/10 text-white text-xs h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 z-50">
                                            <SelectItem value="friendly" className="text-white">Friendly</SelectItem>
                                            <SelectItem value="professional" className="text-white">Professional</SelectItem>
                                            <SelectItem value="witty" className="text-white">Witty</SelectItem>
                                            <SelectItem value="empathetic" className="text-white">Empathetic</SelectItem>
                                            <SelectItem value="analytical" className="text-white">Analytical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="h-px bg-white/10 my-1" />
                                
                                <div className="flex justify-center">
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        onSettings();
                                    }} className="text-gray-400 hover:text-white" title="Settings">
                                        <Settings className="w-5 h-5" />
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            {/* Video Avatar Area */}
            {isVideoMode && (
                <div className="p-4 bg-black/20 border-b border-white/5 animate-slide-up">
                    <div className="max-w-xl mx-auto">
                        <VideoAvatar
                            videoStream={videoStream || null}
                            isConnected={heygenState === 'connected'}
                            isSpeaking={false}
                            onConnect={onStartHeyGen || (() => { })}
                            sessionState={heygenState || 'idle'}
                        />
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                    {!conversation ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 min-h-[60vh]">
                            <div className="relative mb-6">
                                <LizaLogo width={160} height={60} className="rounded-2xl" />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-slate-950" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Start a Conversation</h2>
                            <p className="text-gray-400 max-w-md mb-6">Click "New Chat" to begin talking with Liza. Choose from different AI personalities to match your mood.</p>
                            <Button onClick={onNewChat} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25">
                                <Plus className="w-4 h-4 mr-2" />
                                Start New Chat
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-3xl mx-auto">
                            {conversation.messages.map((msg) => (
                                <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="flex-shrink-0 mb-1">
                                            <Avatar className="w-8 h-8">
                                                {characterProfile?.avatar && (
                                                    <AvatarImage src={characterProfile.avatar} alt={characterProfile.name} className="object-cover" />
                                                )}
                                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold">
                                                    {characterProfile?.name ? characterProfile.name.charAt(0).toUpperCase() : 'L'}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                    )}
                                    <div className={`max-w-[75%] px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl rounded-br-md shadow-lg shadow-purple-500/10'
                                        : 'bg-white/[0.06] text-gray-200 rounded-2xl rounded-bl-md shadow-lg shadow-black/10 border border-white/5'
                                        }`}>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                        <div className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-white/50' : 'text-gray-600'}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="flex-shrink-0 mb-1">
                                            <Avatar className="w-7 h-7">
                                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                                                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex items-end gap-2 justify-start">
                                    <div className="flex-shrink-0 mb-1">
                                        <Avatar className="w-8 h-8">
                                            {characterProfile?.avatar && (
                                                <AvatarImage src={characterProfile.avatar} alt={characterProfile.name} className="object-cover" />
                                            )}
                                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold">
                                                {characterProfile?.name ? characterProfile.name.charAt(0).toUpperCase() : 'L'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="bg-white/[0.06] border border-white/5 px-5 py-4 rounded-2xl rounded-bl-md shadow-lg shadow-black/10">
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot" />
                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-delay-1" />
                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-typing-dot-delay-2" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="w-full bg-slate-950/95 backdrop-blur-xl border-t border-white/5 p-3 sm:p-4 z-40 flex-shrink-0">
                <div className="max-w-3xl mx-auto w-full">
                    <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-1.5 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
                            placeholder={conversation ? 'Type your message...' : 'Start a new chat first...'}
                            className="flex-1 bg-transparent border-0 text-white placeholder:text-gray-600 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-10"
                            disabled={!conversation}
                        />
                        <Button
                            onClick={onSend}
                            disabled={!conversation || !input.trim() || loading}
                            size="icon"
                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl w-9 h-9 hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-30"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
