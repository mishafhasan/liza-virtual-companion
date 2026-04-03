import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Conversation } from '@/types';

interface ChatSidebarProps {
    isOpen: boolean;
    conversations: Conversation[];
    currentConversationId?: string;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
    isOpen, conversations, currentConversationId, onNewChat, onSelectChat
}) => {
    return (
        <div className={`${isOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-900/95 border-r border-white/5 flex flex-col overflow-hidden flex-shrink-0`}>
            <div className="p-4 border-b border-white/5">
                <Button onClick={onNewChat} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {conversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => onSelectChat(conv.id)}
                            className={`w-full p-3 rounded-xl text-left transition-all ${currentConversationId === conv.id
                                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <div className="font-medium truncate text-sm">{conv.title}</div>
                            <div className="text-xs opacity-60 mt-0.5">{conv.updatedAt.toLocaleDateString()}</div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};
