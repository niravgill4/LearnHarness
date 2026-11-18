import { createClient } from "@/lib/supabase/server";
import { isTurnRunning, listJobs } from "@/src/server";

export const dynamic = "force-dynamic";

/**
 * Job status endpoint (contracts.ts "THE ASYNC PROTOCOL" §4): the chat
 * view's jobs fetch lands here — once on mount, per jobs-changed
 * announcement (the store emits post-write, debounced client-side), and
 * on channel resync (push-architecture S4, 2026-10-02 — the old interval
 * poll is retired). It drives the dispatch cards, the sub-agents panel,
 * and the re-sync when a job settles. `turnInFlight` rides along for the
 * settle logic's idle check.
 */
export async function GET(req: Request) {
	const chatId = new URL(req.url).searchParams.get("chatId");
	if (!chatId) {
		return Response.json({ error: "chatId query parameter is required" }, { status: 400 });
	}
	if (!/^[A-Za-z0-9_-]+$/.test(chatId)) {
		return Response.json({ error: "Invalid chatId" }, { status: 400 });
	}
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
		const { data, error } = await supabase.from("chats").select("id").eq("id", chatId).eq("user_id", user.id).maybeSingle();
		if (error) return Response.json({ error: "Could not verify session access." }, { status: 503 });
		if (!data) return Response.json({ error: "Not found" }, { status: 404 });
		const tasks = await supabase.from("cloud_tasks").select("input,status,updated_at").eq("chat_id", chatId).eq("user_id", user.id).eq("kind", "job").order("created_at", { ascending: false });
		if (tasks.error) return Response.json({ error: "Could not load background work." }, { status: 503 });
		const jobs = (tasks.data ?? []).flatMap((task) => {
			const job = task.input?.job;
			if (!job || typeof job !== "object") return [];
			return [{ ...job, status: task.status === "failed" ? "error" : task.status === "completed" ? job.status : "running", updatedAt: task.updated_at }];
		});
		return Response.json({ jobs, turnInFlight: false }, { headers: { "Cache-Control": "no-store" } });
	}
	return Response.json({ jobs: listJobs(chatId), turnInFlight: isTurnRunning(chatId) });
}
