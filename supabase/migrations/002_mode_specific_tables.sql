-- ============================================
-- LANGUAGE LEARNING
-- ============================================
CREATE TABLE IF NOT EXISTS public.language_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    target_language TEXT NOT NULL CHECK (target_language IN ('English', 'Sinhala', 'Tamil')),
    proficiency_level TEXT DEFAULT 'Beginner' CHECK (proficiency_level IN ('Beginner', 'Intermediate', 'Advanced')),
    learning_goal TEXT DEFAULT 'Daily Practice',
    sessions_completed INTEGER DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    fluency_score FLOAT DEFAULT 0 CHECK (fluency_score BETWEEN 0 AND 100),
    vocabulary_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.language_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_session_id UUID REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,
    performance_score FLOAT DEFAULT 0,
    grammar_score FLOAT DEFAULT 0,
    vocabulary_score FLOAT DEFAULT 0,
    fluency_score FLOAT DEFAULT 0,
    corrections JSONB DEFAULT '[]'::jsonb,
    vocabulary_introduced JSONB DEFAULT '[]'::jsonb,
    areas_for_improvement TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MOCK INTERVIEW
-- ============================================
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_session_id UUID REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,
    job_role TEXT NOT NULL,
    company_name TEXT,
    interview_type TEXT DEFAULT 'mixed' CHECK (interview_type IN ('behavioral', 'technical', 'mixed')),
    difficulty TEXT DEFAULT 'mid',
    resume_path TEXT,           -- Supabase Storage path
    job_description TEXT,
    overall_score FLOAT DEFAULT 0,
    questions JSONB DEFAULT '[]'::jsonb,
    feedback JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS interview_user_idx ON public.interview_sessions(user_id, started_at DESC);

-- ============================================
-- RESUME FILES (metadata; file bytes live in Supabase Storage)
-- ============================================
CREATE TABLE IF NOT EXISTS public.resume_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size INTEGER,
    parsed_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS language_progress_updated_at ON public.language_progress;
CREATE TRIGGER language_progress_updated_at BEFORE UPDATE ON public.language_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
