import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Play, MessageSquare, Brain, Briefcase, Layers, CheckCircle, ArrowRight, Twitter, Github, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoDisplay } from '@/components/shared/LizaLogo';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    const features = [
        {
            icon: MessageSquare,
            title: 'Entertainment Chat',
            desc: 'Engage in natural, meaningful conversations with AI personalities that adapt to your mood and style.',
            gradient: 'from-purple-500 to-pink-500',
            features: ['5 AI Personalities', 'Context Awareness', 'Emotional Intelligence', '24/7 Availability'],
        },
        {
            icon: Brain,
            title: 'Language Learning',
            desc: 'Master new languages through immersive AI-powered conversations with real-time feedback.',
            gradient: 'from-blue-500 to-teal-500',
            features: ['3 Languages', 'Adaptive Lessons', 'Grammar Correction', 'Progress Tracking'],
        },
        {
            icon: Briefcase,
            title: 'Mock Interviews',
            desc: 'Prepare for your dream job with tailored interview questions and detailed performance feedback.',
            gradient: 'from-green-500 to-emerald-500',
            features: ['Resume Analysis', 'Role-Specific Questions', 'Instant Feedback', 'Performance Report'],
        },
    ];

    return (
        <div className="min-h-screen bg-slate-950 overflow-x-hidden">
            <nav className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 bg-slate-950/40 backdrop-blur-md border-b border-white/5 supports-[backdrop-filter]:bg-slate-950/20">
                <LogoDisplay size={44} textSize="text-2xl" />
                <div className="flex items-center gap-6">
                    <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex font-medium" onClick={() => navigate('/login')}>
                        Sign In
                    </Button>
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300 rounded-full px-6" onClick={() => navigate('/signup')}>
                        Get Started
                    </Button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex flex-col">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />

                <main className="relative z-10 flex-1 flex items-center px-6 lg:px-12 py-12">
                    <div className="max-w-7xl mx-auto w-full">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div className="text-left">
                                <AnimatedSection delay={0} effect="fade-up">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-6">
                                        <Bot className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm text-purple-300">AI-Powered Multi-Modal Platform</span>
                                    </div>
                                </AnimatedSection>

                                <AnimatedSection delay={100} effect="slide-in-left">
                                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                                        Meet{' '}
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400">
                                            Liza
                                        </span>
                                        <br />
                                        <span className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-300">
                                            Your Intelligent
                                        </span>
                                        <br />
                                        <span className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-300">
                                            Virtual Companion
                                        </span>
                                    </h1>
                                </AnimatedSection>

                                <AnimatedSection delay={200} effect="fade-up">
                                    <p className="text-lg text-gray-400 max-w-xl mb-8 leading-relaxed">
                                        Experience the future of AI interaction. Engage in natural conversations,
                                        master new languages, and prepare for interviews with an AI that truly understands you.
                                    </p>
                                </AnimatedSection>

                                <AnimatedSection delay={300} effect="scale-up">
                                    <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                        <Button
                                            size="lg"
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:scale-105"
                                            onClick={() => navigate('/signup')}
                                        >
                                            Start Your Journey
                                            <ArrowRight className="ml-2 w-5 h-5" />
                                        </Button>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="border-white/20 text-white hover:bg-white/10"
                                            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                        >
                                            <Play className="mr-2 w-5 h-5" />
                                            Explore Features
                                        </Button>
                                    </div>
                                </AnimatedSection>
                            </div>

                            <AnimatedSection delay={200} className="hidden lg:block" effect="scale-up">
                                <div className="relative" style={{ height: 400 }}>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-500/40 via-pink-500/30 to-blue-500/40 animate-gradient-orb blur-3xl" />
                                    </div>

                                    {/* Card 1 */}
                                    <div className="absolute -top-4 -left-4 w-64 p-5 rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-purple-500/30 backdrop-blur-xl shadow-xl shadow-purple-500/10 animate-hero-float-1 hover:scale-105 hover:shadow-purple-500/25 transition-all duration-300 cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                                <MessageSquare className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-white font-semibold">Entertainment Chat</div>
                                                <div className="text-gray-400 text-sm">5 AI Personalities</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex gap-1">
                                            {['😊', '🧠', '😎', '💛', '📊'].map((e, i) => (
                                                <span key={i} className="text-xs bg-white/5 rounded-full px-2 py-0.5">{e}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Card 2 */}
                                    <div className="absolute top-24 -right-2 w-60 p-5 rounded-2xl bg-gradient-to-br from-blue-500/15 to-teal-500/15 border border-blue-500/30 backdrop-blur-xl shadow-xl shadow-blue-500/10 animate-hero-float-2 hover:scale-105 hover:shadow-blue-500/25 transition-all duration-300 cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                                <Brain className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-white font-semibold">Language Learning</div>
                                                <div className="text-gray-400 text-sm">3 Languages</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex gap-1.5">
                                            <span className="text-xs bg-white/5 rounded-full px-2 py-0.5">🇺🇸 EN</span>
                                            <span className="text-xs bg-white/5 rounded-full px-2 py-0.5">🇮🇳 TA</span>
                                            <span className="text-xs bg-white/5 rounded-full px-2 py-0.5">🇱🇰 SI</span>
                                        </div>
                                    </div>

                                    {/* Card 3 */}
                                    <div className="absolute bottom-2 left-8 w-64 p-5 rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/15 border border-green-500/30 backdrop-blur-xl shadow-xl shadow-green-500/10 animate-hero-float-3 hover:scale-105 hover:shadow-green-500/25 transition-all duration-300 cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                                                <Briefcase className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-white font-semibold">Mock Interviews</div>
                                                <div className="text-gray-400 text-sm">Resume Analysis</div>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <div className="w-full bg-white/10 rounded-full h-1.5">
                                                <div className="bg-gradient-to-r from-green-400 to-emerald-400 h-1.5 rounded-full" style={{ width: '78%' }} />
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">78% Confident</div>
                                        </div>
                                    </div>
                                </div>
                            </AnimatedSection>
                        </div>
                    </div>
                </main>
            </section>

            {/* Features Section */}
            <section id="features" className="relative py-24 bg-slate-950">
                <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
                    <AnimatedSection className="text-center mb-16" effect="fade-up">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-gray-300">Powerful Features</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            Three Modes, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Infinite Possibilities</span>
                        </h2>
                    </AnimatedSection>

                    <div className="grid md:grid-cols-3 gap-8">
                        {features.map((feature, i) => (
                            <AnimatedSection key={i} delay={i * 150} effect="scale-up">
                                <div className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:-translate-y-2">
                                    <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                                        <feature.icon className="w-8 h-8 text-white" />
                                    </div>

                                    <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                                    <p className="text-gray-400 mb-6 leading-relaxed">{feature.desc}</p>

                                    <ul className="space-y-3">
                                        {feature.features.map((f, j) => (
                                            <li key={j} className="flex items-center gap-3 text-sm text-gray-300">
                                                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${feature.gradient} flex items-center justify-center flex-shrink-0`}>
                                                    <CheckCircle className="w-3 h-3 text-white" />
                                                </div>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative py-16 bg-slate-950 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 lg:px-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
                        <div className="col-span-2 md:col-span-1">
                            <LogoDisplay size={36} />
                            <p className="text-gray-500 text-sm mt-4 leading-relaxed max-w-xs">
                                Your intelligent AI companion for entertainment, language learning, and interview preparation.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Product</h4>
                            <ul className="space-y-3">
                                {['Entertainment Chat', 'Language Learning', 'Mock Interviews', 'Pricing'].map((item) => (
                                    <li key={item}><button className="text-gray-500 hover:text-white text-sm transition-colors">{item}</button></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
                            <ul className="space-y-3">
                                {['About Us', 'Blog', 'Careers', 'Contact'].map((item) => (
                                    <li key={item}><button className="text-gray-500 hover:text-white text-sm transition-colors">{item}</button></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h4>
                            <ul className="space-y-3">
                                {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'].map((item) => (
                                    <li key={item}><button className="text-gray-500 hover:text-white text-sm transition-colors">{item}</button></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                            © {new Date().getFullYear()} Liza AI. All rights reserved.
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"><Twitter className="w-4 h-4" /></button>
                            <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"><Github className="w-4 h-4" /></button>
                            <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"><Globe className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
