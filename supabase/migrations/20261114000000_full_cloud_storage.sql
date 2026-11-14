-- Full Multi-Tenant Cloud Storage Enhancements

-- 1. Ensure chats has record column for full session serialization (messages, tree, turns, settings, sideChats)
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS record JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure profiles has user_settings column for complete user model choices and preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_settings JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure graph_sources has metadata column for source file attributes
ALTER TABLE public.graph_sources 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Create index on chats record for fast searches if needed
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);

