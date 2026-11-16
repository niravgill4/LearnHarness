import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { notebookAccount, notebookDirectory, notebookFailure, NotebookError } from "@/lib/notebook-server";
export async function POST(request: Request) {
	try {
		const { client, userId } = await notebookAccount();
		const file = (await request.formData()).get("file");
		if (!(file instanceof File) || file.size > 5242880)
			throw new NotebookError("Choose an image smaller than 5 MB.", 400);
		const bytes = Buffer.from(await file.arrayBuffer());
		const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
			? "image/png"
			: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
				? "image/jpeg"
				: bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
					? "image/webp"
					: "";
		if (!mime) throw new NotebookError("Choose a PNG, JPEG, or WebP image.", 400);
		const id = randomUUID();
		if (client) {
			const { error } = await client.storage
				.from("notebook-assets")
				.upload(`${userId}/${id}`, bytes, { contentType: mime });
			if (error)
				throw new NotebookError("Image could not be saved. Check the notebook storage setup and retry.");
		} else {
			const dir = path.join(notebookDirectory(), "assets");
			mkdirSync(dir, { recursive: true });
			writeFileSync(path.join(dir, id), bytes, { mode: 0o600 });
		}
		return Response.json({ src: `/api/notebook/assets/${id}` });
	} catch (error) {
		return notebookFailure(error);
	}
}
