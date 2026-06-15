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

// Module-level cache so every instance of the hook shares the same data.
let cachedSnapshot: CachedSnapshot | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats | null>(EMPTY_STATS);
  const [displayName, setDisplayName] = useState<string>('Explorer');
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);

  const activitySessionId = useRef<string | null>(null);
  const isMounted = useRef(true);

  // ─── Load user stats and name ─────────────────────────────────────────────
  const loadStats = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background ?? false;

    // If we have a fresh cache, hydrate from it immediately without showing a spinner.
    if (cachedSnapshot && Date.now() - cachedSnapshot.timestamp < CACHE_TTL_MS) {
      if (!background) {
        setStats(cachedSnapshot.stats);
        setDisplayName(cachedSnapshot.displayName);
        setRecentActivity(cachedSnapshot.recentActivity);
        setLoading(false);
      }
      // Still fetch in the background if the cache is stale (handled below).
      return;
    }

    if (!background) setLoading(true);

    try {
      const snapshot = await getDashboardStatsSnapshot();
      const payload: CachedSnapshot = {
        stats: snapshot.stats,
        displayName: snapshot.displayName,
        recentActivity: snapshot.recentActivity,
        timestamp: Date.now(),
      };
      cachedSnapshot = payload;

      if (isMounted.current) {
        setStats(snapshot.stats);
        setDisplayName(snapshot.displayName);
        setRecentActivity(snapshot.recentActivity);
      }
    } catch (e) {
      console.error('[useUserStats] loadStats failed:', e);
      // On failure, keep any existing cached data so the UI isn't blank.
      if (cachedSnapshot && isMounted.current) {
        setStats(cachedSnapshot.stats);
        setDisplayName(cachedSnapshot.displayName);
        setRecentActivity(cachedSnapshot.recentActivity);
      }
    } finally {
      if (isMounted.current && !background) {
        setLoading(false);
      }
    }
  }, []);

  // ─── Initialize on mount ──────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;

    // If we have a recent cache, show it immediately and skip the loading state.
    if (cachedSnapshot && Date.now() - cachedSnapshot.timestamp < CACHE_TTL_MS) {
      setStats(cachedSnapshot.stats);
      setDisplayName(cachedSnapshot.displayName);
      setRecentActivity(cachedSnapshot.recentActivity);
      setLoading(false);
    } else {
      loadStats();
    }

    // Cleanup on unmount — end any active activity session
    return () => {
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
