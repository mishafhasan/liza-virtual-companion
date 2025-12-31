
import React, { useState } from 'react';
import { MicrophoneIcon, MicrophoneSlashIcon, PaperAirplaneIcon } from './Icons';

interface InputBarProps {
  isListening: boolean;
  onMicClick: () => void;
  onSendText: (text: string) => void;
}

export const InputBar: React.FC<InputBarProps> = ({ isListening, onMicClick, onSendText }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSendText(text.trim());
      setText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <footer className="absolute bottom-0 left-0 right-0 p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-auto flex items-center space-x-4">
        <div className="flex-1 relative">
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Talk anything or type a message"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-full py-3 pl-5 pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {text && (
                 <button onClick={handleSend} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-indigo-400 hover:text-indigo-300">
                    <PaperAirplaneIcon className="w-6 h-6" />
                </button>
            )}
        </div>
        <button
          onClick={onMicClick}
          className={`p-4 rounded-full transition-colors duration-300 ${isListening ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          aria-label={isListening ? 'Stop Listening' : 'Start Listening'}
        >
          {isListening ? (
            <MicrophoneSlashIcon className="h-6 w-6 text-white" />
          ) : (
            <MicrophoneIcon className="h-6 w-6 text-white" />
          )}
        </button>
      </div>
    </footer>
  );
};
