
# Liza - Virtual Companion with Video Call Feature 🎥

Your AI-powered virtual girlfriend with realistic video avatars powered by HeyGen!

## ✨ Features

- 💬 **Natural Conversations**: Real-time voice conversations with emotion detection
- 🎥 **Video Call Mode**: Talk to Liza face-to-face with realistic video avatars (NEW!)
- 🧠 **Memory System**: Remembers important details about you
- 😊 **Emotion Intelligence**: Adapts responses based on your mood
- 🎭 **Custom Avatars**: Generate unique avatar images with AI
- 🌍 **Multi-language**: Supports English, Sinhala, and Tamil

## 🎥 Video Call Feature (HeyGen Integration)

Liza now supports **video call mode** where you can see and talk to her with realistic facial expressions and lip-sync!

### Is it Free?

**YES!** HeyGen offers a generous free tier:
- ✅ **10 API credits per month FREE**
- ✅ **0.2 credits per minute** of video conversation
- ✅ **= 50 minutes of free video calls monthly!**

### How to Enable Video Mode

1. **Get Your Free HeyGen API Key:**
   - Visit [app.heygen.com](https://app.heygen.com)
   - Sign up for a free account
   - Go to Settings → API Keys
   - Copy your API key

2. **Configure in Liza:**
   - Open Liza app
   - Click the Settings icon (⚙️)
   - Scroll to "🎥 Video Call Mode"
   - Toggle it ON
   - Paste your HeyGen API key
   - (Optional) Choose an avatar ID (default works great!)

3. **Start Video Conversation:**
   - Click "Save & Start New Chat"
   - You'll see Liza's video feed appear
   - She'll speak with realistic expressions and lip-sync!

### Cost Breakdown

| Plan | Credits/Month | Cost | Video Minutes |
|------|---------------|------|---------------|
| Free | 10 | $0 | 50 minutes |
| Pro | 100 | $99/mo | 500 minutes |
| Scale | 660 | $330/mo | 3,300 minutes |

**Note:** Video mode uses HeyGen for video + Google Gemini for conversation. Both have free tiers!

## 🚀 Run Locally

**Prerequisites:** Node.js

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   
   Create a `.env.local` file with:
   ```env
   API_KEY=your_gemini_api_key_here
   STABILITY_API_KEY=your_stability_api_key_here
   ```

   Get your API keys:
   - Gemini API: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (FREE)
   - Stability AI: [platform.stability.ai](https://platform.stability.ai) (for avatar generation - optional)

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:5173
   ```

## 📖 Usage Guide

### Text Mode (Default)
- Start conversation
- Speak naturally or type messages
- Liza responds with voice and adapts to your emotions

### Video Mode
- Enable in settings with HeyGen API key
- Start conversation
- See Liza's video avatar speaking with expressions
- Real-time lip-sync and emotional expressions

### Tips for Best Experience

1. **Microphone**: Use a good microphone for better voice recognition
2. **Internet**: Stable connection required for video streaming
3. **Browser**: Chrome or Edge recommended for best performance
4. **Memory**: Add facts about yourself in settings for personalized conversations

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **AI Conversation**: Google Gemini 2.5 Flash with native audio
- **Video Avatars**: HeyGen Streaming Avatar SDK
- **Avatar Generation**: Stability AI
- **WebRTC**: LiveKit (via HeyGen)

## 🔧 Configuration

All settings are accessible in the app:
- Language preferences
- Voice selection
- Flirt & emotion intensity
- Video mode toggle
- Character personality customization
- Persistent memory management

## 📝 Notes

- First conversation may take a moment to initialize
- Video mode requires HeyGen API key (free tier available)
- Avatar generation requires Stability AI key (optional feature)
- All conversations are processed in real-time
- Memory is stored locally in your browser

## 🤝 Credits

- Built with [Google Gemini](https://ai.google.dev/)
- Video powered by [HeyGen](https://www.heygen.com/)
- Avatar generation by [Stability AI](https://stability.ai/)

## 📄 License

This project is for educational and personal use.
