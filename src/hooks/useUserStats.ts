/**
 * Hook for managing user statistics, activity tracking, and time spent.
 *
 * Provides methods for awarding XP, updating streaks, and managing recent
 * activity. Global time tracking is handled by AppLayout — this hook only
 * loads and exposes stats data.
 *
 * Uses a module-level cache with a 30-second TTL so navigating between
 * settings and dashboard does not trigger fresh network requests every time.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDashboardStatsSnapshot,
  addXP,
  startActivitySession,
  endActivitySession,
  updateRecentActivity,
  getRecentActivity,
  XP_REWARDS,
  type UserStats,
  type RecentActivity,
} from '@/services/supabase/userStatsService';
import { useAuthStore } from '@/stores/authStore';
import { registerCacheClearer } from '@/services/sync/cache';
import type { AppMode } from '@/types';

type TrackedMode = Exclude<AppMode, null>;

const EMPTY_STATS: UserStats = {
  total_xp: 0,
  current_streak: 0,
  longest_streak: 0,
  last_activity_date: null,
  total_time_seconds: 0,
  entertainment_xp: 0,
  language_xp: 0,
  interview_xp: 0,
};

interface CachedSnapshot {
  stats: UserStats;
  displayName: string;
  recentActivity: RecentActivity | null;
  timestamp: number;
}

// Per-user module-level cache (30s TTL). Keyed by the auth store's cached user
// id, so there's no async probe and no "pending" sentinel. Cleared on logout.
const cacheByUser = new Map<string, CachedSnapshot>();
const CACHE_TTL_MS = 30_000; // 30 seconds

/** Clear all stats caches — registered for the logout wipe. */
function clearStatsCache() {
  cacheByUser.clear();
}
registerCacheClearer(clearStatsCache);

/**
 * Reads the current user id synchronously from the auth store. Behind the auth
 * gate this is always set. Returns null during the very first mount before the
 * session is restored, in which case the snapshot is fetched but not cached.
 */
function getUserId(): string | null {
  return useAuthStore.getState().userId;
}

export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats | null>(EMPTY_STATS);
  const [displayName, setDisplayName] = useState<string>('Explorer');
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);

  const activitySessionId = useRef<string | null>(null);
  const isMounted = useRef(true);

  // ─── Load user stats and name ─────────────────────────────────────────────
  const loadStats = useCallback(async (opts?: {
    background?: boolean;
    signal?: { cancelled: boolean };
  }) => {
    const background = opts?.background ?? false;
    const checkCancelled = () => opts?.signal?.cancelled || !isMounted.current;
    const cacheKey = getUserId();
    const cached = cacheKey ? cacheByUser.get(cacheKey) : undefined;

    // If we have a fresh cache for this user, hydrate from it immediately.
    if (
      cached &&
      Date.now() - cached.timestamp < CACHE_TTL_MS
    ) {
      if (!background && !checkCancelled()) {
        setStats(cached.stats);
        setDisplayName(cached.displayName);
        setRecentActivity(cached.recentActivity);
        setLoading(false);
      }
      return;
    }

    if (!background && !checkCancelled()) setLoading(true);

    try {
      const snapshot = await getDashboardStatsSnapshot();
      if (checkCancelled()) return;
      const fetchedUser = snapshot.userId;
      const payload: CachedSnapshot = {
        stats: snapshot.stats,
        displayName: snapshot.displayName,
        recentActivity: snapshot.recentActivity,
        timestamp: Date.now(),
      };

      // Only cache snapshots fetched for a real user. The "no user yet" fallback
      // (Explorer / all-zero) is transient and must not lock in for the 30s TTL.
      if (fetchedUser) {
        cacheByUser.set(fetchedUser, payload);
      }

      setStats(snapshot.stats);
      setDisplayName(snapshot.displayName);
      setRecentActivity(snapshot.recentActivity);
    } catch (e) {
      console.error('[useUserStats] loadStats failed:', e);
      // On failure, fall back to the last cached snapshot for this user if any.
      const fallback = cacheKey ? cacheByUser.get(cacheKey) : undefined;
      if (fallback && !checkCancelled()) {
        setStats(fallback.stats);
        setDisplayName(fallback.displayName);
        setRecentActivity(fallback.recentActivity);
      }
    } finally {
      if (!background && !checkCancelled()) {
        setLoading(false);
      }
    }
  }, []);

  // ─── Initialize on mount ──────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    const signal = { cancelled: false };
    const cacheKey = getUserId();
    const cached = cacheKey ? cacheByUser.get(cacheKey) : undefined;
    if (
      cached &&
      Date.now() - cached.timestamp < CACHE_TTL_MS
    ) {
      setStats(cached.stats);
      setDisplayName(cached.displayName);
      setRecentActivity(cached.recentActivity);
      setLoading(false);
    } else {
      loadStats({ signal });
    }

    // Cleanup on unmount — end any active activity session
    return () => {
      signal.cancelled = true;
      isMounted.current = false;
      if (activitySessionId.current) {
        endActivitySession(activitySessionId.current, 0);
      }
    };
  }, [loadStats]);

  // ─── Award XP ─────────────────────────────────────────────────────────────
  const awardXP = useCallback(
    async (amount: number, mode?: AppMode) => {
      await addXP(amount, mode);
      await loadStats({ background: true }); // Refresh stats in background
    },
    [loadStats]
  );

  // ─── Start mode activity ──────────────────────────────────────────────────
  const startModeActivity = useCallback(async (mode: TrackedMode) => {
    const sessionId = await startActivitySession(mode);
    activitySessionId.current = sessionId;
  }, []);

  // ─── End mode activity ────────────────────────────────────────────────────
  const endModeActivity = useCallback(
    async (xpEarned: number = 0) => {
      if (activitySessionId.current) {
        await endActivitySession(activitySessionId.current, xpEarned);
        activitySessionId.current = null;
        await loadStats({ background: true }); // Refresh stats in background
      }
    },
    [loadStats]
  );

  // ─── Track conversation activity ──────────────────────────────────────────
  const trackConversation = useCallback(
    async (mode: TrackedMode, conversationId: string) => {
      await updateRecentActivity(mode, conversationId);
      await loadStats({ background: true }); // Refresh recent activity in background
    },
    [loadStats]
  );

  // ─── Get recent activity for mode ─────────────────────────────────────────
  const getRecentForMode = useCallback(async (mode: TrackedMode) => {
    return await getRecentActivity(mode);
  }, []);

  // ─── Format time spent ────────────────────────────────────────────────────
  const formatTimeSpent = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      const decimalMins = Math.floor((minutes / 60) * 10);
      return `${hours}.${decimalMins} Hrs`;
    }
    if (minutes === 0 && seconds > 0) return '<1 Min';
    return `${minutes} Mins`;
  }, []);

  // ─── Format streak ────────────────────────────────────────────────────────
  const formatStreak = useCallback((streak: number): string => {
    if (streak === 0) return 'Start Today!';
    if (streak === 1) return '1 Day';
    return `${streak} Days`;
  }, []);

  return {
    stats,
    displayName,
    loading,
    recentActivity,
    XP_REWARDS,
    awardXP,
    startModeActivity,
    endModeActivity,
    trackConversation,
    getRecentForMode,
    formatTimeSpent,
    formatStreak,
    refreshStats: loadStats,
  };
};
