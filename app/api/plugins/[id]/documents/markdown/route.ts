import { createPluginDocumentRoute, pluginTransport } from "@/src/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route skips Proxy body cloning, so enforce cloud authentication here.
const handlers = createPluginDocumentRoute(pluginTransport);
async function authorized(request: Request, context: { params: Promise<{ id: string }> }) {
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
	}
	const method = request.method.toUpperCase();
	if (method === "POST") return handlers.POST(request, context);
	if (method === "OPTIONS") return handlers.OPTIONS(request);
	return handlers.GET(request);
}
export const POST = authorized;
export const OPTIONS = authorized;
export const GET = authorized;
export const HEAD = authorized;
export const PUT = authorized;
export const PATCH = authorized;
export const DELETE = authorized;
