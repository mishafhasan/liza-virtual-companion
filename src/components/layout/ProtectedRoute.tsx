import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isSupabaseEnabled } from '@/services/supabase/supabaseClient';

/**
 * Gates authenticated routes. Unauthenticated users are redirected to login.
 *
 * Waits for `initialize()` to complete before deciding — this prevents the
 * "flash to /login" that would happen on a hard refresh while a valid Supabase
 * session exists but hasn't been restored from storage yet.
 *
 * Once the user is confirmed, `loadFromCloud()` hydrates settings and character
 * profile from Supabase (no-op in local-only mode).
 *
 * The auth initializer is only called once globally; settings are only loaded once
 * per user so navigating between /dashboard and /settings does not trigger
 * redundant network requests.
 */
export const ProtectedRoute: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  const cloudLoaded = useSettingsStore((s) => s.cloudLoaded);
  const loadFromCloud = useSettingsStore((s) => s.loadFromCloud);
  const lastCloudLoadedUserId = useSettingsStore((s) => s.lastCloudLoadedUserId);

  const hasInitialized = useRef(false);
  const isLoadingCloud = useRef(false);

  // Force a cloud refresh on every fresh mount by clearing the last-loaded
  // user id. This keeps settings, character profile, and memories in sync
  // across devices after re-entering the app. In-app SPA navigation is
  // already short-circuited via `lastCloudLoadedUserId`, so this only
  // runs on full mount (hard refresh / tab open). No-op when Supabase is
  // disabled — localStorage is the source of truth in that case.
  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    useSettingsStore.setState({ lastCloudLoadedUserId: null });
  }, []);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initialize();
    }
  }, [initialize]);

  useEffect(() => {
    if (user && !cloudLoaded && lastCloudLoadedUserId !== user.id) {
      // Prevent StrictMode double-fires and duplicate in-flight requests.
      if (!isLoadingCloud.current) {
        isLoadingCloud.current = true;
        loadFromCloud(user.id).finally(() => {
          isLoadingCloud.current = false;
        });
      }
    }
  }, [user, cloudLoaded, lastCloudLoadedUserId, loadFromCloud]);

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
