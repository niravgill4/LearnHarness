import { readNotebook, saveNotebook, notebookFailure } from "@/lib/notebook-server";
import { validateNotebook } from "@/lib/notebook";
export const dynamic = "force-dynamic";
export async function GET() {
	try {
		return Response.json(await readNotebook(), { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return notebookFailure(error);
	}
}
export async function PUT(request: Request) {
	try {
		const raw = await request.text();
		if (raw.length > 12000000)
			return Response.json(
				{ error: "Notebook is too large to save. Export a backup and split it into smaller notebooks." },
				{ status: 413 },
			);
		let body;
		try {
			body = JSON.parse(raw);
		} catch {
			return Response.json({ error: "Invalid notebook document." }, { status: 400 });
		}
		if (!Number.isSafeInteger(body.version) || body.version < 0 || !validateNotebook(body.data))
			return Response.json(
				{ error: "Invalid notebook document. Your draft has been kept." },
				{ status: 400 },
			);
		return Response.json({ version: await saveNotebook(body.version, body.data) });
	} catch (error) {
		return notebookFailure(error);
	}
}
