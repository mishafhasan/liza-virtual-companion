import React, { useRef, useEffect } from 'react';
import { Send, LogOut, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LizaLogo } from '@/components/shared/LizaLogo';
import type { Message, LanguageSession } from '@/types';
import { LANGUAGE_DATA } from '@/data/mockData';
import { useAuth } from '@/stores/authStore';

interface LanguageSessionViewProps {
    session: LanguageSession | null;
    messages: Message[];
    input: string;
    setInput: (val: string) => void;
    onSend: () => void;
    onEndSession: () => void;
    loading?: boolean;
}

export const LanguageSessionView: React.FC<LanguageSessionViewProps> = ({
    session, messages, input, setInput, onSend, onEndSession, loading = false
}) => {
    const { user } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    if (!session) return null;

    return (
        <div className="flex flex-col h-[calc(100vh-65px)] bg-slate-950">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">{LANGUAGE_DATA[session.language].flag}</div>
                    <div>
                        <div className="text-white font-medium">{LANGUAGE_DATA[session.language].name} Session</div>
                        <div className="text-xs text-gray-400 capitalize">{session.level} • {session.goal.replace('-', ' ')}</div>
                    </div>
                </div>
                <Button variant="outline" onClick={onEndSession} className="border-red-500/20 text-red-400 hover:bg-red-500/10">
                    <LogOut className="w-4 h-4 mr-2" />
                    End Session
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6 max-w-3xl mx-auto space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className="flex-shrink-0 mt-1">
                                {msg.role === 'assistant' ? (
                                    <LizaLogo width={48} height={16} className="rounded-full bg-blue-500/10 p-1" />
                                ) : (
                                    <Avatar className="w-8 h-8">
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-teal-500 text-white text-xs">
                                            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                            <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-tr-none'
                                : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                                }`}>
                                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                                <LizaLogo width={48} height={16} className="rounded-full bg-blue-500/10 p-1" />
                            </div>
                            <div className="max-w-[80%] p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-300 rounded-tl-none">
                                <span className="inline-flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="p-4 bg-slate-900/50 border-t border-white/5 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/10">
                        <Mic className="w-5 h-5" />
                    </Button>
                    <div className="flex-1 relative">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !loading && onSend()}
                            disabled={loading}
                            placeholder={`Type your response in ${LANGUAGE_DATA[session.language].name}...`}
                            className="w-full bg-white/5 border-white/10 text-white pr-10 focus-visible:ring-blue-500/50 disabled:opacity-60"
                        />
                    </div>
                    <Button
                        onClick={onSend}
                        disabled={!input.trim() || loading}
                        className="bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg shadow-blue-500/20"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};