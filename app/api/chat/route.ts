import { loadAccountGraph } from "@/lib/supabase/account-graph";
import { reserveCloudTurn, persistCloudTurn } from "@/lib/supabase/cloud-turns";
import { profileSettings } from "@/lib/supabase/profile-settings";
import { handleChatRequest, userAuthStorage } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { readProfileKeys } from "@/lib/supabase/profile-keys";
import { restoreChatFromCloud } from "@/lib/supabase/sync";
import { getChat, restoreChatRecord } from "@/src/server";
import { after } from "next/server";
import { runningTurn } from "@/src/server";
import { syncChatToCloud } from "@/lib/supabase/sync";

export const maxDuration = 300;

export async function POST(req: Request) {
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return Response.json({ error: "Sign in to continue." }, { status: 401 });
		}
		// A function instance may have no local cache, or a cache belonging to
		// another request. Authorize and hydrate from the account's cloud record.
		const body = await req.json().catch(() => null);
		if (!body || typeof body.chatId !== "string") return Response.json({ error: "Invalid session request." }, { status: 400 });
		const record = await restoreChatFromCloud(body.chatId, user.id, supabase);
		if (!record) return Response.json({ error: "Session not found." }, { status: 404 });

		const hydratedRequest = new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(body) });
		const { data: profile } = await supabase
			.from("profiles")
			.select("encrypted_keys, model_settings, theme_settings")
			.eq("id", user.id)
			.single();
		const graph = await loadAccountGraph(user.id);
		const keys = profile?.encrypted_keys ? readProfileKeys(profile.encrypted_keys) : {};
		return userAuthStorage.run({ userId: user.id, keys, graphStore: graph.store, settings: profile ? profileSettings(profile) : { version: 1 } }, async () => {
			const task = await reserveCloudTurn(user.id, record.id, body);
			if (!task.ok) return Response.json({ error: task.conflict ? "A turn is already running for this session." : "Cloud execution could not be started." }, { status: task.conflict ? 409 : 503 });
			restoreChatRecord(record, true);
			let response: Response;
			try { response = await handleChatRequest(hydratedRequest); }
			catch (error) { await persistCloudTurn(task.id, task.token, body, "", "failed"); throw error; }
			const handle = runningTurn(record.id);
			if (handle) {
				// Keep the function alive after the acknowledgement while the
				// existing agent settles; persist the final record before release.
				const reader = handle.subscribe().getReader();
				after(async () => {
					let stream = "";
					const decoder = new TextDecoder();
					let lastPersisted = 0;
					let heartbeatFailure: unknown;
					const heartbeat = setInterval(() => {
						void persistCloudTurn(task.id, task.token, body, stream, "running").catch((error) => { heartbeatFailure = error; });
					}, 60_000);
					try {
						while (true) {
							const chunk = await reader.read();
							if (chunk.done) break;
							stream += decoder.decode(chunk.value, { stream: true });
							if (stream.length > 8 * 1024 * 1024) throw new Error("Cloud response exceeded replay capacity");
							if (Date.now() - lastPersisted >= 250) {
								await persistCloudTurn(task.id, task.token, body, stream, "running");
								lastPersisted = Date.now();
							}
						}
						stream += decoder.decode();
						if (heartbeatFailure) throw heartbeatFailure;
						const final = getChat(record.id);
						if (final) await syncChatToCloud(final, user.id);
						await graph.flush();
						await persistCloudTurn(task.id, task.token, body, stream, "completed");
					} catch (error) {
						handle.abort();
						await persistCloudTurn(task.id, task.token, body, stream, "failed");
						throw error;
					}
					finally {
						clearInterval(heartbeat);
						reader.releaseLock();
					}
				});
			} else {
				await graph.flush();
				await persistCloudTurn(task.id, task.token, body, "", response.ok ? "completed" : "failed");
			}
			return response;
		});
	}
	return handleChatRequest(req);
}
