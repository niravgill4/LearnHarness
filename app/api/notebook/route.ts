import { readNotebook, saveNotebook, saveNotebookPages, notebookFailure } from "@/lib/notebook-server";
import { NOTEBOOK_PATCH_LIMIT, NOTEBOOK_PATCH_PAGES, validateNotebook, validateNotePage } from "@/lib/notebook";
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

export async function PATCH(request: Request) {
	try {
		if (Number(request.headers.get("content-length")) > NOTEBOOK_PATCH_LIMIT)
			return Response.json({ error: "These pages are too large to save together. Your recovery draft is kept." }, { status: 413 });
		const bytes = await request.arrayBuffer();
		if (bytes.byteLength > NOTEBOOK_PATCH_LIMIT)
			return Response.json({ error: "These pages are too large to save together. Your recovery draft is kept." }, { status: 413 });
		let body;
		try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch {}
		const pages = body?.pages;
		if (!Number.isSafeInteger(body?.version) || body.version < 0 || !Array.isArray(pages) ||
			pages.length < 1 || pages.length > NOTEBOOK_PATCH_PAGES || !pages.every(validateNotePage) ||
			new Set(pages.map(page => page.id)).size !== pages.length)
			return Response.json({ error: "Invalid notebook pages. Your recovery draft is kept." }, { status: 400 });
		return Response.json({ version: await saveNotebookPages(body.version, pages) });
	} catch (error) {
		return notebookFailure(error);
	}
}
