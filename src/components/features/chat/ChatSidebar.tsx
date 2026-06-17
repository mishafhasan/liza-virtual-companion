import React from 'react';
import { Plus, MoreVertical, Trash, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from '@/types';

interface ChatSidebarProps {
    isOpen: boolean;
    onClose?: () => void;
    conversations: Conversation[];
    currentConversationId?: string;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat?: (id: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
    isOpen, onClose, conversations, currentConversationId, onNewChat, onSelectChat, onDeleteChat
}) => {
    return (
        <div className={`
            absolute z-50 h-full md:relative 
            ${isOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'} 
            transition-all duration-300 bg-slate-950 md:bg-slate-900/95 border-r border-white/5 flex flex-col overflow-hidden flex-shrink-0 shadow-2xl md:shadow-none
        `}>
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <Button 
                    onClick={() => {
                        onNewChat();
                        if (window.innerWidth < 768 && onClose) onClose();
                    }} 
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat
                </Button>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden text-gray-400 hover:text-white shrink-0">
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {conversations.map((conv) => (
                        <div key={conv.id} className="relative group">
                            <button
                                onClick={() => {
                                    onSelectChat(conv.id);
                                    if (window.innerWidth < 768 && onClose) onClose();
                                }}
                                className={`w-full p-3 pr-10 rounded-xl text-left transition-all ${currentConversationId === conv.id
                                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <div className="font-medium truncate text-sm">{conv.title}</div>
                                <div className="text-xs opacity-60 mt-0.5">{conv.updatedAt.toLocaleDateString()}</div>
                            </button>

                            {onDeleteChat && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-gray-500 hover:text-white hover:bg-white/10"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            className="bg-slate-800 border-white/10 text-white"
                                        >
                                            <DropdownMenuItem
                                                className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer gap-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteChat(conv.id);
                                                }}
                                            >
                                                <Trash className="w-4 h-4" />
                                                Delete Chat
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};
