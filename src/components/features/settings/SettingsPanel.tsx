import React, { useState } from 'react';
import { X, Save, Plus, Trash2, User, Video, Key, Brain, Globe, Mic, Heart, Sparkles, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canGenerateAvatar, generateAvatar } from '@/services/ai/avatarService';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Settings, CharacterProfile, MemoryItem, Language } from '@/types';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSettingsChange: (updates: Partial<Settings>) => void;
    characterProfile: CharacterProfile;
    onCharacterProfileChange: (updates: Partial<CharacterProfile>) => void;
    /** @deprecated SettingsPanel reads memory directly from the Zustand store. */
    memory?: MemoryItem[];
    /** @deprecated SettingsPanel uses addMemory directly from the Zustand store. */
    onAddMemory?: (item: MemoryItem) => void;
    /** @deprecated SettingsPanel uses deleteMemory directly from the Zustand store. */
    onDeleteMemory?: (id: string) => void;
    onSave?: () => void;
}

/** Compress image to fit in localStorage */
const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 512;
            canvas.width = size;
            canvas.height = size;
            if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(img, 0, 0, size, size);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else {
                reject(new Error('Canvas context creation failed'));
            }
        };
        img.onerror = (e) => reject(e);
        img.src = dataUrl;
    });
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isOpen, onClose, settings, onSettingsChange,
    characterProfile, onCharacterProfileChange,
    onSave
}) => {
    // Read memory directly from the Zustand store so the Long-Term Memory
    // section updates live when mid-conversation summarization adds new
    // facts — no page reload needed.
    const memory = useSettingsStore((s) => s.memory);
    const addMemory = useSettingsStore((s) => s.addMemory);
    const deleteMemory = useSettingsStore((s) => s.deleteMemory);

    const [newMemory, setNewMemory] = useState('');
    const [avatarPrompt, setAvatarPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const avatarGenerationEnabled = canGenerateAvatar();

    if (!isOpen) return null;

    const handleAddMemory = () => {
        if (!newMemory.trim()) return;
        addMemory({ id: Date.now().toString(), fact: newMemory.trim() });
        setNewMemory('');
    };

    const handleGenerateAvatar = async () => {
        if (!avatarPrompt.trim()) return;
        setIsGenerating(true);
        setGenerationError('');

        try {
            const rawImageUrl = await generateAvatar(avatarPrompt);
            try {
                const compressedUrl = await compressImage(rawImageUrl);
                onCharacterProfileChange({ avatar: compressedUrl });
            } catch {
                onCharacterProfileChange({ avatar: rawImageUrl });
            }
        } catch (error: any) {
            setGenerationError(error?.message || 'Failed to generate avatar. Please try again later.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRemoveAvatar = () => {
        onCharacterProfileChange({ avatar: undefined });
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                <div>
                    <h2 className="text-xl font-semibold text-white">Settings</h2>
                    <p className="text-xs text-gray-500 mt-1">Customize personality, memory, voice, and call behavior</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="p-6 space-y-2">
                    <Tabs defaultValue="character">
                        <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/10 border border-white/10">
                            <TabsTrigger value="character">Profile</TabsTrigger>
                            <TabsTrigger value="memory">Memory</TabsTrigger>
                            <TabsTrigger value="system">System</TabsTrigger>
                        </TabsList>

                        <TabsContent value="character" className="space-y-6">
                            {/* Character Identity */}
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-4 h-4" /> Character Identity
                                </h3>
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value={characterProfile.name} onChange={(e) => onCharacterProfileChange({ name: e.target.value })} className="bg-white/5 border-white/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Personality</Label>
                                    <Textarea
                                        value={characterProfile.personality}
                                        onChange={(e) => onCharacterProfileChange({ personality: e.target.value })}
                                        className="bg-white/5 border-white/10 min-h-[80px]"
                                        placeholder="Playful, flirty, cozy, witty, and deeply caring..."
                                    />
                                    <p className="text-xs text-gray-500">Core personality traits used in all conversations</p>
                                </div>
                            </div>

                            {/* Visual Avatar */}
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <ImagePlus className="w-4 h-4" /> Visual Avatar
                                </h3>
                                <div className="p-4 rounded-xl bg-black/20 border border-white/10 space-y-4">
                                    {characterProfile.avatar ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <img
                                                src={characterProfile.avatar}
                                                alt="Avatar"
                                                className="w-28 h-28 rounded-full object-cover border-4 border-purple-500/50 shadow-lg shadow-purple-500/20"
                                            />
                                            <button onClick={handleRemoveAvatar} className="text-xs text-red-400 hover:text-red-300 underline">
                                                Remove Avatar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-28 h-28 mx-auto rounded-full bg-white/5 flex items-center justify-center border-2 border-dashed border-white/20">
                                            <span className="text-gray-500 text-xs">No Avatar</span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Input
                                            value={avatarPrompt}
                                            onChange={(e) => setAvatarPrompt(e.target.value)}
                                            placeholder="Describe appearance (e.g., cute girl with pink hair)"
                                            className="bg-white/5 border-white/10 text-sm"
                                        />
                                        <Button
                                            onClick={handleGenerateAvatar}
                                            disabled={isGenerating || !avatarPrompt.trim() || !avatarGenerationEnabled}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                                        >
                                            {isGenerating ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                                            ) : (
                                                <><ImagePlus className="w-4 h-4 mr-2" /> Generate New Avatar</>
                                            )}
                                        </Button>
                                        {generationError && (
                                            <p className="text-xs text-red-400">{generationError}</p>
                                        )}
                                        {!avatarGenerationEnabled && (
                                            <p className="text-xs text-gray-500">Avatar generation is unavailable until the app developer configures Stability AI.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="memory" className="space-y-6">
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Brain className="w-4 h-4" /> Long-Term Memory
                                </h3>
                                <div className="flex gap-2">
                                    <Input value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="Add a fact about you..." className="bg-white/5 border-white/10" onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()} />
                                    <Button onClick={handleAddMemory} size="icon">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {memory.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 text-sm">No memories stored yet.</div>
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
                            </div>
                        </TabsContent>

                        <TabsContent value="system" className="space-y-6">
                            {/* Language Selection */}
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Globe className="w-4 h-4" /> Language
                                </h3>
                                <div className="space-y-2">
                                    <Label>Conversation Language</Label>
                                    <Select value={settings.language} onValueChange={(v) => onSettingsChange({ language: v as Language })}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10">
                                            <SelectItem value="English" className="text-white">🇬🇧 English</SelectItem>
                                            <SelectItem value="Sinhala" className="text-white">🇱🇰 Sinhala (සිංහල)</SelectItem>
                                            <SelectItem value="Tamil" className="text-white">🇮🇳 Tamil (தமிழ்)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500">Sets language for both text and voice responses</p>
                                </div>
                            </div>

                            {/* Voice Settings */}
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Mic className="w-4 h-4" /> Voice & Tone
                                </h3>
                                <div className="space-y-2">
                                    <Label>Voice Name</Label>
                                    <Select value={settings.voiceName} onValueChange={(v) => onSettingsChange({ voiceName: v })}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10">
                                            <SelectItem value="Kore" className="text-white">Kore (Warm, Feminine)</SelectItem>
                                            <SelectItem value="Aoede" className="text-white">Aoede (Bright, Cheerful)</SelectItem>
                                            <SelectItem value="Puck" className="text-white">Puck (Playful, Upbeat)</SelectItem>
                                            <SelectItem value="Charon" className="text-white">Charon (Deep, Smooth)</SelectItem>
                                            <SelectItem value="Fenrir" className="text-white">Fenrir (Rich, Calm)</SelectItem>
                                            <SelectItem value="Zephyr" className="text-white">Zephyr (Soft, Natural)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500">Controls the AI voice in voice/call mode</p>
                                </div>
                            </div>

                            {/* Emotional Intelligence */}
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" /> Emotional Intelligence
                                </h3>
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Emotion Intensity</Label>
                                            <span className="text-xs text-purple-400 font-mono">{settings.emotionIntensity}%</span>
                                        </div>
                                        <Slider
                                            value={[settings.emotionIntensity]}
                                            onValueChange={([v]) => onSettingsChange({ emotionIntensity: v })}
                                            min={0}
                                            max={100}
                                            step={5}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-gray-500">How strongly Liza reacts to your mood</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-1.5">
                                                <Heart className="w-3.5 h-3.5 text-pink-400" />
                                                Flirt Intensity
                                            </Label>
                                            <span className="text-xs text-pink-400 font-mono">{settings.flirtIntensity}%</span>
                                        </div>
                                        <Slider
                                            value={[settings.flirtIntensity]}
                                            onValueChange={([v]) => onSettingsChange({ flirtIntensity: v })}
                                            min={0}
                                            max={100}
                                            step={5}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-gray-500">Controls romantic/flirty tone intensity</p>
                                    </div>
                                </div>
                            </div>

                            {/* Video Call Mode */}
                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Video className="w-4 h-4" /> Video Call Mode
                                </h3>
                                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Enable Video Avatar</Label>
                                            <p className="text-xs text-gray-500">Talk with real-time video avatar (HeyGen)</p>
                                        </div>
                                        <Switch checked={settings.videoMode} onCheckedChange={(c) => onSettingsChange({ videoMode: c })} />
                                    </div>

                                    {settings.videoMode && (
                                        <div className="space-y-3 pt-2 border-t border-white/5">
                                            <div className="space-y-2">
                                                <Label className="flex items-center gap-1.5">
                                                    <Key className="w-3 h-3" /> HeyGen API Key
                                                </Label>
                                                <Input
                                                    type="password"
                                                    value={settings.heygenApiKey || ''}
                                                    onChange={(e) => onSettingsChange({ heygenApiKey: e.target.value })}
                                                    placeholder="Enter your HeyGen API key"
                                                    className="bg-white/5 border-white/10 text-sm"
                                                />
                                                <p className="text-xs text-gray-500">
                                                    Get free API key at{' '}
                                                    <a href="https://app.heygen.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                                                        app.heygen.com
                                                    </a>{' '}
                                                    (10 credits/month free)
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Avatar ID</Label>
                                                <Input
                                                    value={settings.avatarId || 'default'}
                                                    onChange={(e) => onSettingsChange({ avatarId: e.target.value })}
                                                    placeholder="default"
                                                    className="bg-white/5 border-white/10 text-sm"
                                                />
                                                <p className="text-xs text-gray-500">Use 'default' or browse avatars at HeyGen</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </ScrollArea>

            <div className="p-6 border-t border-white/10 bg-slate-900/90 shrink-0">
                <Button onClick={onSave} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25">
                    <Save className="w-4 h-4 mr-2" />
                    Save & Restart Session
                </Button>
            </div>
        </div>
    );
};
