import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
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
import {
    createSession,
    closeSession,
    saveTurn,
    saveTurnPair,
    updateSessionTitle,
} from '@/services/supabase/conversationService';
import type { ConversationTurn, Language } from '@/types';
import { toast } from 'sonner';

export const ChatPage: React.FC = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
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
    const voiceSessionIdRef = useRef<string | null>(null);
    const voiceSessionTitleRef = useRef(false);

    const location = useLocation();

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
        deleteConversation,
        loadHistory,
    } = useChatSession({ systemInstructionOverride: textSystemInstruction });

    // Reload conversation history every time the user navigates to /chat.
    // Using location.pathname as the dependency ensures this fires on each
    // visit (initial mount, back navigation, dashboard → chat), not just once.
    useEffect(() => {
        if (location.pathname !== '/chat') return;

        const sessionId = searchParams.get('session');
        loadHistory(sessionId ?? undefined).then(() => {
            if (sessionId) {
                setSearchParams({}, { replace: true });
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

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

            // Persist turns to the DB session and generate RAG memories
            const sid = voiceSessionIdRef.current;
            if (sid) {
                if (turn.user && turn.liza) {
                    saveTurnPair(sid, turn.user, turn.liza).catch(console.error);
                } else {
                    if (turn.user) saveTurn(sid, 'user', turn.user).catch(console.error);
                    if (turn.liza) saveTurn(sid, 'liza', turn.liza).catch(console.error);
                }

                // Derive conversation title from the first user utterance
                if (turn.user && !voiceSessionTitleRef.current) {
                    const title = turn.user.slice(0, 40) + (turn.user.length > 40 ? '…' : '');
                    updateSessionTitle(sid, title).catch(console.error);
                    voiceSessionTitleRef.current = true;
                }
            }

            // If video mode is enabled and we have Liza's response, speak it via HeyGen
            if (isVideoMode && turn.liza && heygenSessionState === 'connected') {
                heygenSpeak(turn.liza);
            }

            // Simple memory creation: add user's turn to local state memory
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
        voiceSessionTitleRef.current = false;
        voiceSessionIdRef.current = null;

        try {
            // Create a DB session so voice turns get persisted like text conversations
            const sid = await createSession('entertainment', 'Voice Conversation');
            if (sid) voiceSessionIdRef.current = sid;

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
            // Clean up the orphaned session if one was created
            if (voiceSessionIdRef.current) {
                closeSession(voiceSessionIdRef.current).catch(console.error);
                voiceSessionIdRef.current = null;
            }
            setIsVoiceMode(false);
        }
    }, [startVoiceSession, startHeyGenSession, isVideoMode, settings.heygenApiKey, resetEmotionState]);

    const handleStopVoiceMode = useCallback(() => {
        setIsVoiceMode(false);
        stopVoiceSession();

        // Close the DB session so it appears in the conversation sidebar
        const sid = voiceSessionIdRef.current;
        if (sid) {
            closeSession(sid).catch(console.error);
            voiceSessionIdRef.current = null;
        }

        if (heygenSessionState === 'connected') {
            stopHeyGenSession();
        }

        // Reload conversation history to pick up the new voice session
        loadHistory();
    }, [stopVoiceSession, stopHeyGenSession, heygenSessionState, loadHistory]);

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
                onDeleteChat={deleteConversation}
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
                characterProfile={characterProfile}
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
