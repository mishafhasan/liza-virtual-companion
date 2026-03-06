import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Settings, CharacterProfile, MemoryItem } from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_CHARACTER_PROFILE } from '@/constants';

interface SettingsContextType {
    settings: Settings;
    updateSettings: (updates: Partial<Settings>) => void;
    characterProfile: CharacterProfile;
    updateCharacterProfile: (updates: Partial<CharacterProfile>) => void;
    memory: MemoryItem[];
    addMemory: (item: MemoryItem) => void;
    deleteMemory: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const saved = localStorage.getItem('liza-settings');
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    const [characterProfile, setCharacterProfile] = useState<CharacterProfile>(() => {
        try {
            const saved = localStorage.getItem('liza-character');
            return saved ? JSON.parse(saved) : DEFAULT_CHARACTER_PROFILE;
        } catch {
            return DEFAULT_CHARACTER_PROFILE;
        }
    });

    const [memory, setMemory] = useState<MemoryItem[]>(() => {
        try {
            const saved = localStorage.getItem('liza-memory');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Persist to localStorage
    useEffect(() => {
        try { localStorage.setItem('liza-settings', JSON.stringify(settings)); } catch { /* quota exceeded */ }
    }, [settings]);

    useEffect(() => {
        try { localStorage.setItem('liza-character', JSON.stringify(characterProfile)); } catch { /* quota exceeded */ }
    }, [characterProfile]);

    useEffect(() => {
        try { localStorage.setItem('liza-memory', JSON.stringify(memory)); } catch { /* quota exceeded */ }
    }, [memory]);

    const updateSettings = (updates: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    };

    const updateCharacterProfile = (updates: Partial<CharacterProfile>) => {
        setCharacterProfile(prev => ({ ...prev, ...updates }));
    };

    const addMemory = (item: MemoryItem) => {
        setMemory(prev => [...prev, item]);
    };

    const deleteMemory = (id: string) => {
        setMemory(prev => prev.filter(m => m.id !== id));
    };

    return (
        <SettingsContext.Provider value={{
            settings, updateSettings,
            characterProfile, updateCharacterProfile,
            memory, addMemory, deleteMemory
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
