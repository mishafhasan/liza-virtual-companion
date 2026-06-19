/**
 * User statistics service.
 *
 * Handles XP tracking, streaks, time spent, and recent activity. Supabase +
 * auth are required — callers are behind the auth gate. The user id is read
 * synchronously from the auth store (no per-call `auth.getUser()` round-trip).
 */

import { getSupabaseClient } from './supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import type { AppMode } from '@/types';

type TrackedMode = Exclude<AppMode, null>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserStats {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_time_seconds: number;
  entertainment_xp: number;
  language_xp: number;
  interview_xp: number;
}

export interface RecentActivity {
  mode: TrackedMode;
  conversation_session_id: string | null;
  last_accessed_at: string;
}

export interface DashboardStatsSnapshot {
  stats: UserStats;
  displayName: string;
  recentActivity: RecentActivity | null;
  /**
   * The Supabase user id the snapshot was fetched for, or `null` if there was
   * no current user. Callers use this to decide whether the result is cacheable.
   */
  userId: string | null;
}

const DEFAULT_STATS: UserStats = {
  total_xp: 0,
  current_streak: 0,
  longest_streak: 0,
  last_activity_date: null,
  total_time_seconds: 0,
  entertainment_xp: 0,
  language_xp: 0,
  interview_xp: 0,
};

/**
 * Reads the current user id from the auth store. Returns null if there is no
 * authenticated user yet (e.g. still hydrating) so callers can return defaults
 * instead of throwing during the initial dashboard mount.
 */
function getUserId(): string | null {
  return useAuthStore.getState().userId;
}

async function ensureUserStats(userId: string): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from('user_stats')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error && error.code !== '23505') {
    console.error('[userStatsService] ensureUserStats error:', error.message);
  }
}

// ─── XP Configuration ─────────────────────────────────────────────────────────

/**
 * XP rewards for different activities
 */
export const XP_REWARDS = {
  MESSAGE_SENT: 5,           // Per message in entertainment chat
  CONVERSATION_STARTED: 10,  // Starting a new conversation
  LANGUAGE_SESSION: 50,      // Completing a language session
  INTERVIEW_SESSION: 100,    // Completing a mock interview
  DAILY_LOGIN: 25,           // First activity of the day
} as const;

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  return (
    (user.user_metadata?.display_name as string | undefined)?.trim()
    || (user.user_metadata?.name as string | undefined)?.trim()
    || user.email?.split('@')[0]
    || 'Explorer'
  );
}

// ─── Stats Retrieval ──────────────────────────────────────────────────────────

/**
 * Get user statistics (XP, streaks, time spent). Returns default values if no
 * row exists yet (and seeds one).
 */
export async function getUserStats(): Promise<UserStats> {
  const userId = getUserId();
  if (!userId) return DEFAULT_STATS;

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[userStatsService] getUserStats error:', error.message);
    return DEFAULT_STATS;
  }

  if (!data) {
    await ensureUserStats(userId);
    return DEFAULT_STATS;
  }

  return data as UserStats;
}

/**
 * Load all dashboard stats with parallel DB reads (single auth lookup, cached).
 *
 * Returns `userId: null` when there is no current user yet. Hooks must NOT
 * cache `userId === null` results because they represent an unhydrated state.
 */
