import React, { useEffect, useRef } from 'react';

interface VideoAvatarProps {
  videoStream: MediaStream | null;
  isConnected: boolean;
  isSpeaking: boolean;
  onVideoReady?: () => void;
}

export const VideoAvatar: React.FC<VideoAvatarProps> = ({ 
  videoStream, 
  isConnected,
  isSpeaking,
  onVideoReady 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        onVideoReady?.();
      };
    }
  }, [videoStream, onVideoReady]);

  return (
    <div className="video-avatar-container">
      <div className="video-wrapper">
        {!isConnected && (
          <div className="connection-overlay">
            <div className="connection-status">
              <div className="spinner"></div>
              <p>Connecting to Liza...</p>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`video-element ${isSpeaking ? 'speaking' : ''}`}
        />

        {isConnected && (
          <div className={`speaking-indicator ${isSpeaking ? 'active' : ''}`}>
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay-1"></div>
            <div className="pulse-ring delay-2"></div>
          </div>
        )}
      </div>

      <style>{`
        .video-avatar-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          position: relative;
        }

        .video-wrapper {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .video-element {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .video-element.speaking {
          transform: scale(1.02);
        }

        .connection-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          z-index: 10;
        }

        .connection-status {
          text-align: center;
          color: white;
        }

        .spinner {
          width: 50px;
          height: 50px;
          margin: 0 auto 20px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .connection-status p {
          font-size: 18px;
          font-weight: 500;
          margin: 0;
        }

        .speaking-indicator {
          position: absolute;
          bottom: 20px;
          left: 20px;
          width: 40px;
          height: 40px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .speaking-indicator.active {
          opacity: 1;
        }

        .pulse-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          border: 3px solid rgba(255, 255, 255, 0.8);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 1.5s ease-out infinite;
        }

        .pulse-ring.delay-1 {
          animation-delay: 0.5s;
        }

        .pulse-ring.delay-2 {
          animation-delay: 1s;
        }

        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }

        @media (max-width: 768px) {
          .video-avatar-container {
            max-width: 100%;
          }

          .video-wrapper {
            border-radius: 12px;
          }

          .speaking-indicator {
            bottom: 12px;
            left: 12px;
            width: 30px;
            height: 30px;
          }
        }
      `}</style>
    </div>
  );
};
