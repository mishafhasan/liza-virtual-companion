import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isSupabaseEnabled } from '@/services/supabase/supabaseClient';
import { SupabaseConfigErrorScreen } from '@/components/shared/SupabaseConfigErrorScreen';

/**
 * Gates authenticated routes. Login is REQUIRED — there is no local-only mode.
 *
 * - If Supabase is not configured → render {@link SupabaseConfigErrorScreen}.
 *   No authenticated UI is reachable without a backend.
 * - While the session is being restored → spinner (prevents the "flash to
 *   /login" on a hard refresh while a valid session exists).
 * - Once restored with no user → redirect to /login.
 * - Once a user is confirmed → hydrate settings/profile/memories from Supabase
 *   once per user via `loadFromCloud()`.
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
  // across devices after re-entering the app. In-app SPA navigation is already
  // short-circuited via `lastCloudLoadedUserId`, so this only runs on full
  // mount (hard refresh / tab open).
  useEffect(() => {
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

  // No backend → hard block. The user cannot reach any feature.
  if (!isSupabaseEnabled()) {
    return <SupabaseConfigErrorScreen />;
  }

  // Still checking session — show a centered spinner.
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
