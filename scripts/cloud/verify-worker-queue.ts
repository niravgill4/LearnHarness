import { fetch as proxyFetch, EnvHttpProxyAgent } from "undici";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { claimCloudTask, enqueueCloudExtraction, enqueueCloudJob, finishCloudTask, heartbeatCloudTask, retryCloudTask } from "../../lib/supabase/cloud-workers";

const dispatcher = new EnvHttpProxyAgent();
globalThis.fetch = ((input: unknown, init?: RequestInit) => proxyFetch(input as string, { ...init, dispatcher, signal: AbortSignal.timeout(15_000) } as Parameters<typeof proxyFetch>[1])) as unknown as typeof fetch;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let userId: string | undefined;
try {
	const created = await admin.auth.admin.createUser({ email: `worker-audit-${randomUUID()}@example.com`, password: randomUUID() + randomUUID(), email_confirm: true });
	assert.ifError(created.error);
	userId = created.data.user!.id;
	const chatId = `audit_${randomUUID()}`;
	assert.ifError((await admin.from("chats").insert({ id: chatId, user_id: userId, title: "Temporary worker fixture" })).error);
	const job = { id: `job_${randomUUID()}`, kind: "research" as const, chatId, toolCallId: "fixture", status: "running" as const, activity: "starting", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
	await Promise.all([enqueueCloudJob(userId, job, { question: "fixture" }), enqueueCloudJob(userId, job, { question: "fixture" })]);
	const queued = await admin.from("cloud_tasks").select("id").eq("user_id", userId).eq("kind", "job");
	assert.ifError(queued.error);
	assert.equal(queued.data.length, 1, "deterministic request IDs deduplicate job enqueue races");
	const claimed = await claimCloudTask();
	assert.ok(claimed);
	assert.equal(claimed.user_id, userId);
	await heartbeatCloudTask(claimed);
	await finishCloudTask(claimed, "completed", { ...claimed.input, job: { ...job, status: "done" } });
	await Promise.all([enqueueCloudExtraction(userId, chatId, "message-1"), enqueueCloudExtraction(userId, chatId, "message-1")]);
	const extraction = await admin.from("cloud_tasks").select("id").eq("user_id", userId).eq("kind", "extraction");
	assert.ifError(extraction.error);
	assert.equal(extraction.data.length, 1, "extraction enqueue is idempotent for one session version");
	const extractionTask = await claimCloudTask();
	assert.ok(extractionTask);
	assert.equal(await retryCloudTask(extractionTask, extractionTask.input, "synthetic_transient"), "queued");
	const retry = await admin.from("cloud_tasks").select("status,attempt,error_code,available_at").eq("id", extractionTask.id).single();
	assert.ifError(retry.error);
	assert.equal(retry.data.status, "queued");
	assert.equal(retry.data.attempt, 1);
	assert.equal(retry.data.error_code, "synthetic_transient");
	assert.ok(Date.parse(retry.data.available_at) > Date.now());
	console.log("PASS: durable enqueue, race deduplication, atomic claim, heartbeat, fenced completion, bounded retry");
} finally {
	if (userId) {
		const removed = await admin.auth.admin.deleteUser(userId);
		assert.ifError(removed.error);
		console.log("Temporary worker account removed");
	}
	await dispatcher.close();
}
