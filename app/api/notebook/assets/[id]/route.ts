import { readFileSync } from "node:fs";
import path from "node:path";
import { notebookAccount, notebookDirectory, notebookFailure, NotebookError } from "@/lib/notebook-server";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { client, userId } = await notebookAccount();
		const { id } = await params;
		if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotebookError("Image not found.", 404);
		let bytes: Uint8Array;
		if (client) {
			const { data, error } = await client.storage.from("notebook-assets").download(`${userId}/${id}`);
			if (error || !data) throw new NotebookError("Image not found.", 404);
			bytes = new Uint8Array(await data.arrayBuffer());
		} else {
			try {
				bytes = readFileSync(path.join(notebookDirectory(), "assets", id));
			} catch {
				throw new NotebookError("Image not found.", 404);
			}
		}
		const mime = bytes[0] === 137 ? "image/png" : bytes[0] === 255 ? "image/jpeg" : "image/webp";
		return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
			headers: {
				"Content-Type": mime,
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		return notebookFailure(error);
	}
}
