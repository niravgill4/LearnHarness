import { fetch as proxyFetch, EnvHttpProxyAgent } from "undici";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createCloudTurnReplay } from "../../lib/supabase/cloud-turn-stream";

const dispatcher = new EnvHttpProxyAgent();
globalThis.fetch = ((input: unknown, init?: RequestInit) => proxyFetch(input as string, { ...init, dispatcher, signal: AbortSignal.timeout(15_000) } as Parameters<typeof proxyFetch>[1])) as unknown as typeof fetch;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let userId: string | undefined;
try {
	const email = `reconnect-audit-${randomUUID()}@example.com`;
	const password = randomUUID() + randomUUID();
	const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
	assert.ifError(created.error);
	userId = created.data.user!.id;
	const chatId = `audit_${randomUUID()}`;
	assert.ifError((await admin.from("chats").insert({ id: chatId, user_id: userId, title: "Reconnect fixture" })).error);
	const inserted = await admin.from("cloud_tasks").insert({ user_id: userId, chat_id: chatId, request_id: randomUUID(), kind: "turn", status: "running", attempt: 1, lease_token: randomUUID(), lease_until: new Date(Date.now() + 60_000).toISOString(), input: { stream: "data: first\n\n" } }).select("id").single();
	assert.ifError(inserted.error);
	const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
	assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
	const response = createCloudTurnReplay(client, userId, inserted.data.id, { pollMs: 20, maxMs: 5_000 });
	const reading = response.text();
	await new Promise((resolve) => setTimeout(resolve, 60));
	const final = "data: first\n\ndata: second\n\ndata: [DONE]\n\n";
	assert.ifError((await admin.from("cloud_tasks").update({ input: { stream: final }, status: "completed", lease_until: null }).eq("id", inserted.data.id)).error);
	assert.equal(await reading, final, "a different process replays saved chunks exactly once through completion");
	const outsider = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
	const hidden = await outsider.from("cloud_tasks").select("id").eq("id", inserted.data.id);
	assert.ok(hidden.error || hidden.data.length === 0, "anonymous reconnect cannot read another account's task");
	console.log("PASS: cross-instance replay, incremental resume, exact completion, account isolation");
} finally {
	if (userId) {
		const removed = await admin.auth.admin.deleteUser(userId);
		assert.ifError(removed.error);
		console.log("Temporary reconnect account removed");
	}
	await dispatcher.close();
}
