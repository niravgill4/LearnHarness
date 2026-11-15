import { modelCatalog, onboardingAccountAvailable, onboardingProviderModels, readSettingsRecord, writeSettingsRecord, refreshConnectionCatalog } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { mutateProfileKey, readProfileKeys } from "@/lib/supabase/profile-keys";
import { ONBOARDING_PROVIDERS, profileModelSlots, validateOnboardingSlots, type LearningSetup, type OnboardingProvider } from "@/lib/onboarding";
import { AUTH_PROVIDER_KEYS, genericProviderKeyGuard, slotsConfigured } from "@/src/core";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
	await refreshConnectionCatalog("chatgpt").catch(() => {});
	const client = await createClient();
	if (!client) return json({ error: "Account setup is not available yet. Please try again later." }, 503);
	const { data: { user } } = await client.auth.getUser();
	if (!user) return json({ error: "Sign in to continue." }, 401);
	const { data: profile, error } = await client.from("profiles").select("encrypted_keys, model_settings").eq("id", user.id).single();
	if (error || !profile) return json({ error: "Your profile could not be loaded. Please try again." }, 503);
	try {
		const keys = readProfileKeys(profile.encrypted_keys);
		const isChatgptConnectedForUser = () => {
			if (!keys["__chatgpt_credentials"]) return false;
			try {
				const parsed = JSON.parse(keys["__chatgpt_credentials"]);
				return parsed.registrations?.some((r: any) => r.id === parsed.activeId && r.tokens && !r.reconnectRequired) ?? false;
			} catch {
				return false;
			}
		};

		const connected = ONBOARDING_PROVIDERS.filter(p => {
			if (p.id === "chatgpt") return isChatgptConnectedForUser();
			if (p.keyless) return false;
			const authKey = AUTH_PROVIDER_KEYS.find(k => k.id === p.id);
			return authKey ? !!keys[authKey.envVar] : false;
		}).map(p => p.id);

		let liveCatalogModels: { id: string; name: string; provider: string; input: readonly string[] }[] = [];
		try {
			liveCatalogModels = modelCatalog().models;
		} catch {
			liveCatalogModels = [];
		}

		const models = ONBOARDING_PROVIDERS.flatMap(p => {
			const catalogForProvider = liveCatalogModels.filter(m => m.provider === p.id);
			if (catalogForProvider.length > 0) {
				return catalogForProvider.map(m => ({ id: m.id, name: m.name, provider: p.id, vision: m.input.includes("image") }));
			}
			return onboardingProviderModels(p.id).map(m => ({ ...m, provider: p.id }));
		});

		return json({ email: user.email, setup: profile.model_settings?.onboarding ?? null, configured: slotsConfigured(profileModelSlots(profile.model_settings)), connected, models });
	} catch { return json({ error: "Your saved connection could not be loaded. Please try again." }, 503); }
}

