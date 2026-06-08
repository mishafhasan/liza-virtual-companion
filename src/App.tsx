import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { ModeSelectionPage } from '@/pages/dashboard/ModeSelectionPage';
import { ChatPage } from '@/pages/features/ChatPage';
import { LanguageLearningPage } from '@/pages/features/LanguageLearningPage';
import { InterviewPage } from '@/pages/features/InterviewPage';
import { SettingsPage } from '@/pages/SettingsPage';

/**
 * Root application component.
 *
 * State is now managed by Zustand stores (see src/stores), so the former
 * AuthProvider/SettingsProvider context wrappers are gone — stores are imported
 * directly where needed. An ErrorBoundary wraps the whole tree so a failure in
 * any route degrades gracefully instead of blanking the screen.
 */
function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<AuthPage />} />
                    <Route path="/signup" element={<AuthPage />} />

                    {/* Authenticated Routes (guarded) */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                            <Route path="/dashboard" element={<ModeSelectionPage />} />
                            <Route path="/chat" element={<ChatPage />} />
                            <Route path="/language" element={<LanguageLearningPage />} />
                            <Route path="/interview" element={<InterviewPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Route>
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <Toaster position="top-center" theme="dark" />
            </Router>
        </ErrorBoundary>
    );
}

export default App;
