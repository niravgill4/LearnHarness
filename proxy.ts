import { NextResponse, type NextRequest } from "next/server";
import { apiRequestRefusal } from "./src/server/desktop-access.ts";
import { updateSession } from "./lib/supabase/middleware";

/** Protects API methods, including SSE and spending/settings routes. The one
 * streamed document route enforces the identical all-method request policy
 * inside its handler, avoiding Next's silently truncated Proxy body clone.
 * No public callback or worker bypass: legitimate self-HTTP still needs the capability. */
export async function proxy(request: NextRequest) {
	const isApi = request.nextUrl.pathname === "/api" || request.nextUrl.pathname.startsWith("/api/");
	const refusal = isApi ? apiRequestRefusal(request) : undefined;
	if (refusal) {
		return NextResponse.json(
			{ error: refusal },
			{ status: 403, headers: { "Cache-Control": "no-store" } },
		);
	}
	if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return updateSession(request);
	return NextResponse.next();
}

export const config = {
	// Keep /api itself covered; exempt only the exact streamed endpoint, not
	// the documents subtree or other plugin routes. Must remain static literals.
	matcher: ["/api", "/api/((?!plugins/[^/]+/documents/markdown/?$).*)", "/((?!api|_next|fonts|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)"],
};
