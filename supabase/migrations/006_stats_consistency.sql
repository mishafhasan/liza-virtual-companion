-- ============================================
-- MIGRATION 006: ENSURE USER STATS CONSISTENCY
-- ============================================
-- This migration ensures all existing auth users have corresponding
-- user_stats rows, and adds any missing indexes for performance.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- Ensure user_stats exists for all current users (handles users created
-- before trigger was in place or if trigger failed).
INSERT INTO public.user_stats (user_id)
SELECT au.id
FROM auth.users au
LEFT JOIN public.user_stats us ON us.user_id = au.id
WHERE us.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Ensure user_stats exists for all profiles too (belt-and-suspenders)
INSERT INTO public.user_stats (user_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.user_stats us ON us.user_id = p.id
WHERE us.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Add index on recent_activity for faster lookups
CREATE INDEX IF NOT EXISTS recent_activity_user_time_idx
    ON public.recent_activity(user_id, last_accessed_at DESC);

-- Add index on user_stats for faster reads
CREATE INDEX IF NOT EXISTS user_stats_user_idx
    ON public.user_stats(user_id);

-- Ensure the update_user_streak function correctly handles edge cases
-- Re-create with improved logic for same-day activity (idempotent update)
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_last_activity DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Ensure user_stats row exists (auto-create if missing)
    INSERT INTO public.user_stats (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current stats
    SELECT last_activity_date, current_streak, longest_streak
    INTO v_last_activity, v_current_streak, v_longest_streak
    FROM public.user_stats
    WHERE user_id = p_user_id;

    -- If first activity or no last activity
    IF v_last_activity IS NULL THEN
        UPDATE public.user_stats
        SET
            last_activity_date = v_today,
            current_streak = 1,
            longest_streak = GREATEST(1, COALESCE(v_longest_streak, 0)),
            updated_at = NOW()
        WHERE user_id = p_user_id;
        RETURN;
    END IF;

    -- If activity is today, do nothing (already counted)
    IF v_last_activity = v_today THEN
        RETURN;
    END IF;

    -- If activity was yesterday, increment streak
    IF v_last_activity = v_today - INTERVAL '1 day' THEN
        UPDATE public.user_stats
        SET
            last_activity_date = v_today,
            current_streak = COALESCE(v_current_streak, 0) + 1,
            longest_streak = GREATEST(COALESCE(v_current_streak, 0) + 1, COALESCE(v_longest_streak, 0)),
            updated_at = NOW()
        WHERE user_id = p_user_id;
        RETURN;
    END IF;

    -- If activity was before yesterday, reset streak to 1
    UPDATE public.user_stats
    SET
        last_activity_date = v_today,
        current_streak = 1,
        longest_streak = COALESCE(v_longest_streak, 0),
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Ensure add_user_xp also creates user_stats if missing
CREATE OR REPLACE FUNCTION public.add_user_xp(
    p_user_id UUID,
    p_xp INTEGER,
    p_mode TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Ensure user_stats row exists
    INSERT INTO public.user_stats (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Add XP
    UPDATE public.user_stats
    SET
        total_xp = total_xp + p_xp,
        entertainment_xp = CASE WHEN p_mode = 'entertainment' THEN entertainment_xp + p_xp ELSE entertainment_xp END,
        language_xp = CASE WHEN p_mode = 'language' THEN language_xp + p_xp ELSE language_xp END,
        interview_xp = CASE WHEN p_mode = 'interview' THEN interview_xp + p_xp ELSE interview_xp END,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Update streak when XP is added (means user is active today)
    PERFORM public.update_user_streak(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Ensure add_time_spent also creates user_stats if missing
CREATE OR REPLACE FUNCTION public.add_time_spent(
    p_user_id UUID,
    p_seconds INTEGER
)
RETURNS void AS $$
BEGIN
    -- Ensure user_stats row exists
    INSERT INTO public.user_stats (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_stats
    SET
        total_time_seconds = total_time_seconds + p_seconds,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
