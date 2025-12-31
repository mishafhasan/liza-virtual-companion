
import React, { useState } from 'react';
import type { Settings, CharacterProfile, MemoryItem, Language } from '../types';
import { XIcon, TrashIcon, PlusIcon } from './Icons';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (newSettings: Settings) => void;
  characterProfile: CharacterProfile;
  onCharacterProfileChange: (newProfile: CharacterProfile) => void;
  memory: MemoryItem[];
  onAddMemory: (item: MemoryItem) => void;
  onDeleteMemory: (id: string) => void;
  onSave: () => void;
}

// Utility to compress image to fit in localStorage
const compressImage = (dataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Resize to 512x512 max - perfect for avatar display and saves huge amount of space
      const size = 512; 
      canvas.width = size;
      canvas.height = size;
      
      if (ctx) {
        // Fill white background (handling transparency issues)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        // Convert to JPEG with 0.7 quality - drastic size reduction
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
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  characterProfile,
  onCharacterProfileChange,
  memory,
  onAddMemory,
  onDeleteMemory,
  onSave,
}) => {
  const [newMemory, setNewMemory] = useState('');
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  const handleAddMemory = () => {
    if (newMemory.trim()) {
      onAddMemory({ id: Date.now().toString(), fact: newMemory.trim() });
      setNewMemory('');
    }
  };

  const handleGenerateAvatar = async () => {
    if (!avatarPrompt.trim()) return;

    setIsGenerating(true);
    setGenerationError('');

    try {
      console.log("Starting avatar generation with Stability.ai...");
      
      // Get API key from environment or use placeholder
      const apiKey = process.env.STABILITY_API_KEY || process.env.API_KEY;
      
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        setGenerationError('Please add STABILITY_API_KEY to .env.local. Get free API key from platform.stability.ai');
        setIsGenerating(false);
        return;
      }
      
      // Create FormData for multipart/form-data
      const formData = new FormData();
      formData.append('prompt', `professional portrait photo of a beautiful young woman, ${avatarPrompt}, centered face, high quality, detailed facial features, soft lighting, 8k resolution, photorealistic`);
      formData.append('output_format', 'png');
      formData.append('aspect_ratio', '1:1');
      
      const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'image/*',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stability API error:', errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawImageUrl = reader.result as string;
        
        // Compress the image before saving
        try {
          const compressedUrl = await compressImage(rawImageUrl);
          onCharacterProfileChange({ ...characterProfile, avatar: compressedUrl });
        } catch (err) {
          console.warn("Compression failed, using raw image", err);
          onCharacterProfileChange({ ...characterProfile, avatar: rawImageUrl });
        }
      };
      reader.onerror = () => {
        setGenerationError('Failed to process generated image.');
      };
      reader.readAsDataURL(blob);

    } catch (error: any) {
      console.error("Avatar generation failed:", error);
      setGenerationError(`Failed to generate avatar: ${error?.message || 'Please check your API key'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveAvatar = () => {
    const { avatar, ...rest } = characterProfile;
    onCharacterProfileChange(rest);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/60 z-30 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`fixed top-0 left-0 h-full w-full max-w-md bg-gray-800 text-white shadow-2xl transform transition-transform p-6 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-8">
          {/* Language Settings */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">Language</label>
            <select
              id="language"
              value={settings.language}
              onChange={(e) => onSettingsChange({ ...settings, language: e.target.value as Language })}
              className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option>English</option>
              <option>Sinhala</option>
              <option>Tamil</option>
            </select>
          </div>

          {/* Voice Settings */}
          <div>
            <label htmlFor="voiceName" className="block text-sm font-medium text-gray-300 mb-2">Voice</label>
            <select
              id="voiceName"
              value={settings.voiceName}
              onChange={(e) => onSettingsChange({ ...settings, voiceName: e.target.value })}
              className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Puck">Puck</option>
              <option value="Charon">Charon</option>
              <option value="Kore">Kore</option>
              <option value="Fenrir">Fenrir</option>
              <option value="Zephyr">Zephyr</option>
            </select>
          </div>

          {/* Video Mode Toggle */}
          <div className="bg-gradient-to-r from-purple-700/30 to-pink-700/30 p-4 rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <label htmlFor="videoMode" className="block text-sm font-medium text-gray-200">
                  🎥 Video Call Mode
                </label>
                <p className="text-xs text-gray-400 mt-1">Talk to Liza with real-time video avatar (HeyGen)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="videoMode"
                  type="checkbox"
                  checked={settings.videoMode}
                  onChange={(e) => onSettingsChange({ ...settings, videoMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            
            {settings.videoMode && (
              <div className="space-y-3 mt-4">
                <div>
                  <label htmlFor="heygenApiKey" className="block text-xs font-medium text-gray-300 mb-1">
                    HeyGen API Key
                  </label>
                  <input
                    id="heygenApiKey"
                    type="password"
                    value={settings.heygenApiKey || ''}
                    onChange={(e) => onSettingsChange({ ...settings, heygenApiKey: e.target.value })}
                    placeholder="Enter your HeyGen API key"
                    className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-sm text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Get free API key at <a href="https://app.heygen.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">app.heygen.com</a> (10 credits/month free)
                  </p>
                </div>
                
                <div>
                  <label htmlFor="avatarId" className="block text-xs font-medium text-gray-300 mb-1">
                    Avatar ID
                  </label>
                  <input
                    id="avatarId"
                    type="text"
                    value={settings.avatarId || 'default'}
                    onChange={(e) => onSettingsChange({ ...settings, avatarId: e.target.value })}
                    placeholder="default"
                    className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-sm text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Use 'default' or browse avatars at HeyGen
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Intensity Controls */}
          <div>
            <label htmlFor="flirtIntensity" className="block text-sm font-medium text-gray-300">Flirt Intensity: {settings.flirtIntensity}</label>
            <input
              id="flirtIntensity"
              type="range"
              min="0"
              max="100"
              value={settings.flirtIntensity}
              onChange={(e) => onSettingsChange({ ...settings, flirtIntensity: parseInt(e.target.value, 10) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="emotionIntensity" className="block text-sm font-medium text-gray-300">Emotion Intensity: {settings.emotionIntensity}</label>
            <input
              id="emotionIntensity"
              type="range"
              min="0"
              max="100"
              value={settings.emotionIntensity}
              onChange={(e) => onSettingsChange({ ...settings, emotionIntensity: parseInt(e.target.value, 10) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Character Customizer */}
          <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b border-gray-600 pb-2">Character Customizer</h3>
              
              {/* Avatar Generator */}
              <div className="bg-gray-700/50 p-4 rounded-lg space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Visual Avatar</label>
                  
                  {characterProfile.avatar ? (
                      <div className="flex flex-col items-center space-y-3">
                          <img 
                            src={characterProfile.avatar} 
                            alt="Liza Avatar" 
                            className="w-32 h-32 rounded-full object-cover border-4 border-indigo-500 shadow-lg"
                          />
                          <button 
                            onClick={handleRemoveAvatar}
                            className="text-xs text-red-400 hover:text-red-300 underline"
                          >
                              Remove Avatar
                          </button>
                      </div>
                  ) : (
                    <div className="w-32 h-32 mx-auto rounded-full bg-gray-600 flex items-center justify-center border-2 border-dashed border-gray-500">
                        <span className="text-gray-400 text-xs">No Avatar</span>
                    </div>
                  )}

                  <div className="pt-2">
                      <input
                        type="text"
                        value={avatarPrompt}
                        onChange={(e) => setAvatarPrompt(e.target.value)}
                        placeholder="Describe appearance (e.g., cute girl with pink hair)"
                        className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-sm text-white mb-2"
                      />
                      <button
                        onClick={handleGenerateAvatar}
                        disabled={isGenerating || !avatarPrompt.trim()}
                        className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                            isGenerating 
                            ? 'bg-gray-600 cursor-not-allowed' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isGenerating ? 'Generating...' : 'Generate New Avatar'}
                      </button>
                      {generationError && (
                          <p className="text-xs text-red-400 mt-1">{generationError}</p>
                      )}
                  </div>
              </div>

              <div>
                <label htmlFor="charName" className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                    type="text"
                    id="charName"
                    value={characterProfile.name}
                    onChange={(e) => onCharacterProfileChange({...characterProfile, name: e.target.value})}
                    className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="charPersonality" className="block text-sm font-medium text-gray-300 mb-2">Personality</label>
                <textarea
                    id="charPersonality"
                    value={characterProfile.personality}
                    onChange={(e) => onCharacterProfileChange({...characterProfile, personality: e.target.value})}
                    rows={3}
                    className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white"
                />
              </div>
          </div>

          {/* Memory Management */}
          <div className="space-y-4">
             <h3 className="text-lg font-semibold border-b border-gray-600 pb-2">Persistent Memory</h3>
             <div className="flex space-x-2">
                 <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Add a fact about you..."
                    className="flex-1 bg-gray-700 border-gray-600 rounded-md p-2 text-white"
                 />
                 <button onClick={handleAddMemory} className="p-2 bg-indigo-600 rounded-md hover:bg-indigo-500">
                     <PlusIcon className="h-5 w-5"/>
                 </button>
             </div>
             <div className="space-y-2 max-h-48 overflow-y-auto">
                {memory.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700 p-2 rounded-md">
                        <p className="text-sm flex-1">{item.fact}</p>
                        <button onClick={() => onDeleteMemory(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                            <TrashIcon className="h-4 w-4"/>
                        </button>
                    </div>
                ))}
             </div>
          </div>
          
           {/* Save Button */}
           <div className="pt-4 border-t border-gray-700 mt-4">
            <button
              onClick={onSave}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg"
            >
              <span>Save & Start New Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
