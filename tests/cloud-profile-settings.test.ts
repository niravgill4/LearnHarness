import assert from "node:assert/strict";
import { test } from "node:test";
import { profileSettings } from "../lib/supabase/profile-settings";

test("account settings resolve exclusively from each profile and exclude onboarding metadata", () => {
 const alice = profileSettings({ model_settings: { strong: { model: { provider: "google", id: "gemini-2.5-flash" } }, readingPace: { wordsPerMinute: 200 }, preferences: { version: 1, general: {} } } });
 const bob = profileSettings({ model_settings: {} });
 assert.equal(alice.models?.strong?.model?.provider, "google");
 assert.equal(bob.models?.strong, undefined);
 assert.equal("readingPace" in (alice.models ?? {}), false);
 assert.notEqual(alice, bob);
});

test("malformed cloud metadata falls back to an empty account record", () => {
 const settings = profileSettings({ model_settings: "corrupt" });
 assert.equal(settings.models?.strong, undefined);
 assert.equal(settings.version, 1);
});
