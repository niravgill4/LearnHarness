-- LearnHarness Multi-Tenant PostgreSQL Schema with Row-Level Security (RLS)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USER PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    encrypted_keys TEXT, -- AES-256 encrypted JSON string of user BYOK keys
    theme_settings JSONB DEFAULT '{}'::jsonb,
    model_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. CHAT SESSIONS (replaces data/chats/*.json)
CREATE TABLE IF NOT EXISTS public.chats (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'teach', -- 'teach' | 'practice'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON public.chats(user_id, updated_at DESC);

-- 4. CONVERSATION MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_lookup ON public.chat_messages(user_id, chat_id, created_at ASC);

-- 5. REASONING PLANS
CREATE TABLE IF NOT EXISTS public.chat_plans (
    chat_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tree JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (chat_id, user_id)
);

-- 6. TURN USAGE METRICS
CREATE TABLE IF NOT EXISTS public.chat_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_usage_lookup ON public.chat_usage(user_id, chat_id);

-- 7. KNOWLEDGE GRAPH PROPOSITIONS (replaces data/graph/nodes.jsonl)
CREATE TABLE IF NOT EXISTS public.graph_nodes (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    statement TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_user ON public.graph_nodes(user_id);

-- 8. REASONING CHAINS (replaces data/graph/chains.jsonl)
CREATE TABLE IF NOT EXISTS public.graph_chains (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    premises TEXT[] NOT NULL,
    conclusion TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_graph_chains_user ON public.graph_chains(user_id);

-- 9. CANVAS POSITIONS (replaces data/graph/positions.json)
CREATE TABLE IF NOT EXISTS public.graph_positions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    positions JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. GRAPH SOURCES / NOTES
CREATE TABLE IF NOT EXISTS public.graph_sources (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);

-- 11. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_sources ENABLE ROW LEVEL SECURITY;

-- 12. ROW LEVEL SECURITY POLICIES
CREATE POLICY "Users access own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own chats" ON public.chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own chat_messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own chat_plans" ON public.chat_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own chat_usage" ON public.chat_usage FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own graph_nodes" ON public.graph_nodes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own graph_chains" ON public.graph_chains FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own graph_positions" ON public.graph_positions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own graph_sources" ON public.graph_sources FOR ALL USING (auth.uid() = user_id);

