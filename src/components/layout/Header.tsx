import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LogoDisplay } from '@/components/shared/LizaLogo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const Header: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="flex items-center justify-between px-6 lg:px-12 py-4 bg-slate-950/70 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 supports-[backdrop-filter]:bg-slate-950/50">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="hover:opacity-80 transition-opacity">
                    <LogoDisplay size={36} />
                </button>
            </div>
            <div className="flex items-center gap-4">
                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-3 hover:bg-white/5 rounded-full pl-1 pr-3 py-1 transition-all border border-transparent hover:border-white/10 ring-offset-slate-950 focus-visible:ring-2 focus-visible:ring-purple-500">
                                <Avatar className="w-8 h-8 border border-white/10">
                                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-xs font-medium">
                                        {user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-gray-200 text-sm hidden sm:block font-medium">{user.name}</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-slate-950/90 backdrop-blur-xl border-white/10 text-gray-200 shadow-xl shadow-black/50">
                            <DropdownMenuLabel className="text-gray-400 text-xs uppercase tracking-wider font-semibold">My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => navigate('/settings')} className="text-gray-200 focus:bg-white/10 focus:text-white cursor-pointer">
                                <Settings className="w-4 h-4 mr-2" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer">
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
    );
};
