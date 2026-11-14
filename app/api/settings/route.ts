/**
 * GET /api/settings — THE user settings record (settings-storage wave,
 * 2026-09-19): the whole delta record at data/settings.json (config.
 * SETTINGS_FILE, via the SettingsStore port). Non-secret by construction —
 * secrets live in auth.json / .env.local and never enter this record.
 *
 *   GET → 200 {settings} (the sanitized delta record — absent keys mean
 *         "factory default", never guessed server-side) or 200
 *         {settings: null} on first boot.
 *
 * Section writes go through PUT /api/settings/[section]; the chat defaults
 * also remain writable via the legacy /api/settings/defaults alias.
 * Resolution to concrete values is the client's/core's job
 * (core/settings-resolution.ts resolveSettings — browser-safe).
 */

import { settingsStore, fileAccessConfigurationError } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import type { ModelsSettings, AppearanceSettings } from "@/src/core";

export const dynamic = "force-dynamic";

export async function GET() {
	let settings = settingsStore.readSettings();
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from("profiles")
				.select("model_settings, theme_settings")
				.eq("id", user.id)
				.maybeSingle();

			if (profile) {
				const baseSettings = settings ?? { version: 1 };
				settings = {
					...baseSettings,
					version: baseSettings.version ?? 1,
					...(profile.model_settings && typeof profile.model_settings === "object"
						? { models: profile.model_settings as ModelsSettings }
						: {}),
					...(profile.theme_settings && typeof profile.theme_settings === "object"
						? { appearance: profile.theme_settings as AppearanceSettings }
						: {}),
				};
			}
		}
	}
	const fileAccessError = fileAccessConfigurationError();
	return Response.json({ settings, ...(fileAccessError ? { fileAccessError } : {}) });
}
