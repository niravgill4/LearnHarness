import { test } from "node:test";
import assert from "node:assert/strict";
import { profileModelSlots, validateOnboardingSlots } from "../lib/onboarding.ts";
import { parseModelsSettingsBody } from "../src/server/settings-body.ts";
import { recommendSlotsForProvider, isModelRecommended } from "../components/onboarding/setup-screen.tsx";

const models = [
	{ id: "tutor", name: "Tutor Pro", vision: true },
	{ id: "helper", name: "Helper Mini", vision: false },
	{ id: "reader", name: "Reader Vision", vision: true },
];

test("recommendSlotsForProvider picks strong, cheap, and vision models", () => {
	const chatgptModels = [
		{ id: "gpt-6-sol", name: "GPT 6 Sol", vision: true },
		{ id: "gpt-6-astra", name: "GPT 6 Astra", vision: true },
		{ id: "gpt-6-tera", name: "GPT 6 Tera", vision: true },
	];
	const recs = recommendSlotsForProvider("chatgpt", chatgptModels);
	assert.equal(recs.strong, "gpt-6-sol");
	assert.equal(recs.cheap, "gpt-6-tera");
	assert.ok(recs.vision === "gpt-6-astra" || recs.vision === "gpt-6-sol");

	assert.equal(isModelRecommended(chatgptModels[0]!, "strong"), true);
	assert.equal(isModelRecommended(chatgptModels[2]!, "cheap"), true);
	assert.equal(isModelRecommended(chatgptModels[1]!, "vision"), true);
});

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
