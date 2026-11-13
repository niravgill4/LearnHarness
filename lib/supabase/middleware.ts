import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	// Fallback to local mode when Supabase is not yet configured
	if (!url || !anonKey) {
		return supabaseResponse;
	}

	const supabase = createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				supabaseResponse = NextResponse.next({
					request,
				});
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options)
				);
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const isAuthRoute =
		request.nextUrl.pathname.startsWith("/login") ||
		request.nextUrl.pathname.startsWith("/auth");

	const isPublicStatic =
		request.nextUrl.pathname.startsWith("/_next") ||
		request.nextUrl.pathname.startsWith("/fonts") ||
		request.nextUrl.pathname.startsWith("/favicon.ico");

	// Enforce authentication on all protected routes
	if (!user && !isAuthRoute && !isPublicStatic) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/login";
		return NextResponse.redirect(redirectUrl);
	}

	// Redirect authenticated users away from /login back to app
	if (user && isAuthRoute && request.nextUrl.pathname === "/login") {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/";
		return NextResponse.redirect(redirectUrl);
	}

	return supabaseResponse;
}

