import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/stores/authStore';
import { useSettings } from '@/stores/settingsStore';
import { useChatSession } from '@/hooks/useChatSession';
import { useLiveSession } from '@/hooks/useLiveSession';
import { useHeyGenSession } from '@/hooks/useHeyGenSession';
import { useEmotionState } from '@/hooks/useEmotionState';
import { ChatSidebar } from '@/components/features/chat/ChatSidebar';
import { ChatArea } from '@/components/features/chat/ChatArea';
import { SettingsPanel } from '@/components/features/settings/SettingsPanel';
import { VoiceModeOverlay } from '@/components/features/chat/VoiceModeOverlay';
import { buildTextSystemInstruction, buildVoiceSystemInstruction } from '@/services/prompts/companionPrompt';
import type { ConversationTurn, Language } from '@/types';
import { toast } from 'sonner';

export const ChatPage: React.FC = () => {
    const { user } = useAuth();
    const {
        settings,
        updateSettings,
        characterProfile,
        updateCharacterProfile,
        memory,
        addMemory,
        deleteMemory
    } = useSettings();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [isVideoMode, setIsVideoMode] = useState(settings.videoMode);
    const [voiceConversation, setVoiceConversation] = useState<ConversationTurn[]>([]);

    // Emotion state management for intelligent mood adaptation
    const { emotionState, processUserInput, resetEmotionState } = useEmotionState();

    // ==========================================
    // TEXT-MODE SYSTEM INSTRUCTION
    // Built from the shared companion prompt module so text and voice modes
    // stay in sync. See services/prompts/companionPrompt.ts.
    // ==========================================
    const textSystemInstruction = useMemo(
        () =>
            buildTextSystemInstruction({
                characterProfile,
                language: settings.language,
                flirtIntensity: settings.flirtIntensity,
                emotionIntensity: settings.emotionIntensity,
                memory,
                userMood: emotionState.userMood,
                emotionIntensityLevel: emotionState.intensity,
            }),
        [
            settings.language, settings.flirtIntensity, settings.emotionIntensity,
            characterProfile, memory, emotionState.userMood, emotionState.intensity,
        ],
    );

    // Text chat session (uses Gemini for text-based conversations)
    const {
        conversations,
        currentConversation,
        chatLoading,
        input,
        setInput,
        personality,
        setPersonality,
        sidebarOpen,
        setSidebarOpen,
        createConversation,
        sendMessage: rawSendMessage,
        selectConversation,
        loadHistory,
    } = useChatSession({ systemInstructionOverride: textSystemInstruction });

    // Load past conversations from Supabase on mount.
    useEffect(() => {
        loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Wrapper around sendMessage to also run emotion analysis on typed text
    const handleSendMessage = useCallback(() => {
        if (input.trim()) {
            processUserInput(input);
        }
        rawSendMessage();
    }, [input, rawSendMessage, processUserInput]);

    // Handle quick language change from ChatArea header
    const handleLanguageChange = useCallback((lang: Language) => {
        updateSettings({ language: lang });
        toast.success(`Language switched to ${lang}`);
    }, [updateSettings]);

    // ==========================================
    // VOICE-MODE SYSTEM INSTRUCTION
    // Built from the shared companion prompt module (services/prompts).
    // The full voice-performance/prosody directives live there, keeping this
    // page focused on orchestration rather than prompt engineering.
    // ==========================================
    const voiceSystemInstruction = useMemo(
        () =>
            buildVoiceSystemInstruction({
                characterProfile,
                language: settings.language,
                flirtIntensity: settings.flirtIntensity,
                emotionIntensity: settings.emotionIntensity,
                memory,
                userMood: emotionState.userMood,
                emotionIntensityLevel: emotionState.intensity,
            }),
        [
            settings.language, settings.flirtIntensity, settings.emotionIntensity,
            characterProfile, memory, emotionState.userMood, emotionState.intensity,
        ],
    );

    // ==========================================
    // VOICE MODE: Real Gemini Live API session
    // ==========================================
    const {
        connectionState,
        isListening,
        userTranscription,
        lizaTranscription,
        startSession: startVoiceSession,
        stopSession: stopVoiceSession,
        toggleListening,
        sendText: sendVoiceText,
    } = useLiveSession({
        systemInstruction: voiceSystemInstruction,
        voiceName: settings.voiceName,
        onTurnComplete: (turn) => {
            const turnWithEmotion = {
                ...turn,
                userEmotion: emotionState.userMood,
                lizaEmotion: emotionState.lizaEmotion
            };
            setVoiceConversation(prev => [...prev, turnWithEmotion]);

            // If video mode is enabled and we have Liza's response, speak it via HeyGen
            if (isVideoMode && turn.liza && heygenSessionState === 'connected') {
                heygenSpeak(turn.liza);
            }

            // Simple memory creation: add user's turn to memory
            if (turn.user && turn.user.length > 5) {
                addMemory({ id: Date.now().toString(), fact: turn.user });
            }
        }
    });

    // ==========================================
    // HeyGen Video Avatar session
    // ==========================================
    const {
        sessionState: heygenSessionState,
        isAvatarSpeaking,
        videoStream,
        startSession: startHeyGenSession,
        speak: heygenSpeak,
        stopSession: stopHeyGenSession,
    } = useHeyGenSession({
        apiKey: settings.heygenApiKey || '',
        avatarId: settings.avatarId || 'default',
        onError: (error) => {
            console.error('HeyGen error:', error);
            toast.error('Video avatar error: ' + error);
        },
    });

    // Process user transcription in real-time for emotion detection
    useEffect(() => {
        if (userTranscription && userTranscription.length > 3) {
            processUserInput(userTranscription);
        }
    }, [userTranscription, processUserInput]);

    // ==========================================
    // Voice Mode handlers
    // ==========================================
    const handleStartVoiceMode = useCallback(async () => {
        setIsVoiceMode(true);
        setVoiceConversation([]);
        resetEmotionState();

        try {
            await startVoiceSession();

            // Start HeyGen video session if enabled and configured
            if (isVideoMode && settings.heygenApiKey) {
                try {
                    await startHeyGenSession();
                } catch (error) {
                    console.error('Failed to start video session:', error);
                    toast.error('Failed to start video avatar');
                }
            }
        } catch (error) {
            console.error('Failed to start voice session:', error);
            toast.error('Failed to connect to voice AI');
            setIsVoiceMode(false);
        }
    }, [startVoiceSession, startHeyGenSession, isVideoMode, settings.heygenApiKey, resetEmotionState]);

    const handleStopVoiceMode = useCallback(() => {
        setIsVoiceMode(false);
        stopVoiceSession();
        if (heygenSessionState === 'connected') {
            stopHeyGenSession();
        }
    }, [stopVoiceSession, stopHeyGenSession, heygenSessionState]);

    // Toggle video mode
    const handleToggleVideoMode = useCallback(() => {
        if (!isVideoMode && !settings.heygenApiKey) {
            toast.error('Please add your HeyGen API key in Settings first!');
            setIsSettingsOpen(true);
            return;
        }

        const newVideoMode = !isVideoMode;
        setIsVideoMode(newVideoMode);
        updateSettings({ videoMode: newVideoMode });

        if (newVideoMode && connectionState === 'connected' && settings.heygenApiKey) {
            startHeyGenSession();
        } else if (!newVideoMode && heygenSessionState === 'connected') {
            stopHeyGenSession();
        }
    }, [isVideoMode, settings.heygenApiKey, connectionState, heygenSessionState, startHeyGenSession, stopHeyGenSession, updateSettings]);

    // Handle settings save and session restart
    const handleSaveSettings = useCallback(() => {
        setIsSettingsOpen(false);
        toast.success('Settings saved!');

        // If in voice mode, restart the session with new settings
        if (isVoiceMode && connectionState === 'connected') {
            setVoiceConversation([]);
            resetEmotionState();
            stopVoiceSession();
            if (heygenSessionState === 'connected') {
                stopHeyGenSession();
            }

            setTimeout(() => {
                startVoiceSession();
                if (isVideoMode && settings.heygenApiKey) {
                    startHeyGenSession();
                }
            }, 500);
        }
    }, [isVoiceMode, connectionState, heygenSessionState, isVideoMode, settings.heygenApiKey,
        stopVoiceSession, stopHeyGenSession, startVoiceSession, startHeyGenSession, resetEmotionState]);

    return (
        <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-slate-950">
            <ChatSidebar
                isOpen={sidebarOpen}
                conversations={conversations}
                currentConversationId={currentConversation?.id}
                onNewChat={createConversation}
                onSelectChat={selectConversation}
            />

            <ChatArea
                conversation={currentConversation}
                loading={chatLoading}
                input={input}
                setInput={setInput}
                onSend={handleSendMessage}
                onNewChat={createConversation}
                user={user}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                isVideoMode={isVideoMode}
                setIsVideoMode={handleToggleVideoMode}
                onVoiceMode={handleStartVoiceMode}
                onSettings={() => setIsSettingsOpen(true)}
                personality={personality}
                setPersonality={setPersonality}
                videoStream={videoStream}
                heygenState={heygenSessionState}
                onStartHeyGen={startHeyGenSession}
                currentEmotion={emotionState.lizaEmotion}
                emotionIntensity={emotionState.intensity}
                language={settings.language}
                onLanguageChange={handleLanguageChange}
            />

            <SettingsPanel
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onSettingsChange={updateSettings}
                characterProfile={characterProfile}
                onCharacterProfileChange={updateCharacterProfile}
                memory={memory}
                onAddMemory={addMemory}
                onDeleteMemory={deleteMemory}
                onSave={handleSaveSettings}
            />

            <VoiceModeOverlay
                isOpen={isVoiceMode}
                onClose={handleStopVoiceMode}
                isConnected={connectionState === 'connected'}
                isListening={isListening}
                onToggleListening={toggleListening}
                userTranscription={userTranscription}
                lizaTranscription={lizaTranscription}
                currentEmotion={emotionState.lizaEmotion}
                emotionIntensity={emotionState.intensity}
                language={settings.language}
                isVideoMode={isVideoMode}
                videoStream={videoStream}
                heygenSessionState={heygenSessionState}
                isAvatarSpeaking={isAvatarSpeaking}
                onSendText={sendVoiceText}
                conversationHistory={voiceConversation}
                characterAvatar={characterProfile.avatar}
                characterName={characterProfile.name}
            />
        </div>
    );
};
