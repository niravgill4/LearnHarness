import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { updateSession } from "../lib/supabase/middleware";

test("cloud authentication exposes only the public sign-in capability read", async t => {
	const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.example";
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fixture";
	t.after(() => {
		if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
		if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
	});
	const publicRead = await updateSession(new NextRequest("http://localhost:3000/api/auth/providers"));
	assert.equal(publicRead.headers.get("x-middleware-next"), "1");
	for (const [path, method] of [["/api/auth/providers", "POST"], ["/api/auth/providers-extra", "GET"], ["/api/onboarding", "GET"], ["/api/onboarding", "POST"]]) {
		const response = await updateSession(new NextRequest(`http://localhost:3000${path}`, { method }));
		assert.equal(response.status, 401, `${method} ${path}`);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
	}
});
