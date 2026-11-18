import { modelCatalog, refreshConnectionCatalog, userAuthStorage } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { readProfileKeys } from "@/lib/supabase/profile-keys";
import { profileSettings } from "@/lib/supabase/profile-settings";

/**
 * The model picker's data (model-control wave): pi-ai's configured-provider
 * catalog as client-safe DTOs — id/name/cost/context/modality plus each
 * model's SUPPORTED thinking levels (per its thinkingLevelMap). Static
 * catalog: no network, stable within a pi-ai version.
 */
export async function GET() {
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			let userKeys: Record<string, string> = {};
			const { data: profile } = await supabase
				.from("profiles")
				.select("encrypted_keys, model_settings, theme_settings")
				.eq("id", user.id)
				.single();
			if (profile?.encrypted_keys) {
				userKeys = readProfileKeys(profile.encrypted_keys);
			}
			return userAuthStorage.run({
				userId: user.id,
				keys: userKeys,
				settings: profile ? profileSettings(profile) : { version: 1 },
			}, async () => {
				await refreshConnectionCatalog();
				return Response.json(modelCatalog(), { headers: { "Cache-Control": "no-store" } });
			});
		}
	}
	await refreshConnectionCatalog();
	return Response.json(modelCatalog(), { headers: { "Cache-Control": "no-store" } });
}
