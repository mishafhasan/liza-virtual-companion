import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface VideoAvatarProps {
    videoStream: MediaStream | null;
    isConnected: boolean;
    isSpeaking: boolean;
    onConnect: () => void;
    sessionState: 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
}

export const VideoAvatar: React.FC<VideoAvatarProps> = ({
    videoStream, isConnected, isSpeaking, onConnect, sessionState
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
            videoRef.current.play().catch(e => console.error("Video play failed:", e));
        }
    }, [videoStream]);

    return (
        <div className="group relative w-full aspect-video bg-gradient-to-br from-slate-900 to-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            </div>

            {!isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10 transition-all">
                    {sessionState === 'idle' && (
                        <div className="text-center">
                            <p className="text-gray-300 mb-4">Click to start video chat</p>
                            <button onClick={onConnect} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-white font-medium transition-colors">
                                Connect
                            </button>
                        </div>
                    )}
                    {sessionState === 'connecting' && (
                        <div className="flex flex-col items-center">
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                            <p className="text-white text-sm">Connecting to Liza...</p>
                        </div>
                    )}
                    {sessionState === 'error' && (
                        <div className="text-center text-red-400">
                            <p>Connection Failed</p>
                            <button onClick={onConnect} className="mt-2 text-sm underline hover:text-red-300">Retry</button>
                        </div>
                    )}
                </div>
            )}

            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover transition-transform duration-300 ${isSpeaking ? 'scale-105' : 'scale-100'}`} />

            {isSpeaking && (
                <div className="absolute bottom-4 right-4 flex gap-1">
                    <div className="w-1 h-3 bg-green-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" />
                    <div className="w-1 h-5 bg-green-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.1s]" />
                    <div className="w-1 h-3 bg-green-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s]" />
                </div>
            )}
        </div>
    );
};
