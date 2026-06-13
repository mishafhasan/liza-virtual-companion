-- ============================================
-- ROW LEVEL SECURITY FOR USER STATS TABLES
-- ============================================

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;

-- User Stats: Users can view and update their own stats
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
CREATE POLICY "Users can view own stats" ON public.user_stats
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
CREATE POLICY "Users can update own stats" ON public.user_stats
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
CREATE POLICY "Users can insert own stats" ON public.user_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Activity Sessions: Full access to own sessions
DROP POLICY IF EXISTS "Users can manage own activity sessions" ON public.activity_sessions;
CREATE POLICY "Users can manage own activity sessions" ON public.activity_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recent Activity: Full access to own recent activity
DROP POLICY IF EXISTS "Users can manage own recent activity" ON public.recent_activity;
CREATE POLICY "Users can manage own recent activity" ON public.recent_activity
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
