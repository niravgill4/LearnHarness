import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PATHS } from "@/config";
import { createClient } from "./supabase/server";
import { emptyNotebook, type NotebookSnapshot, type NotebookData } from "./notebook";

export class NotebookError extends Error {
	constructor(
		message: string,
		public status = 503,
	) {
		super(message);
	}
}
export async function notebookAccount() {
	const client = await createClient();
	if (!client) return { client: null, userId: "local" };
	const {
		data: { user },
		error,
	} = await client.auth.getUser();
	if (error || !user) throw new NotebookError("Sign in to open your notebooks.", 401);
	return { client, userId: user.id };
}
export const notebookDirectory = () => path.join(PATHS.data, "notebook");
function readLocal(): NotebookSnapshot {
	try {
		return JSON.parse(readFileSync(path.join(notebookDirectory(), "workspace.json"), "utf8"));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { version: 0, data: emptyNotebook(), storage: "local" };
		throw error;
	}
}
export async function readNotebook() {
	const { client, userId } = await notebookAccount();
	if (!client) return { ...readLocal(), account: userId };
	const { data, error } = await client
		.from("notebook_workspaces")
		.select("version,data")
		.eq("user_id", userId)
		.maybeSingle();
	if (error)
		throw new NotebookError(
			"Cloud notebooks are unavailable. The notebook database migration may need to be applied; your local recovery draft is kept.",
		);
	return {
		version: data?.version ?? 0,
		data: data?.data ?? emptyNotebook(),
		storage: "cloud" as const,
		account: userId,
	};
}
export async function saveNotebook(version: number, document: NotebookData) {
	const { client } = await notebookAccount();
	if (!client) {
		// Synchronous read/check/atomic rename is a single critical section in local mode.
		const current = readLocal();
		if (current.version !== version)
			throw new NotebookError(
				"This notebook changed in another window. Your draft is kept. Reload the cloud copy or export your draft.",
				409,
			);
		mkdirSync(notebookDirectory(), { recursive: true });
		const next = { version: version + 1, data: document, storage: "local" };
		const temp = path.join(notebookDirectory(), "workspace.tmp");
		writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
		renameSync(temp, path.join(notebookDirectory(), "workspace.json"));
		return next.version;
	}
	const { data, error } = await client.rpc("save_notebook", { expected: version, document });
	if (error)
		throw new NotebookError(
			error.message.includes("NOTEBOOK_CONFLICT")
				? "This notebook changed on another device. Your draft is kept. Reload the cloud copy or export your draft."
				: "Cloud save failed. Your recovery draft is kept; check the notebook database setup and retry.",
			error.message.includes("NOTEBOOK_CONFLICT") ? 409 : 503,
		);
	return data as number;
}
export function notebookFailure(error: unknown) {
	return Response.json(
		{
			error:
				error instanceof NotebookError
					? error.message
					: "Notebook storage is unavailable. Your draft has been kept.",
		},
		{ status: error instanceof NotebookError ? error.status : 500 },
	);
}
