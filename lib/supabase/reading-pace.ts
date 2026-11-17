import { parseReadingPace, type ReadingPace } from "../../src/core/reading-pace.ts";
import type { createClient } from "./server";

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;
export async function readReadingPace(client: Client, userId: string) {
	const { data, error } = await client.from("profiles").select("model_settings").eq("id", userId).single();
	if (error || !data) throw new Error("Your reading preferences could not be loaded. Please try again.");
	return parseReadingPace(data.model_settings?.readingPace);
}
/** Compare-and-swap preserves other preferences when separate tabs save concurrently. */
export async function saveReadingPace(client: Client, userId: string, pace: ReadingPace | null) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const { data, error } = await client.from("profiles").select("model_settings").eq("id", userId).single();
		if (error || !data) throw new Error("Your reading preferences could not be loaded. Please try again.");
		const previous = data.model_settings;
		const settings =
			previous && typeof previous === "object" && !Array.isArray(previous) ? { ...previous } : {};
		if (pace) settings.readingPace = pace;
		else delete settings.readingPace;
		let query = client
			.from("profiles")
			.update({ model_settings: settings, updated_at: new Date().toISOString() })
			.eq("id", userId);
		query =
			previous === null
				? query.is("model_settings", null)
				: query.eq("model_settings", JSON.stringify(previous));
		const result = await query.select("id");
		if (result.error) throw new Error("Your reading pace could not be saved. Please try again.");
		if (result.data?.length) return;
	}
	throw new Error("Another preference is being saved. Please try again.");
}
