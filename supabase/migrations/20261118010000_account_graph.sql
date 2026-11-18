BEGIN;
CREATE TABLE IF NOT EXISTS public.account_graph_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1,
 state jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_graph_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_graph_state FROM anon, authenticated;
GRANT SELECT ON public.account_graph_state TO authenticated;
GRANT ALL ON public.account_graph_state TO service_role;
DROP POLICY IF EXISTS account_graph_read_own ON public.account_graph_state;
CREATE POLICY account_graph_read_own ON public.account_graph_state FOR SELECT TO authenticated USING(auth.uid()=user_id);
-- Compare-and-swap prevents two instances from silently losing each other's
-- graph changes. Conflicts are surfaced for recovery rather than overwritten.
CREATE OR REPLACE FUNCTION public.save_account_graph(p_user_id uuid, p_revision bigint, p_state jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result bigint;
BEGIN
 IF p_revision=0 THEN
  INSERT INTO public.account_graph_state(user_id,state) VALUES(p_user_id,p_state)
  ON CONFLICT(user_id) DO NOTHING RETURNING revision INTO result;
 ELSE
  UPDATE public.account_graph_state SET state=p_state,revision=revision+1,updated_at=now()
  WHERE user_id=p_user_id AND revision=p_revision RETURNING revision INTO result;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'graph_revision_conflict' USING ERRCODE='40001'; END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.save_account_graph(uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_account_graph(uuid,bigint,jsonb) TO service_role;
COMMIT;
