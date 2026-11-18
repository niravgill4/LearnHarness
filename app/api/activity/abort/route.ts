import { createAdminClient, createClient } from "@/lib/supabase/server";
import { stores } from "@/src/server";
/**
 * POST /api/activity/abort — the dock's END/ABORT control, uniform across
 * process kinds (user-decided contract): body {kind: "job"|"plugin-worker"|"extraction"|"turn", id}
 * where id is the jobId for sub-agent jobs, the chatId for extraction runs
 * (the pipeline registry is chat-keyed), and the chatId for turns
 * (background-turn wave, 2026-09-25: a running turn is a background
 * object — any client may stop it here; a view leaving NEVER kills it).
 * Mechanisms live in their domains — abortJob (server/jobs.ts, agents
 * stream), abortExtraction (the pipeline module, graph stream), and
 * abortTurn (server/turn-runs.ts, the running-turn registry); this route
 * is the thin composition.
 *
 * Outcomes: a job's not_found -> 404, not_running -> 409, aborted -> 200.
 * A turn mirrors the job semantics: not_running -> 409 (honest "nothing to
 * abort" — the caller refetches), aborted -> 200 (partial persists via
 * the usual settle path, every subscriber closes cleanly).
 * Extraction abort is idempotent by design (aborting with nothing in
 * flight is success — the blob is gone either way) -> 200.
 */
import { abortExtraction, abortJob, abortPluginWorkerActivity, abortTurn } from "@/src/server";

export async function POST(req: Request) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}
	const { kind, id } = (body ?? {}) as { kind?: string; id?: string };
	if ((kind !== "job" && kind !== "plugin-worker" && kind !== "extraction" && kind !== "turn") || typeof id !== "string" || id === "") {
		return Response.json({ error: 'Body must be {kind: "job"|"plugin-worker"|"extraction"|"turn", id: string}' }, { status: 400 });
	}
	if (!/^[A-Za-z0-9:_-]+$/.test(id)) {
		return Response.json({ error: "Invalid id" }, { status: 400 });
	}

	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
		// Plugin workers do not yet carry a verifiable account owner.
		if (kind === "plugin-worker") return Response.json({ error: "Cloud worker cancellation is not available." }, { status: 503 });
		let taskQuery = supabase.from("cloud_tasks").select("id,status,input").eq("user_id", user.id);
		taskQuery = kind === "job"
			? taskQuery.eq("kind", "job").contains("input", { job: { id } })
			: taskQuery.eq("kind", kind).eq("chat_id", id);
		const { data: task, error } = await taskQuery.in("status", ["queued", "running"]).limit(1).maybeSingle();
		if (error) return Response.json({ error: "Could not verify background work." }, { status: 503 });
		if (!task) return Response.json({ ok: false, reason: "not_running" }, { status: 409 });
		const admin = createAdminClient();
		if (!admin) return Response.json({ error: "Cloud worker control is unavailable." }, { status: 503 });
		const update = await admin.from("cloud_tasks").update({ status: "cancelled", lease_until: null, updated_at: new Date().toISOString() })
			.eq("id", task.id).eq("user_id", user.id).in("status", ["queued", "running"]).select("id");
		if (update.error || !update.data?.length) return Response.json({ ok: false, reason: "not_running" }, { status: 409 });
		return Response.json({ ok: true });
	}

	if (kind === "job") {
		const outcome = abortJob(id);
		if (!outcome.ok) {
			const status = outcome.reason === "not_found" ? 404 : 409;
			return Response.json({ ok: false, reason: outcome.reason }, { status });
		}
		return Response.json({ ok: true });
	}
	if (kind === "plugin-worker") {
		if (!abortPluginWorkerActivity(id)) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
		return Response.json({ ok: true });
	}
	if (kind === "turn") {
		const outcome = abortTurn(id);
		if (!outcome.ok) return Response.json({ ok: false, reason: outcome.reason }, { status: 409 });
		return Response.json({ ok: true });
	}
	// kind === "extraction": true cancellation; idempotent (nothing in
	// flight is success — same dock outcome)
	abortExtraction(id);
	return Response.json({ ok: true });
}