export async function POST(request: Request) {
	const client = await createClient();
	if (!client) return json({ error: "Account setup is not available yet. Please try again later." }, 503);
	const { data: { user } } = await client.auth.getUser();
	if (!user) return json({ error: "Sign in to continue." }, 401);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid setup request." }, 400);
	const provider = ONBOARDING_PROVIDERS.find(p => p.id === body.provider);
	if (!provider) return json({ error: "Choose a supported provider." }, 400);

	const isKeyless = !!provider.keyless;

	try {
		const { data: profile, error: profileErr } = await client.from("profiles").select("encrypted_keys").eq("id", user.id).single();
		const currentKeys = profile?.encrypted_keys ? readProfileKeys(profile.encrypted_keys) : {};
		const isChatgptConnectedForUser = () => {
			if (!currentKeys["__chatgpt_credentials"]) return false;
			try {
				const parsed = JSON.parse(currentKeys["__chatgpt_credentials"]);
				return parsed.registrations?.some((r: any) => r.id === parsed.activeId && r.tokens && !r.reconnectRequired) ?? false;
			} catch {
				return false;
			}
		};

		if (body.action === "connect") {
			if (isKeyless) {
				const available = provider.id === "chatgpt" ? isChatgptConnectedForUser() : onboardingAccountAvailable(provider.id);
				return available ? json({ saved: true }) : json({ error: "Finish this connection before choosing models." }, 409);
			}

			const envVar = AUTH_PROVIDER_KEYS.find(k => k.id === provider.id)?.envVar;
			if (!envVar) return json({ error: "Invalid provider key configuration." }, 400);
			if (typeof body.key !== "string" || body.key.length > 4096) return json({ error: "Enter a valid API key." }, 400);
			const verdict = genericProviderKeyGuard(envVar, body.key);
			if (!verdict.ok) return json({ error: verdict.error }, 400);
			await mutateProfileKey(client, user.id, envVar, body.key.trim());
			return json({ saved: true });
		}

		if (body.action !== "complete") return json({ error: "Unknown setup action." }, 400);

		let liveCatalogModels: { id: string; name: string; provider: string; input: readonly string[] }[] = [];
		try {
			liveCatalogModels = modelCatalog().models;
		} catch {
			liveCatalogModels = [];
		}

		const liveForProvider = liveCatalogModels.filter(m => m.provider === provider.id);
		const availableModels = liveForProvider.length
			? liveForProvider.map(m => ({ id: m.id, name: m.name, vision: m.input.includes("image") }))
			: onboardingProviderModels(provider.id);
		const choices = validateOnboardingSlots(body.slots, availableModels);
		if (!choices) return json({ error: "Choose valid strong, cheap, and image-capable vision models." }, 400);
		if (body.topic !== undefined && (typeof body.topic !== "string" || body.topic.length > 500)) return json({ error: "Keep your topic under 500 characters." }, 400);
		if (!["understand", "exam", "explore"].includes(body.intent)) return json({ error: "Choose a learning goal." }, 400);

		const { data: fullProfile, error } = await client.from("profiles").select("encrypted_keys, model_settings").eq("id", user.id).single();
		if (error || !fullProfile) return json({ error: "Your profile could not be loaded. Please try again." }, 503);

		if (isKeyless) {
			const available = provider.id === "chatgpt" ? isChatgptConnectedForUser() : onboardingAccountAvailable(provider.id);
			if (!available) return json({ error: "Finish connecting this account first." }, 409);
		} else {
			const envVar = AUTH_PROVIDER_KEYS.find(k => k.id === provider.id)?.envVar;
			if (!envVar || !readProfileKeys(fullProfile.encrypted_keys)[envVar]) return json({ error: "Save your provider key first." }, 400);
		}

		const setup: LearningSetup = {
			version: 1,
			completedAt: new Date().toISOString(),
			provider: provider.id as OnboardingProvider,
			modelId: choices.strong.id,
			slots: { strong: choices.strong.id, cheap: choices.cheap.id, vision: choices.vision.id },
			topic: body.topic?.trim() ?? "",
			intent: body.intent,
		};
		const slots = Object.fromEntries((["strong", "cheap", "vision"] as const).map(name => [name, { model: { provider: provider.id, id: choices[name].id } }])) as Record<"strong" | "cheap" | "vision", { model: { provider: string; id: string } }>;
		const isClaude = provider.id === "claude-code";
		const nextModelSettings = {
			...profile.model_settings,
			...slots,
			onboarding: setup,
		};

		const { error: saveError } = await client.from("profiles").update({
			model_settings: nextModelSettings,
			updated_at: new Date().toISOString(),
		}).eq("id", user.id);
		if (saveError) return json({ error: "Your preferences could not be saved." }, 503);

		// Mirror to local disk settings so runtime inference and initialConfigured check pass immediately
		const localRecord = readSettingsRecord() ?? { version: 1 };
		writeSettingsRecord({
			...localRecord,
			...(isClaude ? { claudeCode: { enabled: true } } : {}),
			models: {
				...localRecord.models,
				...slots,
			},
		});

		return json({ saved: true, setup });
	} catch {
		return json({ error: "Could not complete setup. Please try again." }, 500);
	}
}
