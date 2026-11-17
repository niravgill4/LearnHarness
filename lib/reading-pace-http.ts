import { measureReadingPace } from "../src/core/reading-pace.ts";
import { readReadingPace, saveReadingPace } from "./supabase/reading-pace";
import type { createClient } from "./supabase/server";

const json = (body: unknown, status = 200) =>
	Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function readingPaceHandlers(getClient: typeof createClient) {
	return {
		async GET() {
			try {
				const client = await getClient();
				if (!client) return json({ pace: null, accountAvailable: false });
				const {
					data: { user },
				} = await client.auth.getUser();
				if (!user) return json({ error: "Sign in to view your reading pace." }, 401);
				return json({ pace: await readReadingPace(client, user.id), accountAvailable: true });
			} catch {
				return json({ error: "Your reading pace could not be loaded. Please try again." }, 503);
			}
		},
		async POST(request: Request) {
			try {
				const client = await getClient();
				if (!client) return json({ error: "Sign in to save your reading pace." }, 503);
				const {
					data: { user },
				} = await client.auth.getUser();
				if (!user) return json({ error: "Sign in to save your reading pace." }, 401);
				const body = await request.json().catch(() => null);
				const pace = measureReadingPace(body?.passageId, body?.elapsedMs);
				if (!pace)
					return json(
						{ error: "That reading was too short or interrupted. Try again at your normal pace." },
						400,
					);
				await saveReadingPace(client, user.id, pace);
				return json({ pace });
			} catch {
				return json({ error: "Your reading pace could not be saved. Please try again." }, 503);
			}
		},
	};
}
