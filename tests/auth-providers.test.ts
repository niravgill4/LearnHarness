import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../app/api/auth/providers/route";

test("public auth options report configuration and never expose privileged credentials", async t => {
	const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	const originalFetch = globalThis.fetch;
	t.after(() => {
		if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
		if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
		globalThis.fetch = originalFetch;
	});
	await t.test("missing configuration offers no broken social redirects", async () => {
		delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		globalThis.fetch = async () => { throw new Error("Must not request an unconfigured project"); };
		const response = await GET();
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.deepEqual(await response.json(), { configured: false, providers: { google: false, github: false } });
	});
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.example";
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fixture";
	await t.test("only explicitly enabled providers are advertised", async () => {
		globalThis.fetch = async (input, init) => {
			assert.equal(String(input), "https://auth-fixture.example/auth/v1/settings");
			assert.equal(new Headers(init?.headers).get("apikey"), "sb_publishable_fixture");
			assert.equal(init?.cache, "no-store");
			return Response.json({ external: { google: true, github: false, email: true }, ignored: "server-only-field" });
		};
		assert.deepEqual(await (await GET()).json(), { configured: true, url: "https://auth-fixture.example", publicKey: "sb_publishable_fixture", providers: { google: true, github: false } });
	});
	await t.test("a provider settings outage leaves email configuration available", async () => {
		globalThis.fetch = async () => { throw new Error("Fixture network outage"); };
		const result = await (await GET()).json();
		assert.equal(result.configured, true);
		assert.equal(result.unavailable, true);
		assert.deepEqual(result.providers, { google: false, github: false });
	});
	await t.test("an upstream error is never presented as an enabled provider", async () => {
		globalThis.fetch = async () => Response.json({ message: "private upstream detail" }, { status: 503 });
		const result = await (await GET()).json();
		assert.equal(result.unavailable, true);
		assert(!JSON.stringify(result).includes("private upstream detail"));
	});
});
