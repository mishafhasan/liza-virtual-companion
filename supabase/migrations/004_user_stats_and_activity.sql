-- ============================================
-- USER STATISTICS & ACTIVITY TRACKING
-- ============================================

-- User Stats Table - tracks XP, streaks, and time spent
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_xp INTEGER DEFAULT 0 CHECK (total_xp >= 0),
    current_streak INTEGER DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INTEGER DEFAULT 0 CHECK (longest_streak >= 0),
    last_activity_date DATE,
    total_time_seconds INTEGER DEFAULT 0 CHECK (total_time_seconds >= 0),
    entertainment_xp INTEGER DEFAULT 0 CHECK (entertainment_xp >= 0),
    language_xp INTEGER DEFAULT 0 CHECK (language_xp >= 0),
    interview_xp INTEGER DEFAULT 0 CHECK (interview_xp >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Sessions - tracks each time user is active in the app
CREATE TABLE IF NOT EXISTS public.activity_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('entertainment', 'language', 'interview')),
    session_start TIMESTAMPTZ DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_user_idx ON public.activity_sessions(user_id, session_start DESC);

-- Recent Activity - tracks the most recent session per mode for quick access
CREATE TABLE IF NOT EXISTS public.recent_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('entertainment', 'language', 'interview')),
    conversation_session_id UUID REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_mode UNIQUE (user_id, mode)
);

-- Auto-create user_stats row when a new profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_stats ON public.profiles;
CREATE TRIGGER on_profile_created_stats
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();

-- Function to update streak based on activity
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_last_activity DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
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
            longest_streak = GREATEST(1, v_longest_streak),
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
            current_streak = v_current_streak + 1,
            longest_streak = GREATEST(v_current_streak + 1, v_longest_streak),
            updated_at = NOW()
        WHERE user_id = p_user_id;
        RETURN;
    END IF;

    -- If activity was before yesterday, reset streak
    UPDATE public.user_stats
    SET 
        last_activity_date = v_today,
        current_streak = 1,
        longest_streak = v_longest_streak,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add XP to user
CREATE OR REPLACE FUNCTION public.add_user_xp(
    p_user_id UUID,
    p_xp INTEGER,
    p_mode TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE public.user_stats
    SET 
        total_xp = total_xp + p_xp,
        entertainment_xp = CASE WHEN p_mode = 'entertainment' THEN entertainment_xp + p_xp ELSE entertainment_xp END,
        language_xp = CASE WHEN p_mode = 'language' THEN language_xp + p_xp ELSE language_xp END,
        interview_xp = CASE WHEN p_mode = 'interview' THEN interview_xp + p_xp ELSE interview_xp END,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Update streak when XP is added (means user is active)
    PERFORM public.update_user_streak(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Function to add time spent
CREATE OR REPLACE FUNCTION public.add_time_spent(
    p_user_id UUID,
    p_seconds INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE public.user_stats
    SET 
        total_time_seconds = total_time_seconds + p_seconds,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger on updated_at for user_stats
DROP TRIGGER IF EXISTS user_stats_updated_at ON public.user_stats;
CREATE TRIGGER user_stats_updated_at BEFORE UPDATE ON public.user_stats
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create stats for existing users (migration helper)
INSERT INTO public.user_stats (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_stats)
ON CONFLICT (user_id) DO NOTHING;
