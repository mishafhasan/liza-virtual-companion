
import React from 'react';
import type { ConversationTurn, EmotionType } from '../types';
import { EMOTION_COLORS, EMOTION_LABELS } from '../constants';

interface ConversationViewProps {
  history: ConversationTurn[];
  userLiveInput: string;
  lizaLiveOutput: string;
  isListening: boolean;
  currentEmotion?: EmotionType;
  emotionIntensity?: number;
  avatarImage?: string; // New prop for avatar
}

type OrbState = 'idle' | 'listening' | 'transcribing' | 'speaking';

interface OrbVisualizerProps {
  state: OrbState;
  emotion?: EmotionType;
  intensity?: number;
  avatarImage?: string;
}

const OrbVisualizer: React.FC<OrbVisualizerProps> = ({ state, emotion = 'neutral', intensity = 50, avatarImage }) => {
    // Get emotion-specific colors
    const emotionColor = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
    
    // Calculate intensity-based opacity modifier
    const intensityModifier = Math.max(0.5, intensity / 100);
    
    const getStyles = () => {
        // Base styles vary by state
        switch (state) {
            case 'speaking':
                return {
                    container: "scale-110",
                    outer: `${emotionColor.bg}/30 animate-pulse duration-1000`,
                    middle: `${emotionColor.bg}/50 animate-pulse delay-75 duration-1000`,
                    inner: `${emotionColor.bg}`,
                    glow: emotionColor.glow
                };
            case 'transcribing':
                return {
                    container: "scale-105",
                    outer: "bg-emerald-500/20 animate-pulse duration-700",
                    middle: "bg-emerald-500/40 animate-pulse delay-75 duration-700",
                    inner: "bg-emerald-500",
                    glow: 'rgba(16, 185, 129, 0.5)'
                };
            case 'listening':
                return {
                    container: "scale-100",
                    outer: `${emotionColor.bg}/10 animate-pulse duration-[3000ms]`,
                    middle: `${emotionColor.bg}/20 animate-pulse delay-150 duration-[3000ms]`,
                    inner: `bg-gray-900/80 border-2 border-${emotionColor.bg.replace('bg-', '')}/40`,
                    glow: emotionColor.glow.replace('0.6', '0.3')
                };
            default: // idle
                return {
                    container: "scale-100 grayscale opacity-80",
                    outer: "bg-gray-800/30",
                    middle: "bg-gray-800/50",
                    inner: "bg-gray-800",
                    glow: 'rgba(0, 0, 0, 0)'
                };
        }
    };

    const styles = getStyles();

    // Dynamic inline styles for emotion colors (since Tailwind can't interpolate)
    const getInlineStyles = () => {
        if (state === 'idle') return {};
        
        const color = emotionColor.primary;
        const glow = emotionColor.glow;
        
        return {
            outer: {
                backgroundColor: state === 'transcribing' ? undefined : `${color}${Math.round(0.2 * intensityModifier * 255).toString(16).padStart(2, '0')}`
            },
            middle: {
                backgroundColor: state === 'transcribing' ? undefined : `${color}${Math.round(0.4 * intensityModifier * 255).toString(16).padStart(2, '0')}`
            },
            inner: {
                backgroundColor: state === 'speaking' ? color : undefined,
                boxShadow: state === 'speaking' ? `0 0 ${30 + intensity * 0.5}px ${glow}` : undefined
            }
        };
    };

    const inlineStyles = getInlineStyles();

    return (
        <div className={`relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center transition-all duration-500 ${styles.container}`}>
            {/* Outer rings - provide breathing/speaking effect */}
            <div 
                className={`absolute w-full h-full rounded-full transition-all ${state === 'transcribing' ? styles.outer : 'animate-pulse duration-1000'}`}
                style={inlineStyles.outer}
            ></div>
            <div 
                className={`absolute w-3/4 h-3/4 rounded-full transition-all ${state === 'transcribing' ? styles.middle : 'animate-pulse delay-75 duration-1000'}`}
                style={inlineStyles.middle}
            ></div>
            
            {/* Center Core or Avatar */}
            {avatarImage ? (
                <div 
                    className={`relative w-1/2 h-1/2 rounded-full overflow-hidden transition-all duration-300 border-4 ${state === 'speaking' ? 'border-white/50 scale-105' : 'border-white/10'}`}
                    style={{ 
                        boxShadow: state === 'speaking' ? `0 0 ${30 + intensity * 0.5}px ${emotionColor.glow}` : undefined,
                        borderColor: state === 'speaking' ? emotionColor.primary : undefined
                    }}
                >
                    <img 
                        src={avatarImage} 
                        alt="Avatar" 
                        className={`w-full h-full object-cover transition-all duration-300 ${state === 'idle' ? 'grayscale opacity-70' : ''}`}
                    />
                    {/* Overlay for speaking highlight */}
                    {state === 'speaking' && (
                        <div className="absolute inset-0 bg-white/10 mix-blend-overlay animate-pulse"></div>
                    )}
                </div>
            ) : (
                <div 
                    className={`w-1/2 h-1/2 rounded-full transition-all duration-300 ${state === 'idle' ? styles.inner : ''} ${state === 'transcribing' ? 'bg-emerald-500' : ''}`}
                    style={inlineStyles.inner}
                ></div>
            )}
        </div>
    );
};

