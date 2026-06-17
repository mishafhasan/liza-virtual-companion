import React, { useState } from 'react';
import { User as UserIcon, Globe, Mic, Heart, Sparkles, Brain, Plus, Trash2, Save, Video, Key } from 'lucide-react';
import { useSettings } from '@/stores/settingsStore';
import { useAuth } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import type { Language } from '@/types';
import { toast } from 'sonner';

/**
 * Full-page settings.
 *
 * Previously this page just told users to open the chat sidebar. It now edits
 * the same Zustand-backed settings directly, so configuration is reachable from
 * the header menu and persists immediately (the store auto-saves).
 */
export const SettingsPage: React.FC = () => {
    const {
        settings, updateSettings,
        characterProfile, updateCharacterProfile,
        memory, addMemory, deleteMemory,
    } = useSettings();
    const { user, updateProfile } = useAuth();

    const [newMemory, setNewMemory] = useState('');
    const [displayName, setDisplayName] = useState(user?.name ?? '');

    const handleAddMemory = () => {
        if (!newMemory.trim()) return;
        const trimmed = newMemory.trim();
        const alreadyExists = memory.some((m) => m.fact.toLowerCase() === trimmed.toLowerCase());
        if (alreadyExists) {
            toast.error('That fact is already in your memory.');
            return;
        }
        addMemory({ id: Date.now().toString(), fact: trimmed });
        setNewMemory('');
    };

    const handleSaveProfile = () => {
        if (displayName.trim().length >= 2) {
            updateProfile({ name: displayName.trim() });
        } else {
            toast.error('Name must be at least 2 characters.');
        }
    };

    return (
        <div className="min-h-[calc(100vh-65px)] bg-slate-950 p-6 flex justify-center">
            <div className="w-full max-w-2xl space-y-6">
                <h1 className="text-3xl font-bold text-white">Settings</h1>

                {/* Account */}
                <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> Account
                    </h2>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Display Name</Label>
                        <div className="flex gap-2">
                            <Input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="bg-white/5 border-white/10 text-white"
                            />
                            <Button onClick={handleSaveProfile} variant="secondary">Save</Button>
                        </div>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                </Card>

                {/* Companion personality */}
                <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Heart className="w-4 h-4 text-pink-400" /> Companion
                    </h2>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Name</Label>
                        <Input
                            value={characterProfile.name}
                            onChange={(e) => updateCharacterProfile({ name: e.target.value })}
                            className="bg-white/5 border-white/10 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Personality</Label>
                        <Textarea
                            value={characterProfile.personality}
                            onChange={(e) => updateCharacterProfile({ personality: e.target.value })}
                            className="bg-white/5 border-white/10 text-white min-h-[80px]"
                        />
                    </div>
                </Card>

                {/* Language & voice */}
                <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Language &amp; Voice
                    </h2>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Conversation Language</Label>
                        <Select value={settings.language} onValueChange={(v) => updateSettings({ language: v as Language })}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10">
                                <SelectItem value="English" className="text-white">🇬🇧 English</SelectItem>
                                <SelectItem value="Sinhala" className="text-white">🇱🇰 Sinhala (සිංහල)</SelectItem>
                                <SelectItem value="Tamil" className="text-white">🇮🇳 Tamil (தமிழ்)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-300 flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> Voice</Label>
                        <Select value={settings.voiceName} onValueChange={(v) => updateSettings({ voiceName: v })}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10">
                                <SelectItem value="Kore" className="text-white">Kore (Warm, Feminine)</SelectItem>
                                <SelectItem value="Aoede" className="text-white">Aoede (Bright, Cheerful)</SelectItem>
                                <SelectItem value="Puck" className="text-white">Puck (Playful, Upbeat)</SelectItem>
                                <SelectItem value="Charon" className="text-white">Charon (Deep, Smooth)</SelectItem>
                                <SelectItem value="Fenrir" className="text-white">Fenrir (Rich, Calm)</SelectItem>
                                <SelectItem value="Zephyr" className="text-white">Zephyr (Soft, Natural)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </Card>

                {/* Emotional intelligence */}
                <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Emotional Intelligence
                    </h2>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-gray-300">Emotion Intensity</Label>
                            <span className="text-xs text-purple-400 font-mono">{settings.emotionIntensity}%</span>
                        </div>
                        <Slider value={[settings.emotionIntensity]} onValueChange={([v]) => updateSettings({ emotionIntensity: v })} min={0} max={100} step={5} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-gray-300 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-pink-400" /> Flirt Intensity</Label>
                            <span className="text-xs text-pink-400 font-mono">{settings.flirtIntensity}%</span>
                        </div>
                        <Slider value={[settings.flirtIntensity]} onValueChange={([v]) => updateSettings({ flirtIntensity: v })} min={0} max={100} step={5} />
                    </div>
                </Card>

                {/* Video avatar */}
                <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Video className="w-4 h-4" /> Video Call Mode
                    </h2>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-gray-300">Enable Video Avatar</Label>
                            <p className="text-xs text-gray-500">Real-time video avatar (HeyGen)</p>
                        </div>
                        <Switch checked={settings.videoMode} onCheckedChange={(c) => updateSettings({ videoMode: c })} />
                    </div>
                    {settings.videoMode && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <Label className="text-gray-300 flex items-center gap-1.5"><Key className="w-3 h-3" /> HeyGen API Key</Label>
                            <Input
                                type="password"
                                value={settings.heygenApiKey || ''}
                                onChange={(e) => updateSettings({ heygenApiKey: e.target.value })}
                                placeholder="Enter your HeyGen API key"
                                className="bg-white/5 border-white/10 text-white text-sm"
                            />
                        </div>
                    )}
                </Card>

                {/* Memory */}
                <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Brain className="w-4 h-4" /> Long-Term Memory
                    </h2>
                    <div className="flex gap-2">
                        <Input
                            value={newMemory}
                            onChange={(e) => setNewMemory(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                            placeholder="Add a fact about you..."
                            className="bg-white/5 border-white/10 text-white"
                        />
                        <Button onClick={handleAddMemory} size="icon"><Plus className="w-4 h-4" /></Button>
                    </div>
                    <div className="space-y-2">
                        {memory.length === 0 ? (
                            <p className="text-center py-6 text-gray-500 text-sm">No memories stored yet.</p>
                        ) : (
                            memory.map((mem) => (
                                <div key={mem.id} className="group flex items-start justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <span className="text-sm text-gray-300">{mem.fact}</span>
                                    <button onClick={() => deleteMemory(mem.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <p className="text-center text-xs text-gray-600 flex items-center justify-center gap-1.5 pb-4">
                    <Save className="w-3 h-3" /> Changes are saved automatically.
                </p>
            </div>
        </div>
    );
};
