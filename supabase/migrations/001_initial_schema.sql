-- ============================================
-- LIZA VIRTUAL COMPANION - CORE SCHEMA
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- USER PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    preferred_language TEXT DEFAULT 'English' CHECK (preferred_language IN ('English', 'Sinhala', 'Tamil')),
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row whenever a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- USER SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    language TEXT DEFAULT 'English' CHECK (language IN ('English', 'Sinhala', 'Tamil')),
    voice_name TEXT DEFAULT 'Kore',
    flirt_intensity INTEGER DEFAULT 70 CHECK (flirt_intensity BETWEEN 0 AND 100),
    emotion_intensity INTEGER DEFAULT 80 CHECK (emotion_intensity BETWEEN 0 AND 100),
    video_mode BOOLEAN DEFAULT false,
    avatar_id TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHARACTER PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS public.character_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    name TEXT DEFAULT 'Liza' NOT NULL,
    personality TEXT DEFAULT 'Playful, flirty, spoony, cozy, witty, and deeply caring.',
    avatar_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEMORIES (with RAG embeddings)
-- ============================================
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    embedding vector(768),  -- Gemini text-embedding-004 = 768 dimensions
    importance FLOAT DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_fact UNIQUE (user_id, fact)
);

CREATE INDEX IF NOT EXISTS memories_embedding_idx
ON public.memories USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- CONVERSATION SESSIONS & TURNS
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('entertainment', 'language', 'interview')),
    title TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sessions_user_mode_idx ON public.conversation_sessions(user_id, mode);

CREATE TABLE IF NOT EXISTS public.conversation_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL CHECK (speaker IN ('user', 'liza')),
    content TEXT NOT NULL,
    emotion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS turns_session_idx ON public.conversation_turns(session_id, created_at);

-- ============================================
-- SEMANTIC SEARCH FUNCTION (RAG)
-- ============================================
CREATE OR REPLACE FUNCTION public.match_memories(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    fact TEXT,
    similarity FLOAT,
    importance FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.fact,
        (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity,
        m.importance,
        m.created_at
    FROM public.memories m
    WHERE
        m.user_id = filter_user_id
        AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    ORDER BY
        (1 - (m.embedding <=> query_embedding)) * m.importance DESC
    LIMIT match_count;
END;
$$;

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON public.user_settings;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS characters_updated_at ON public.character_profiles;
CREATE TRIGGER characters_updated_at BEFORE UPDATE ON public.character_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
