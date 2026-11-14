import { test } from "node:test";
import assert from "node:assert/strict";
import { profileModelSlots, validateOnboardingSlots } from "../lib/onboarding.ts";
import { parseModelsSettingsBody } from "../src/server/settings-body.ts";

const models = [
	{ id: "tutor", vision: true },
	{ id: "helper", vision: false },
	{ id: "reader", vision: true },
];

test("onboarding needs all three choices and an image-capable vision model", () => {
	assert.equal(validateOnboardingSlots({ strong: "tutor", cheap: "helper" }, models), null);
	assert.equal(validateOnboardingSlots({ strong: "tutor", cheap: "helper", vision: "helper" }, models), null);
	assert.equal(validateOnboardingSlots({ strong: "elsewhere", cheap: "helper", vision: "reader" }, models), null);
	assert.deepEqual(validateOnboardingSlots({ strong: "tutor", cheap: "helper", vision: "reader" }, models), {
		strong: models[0], cheap: models[1], vision: models[2],
	});
});

test("legacy profile metadata cannot leak into strict model slot writes", () => {
	const source = {
		chatgpt: { connected: true }, claudeCode: { enabled: true }, onboarding: { completedAt: "2026-11-14" },
		strong: { model: { provider: "chatgpt", id: "tutor" } },
		cheap: { model: { provider: "chatgpt", id: "helper" } },
		vision: { model: { provider: "chatgpt", id: "reader" } },
	};
	const slots = profileModelSlots(source);
	assert.deepEqual(Object.keys(slots), ["strong", "cheap", "vision"]);
	assert.equal(parseModelsSettingsBody(slots).ok, true);
	assert.equal(parseModelsSettingsBody(source).ok, false);
});
