/**
 * GET /api/activity — the dock's one poll: every running background
 * process, every view (chat, home, everywhere). Composition only — the
 * feed lives in server/observability.ts; costs are projected server-side
 * through Pi's catalog and public calculator. See that module's header for why /api/jobs stays
 * chat-scoped and untouched.
 */
import { createClient } from "@/lib/supabase/server";
import { activityFeed } from "@/src/server";
import { kickCloudWorker } from "@/lib/supabase/cloud-workers";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
	const supabase = await createClient();
	if (!supabase) return Response.json(activityFeed());
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
	const [chats, sources, tasks, graph] = await Promise.all([
		supabase.from("chats").select("id,title").eq("user_id", user.id),
		supabase.from("graph_sources").select("id").eq("user_id", user.id),
		supabase.from("cloud_tasks").select("id,chat_id,kind,input,status,created_at,updated_at").eq("user_id", user.id).in("status", ["queued", "running"]),
		supabase.from("account_graph_state").select("revision").eq("user_id", user.id).maybeSingle(),
	]);
	if (chats.error || sources.error || tasks.error || graph.error) return Response.json({ error: "Your activity could not be loaded." }, { status: 503 });
	after(() => kickCloudWorker().catch((error) => console.error("[cloud-worker] recovery wake failed:", error)));
	const titles = new Map((chats.data ?? []).map((chat) => [chat.id, chat.title]));
	const jobs = (tasks.data ?? []).filter((task) => task.kind === "job").flatMap((task) => {
		const job = task.input?.job;
		return job && typeof job === "object" ? [{ ...job, status: "running", updatedAt: task.updated_at, title: titles.get(task.chat_id) ?? task.chat_id, costUsd: null, contextLimit: null }] : [];
	});
	const extractions = (tasks.data ?? []).filter((task) => task.kind === "extraction").map((task) => ({
		id: task.id, chatId: task.chat_id, title: titles.get(task.chat_id) ?? task.chat_id,
		phase: task.status === "queued" ? "waiting" : "extracting", startedAt: Date.parse(task.created_at),
	}));
	return Response.json({
		jobs,
		extractions,
		pluginWorkers: [], // Standalone workers have no verifiable account owner yet.
		graphRevision: graph.data?.revision ?? 0,
	}, { headers: { "Cache-Control": "no-store" } });
}
