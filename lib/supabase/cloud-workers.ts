import { createHash, randomUUID } from "node:crypto";
import type { JobRecord } from "@/src/core";
import { createAdminClient } from "./server";

export type CloudWorkerTask = {
	id: string;
	user_id: string;
	chat_id: string;
	kind: "turn" | "job" | "extraction";
	input: Record<string, unknown>;
	lease_token: string;
	attempt: number;
	max_attempts: number;
};

function stableUuid(value: string): string {
	const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
	hex[12] = "5";
	hex[16] = ((Number.parseInt(hex[16]!, 16) & 3) | 8).toString(16);
	return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function enqueue(userId: string, chatId: string, kind: "job" | "extraction", dedupe: string, input: object) {
	const client = createAdminClient();
	if (!client) throw new Error("Cloud workers are not configured");
	const { error } = await client.from("cloud_tasks").insert({
		user_id: userId,
		chat_id: chatId,
		request_id: stableUuid(`${kind}:${dedupe}`),
		kind,
		input,
		status: "queued",
		available_at: new Date().toISOString(),
	});
	if (error && error.code !== "23505") throw new Error(`Cloud ${kind} could not be queued`);
	await kickCloudWorker();
}

export async function kickCloudWorker(): Promise<void> {
	const secret = process.env.CRON_SECRET;
	const hostname = process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
	if (!secret || !hostname) return;
	const response = await fetch(`https://${hostname}/api/internal/cloud-worker`, {
		method: "POST",
		headers: { authorization: `Bearer ${secret}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error("Cloud worker could not be started");
}

export function enqueueCloudJob(userId: string, job: JobRecord, toolInput: unknown) {
	return enqueue(userId, job.chatId, "job", job.id, { job, toolInput });
}

export function enqueueCloudExtraction(userId: string, chatId: string, sourceVersion: string) {
	return enqueue(userId, chatId, "extraction", `${chatId}:${sourceVersion}`, { sourceVersion });
}

export async function claimCloudTask(): Promise<CloudWorkerTask | null> {
	const client = createAdminClient();
	if (!client) throw new Error("Cloud workers are not configured");
	const { data, error } = await client.rpc("claim_cloud_task");
	if (error) throw new Error("Cloud task claim failed");
	const task = data?.[0];
	if (!task) return null;
	return task as CloudWorkerTask;
}

export async function heartbeatCloudTask(task: CloudWorkerTask, input?: object): Promise<void> {
	const client = createAdminClient();
	if (!client) throw new Error("Cloud workers are not configured");
	const { data, error } = await client.from("cloud_tasks").update({
		lease_until: new Date(Date.now() + 5 * 60_000).toISOString(),
		updated_at: new Date().toISOString(),
		...(input ? { input } : {}),
	}).eq("id", task.id).eq("lease_token", task.lease_token).eq("status", "running").select("id");
	if (error || !data?.length) throw new Error("Cloud worker lease was lost");
}

export async function finishCloudTask(task: CloudWorkerTask, status: "completed" | "failed", input: object, errorCode?: string) {
	const client = createAdminClient();
	if (!client) throw new Error("Cloud workers are not configured");
	const { data, error } = await client.from("cloud_tasks").update({
		status,
		input,
		error_code: errorCode ?? null,
		lease_until: null,
		updated_at: new Date().toISOString(),
	}).eq("id", task.id).eq("lease_token", task.lease_token).eq("status", "running").select("id");
	if (error || !data?.length) throw new Error("Cloud task completion was not accepted");
}

/** Release a transiently failed lease with bounded exponential backoff. */
export async function retryCloudTask(task: CloudWorkerTask, input: object, errorCode: string): Promise<"queued" | "failed"> {
	const client = createAdminClient();
	if (!client) throw new Error("Cloud workers are not configured");
	const terminal = task.attempt >= task.max_attempts;
	const { data, error } = await client.from("cloud_tasks").update({
		status: terminal ? "failed" : "queued",
		input,
		error_code: errorCode,
		lease_token: null,
		lease_until: null,
		available_at: new Date(Date.now() + (terminal ? 0 : Math.min(60_000, 2 ** task.attempt * 2_000))).toISOString(),
		updated_at: new Date().toISOString(),
	}).eq("id", task.id).eq("lease_token", task.lease_token).eq("status", "running").select("id");
	if (error || !data?.length) throw new Error("Cloud task retry was not accepted");
	return terminal ? "failed" : "queued";
}

export function newWorkerRequestId() {
	return randomUUID();
}
