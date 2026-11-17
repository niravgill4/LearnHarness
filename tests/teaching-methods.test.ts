import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createFauxCore } from "@earendil-works/pi-ai";
import {
	parseTeachingSetup,
	teachingSetupInstructions,
	TEACHING_METHODS,
	teachingQuestionMode,
} from "../src/core/teaching-methods.ts";
import { measureReadingPace, READING_PASSAGE } from "../src/core/reading-pace.ts";
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
test("catalog has twelve unique methods and rejects invalid setup before use", () => {
	assert.equal(TEACHING_METHODS.length, 12);
	assert.equal(new Set(TEACHING_METHODS.map((m) => m.id)).size, 12);
	assert.ok(parseTeachingSetup({ ...setup, methods: TEACHING_METHODS.map(m => m.id) }));
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
test("question-method selections arm the real teacher tools, override defaults, and preserve one-question pacing", async () => {
	const { createTeacherAgent } = await import("../src/agent/teacher-agent.ts");
	const { createTeacherTools } = await import("../src/agent/tools.ts");
	const { stores } = await import("../src/server/index.ts");
	const chat = stores.chatStore.createChat("Question format methods");
	stores.chatStore.saveTree(chat.id, { version: 1, nodes: [{ id: "arith", title: "Arithmetic" }], edges: [] });
	const ctx = { chatId: chat.id, chatStore: stores.chatStore, jobStore: stores.jobStore, spawn: () => {} };
	const faux = createFauxCore({});
	const engine = { model: faux.getModel(), streamFn: faux.streamSimple };
	for (const [methods, mode, names] of [
		[["free-response"], "free", ["explain"]],
		[["multiple-choice"], "choice", ["quiz"]],
		[["free-response", "multiple-choice"], "mixed", ["explain", "quiz"]],
	] as const) {
		const selection = parseTeachingSetup({ ...setup, methods })!;
		assert.equal(teachingQuestionMode(selection), mode);
		const agent = createTeacherAgent(ctx, { engine, teachingSetup: selection, toolToggles: { explain: mode === "choice" } });
		assert.deepEqual(agent.state.tools.filter(t => t.name === "quiz" || t.name === "explain").map(t => t.name).sort(), [...names].sort());
		assert.match(agent.state.systemPrompt, /after completing a meaningful explanation/);
		if (mode === "mixed") assert.match(agent.state.systemPrompt, /Alternate explain.*quiz/);
	}
	assert.equal(teachingQuestionMode(setup), undefined);
	assert.ok(createTeacherTools(ctx, { explain: true }).explain);
	assert.ok(createTeacherTools(ctx).quiz);
	const tools = createTeacherTools(ctx, undefined, "mixed");
	for (const [name, input] of [
		["explain", { type: "check", nodeId: "arith", question: "What is 2 + 2? Explain.", correctAnswer: "4, because adding two pairs makes four." }],
		["quiz", { type: "check", nodeId: "arith", question: "What is 2 + 2?", options: [{ label: "3", value: "3" }, { label: "4", value: "4" }], explanation: "Two pairs make four.", correctAnswer: "4" }],
	] as const) {
		const result = await tools[name]!.execute("test-call", input);
		assert.ok(!result.isError, `${name} is usable with the existing question flow`);
	}
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
test("cold cloud restore retains identity, reading calibration and selected methods, without overwriting a local session", async () => {
	const { restoreChatRecord } = await import("../src/store/chats.ts");
	const { stores } = await import("../src/server/index.ts");
	const readingPace = measureReadingPace(READING_PASSAGE.id, 60000)!;
	const record = { id: "chat_cloud_pacing", title: "A cloud lesson", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [], settings: { teachingSetup: parseTeachingSetup({ ...setup, readingPace, methods: ["pictures-diagrams", "interactive-simulations"] })! } };
	const restored = restoreChatRecord(record)!;
	assert.equal(restored.id, record.id);
	assert.deepEqual(restored.settings?.teachingSetup, record.settings.teachingSetup);
	stores.chatStore.renameChat(record.id, "Local title wins");
	assert.equal(restoreChatRecord(record)?.title, "Local title wins");
});
