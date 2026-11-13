/** Public auth capabilities only. Never returns service-role credentials. */
export const dynamic = "force-dynamic";

export async function GET() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	const headers = { "Cache-Control": "no-store" };
	if (!url || !anonKey) return Response.json({ configured: false, providers: { google: false, github: false } }, { headers });
	try {
		const response = await fetch(new URL("/auth/v1/settings", url), { headers: { apikey: anonKey }, signal: AbortSignal.timeout(5000), cache: "no-store" });
		if (!response.ok) throw new Error("Auth settings unavailable");
		const settings = await response.json();
		return Response.json({ configured: true, url, publicKey: anonKey, providers: { google: settings.external?.google === true, github: settings.external?.github === true } }, { headers });
	} catch {
		// Email auth may still work during a capability-check outage.
		return Response.json({ configured: true, url, publicKey: anonKey, providers: { google: false, github: false }, unavailable: true }, { headers });
	}
}
