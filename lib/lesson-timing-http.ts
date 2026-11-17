import { budgetLesson, parseReadingPace, type LessonScope } from "../src/core/reading-pace.ts";
import type { UserSettings } from "../src/core/settings.ts";
import { readProfileKeys } from "./supabase/profile-keys";
import { profileModelSlots } from "./onboarding";
import type { createClient } from "./supabase/server";

interface TimingDependencies {
	getClient: typeof createClient;
	recommend(topic: string, intent: string | undefined, signal: AbortSignal): Promise<LessonScope>;
	runWithUser(
		context: { userId: string; keys: Record<string, string>; settings: UserSettings },
		task: () => Promise<Response>,
	): Promise<Response>;
}
const json = (body: unknown, status = 200) =>
	Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function lessonTimingHandler(deps: TimingDependencies) {
	return async (request: Request) => {
		const body = await request.json().catch(() => null);
		if (!body || typeof body.topic !== "string" || !body.topic.trim() || body.topic.length > 12000)
			return json({ error: "Enter a topic to estimate lesson time." }, 400);
		try {
			const client = await deps.getClient();
			let pace: ReturnType<typeof parseReadingPace> = null;
			let intent: string | undefined;
			const recommend = async () => {
				const scope = await deps.recommend(body.topic.trim(), intent, request.signal);
				const recommendation = budgetLesson(scope, pace);
				if (recommendation.lessonMinutes > 120) throw new Error("Scope too broad for a first session.");
				return json({ pace, recommendation });
			};
			if (!client) return await recommend();
			const {
				data: { user },
			} = await client.auth.getUser();
			if (!user) return json({ error: "Sign in to get your lesson-time recommendation." }, 401);
			const { data: profile, error } = await client
				.from("profiles")
				.select("model_settings,encrypted_keys")
				.eq("id", user.id)
				.single();
			if (error || !profile) return json({ error: "Your learning preferences could not be loaded." }, 503);
			pace = parseReadingPace(profile.model_settings?.readingPace);
			intent = profile.model_settings?.onboarding?.intent;
			return await deps.runWithUser(
				{
					userId: user.id,
					keys: readProfileKeys(profile.encrypted_keys),
					settings: { version: 1, models: profileModelSlots(profile.model_settings) },
				},
				recommend,
			);
		} catch {
			return json({ error: "Time recommendation unavailable. Choose a preset or enter your own time." }, 503);
		}
	};
}
