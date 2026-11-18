import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { EnvHttpProxyAgent, fetch as proxyFetch } from "undici";

const dispatcher = new EnvHttpProxyAgent();
globalThis.fetch = ((input: unknown, init?: RequestInit) => proxyFetch(input as string, {
	...init,
	dispatcher,
	signal: AbortSignal.timeout(30_000),
} as Parameters<typeof proxyFetch>[1])) as unknown as typeof fetch;

const appUrl = process.env.PRODUCTION_APP_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(appUrl && supabaseUrl && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const browser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let userId: string | undefined;

try {
	const email = `model-settings-audit-${randomUUID()}@example.com`;
	const password = randomUUID() + randomUUID();
	const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
	assert.ifError(created.error);
	userId = created.data.user!.id;
	const modelSettings = {
		strong: { model: { provider: "google", id: "gemini-2.5-pro" } },
		cheap: { model: { provider: "google", id: "gemini-2.5-flash" } },
		vision: { model: { provider: "google", id: "gemini-2.5-flash" } },
		onboarding: { version: 1, completedAt: new Date().toISOString(), provider: "google", intent: "understand" },
	};
	const updated = await admin.from("profiles").update({ model_settings: modelSettings }).eq("id", userId).select("id");
	assert.ifError(updated.error);
	assert.equal(updated.data.length, 1);
	const signedIn = await browser.auth.signInWithPassword({ email, password });
	assert.ifError(signedIn.error);
	assert.ok(signedIn.data.session);
	const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
	const encoded = `base64-${Buffer.from(JSON.stringify(signedIn.data.session)).toString("base64url")}`;
	const cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(encoded)}`;
	const response = await fetch(`${appUrl}/api/models`, { headers: { cookie } });
	assert.equal(response.status, 200);
	const catalog = await response.json() as { slots: Record<string, { model?: { provider: string; id: string } } | null> };
	assert.deepEqual(catalog.slots.strong?.model, modelSettings.strong.model);
	assert.deepEqual(catalog.slots.cheap?.model, modelSettings.cheap.model);
	assert.deepEqual(catalog.slots.vision?.model, modelSettings.vision.model);
	console.log("PASS: production reads all onboarding model slots from the signed-in cloud profile");
} finally {
	if (userId) {
		const removed = await admin.auth.admin.deleteUser(userId);
		assert.ifError(removed.error);
		console.log("Temporary model-settings account removed");
	}
	await dispatcher.close();
}
