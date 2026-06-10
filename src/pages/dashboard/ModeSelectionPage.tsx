import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Brain, Briefcase, ArrowRight, Zap, Flame, Clock, Trophy, Play } from 'lucide-react';
import { AnimatedSection } from '@/components/shared/AnimatedSection';
import { useUserStats } from '@/hooks/useUserStats';

export const ModeSelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { stats, displayName, loading, recentActivity, formatTimeSpent, formatStreak } = useUserStats();

    // Format stats for display
    const statsDisplay = [
        { 
            label: 'Total XP', 
            value: stats ? stats.total_xp.toLocaleString() : '0', 
            icon: Zap, 
            color: 'text-yellow-400', 
            bg: 'bg-yellow-400/10', 
            border: 'border-yellow-400/20' 
        },
        { 
            label: 'Day Streak', 
            value: stats ? formatStreak(stats.current_streak) : 'Start Today!', 
            icon: Flame, 
            color: 'text-orange-400', 
            bg: 'bg-orange-400/10', 
            border: 'border-orange-400/20' 
        },
        { 
            label: 'Time Spent', 
            value: stats ? formatTimeSpent(stats.total_time_seconds) : '0 Mins', 
            icon: Clock, 
            color: 'text-blue-400', 
            bg: 'bg-blue-400/10', 
            border: 'border-blue-400/20' 
        },
    ];

    const modes = [
        {
            title: 'Entertainment Chat',
            desc: 'Engage in natural conversations with AI personalities.',
            icon: MessageSquare,
            path: '/chat',
            gradient: 'from-purple-500 to-pink-500',
            badge: 'Popular',
            features: ['5 Personalities', 'Emotional Intelligence'],
            active: true,
        },
        {
            title: 'Language Learning',
            desc: 'Master new languages with immersive practice.',
            icon: Brain,
            path: '/language',
            gradient: 'from-blue-500 to-teal-500',
            progress: stats ? Math.min(100, Math.floor((stats.language_xp / 1000) * 100)) : 0,
            features: ['Multi-language Support', 'Real-time Feedback'],
            badge: stats && stats.language_xp > 0 ? 'In progress' : undefined,
            active: true,
        },
        {
            title: 'Mock Interviews',
            desc: 'Prepare for your dream job with AI interviews.',
            icon: Briefcase,
            path: '/interview',
            gradient: 'from-green-500 to-emerald-500',
            features: ['Resume Analysis', 'Performance Reports'],
            badge: 'Beta',
            active: true,
        },
    ];

    // Handle resume button click
    const handleResumeClick = () => {
        if (recentActivity && recentActivity.mode === 'entertainment') {
            // Navigate to chat with the conversation ID
            if (recentActivity.conversation_session_id) {
                navigate(`/chat?session=${recentActivity.conversation_session_id}`);
            } else {
                navigate('/chat');
            }
        } else {
            // Default to chat if no recent activity
            navigate('/chat');
        }
    };

    // Get recent activity info for display
    const getRecentActivityInfo = () => {
        if (!recentActivity) {
            return {
                title: 'Start Your Journey',
                subtitle: 'No recent activity - Choose a mode below',
                showButton: false,
            };
        }

        const modeNames = {
            entertainment: 'Entertainment Chat',
            language: 'Language Learning',
            interview: 'Mock Interviews',
        };

        const timeSinceActivity = new Date().getTime() - new Date(recentActivity.last_accessed_at).getTime();
        const minutesAgo = Math.floor(timeSinceActivity / 60000);
        const hoursAgo = Math.floor(minutesAgo / 60);
        const daysAgo = Math.floor(hoursAgo / 24);

        let timeText = 'Recently';
        if (minutesAgo < 5) timeText = 'Just now';
        else if (minutesAgo < 60) timeText = `${minutesAgo} min ago`;
        else if (hoursAgo < 24) timeText = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
        else if (daysAgo < 7) timeText = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;

        return {
            title: 'Continue Your Conversation',
            subtitle: `Last active: ${timeText} - ${modeNames[recentActivity.mode]}`,
            showButton: recentActivity.mode === 'entertainment',
        };
    };

    const activityInfo = getRecentActivityInfo();

    return (
        <div className="min-h-[calc(100vh-65px)] bg-slate-950 px-6 lg:px-12 py-8 overflow-x-hidden">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Welcome Header & Stats */}
                <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
                    <AnimatedSection effect="fade-up">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{loading ? '...' : displayName}</span>
                        </h1>
                        <p className="text-gray-400">Ready to continue your journey today?</p>
                    </AnimatedSection>

                    <AnimatedSection delay={100} effect="fade-up" className="grid grid-cols-3 gap-4 w-full md:w-auto">
                        {statsDisplay.map((stat, i) => (
                            <div key={i} className={`p-4 rounded-2xl ${stat.bg} border ${stat.border} flex flex-col items-center justify-center min-w-[100px]`}>
                                <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                                <div className="text-lg font-bold text-white">{stat.value}</div>
                                <div className="text-xs text-gray-400">{stat.label}</div>
                            </div>
                        ))}
                    </AnimatedSection>
                </div>

                {/* Recent Activity Banner */}
                {activityInfo.showButton && (
                    <AnimatedSection delay={200} effect="scale-up">
                        <div className="relative p-6 rounded-3xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10 overflow-hidden group">
                            <div className="absolute top-0 right-0 p-32 bg-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/30 transition-colors duration-500" />

                            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                        <MessageSquare className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <h3 className="text-lg font-semibold text-white">{activityInfo.title}</h3>
                                        <p className="text-sm text-gray-400">{activityInfo.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleResumeClick}
                                    className="px-6 py-2.5 rounded-full bg-white text-slate-900 font-medium hover:bg-purple-50 transition-colors flex items-center gap-2 shadow-lg shadow-white/5"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    Resume
                                </button>
                            </div>
                        </div>
                    </AnimatedSection>
                )}

                {/* Modes Grid */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                            Choose Your Mode
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {modes.map((mode, i) => (
                            <AnimatedSection key={i} delay={300 + (i * 100)} effect="fade-up">
                                <button
                                    onClick={() => mode.active ? navigate(mode.path) : undefined}
                                    disabled={!mode.active}
                                    className={`w-full group relative p-6 h-full rounded-3xl bg-white/[0.02] border border-white/10 transition-all duration-300 text-left flex flex-col overflow-hidden ${
                                        mode.active 
                                            ? 'hover:border-purple-500/50 hover:-translate-y-1 cursor-pointer' 
                                            : 'opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                                    {/* Icon & Badge */}
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                                            <mode.icon className="w-7 h-7 text-white" />
                                        </div>
                                        {mode.badge && (
                                            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full border border-purple-500/30">
                                                {mode.badge}
                                            </span>
                                        )}
                                        {!mode.active && (
                                            <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-xs font-semibold rounded-full border border-gray-500/30">
                                                Coming Soon
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">{mode.title}</h3>
                                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{mode.desc}</p>

                                        {mode.progress !== undefined && (
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-400">Progress</span>
                                                    <span className="text-white font-medium">{mode.progress}%</span>
                                                </div>
                                                <div className="w-full bg-white/10 rounded-full h-1.5">
                                                    <div className={`bg-gradient-to-r ${mode.gradient} h-1.5 rounded-full`} style={{ width: `${mode.progress}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2 mt-auto">
                                            {mode.features.map((feat, j) => (
                                                <div key={j} className="flex items-center gap-2 text-xs text-gray-500">
                                                    <div className={`w-1 h-1 rounded-full bg-gradient-to-r ${mode.gradient}`} />
                                                    {feat}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                            {mode.active ? 'Enter Mode' : 'Coming Soon'}
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </button>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
