import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { AppLayout } from '@/components/layout/AppLayout';

import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { ModeSelectionPage } from '@/pages/dashboard/ModeSelectionPage';
import { ChatPage } from '@/pages/features/ChatPage';
import { LanguageLearningPage } from '@/pages/features/LanguageLearningPage';
import { InterviewPage } from '@/pages/features/InterviewPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
    return (
        <Router>
            <AuthProvider>
                <SettingsProvider>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<AuthPage />} />
                        <Route path="/signup" element={<AuthPage />} />

                        {/* Authenticated Routes */}
                        <Route element={<AppLayout />}>
                            <Route path="/dashboard" element={<ModeSelectionPage />} />
                            <Route path="/chat" element={<ChatPage />} />
                            <Route path="/language" element={<LanguageLearningPage />} />
                            <Route path="/interview" element={<InterviewPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Route>

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <Toaster position="top-center" theme="dark" />
                </SettingsProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
