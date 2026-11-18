import { createClient } from "@/lib/supabase/server";
import { createCloudTurnReplay } from "@/lib/supabase/cloud-turn-stream";
/**
 * THE REATTACH STREAM (background-turn runner wave, owner ruling
 * 2026-09-25) — and, since CONNECTION DIET B (owner, 2026-10-10), THE
 * turn wire, period: POST /api/chat acknowledges and closes, so the
 * submitter too attaches here. One SSE stream per chat: a running turn →
 * subscribe to the live turn object: FULL replay of the event log, then
 * live chunks until settle ([DONE]). No running turn → the cheap terminal
 * ({"type":"turn-settled"} + [DONE]): the client refetches the record.
 * A retained settlement-failure notice precedes that terminal when a
 * reply could not be saved before the submitter attached.
 *
 * 404 mirrors the POST handler's unknown-chat. Framework route is a thin
 * wrapper over the server barrel (the import law); tests drive the seams
 * (turn-runs + ui-stream) directly.
 */
import { getChat, runningTurn, piTurnResponse, settledTurnResponse } from "@/src/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const { id } = await ctx.params;
	const client = await createClient();
	if (client) {
		const { data: { user } } = await client.auth.getUser();
		if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
		const { data: owned, error } = await client.from("chats").select("id").eq("id",id).eq("user_id",user.id).maybeSingle();
		if (error) return Response.json({ error: "Could not verify session access." }, { status: 503 });
		if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
		const { data: task, error: taskError } = await client.from("cloud_tasks").select("id,status").eq("chat_id",id).eq("user_id",user.id).eq("kind","turn").order("created_at",{ ascending:false }).limit(1).maybeSingle();
		if (taskError) return Response.json({ error: "Could not reconnect to your session." }, { status: 503 });
		if (!task || (task.status !== "running" && task.status !== "queued")) return settledTurnResponse(id);
		return createCloudTurnReplay(client, user.id, task.id);
	}
	if (!getChat(id)) return Response.json({ error: "Unknown chat" }, { status: 404 });
	const handle = runningTurn(id);
	if (!handle) return settledTurnResponse(id);
	return piTurnResponse(handle);
}
