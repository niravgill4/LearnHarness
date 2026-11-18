import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { EnvHttpProxyAgent, fetch as proxyFetch } from "undici";

const dispatcher = new EnvHttpProxyAgent();
globalThis.fetch = ((input: unknown, init?: RequestInit) => proxyFetch(input as string, {
	...init,
	dispatcher,
	signal: AbortSignal.timeout(30_000),
} as Parameters<typeof proxyFetch>[1])) as unknown as typeof fetch;

const workerUrl = process.env.CLOUD_WORKER_URL;
const workerSecret = process.env.CLOUD_WORKER_SECRET;
assert.ok(workerUrl && workerSecret, "CLOUD_WORKER_URL and CLOUD_WORKER_SECRET are required");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
	auth: { persistSession: false },
});
let userId: string | undefined;

try {
	const created = await admin.auth.admin.createUser({
		email: `production-worker-audit-${randomUUID()}@example.com`,
		password: randomUUID() + randomUUID(),
		email_confirm: true,
	});
	assert.ifError(created.error);
	userId = created.data.user!.id;
	const chatId = `production_worker_${randomUUID()}`;
	const now = new Date().toISOString();
	const record = { id: chatId, title: "Production worker audit", kind: "teach", createdAt: now, updatedAt: now, messages: [], turns: [] };
	assert.ifError((await admin.from("chats").insert({ id: chatId, user_id: userId, title: record.title, kind: "teach", record })).error);
	assert.ifError((await admin.from("account_graph_state").insert({
		user_id: userId,
		state: { nodes: [], chains: [], coverage: [], checkpoints: [], sources: [], positions: {} },
	})).error);
	const taskId = randomUUID();
	assert.ifError((await admin.from("cloud_tasks").insert({
		id: taskId,
		user_id: userId,
		chat_id: chatId,
		request_id: randomUUID(),
		kind: "job",
		input: {},
		status: "queued",
	})).error);

	const response = await fetch(workerUrl, { method: "GET", headers: { authorization: `Bearer ${workerSecret}` } });
	assert.equal(response.status, 200);
	const result = await response.json() as { failed?: number };
	assert.ok((result.failed ?? 0) >= 1, "production worker did not execute the fixture");
	const task = await admin.from("cloud_tasks").select("status,attempt,error_code").eq("id", taskId).single();
	assert.ifError(task.error);
	assert.equal(task.data.status, "queued", "transient worker failure was not requeued");
	assert.equal(task.data.attempt, 1);
	assert.match(task.data.error_code, /payload is invalid/i);
	console.log("PASS: authorized production worker claim, execution, lease fencing and retry");
} finally {
	if (userId) {
		const removed = await admin.auth.admin.deleteUser(userId);
		assert.ifError(removed.error);
		console.log("Temporary production worker account removed");
	}
	await dispatcher.close();
}
