import { profileSettings } from "@/lib/supabase/profile-settings";
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
import { profileModelSlots } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export async function GET() {
 const supabase = await createClient();
 if (supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { data, error } = await supabase.from("profiles").select("model_settings, theme_settings").eq("id", user.id).single();
  if (error || !data) return Response.json({ error: "Your settings could not be loaded." }, { status: 503 });
  return Response.json({ settings: profileSettings(data) }, { headers: { "Cache-Control": "no-store" } });
 }
 const settings = settingsStore.readSettings();
 const fileAccessError = fileAccessConfigurationError();
 return Response.json({ settings, ...(fileAccessError ? { fileAccessError } : {}) });
}
