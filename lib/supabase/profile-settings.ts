import { sanitizeUserSettings, type UserSettings } from "@/src/core/settings";
import { profileModelSlots } from "@/lib/onboarding";

/** Preferences live beside existing setup metadata until a dedicated column is migrated. */
export function profileSettings(profile: { model_settings?: unknown; theme_settings?: unknown }): UserSettings {
 const metadata = profile.model_settings && typeof profile.model_settings === "object" && !Array.isArray(profile.model_settings)
  ? profile.model_settings as Record<string, unknown> : {};
 return sanitizeUserSettings({
  ...(metadata.preferences && typeof metadata.preferences === "object" ? metadata.preferences : {}),
  version: 1,
  models: profileModelSlots(metadata),
  ...(profile.theme_settings && typeof profile.theme_settings === "object" ? { appearance: profile.theme_settings } : {}),
 }) ?? { version: 1 };
}
