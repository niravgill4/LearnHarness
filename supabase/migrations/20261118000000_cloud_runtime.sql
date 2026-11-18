-- Durable cloud execution foundation. Apply before enabling cloud workers.
BEGIN;

-- Preserve the complete graph objects across cold starts.
ALTER TABLE public.graph_nodes ADD COLUMN IF NOT EXISTS record jsonb;
ALTER TABLE public.graph_chains ADD COLUMN IF NOT EXISTS record jsonb;

CREATE TABLE IF NOT EXISTS public.cloud_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 chat_id text NOT NULL,
 request_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('turn', 'extraction', 'job')),
 input jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
 attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
 max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
 lease_token uuid,
 lease_until timestamptz,
 available_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 error_code text,
 UNIQUE (user_id, request_id),
 FOREIGN KEY (chat_id, user_id) REFERENCES public.chats(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS cloud_tasks_claimable ON public.cloud_tasks(status, available_at, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS cloud_tasks_one_active_turn ON public.cloud_tasks(user_id, chat_id)
 WHERE kind = 'turn' AND status IN ('queued', 'running');
ALTER TABLE public.cloud_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloud_tasks FROM anon, authenticated;
GRANT SELECT ON public.cloud_tasks TO authenticated;
GRANT ALL ON public.cloud_tasks TO service_role;
DROP POLICY IF EXISTS cloud_tasks_read_own ON public.cloud_tasks;
CREATE POLICY cloud_tasks_read_own ON public.cloud_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Claim atomically; distinct workers cannot acquire the same task. Only trusted
-- server workers can invoke this function. Completion must match lease_token.
CREATE OR REPLACE FUNCTION public.claim_cloud_task()
RETURNS SETOF public.cloud_tasks LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE picked uuid;
BEGIN
 UPDATE public.cloud_tasks SET status = 'failed', error_code = 'attempts_exhausted', updated_at = now(), lease_token = NULL, lease_until = NULL
 WHERE status = 'running' AND lease_until < now() AND attempt >= max_attempts;
 SELECT id INTO picked FROM public.cloud_tasks
 WHERE attempt < max_attempts AND available_at <= now()
 AND (status = 'queued' OR (status = 'running' AND lease_until < now()))
 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF picked IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE public.cloud_tasks SET status = 'running', attempt = attempt + 1,
 lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes', updated_at = now()
 WHERE id = picked RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_cloud_task() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cloud_task() TO service_role;
COMMIT;
