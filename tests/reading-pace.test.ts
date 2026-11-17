import { test } from "node:test";
import assert from "node:assert/strict";
import {
	countReadingWords,
	measureReadingPace,
	parseReadingPace,
	READING_PASSAGE,
	READING_WORD_COUNT,
	budgetLesson,
	parseLessonScope,
	parseLessonRecommendation,
	diagnosticMinutes,
} from "../src/core/reading-pace.ts";
import { parseTeachingSetup, teachingSetupInstructions } from "../src/core/teaching-methods.ts";
import { readingPaceHandlers } from "../lib/reading-pace-http.ts";
import type { createClient } from "../lib/supabase/server.ts";
import { lessonTimingHandler } from "../lib/lesson-timing-http.ts";
import { saveReadingPace } from "../lib/supabase/reading-pace.ts";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const scope = {
	scope: "Understand Newton’s second law",
	reason: "Connect force, mass, and acceleration, then practise.",
	explanationWords: 2000,
	questionCount: 4,
	questionMinutes: 8,
	activityMinutes: 4,
	feedbackMinutes: 4,
};
const pace = measureReadingPace(READING_PASSAGE.id, 60000)!;
test("calibration counts the actual passage and rejects interrupted, impossible or tampered measurements", () => {
	assert.ok(READING_WORD_COUNT >= 180 && READING_WORD_COUNT <= 230);
	assert.equal(countReadingWords("One small-change isn’t two. 42!"), 5);
	assert.equal(pace.wpm, READING_WORD_COUNT);
	assert.deepEqual(parseReadingPace(pace), pace);
	assert.deepEqual(
		parseReadingPace(measureReadingPace(READING_PASSAGE.id, 53234.6)),
		measureReadingPace(READING_PASSAGE.id, 53234.6),
	);
	for (const duration of [0, -1, NaN, Infinity, 1, 10000, 21 * 60000, "60000"])
		assert.equal(measureReadingPace(READING_PASSAGE.id, duration), null);
	assert.equal(measureReadingPace("other-passage", 60000), null);
	assert.equal(parseReadingPace({ ...pace, wpm: 999 }), null);
	assert.equal(parseReadingPace({ ...pace, wordCount: 900 }), null);
	assert.equal(parseReadingPace({ ...pace, measuredAt: "invalid" }), null);
});
test("real Supabase client serializes the private JSONB compare-and-swap correctly", async () => {
	const previous = {
		notebook: "preserve",
		nested: { tab: 2 },
		strong: { model: { provider: "openai", id: "fixture-model" } },
		onboarding: { completedAt: "2026-11-17T00:00:00.000Z" },
	};
	let writes = 0;
	const client = createSupabaseClient("https://fixture.supabase.co", "public-fixture-key", {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
		global: {
			fetch: async (input, options) => {
				const url = new URL(
					typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
				);
				assert.equal(url.pathname, "/rest/v1/profiles");
				assert.equal(url.searchParams.get("id"), "eq.alice");
				if ((options?.method ?? "GET") === "GET") return Response.json({ model_settings: previous });
				assert.equal(options?.method, "PATCH");
				assert.equal(url.searchParams.get("model_settings"), `eq.${JSON.stringify(previous)}`);
				const patch = JSON.parse(options!.body as string);
				assert.equal(patch.model_settings.notebook, "preserve");
				assert.deepEqual(patch.model_settings.strong, previous.strong);
				assert.deepEqual(patch.model_settings.onboarding, previous.onboarding);
				assert.deepEqual(patch.model_settings.readingPace, pace);
				writes++;
				return Response.json([{ id: "alice" }]);
			},
		},
	});
	await saveReadingPace(client, "alice", pace);
	assert.equal(writes, 1);
});
test("budget keeps reading, questions, activities, feedback and diagnostic time distinct", () => {
	const estimated = budgetLesson(scope, null);
	assert.equal(estimated.wpm, 250);
	assert.equal(estimated.readingMinutes, 8);
	assert.equal(estimated.lessonMinutes, 25);
	assert.equal(diagnosticMinutes("5 minutes")! + estimated.lessonMinutes, 30);
	const slower = measureReadingPace(READING_PASSAGE.id, 120000)!;
	const personal = budgetLesson(scope, slower);
	assert.ok(personal.lessonMinutes > estimated.lessonMinutes);
	assert.equal(personal.questionMinutes, estimated.questionMinutes);
	assert.equal(personal.feedbackMinutes, estimated.feedbackMinutes);
	assert.equal(personal.paceSource, "measured");
	assert.deepEqual(parseLessonRecommendation(personal), personal);
	assert.equal(parseLessonRecommendation({ ...personal, lessonMinutes: 1 }), null);
	assert.equal(parseLessonRecommendation({ ...estimated, wpm: 500 }), null);
	assert.equal(diagnosticMinutes("Skip probing (dive straight into teaching)"), 0);
	assert.equal(diagnosticMinutes("3 quick questions"), null);
	for (const bad of [
		{ ...scope, explanationWords: 0 },
		{ ...scope, questionCount: 2.5 },
		{ ...scope, activityMinutes: Infinity },
		{ ...scope, feedbackMinutes: -2 },
		{ ...scope, scope: "" },
	])
		assert.equal(parseLessonScope(bad), null);
});
test("both new methods and pacing survive setup parsing and reach the teacher and prober", () => {
	const setup = {
		methods: ["pictures-diagrams", "interactive-simulations"],
		probingTime: "5 minutes",
		learningTime: "25 minutes",
		readingPace: pace,
		recommendation: budgetLesson(scope, pace),
	};
	assert.deepEqual(parseTeachingSetup(setup), setup);
	const prompt = teachingSetupInstructions(setup, "teacher");
	for (const text of [
		"Pictures and Diagrams",
		"Interactive Simulations",
		"behavioral probe",
		"Share with tutor",
		`${pace.wpm} words per minute`,
		"reserving time",
		"selected learningTime remains authoritative",
	])
		assert.ok(prompt.includes(text), text);
	assert.match(teachingSetupInstructions(setup, "prober"), /Assess understanding/);
	assert.equal(teachingSetupInstructions(setup, "practice"), "");
	assert.equal(parseTeachingSetup({ ...setup, readingPace: { ...pace, wpm: 1 } }), null);
});

