import { test } from "node:test";
import assert from "node:assert/strict";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { recommendLessonScope } from "../src/server/lesson-timing.ts";
const scope = {
	scope: "Relate angle and range",
	reason: "Predict, explore, and explain a trajectory.",
	explanationWords: 1200,
	questionCount: 3,
	questionMinutes: 7,
	activityMinutes: 5,
	feedbackMinutes: 3,
};
function engine(text: string) {
	const faux = createFauxCore({});
	faux.setResponses([fauxAssistantMessage(text)]);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}
test("recommendation model output is parsed and bounded; errors remain errors rather than fake personalization", async () => {
	const signal = new AbortController().signal;
	assert.deepEqual(
		await recommendLessonScope("Projectile motion", "understand", signal, engine(JSON.stringify(scope))),
		scope,
	);
	for (const output of [
		"Not JSON",
		JSON.stringify({ ...scope, questionMinutes: -1 }),
		JSON.stringify({ ...scope, explanationWords: 999999 }),
	]) {
		await assert.rejects(
			recommendLessonScope("Projectile motion", "understand", signal, engine(output)),
			/could not be prepared/,
		);
	}
	const cancelled = new AbortController();
	cancelled.abort();
	await assert.rejects(
		recommendLessonScope("Algebra", undefined, cancelled.signal, engine(JSON.stringify(scope))),
		/abort/i,
	);
});
