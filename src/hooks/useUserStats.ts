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
import { getSupabaseClient, isSupabaseEnabled } from '@/services/supabase/supabaseClient';
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
  /** True only when the snapshot was actually fetched from Supabase. */
  isReal: boolean;
}

// Per-user module-level cache. Each account gets its own slot, switching away
// from "pending" prevents the stale first-fetch (returned before Supabase
// session restored) from poisoning subsequent mounts. We deliberately do NOT
// cache snapshots marked `isReal: false` — those are defaults used when
// Supabase isn't ready yet and would lock in "0 XP / no chats" for 30s.
const cacheByUser = new Map<string, CachedSnapshot>();
const CACHE_TTL_MS = 30_000; // 30 seconds
const PENDING_USER_KEY = '__pending__';

/**
 * Resolves the real Supabase user id for cache keying.
 *
 * Returns:
 *   - `'local'` when Supabase is not configured (single shared bucket).
 *   - `PENDING_USER_KEY` when Supabase is configured but the session/user is
 *     not yet available — used as a sentinel so we don't accidentally promote
 *     a default snapshot into the real cache.
 *   - The actual `user.id` string otherwise.
 */
async function resolveCacheKey(): Promise<string> {
  if (!isSupabaseEnabled()) return 'local';
  const supabase = await getSupabaseClient();
  if (!supabase) return PENDING_USER_KEY;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? PENDING_USER_KEY;
  } catch {
    return PENDING_USER_KEY;
  }
}

export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats | null>(EMPTY_STATS);
  const [displayName, setDisplayName] = useState<string>('Explorer');
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);

  const activitySessionId = useRef<string | null>(null);
  const isMounted = useRef(true);

  // ─── Load user stats and name ─────────────────────────────────────────────
  // Accepts an optional pre-resolved `cacheKey` so callers (the mount effect)
  // can resolve once instead of paying an extra `supabase.auth.getUser()` here.
  const loadStats = useCallback(async (opts?: {
    background?: boolean;
    cacheKey?: string;
    signal?: { cancelled: boolean };
  }) => {
    const background = opts?.background ?? false;
    const cacheKey = opts?.cacheKey ?? await resolveCacheKey();
    const checkCancelled = () => opts?.signal?.cancelled || !isMounted.current;
    const cached = cacheByUser.get(cacheKey);

    // If we have a fresh, real cache for this user, hydrate from it immediately.
    if (
      cached &&
      cached.isReal &&
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
      const fetchedRealUser = snapshot.userId !== null;
      const payload: CachedSnapshot = {
        stats: snapshot.stats,
        displayName: snapshot.displayName,
        recentActivity: snapshot.recentActivity,
        timestamp: Date.now(),
        isReal: fetchedRealUser,
      };

      // Only cache snapshots that were actually fetched for a real user. The
      // Supabase-not-ready fallback (displayName="Explorer", all-zero stats)
      // previously locked in defaults for the full 30s TTL after a race.
      if (fetchedRealUser) {
        cacheByUser.set(cacheKey, payload);
      }

      setStats(snapshot.stats);
      setDisplayName(snapshot.displayName);
      setRecentActivity(snapshot.recentActivity);
    } catch (e) {
      console.error('[useUserStats] loadStats failed:', e);
      // On failure, fall back to the last real snapshot for this user if any.
      const fallback = cacheByUser.get(cacheKey);
      if (fallback && fallback.isReal && !checkCancelled()) {
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
    (async () => {
      const cacheKey = await resolveCacheKey();
      if (signal.cancelled || !isMounted.current) return;
      const cached = cacheByUser.get(cacheKey);
      if (
        cached &&
        cached.isReal &&
        Date.now() - cached.timestamp < CACHE_TTL_MS
      ) {
        setStats(cached.stats);
        setDisplayName(cached.displayName);
        setRecentActivity(cached.recentActivity);
        setLoading(false);
      } else {
        // Pass the already-resolved cacheKey so loadStats doesn't probe again.
        loadStats({ cacheKey, signal });
      }
    })();

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
