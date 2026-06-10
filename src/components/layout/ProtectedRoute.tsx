import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Gates authenticated routes. Unauthenticated users are redirected to login.
 *
 * Waits for `initialize()` to complete before deciding — this prevents the
 * "flash to /login" that would happen on a hard refresh while a valid Supabase
 * session exists but hasn't been restored from storage yet.
 *
 * Once the user is confirmed, `loadFromCloud()` hydrates settings and character
 * profile from Supabase (no-op in local-only mode).
 */
export const ProtectedRoute: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  const cloudLoaded = useSettingsStore((s) => s.cloudLoaded);
  const loadFromCloud = useSettingsStore((s) => s.loadFromCloud);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user && !cloudLoaded) {
      loadFromCloud(user.id);
    }
  }, [user, cloudLoaded, loadFromCloud]);

  // Still checking session — show a centered spinner.
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
