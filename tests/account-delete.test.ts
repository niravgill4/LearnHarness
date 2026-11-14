import { test } from "node:test";
import assert from "node:assert/strict";
import { DELETE } from "@/app/api/account/route";

test("DELETE /api/account returns 401 or 503 when unauthenticated in test environment", async () => {
	const res = await DELETE();
	// Without live Supabase environment variables or session cookies,
	// should cleanly reject with 401/503 rather than throwing an unhandled exception
	assert.ok(res.status === 401 || res.status === 503);
	const data = (await res.json()) as { error?: string };
	assert.ok(data.error);
});