// Emotion indicator badge component
const EmotionBadge: React.FC<{ emotion: EmotionType; visible: boolean }> = ({ emotion, visible }) => {
    if (!visible || emotion === 'neutral') return null;
    
    const label = EMOTION_LABELS[emotion];
    const color = EMOTION_COLORS[emotion];
    
    return (
        <div 
            className={`absolute top-4 right-4 px-3 py-1.5 rounded-full ${color.text} bg-white/10 backdrop-blur-sm 
                       text-xs font-medium tracking-wider uppercase transition-all duration-500 animate-in fade-in slide-in-from-right-2`}
        >
            {label}
        </div>
    );
};

export const ConversationView: React.FC<ConversationViewProps> = ({ 
  history, 
  userLiveInput, 
  lizaLiveOutput, 
  isListening,
  currentEmotion = 'neutral',
  emotionIntensity = 50,
  avatarImage
}) => {
  // Determine state priority: Speaking > Transcribing > Listening > Idle
  let orbState: OrbState = 'idle';
  if (lizaLiveOutput) {
      orbState = 'speaking';
  } else if (userLiveInput) {
      orbState = 'transcribing';
  } else if (isListening) {
      orbState = 'listening';
  }

  // Get emotion-specific text color for speaking state
  const emotionTextColor = EMOTION_COLORS[currentEmotion]?.text || 'text-indigo-300';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center space-y-6 px-4">
      
      {/* Emotion indicator badge */}
      <EmotionBadge emotion={currentEmotion} visible={orbState === 'speaking' || orbState === 'listening'} />
      
      {/* Visualizer with emotion-aware colors */}
      <OrbVisualizer 
        state={orbState} 
        emotion={currentEmotion} 
        intensity={emotionIntensity} 
        avatarImage={avatarImage}
      />
      
      {/* Status Label - with emotion context */}
      <div className="h-8 flex flex-col items-center justify-center space-y-1">
          {orbState === 'speaking' && (
            <>
              <span className={`${emotionTextColor} text-xs tracking-[0.3em] uppercase font-bold animate-pulse`}>
                Liza Speaking
              </span>
              {currentEmotion !== 'neutral' && (
                <span className="text-white/40 text-[10px] tracking-wider">
                  Feeling {currentEmotion}
                </span>
              )}
            </>
          )}
          {orbState === 'transcribing' && (
            <span className="text-emerald-400 text-xs tracking-[0.3em] uppercase font-bold animate-pulse">Processing...</span>
          )}
          {orbState === 'listening' && (
            <span className="text-indigo-500/50 text-xs tracking-[0.2em] uppercase font-semibold">Listening</span>
          )}
      </div>

      {/* Text Area */}
      <div className="w-full max-w-2xl text-center min-h-[8rem] flex flex-col items-center justify-start">
        {lizaLiveOutput && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-2xl md:text-3xl font-medium text-white leading-relaxed drop-shadow-lg">
                    {lizaLiveOutput}
                </p>
            </div>
        )}
        
        {!lizaLiveOutput && userLiveInput && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-xl md:text-2xl text-emerald-300 italic leading-relaxed">
                    "{userLiveInput}"
                </p>
            </div>
        )}
        
        {/* History / Fallback */}
         {!lizaLiveOutput && !userLiveInput && history.length > 0 && (
            <p className="text-xl md:text-2xl text-gray-400 italic opacity-80">
                {history[history.length - 1].liza || history[history.length - 1].user}
            </p>
        )}
        {!lizaLiveOutput && !userLiveInput && history.length === 0 && (
            <p className="text-xl md:text-2xl text-gray-500/50 italic font-light">
                Conversation will appear here...
            </p>
        )}
      </div>
    </div>
  );
};