export async function getDashboardStatsSnapshot(): Promise<DashboardStatsSnapshot> {
  const userId = getUserId();
  if (!userId) {
    return {
      stats: DEFAULT_STATS,
      displayName: 'Explorer',
      recentActivity: null,
      userId: null,
    };
  }

  const supabase = await getSupabaseClient();

  const [statsResult, profileResult, activityResult] = await Promise.all([
    supabase
      .from('user_stats')
      .select('total_xp, current_streak, longest_streak, last_activity_date, total_time_seconds, entertainment_xp, language_xp, interview_xp')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('recent_activity')
      .select('mode, conversation_session_id, last_accessed_at')
      .eq('user_id', userId)
      .order('last_accessed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (statsResult.error) {
    console.error('[userStatsService] dashboard stats error:', statsResult.error.message);
  }
  if (profileResult.error) {
    console.error('[userStatsService] dashboard profile error:', profileResult.error.message);
  }
  if (activityResult.error) {
    console.error('[userStatsService] dashboard recent activity error:', activityResult.error.message);
  }

  if (!statsResult.data) {
    void ensureUserStats(userId);
  }

  // Prefer the profile display name; fall back to the auth store's cached name.
  const fallbackName =
    useAuthStore.getState().user?.name ??
    displayNameFromUser({ email: useAuthStore.getState().user?.email });

  return {
    stats: (statsResult.data as UserStats | null) ?? DEFAULT_STATS,
    displayName: profileResult.data?.display_name || fallbackName || 'Explorer',
    recentActivity: (activityResult.data as RecentActivity | null) ?? null,
    userId,
  };
}

/**
 * Get user's display name from profile
 */
export async function getUserDisplayName(): Promise<string> {
  const userId = getUserId();
  if (!userId) return 'Explorer';

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  const fallbackName =
    useAuthStore.getState().user?.name ??
    'Explorer';

  if (error || !data) return fallbackName;

  return data.display_name || fallbackName;
}

// ─── XP Management ────────────────────────────────────────────────────────────

/**
 * Add XP to user (automatically updates streak)
 */
export async function addXP(
  amount: number,
  mode?: TrackedMode,
): Promise<void> {
  if (amount <= 0) return;
  const userId = getUserId();
  if (!userId) return;

  const supabase = await getSupabaseClient();

  const { error } = await supabase.rpc('add_user_xp', {
    p_user_id: userId,
    p_xp: amount,
    p_mode: mode || null,
  });

  if (error) {
    console.error('[userStatsService] addXP error:', error.message);
  }
}

// ─── Time Tracking ────────────────────────────────────────────────────────────

/**
 * Add time spent in the app (in seconds)
 */
export async function addTimeSpent(seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const userId = getUserId();
  if (!userId) return;

  const supabase = await getSupabaseClient();

  const { error } = await supabase.rpc('add_time_spent', {
    p_user_id: userId,
    p_seconds: seconds,
  });

  if (error) {
    console.error('[userStatsService] addTimeSpent error:', error.message);
  }
}

// ─── Activity Sessions ────────────────────────────────────────────────────────

/**
 * Start an activity session (tracks time in a specific mode)
 */
export async function startActivitySession(mode: TrackedMode): Promise<string | null> {
  const userId = getUserId();
  if (!userId) return null;

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('activity_sessions')
    .insert({
      user_id: userId,
      mode,
      session_start: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[userStatsService] startActivitySession error:', error.message);
    return null;
  }

  return data.id;
}

/**
 * End an activity session and calculate XP earned
 */
export async function endActivitySession(
  sessionId: string,
  xpEarned: number = 0,
): Promise<void> {
  if (!sessionId) return;

  const supabase = await getSupabaseClient();

  const now = new Date().toISOString();

  // Get session start time to calculate duration
  const { data: session } = await supabase
    .from('activity_sessions')
    .select('session_start, mode')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  const startTime = new Date(session.session_start);
  const endTime = new Date(now);
  const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  // Update the session
  const { error } = await supabase
    .from('activity_sessions')
    .update({
      session_end: now,
      duration_seconds: durationSeconds,
      xp_earned: xpEarned,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[userStatsService] endActivitySession error:', error.message);
    return;
  }

  // Add the time spent to user stats
  await addTimeSpent(durationSeconds);

  // Add any XP earned during this session
  if (xpEarned > 0) {
    await addXP(xpEarned, session.mode);
  }
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

/**
 * Update recent activity for a mode (used for "Resume" button)
 */
export async function updateRecentActivity(
  mode: TrackedMode,
  conversationSessionId: string,
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from('recent_activity')
    .upsert({
      user_id: userId,
      mode,
      conversation_session_id: conversationSessionId,
      last_accessed_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,mode',
    });

  if (error) {
    console.error('[userStatsService] updateRecentActivity error:', error.message);
  }
}

/**
 * Get recent activity for a specific mode
 */
export async function getRecentActivity(mode: TrackedMode): Promise<RecentActivity | null> {
  const userId = getUserId();
  if (!userId) return null;

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('recent_activity')
    .select('mode, conversation_session_id, last_accessed_at')
    .eq('user_id', userId)
    .eq('mode', mode)
    .single();

  if (error) {
    // No recent activity is not an error
    return null;
  }

  return data as RecentActivity;
}

/**
 * Get the most recent activity across all modes
 */
export async function getMostRecentActivity(): Promise<RecentActivity | null> {
  const userId = getUserId();
  if (!userId) return null;

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('recent_activity')
    .select('mode, conversation_session_id, last_accessed_at')
    .eq('user_id', userId)
    .order('last_accessed_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data as RecentActivity;
}

// ─── Streak Management ────────────────────────────────────────────────────────

/**
 * Manually trigger streak update (usually called on app open)
 */
export async function updateStreak(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const supabase = await getSupabaseClient();

  const { error } = await supabase.rpc('update_user_streak', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[userStatsService] updateStreak error:', error.message);
  }
}
