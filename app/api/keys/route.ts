/**
 * GET /api/keys — the auth page's key list (auth-keys wave, 2026-09-19;
 * providers added by the provider-keys interlude same wave).
 *
 * Every curated key (present or not) plus unknown file vars surfaced as
 * generic rows — ABSENT provider keys deliberately do NOT spam status
 * rows; the provider dropdown is the discovery surface. `providers`
 * carries it: {id, envVar, label} for every pi-ai plain-key provider,
 * derived from pi-ai's own provider→env-var table (no-drift pin in
 * tests/auth-provider-keys.test.ts) — the settings UI reads it optionally
 * with a graceful fallback.
 *
 * Masked only — last 4 + length for ordinary keys; custom keys are fully
 * redacted at every length (no credential suffix). PLAINTEXT NEVER LEAVES THE STORE THROUGH
 * THIS API (owner decision). `source` tells the page whether the live
 * value comes from the environment (dev .env.local / launch env) or the
 * file, and `shadowedByEnv` explains why a saved key is not the live one
 * (env always wins).
 */
import { keyStatuses, providerKeyList } from "@/src/server";
import { resolveKeyStatuses } from "@/src/server/keys";
import { authStore } from "@/src/store/auth";
import { authEnvRecord as boot } from "@/src/core/auth-env";
import { AUTH_PROVIDER_ENV_VARS, CUSTOM_PROVIDER } from "@/src/core/auth-keys";
import { createClient } from "@/lib/supabase/server";
import { decryptData } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
	let keys = keyStatuses();
	const supabase = await createClient();
	if (supabase) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from("profiles")
				.select("encrypted_keys")
				.eq("id", user.id)
				.maybeSingle();
			if (profile?.encrypted_keys) {
				try {
					const userKeys = JSON.parse(decryptData(profile.encrypted_keys)) as Record<string, string>;
					const mergedFileVars = { ...authStore.authVars(), ...userKeys };
					keys = resolveKeyStatuses(
						mergedFileVars,
						{ ...process.env, ...userKeys },
						boot().realEnv,
						new Set([...AUTH_PROVIDER_ENV_VARS, CUSTOM_PROVIDER.envVar]),
					);
				} catch {}
			}
		}
	}
	return Response.json({ keys, providers: providerKeyList() });
}
