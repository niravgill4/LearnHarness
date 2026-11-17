import { createPluginDocumentConverter } from "@/src/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const converter = createPluginDocumentConverter();

export async function POST(request: Request) {
	try {
		const controller = new AbortController();
		const result = await converter.convert(request, controller.signal);
		return Response.json(result);
	} catch (err: any) {
		return Response.json(
			{ error: err.message || "Failed to convert document" },
			{ status: err.statusCode || 400 }
		);
	}
}
