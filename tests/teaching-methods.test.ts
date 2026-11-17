import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createFauxCore } from "@earendil-works/pi-ai";
import {
	parseTeachingSetup,
	teachingSetupInstructions,
	TEACHING_METHODS,
} from "../src/core/teaching-methods.ts";
const folder = mkdtempSync(`${tmpdir()}/teaching-methods-`);
process.env.LH_DATA_DIR = folder;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
after(() => rmSync(folder, { recursive: true, force: true }));
const setup = {
	methods: ["feynman", "co-pilot", "socratic"] as const,
	probingTime: "3 minutes",
	learningTime: "25 minutes",
};
test("catalog has eight unique methods and rejects invalid setup before use", () => {
	assert.equal(TEACHING_METHODS.length, 8);
	assert.equal(new Set(TEACHING_METHODS.map((m) => m.id)).size, 8);
	assert.deepEqual(parseTeachingSetup({ ...setup, methods: ["feynman", "feynman"] }), {
		...setup,
		methods: ["feynman"],
	});
	for (const value of [
		null,
		[],
		{},
		{ ...setup, methods: ["unknown"] },
		{ ...setup, methods: "feynman" },
		{ ...setup, learningTime: "x".repeat(201) },
	])
		assert.equal(parseTeachingSetup(value), null);
	assert.ok(parseTeachingSetup({ ...setup, methods: [] }));
});
test("selected activities augment the actual teacher prompt and leave standard/practice builds compatible", async () => {
	const { createTeacherAgent } = await import("../src/agent/teacher-agent.ts");
	const faux = createFauxCore({});
	const engine = { model: faux.getModel(), streamFn: faux.streamSimple };
	const agent = createTeacherAgent(undefined, { engine, teachingSetup: parseTeachingSetup(setup)! });
	assert.match(agent.state.systemPrompt, /Feynman Mode/);
	assert.match(agent.state.systemPrompt, /separate activities/);
	assert.match(agent.state.systemPrompt, /one reasoning step/i);
	assert.doesNotMatch(agent.state.systemPrompt, /Blitz \/ Pressure Cooker/);
	assert.doesNotMatch(
		createTeacherAgent(undefined, { engine }).state.systemPrompt,
		/Learner-selected session setup/,
	);
	assert.equal(teachingSetupInstructions(setup, "practice"), "");
	assert.match(teachingSetupInstructions(setup, "prober"), /Assess understanding/);
});
test("creation validates before writing; methods survive stored reload and model settings replacement", async () => {
	const { POST } = await import("../app/api/chats/route.ts");
	const { PUT } = await import("../app/api/chats/[id]/settings/route.ts");
	const { stores } = await import("../src/server/index.ts");
	const before = stores.chatStore.listChats().length;
	for (const body of [
		{ title: "Bad", teachingSetup: { ...setup, methods: ["fake"] } },
		{ kind: "practice", teachingSetup: setup },
		null,
	]) {
		assert.equal(
			(await POST(new Request("http://test/api/chats", { method: "POST", body: JSON.stringify(body) })))
				.status,
			400,
		);
	}
	assert.equal(stores.chatStore.listChats().length, before);
	const response = await POST(
		new Request("http://test/api/chats", {
			method: "POST",
			body: JSON.stringify({ title: "Learn momentum", teachingSetup: setup }),
		}),
	);
	assert.equal(response.status, 200);
	const { id } = await response.json();
	assert.equal(stores.chatStore.getChat(id)?.title, "Learn momentum");
	assert.deepEqual(stores.chatStore.getChat(id)?.settings?.teachingSetup, setup);
	const updated = await PUT(
		new Request(`http://test/api/chats/${id}/settings`, { method: "PUT", body: "{}" }),
		{ params: Promise.resolve({ id }) },
	);
	assert.equal(updated.status, 200);
	assert.deepEqual(stores.chatStore.getChat(id)?.settings?.teachingSetup, setup);
});
