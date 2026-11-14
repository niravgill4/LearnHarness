import { onboardingProviderModels } from "@/src/server";
import { createClient } from "@/lib/supabase/server";
import { mutateProfileKey, readProfileKeys } from "@/lib/supabase/profile-keys";
import { ONBOARDING_PROVIDERS, type LearningSetup } from "@/lib/onboarding";
import { AUTH_PROVIDER_KEYS, genericProviderKeyGuard } from "@/src/core";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
	const client = await createClient();
	if (!client) return json({ error: "Account setup is not available yet. Please try again later." }, 503);
	const { data: { user } } = await client.auth.getUser();
	if (!user) return json({ error: "Sign in to continue." }, 401);
	const { data: profile, error } = await client.from("profiles").select("encrypted_keys, model_settings").eq("id", user.id).single();
	if (error || !profile) return json({ error: "Your profile could not be loaded. Please try again." }, 503);
	try {
		const keys = readProfileKeys(profile.encrypted_keys);
		const connected = ONBOARDING_PROVIDERS.filter(p => keys[AUTH_PROVIDER_KEYS.find(k => k.id === p.id)!.envVar]).map(p => p.id);
		const models = ONBOARDING_PROVIDERS.flatMap(p => onboardingProviderModels(p.id).map(m => ({ ...m, provider: p.id })));
		return json({ email: user.email, setup: profile.model_settings?.onboarding ?? null, connected, models });
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
	if (body.action === "existing") {
		const { data: profile, error } = await client.from("profiles").select("model_settings").eq("id", user.id).single();
		if (error || !profile) return json({ error: "Your profile could not be loaded." }, 503);
		const setup = { version: 1, completedAt: new Date().toISOString(), connectionMode: "existing" };
		const { error: saveError } = await client.from("profiles").update({ model_settings: { ...profile.model_settings, onboarding: setup }, updated_at: new Date().toISOString() }).eq("id", user.id);
		return saveError ? json({ error: "Your preferences could not be saved." }, 503) : json({ saved: true, setup });
	}
	if (!provider) return json({ error: "Choose a supported provider." }, 400);
	const envVar = AUTH_PROVIDER_KEYS.find(k => k.id === provider.id)!.envVar;
	try {
		if (body.action === "connect") {
			if (typeof body.key !== "string" || body.key.length > 4096) return json({ error: "Enter a valid API key." }, 400);
			const verdict = genericProviderKeyGuard(envVar, body.key);
			if (!verdict.ok) return json({ error: verdict.error }, 400);
			await mutateProfileKey(client, user.id, envVar, body.key.trim());
			return json({ saved: true });
		}
		if (body.action !== "complete") return json({ error: "Unknown setup action." }, 400);
		const model = onboardingProviderModels(provider.id).find(m => m.id === body.modelId);
		if (!model) return json({ error: "Choose a model from your provider." }, 400);
		if (body.topic !== undefined && (typeof body.topic !== "string" || body.topic.length > 500)) return json({ error: "Keep your topic under 500 characters." }, 400);
		if (!["understand", "exam", "explore"].includes(body.intent)) return json({ error: "Choose a learning goal." }, 400);
		const { data: profile, error } = await client.from("profiles").select("encrypted_keys, model_settings").eq("id", user.id).single();
		if (error || !profile) return json({ error: "Your profile could not be loaded. Please try again." }, 503);
		if (!readProfileKeys(profile.encrypted_keys)[envVar]) return json({ error: "Save your provider key first." }, 400);
		const setup: LearningSetup = { version: 1, completedAt: new Date().toISOString(), provider: provider.id, modelId: model.id, topic: body.topic?.trim() ?? "", intent: body.intent };
		const slot = { model: { provider: provider.id, id: model.id } };
		const { error: saveError } = await client.from("profiles").update({ model_settings: { ...profile.model_settings, strong: slot, cheap: slot, ...(model.vision ? { vision: slot } : {}), onboarding: setup }, updated_at: new Date().toISOString() }).eq("id", user.id);
		if (saveError) return json({ error: "Your preferences could not be saved. Please try again." }, 503);
		return json({ saved: true, setup });
	} catch { return json({ error: "Your connection could not be saved. Please try again." }, 503); }
}