function profileFixture() {
	const rows: Record<string, { model_settings: Record<string, unknown> }> = {
		alice: { model_settings: { notebook: "keep" } },
		bob: { model_settings: { theme: "keep" } },
	};
	let active: string | null = "alice";
	let collide = false;
	const client = {
		auth: { getUser: async () => ({ data: { user: active ? { id: active } : null } }) },
		from: (table: string) => {
			assert.equal(table, "profiles");
			let patch: Record<string, unknown> | undefined;
			const filters: Record<string, unknown> = {};
			const query = {
				select: (_fields: string) => query,
				eq: (key: string, value: unknown) => {
					if (key === "model_settings") {
						assert.equal(typeof value, "string", "JSONB equality must use serialized JSON");
						filters[key] = JSON.parse(value as string);
					} else filters[key] = value;
					return query;
				},
				is: (key: string, value: unknown) => {
					filters[key] = value;
					return query;
				},
				update: (value: Record<string, unknown>) => {
					patch = value;
					return query;
				},
				single: async () => ({ data: structuredClone(rows[filters.id as string] ?? null), error: null }),
				then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
					Promise.resolve()
						.then(() => {
							const row = rows[filters.id as string];
							if (collide && row) {
								collide = false;
								row.model_settings.concurrent = "preserved";
							}
							if (!row || JSON.stringify(row.model_settings) !== JSON.stringify(filters.model_settings))
								return { data: [], error: null };
							row.model_settings = patch!.model_settings as Record<string, unknown>;
							return { data: [{ id: filters.id }], error: null };
						})
						.then(resolve, reject),
			};
			return query;
		},
	};
	const getClient = async () => client as unknown as NonNullable<Awaited<ReturnType<typeof createClient>>>;
	return {
		rows,
		getClient,
		setUser: (value: string | null) => {
			active = value;
		},
		collision: () => {
			collide = true;
		},
		handlers: readingPaceHandlers(getClient),
	};
}
const request = (extra: object = {}) =>
	new Request("http://test/api/reading-pace", {
		method: "POST",
		body: JSON.stringify({ passageId: READING_PASSAGE.id, elapsedMs: 60000, ...extra }),
	});
test("time endpoint uses the signed-in profile and real topic; rejected and failed estimates remain errors", async () => {
	const f = profileFixture();
	f.rows.alice!.model_settings.readingPace = pace;
	let calls = 0,
		contextUser = "",
		actualTopic = "";
	const deps = {
		getClient: f.getClient,
		recommend: async (topic: string) => {
			calls++;
			actualTopic = topic;
			return scope;
		},
		runWithUser: async (context: { userId: string }, task: () => Promise<Response>) => {
			contextUser = context.userId;
			return task();
		},
	};
	const handler = lessonTimingHandler(deps);
	const req = () =>
		new Request("http://test/api/lesson-timing", {
			method: "POST",
			body: JSON.stringify({ topic: "Derive Newton’s second law", readingPace: { wpm: 999 }, userId: "bob" }),
		});
	let response = await handler(req());
	assert.equal(response.status, 200);
	assert.equal((await response.json()).recommendation.wpm, pace.wpm);
	assert.equal(contextUser, "alice");
	assert.equal(actualTopic, "Derive Newton’s second law");
	f.setUser("bob");
	response = await handler(req());
	assert.equal((await response.json()).recommendation.paceSource, "estimated");
	assert.equal(contextUser, "bob");
	f.setUser(null);
	assert.equal((await handler(req())).status, 401);
	assert.equal(calls, 2);
	assert.equal((await handler(new Request("http://test", { method: "POST", body: "{}" }))).status, 400);
	f.setUser("alice");
	const unavailable = lessonTimingHandler({
		...deps,
		recommend: async () => {
			throw new Error("Provider unavailable");
		},
	});
	assert.equal((await unavailable(req())).status, 503);
});
test("reading API derives pace, isolates accounts, preserves concurrent preferences and rejects unauthenticated saves", async () => {
	const f = profileFixture();
	f.collision();
	const response = await f.handlers.POST(request({ wpm: 999, userId: "bob" }));
	assert.equal(response.status, 200);
	assert.equal((await response.json()).pace.wpm, READING_WORD_COUNT);
	assert.equal(f.rows.alice!.model_settings.notebook, "keep");
	assert.equal(f.rows.alice!.model_settings.concurrent, "preserved");
	assert.equal(f.rows.bob!.model_settings.readingPace, undefined);
	assert.equal((await (await f.handlers.GET()).json()).pace.wpm, READING_WORD_COUNT);
	f.setUser("bob");
	assert.equal((await (await f.handlers.GET()).json()).pace, null);
	assert.equal((await f.handlers.POST(request({ elapsedMs: 0 }))).status, 400);
	f.setUser(null);
	assert.equal((await f.handlers.GET()).status, 401);
	assert.equal((await f.handlers.POST(request())).status, 401);
	const unavailable = readingPaceHandlers(async () => null);
	assert.equal((await unavailable.POST(request())).status, 503);
	assert.equal((await (await unavailable.GET()).json()).accountAvailable, false);
});
