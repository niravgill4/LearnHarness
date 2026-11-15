import assert from "node:assert/strict";
import test from "node:test";
import { userAuthStorage } from "../src/core/user-auth-context.ts";
import { keyValue, providerKeyPresent } from "../src/server/keys.ts";

test("multi-tenant API key isolation: no keys leak or mix across users", () => {
	const userA = {
		userId: "user-a-uuid",
		keys: {
			ANTHROPIC_API_KEY: "sk-ant-usera-secret-key-123456",
			OPENAI_API_KEY: "sk-proj-usera-secret-key-654321",
		},
	};

	const userB = {
		userId: "user-b-uuid",
		keys: {
			GEMINI_API_KEY: "AIzaSyUserBSecretKey987654321",
		},
	};

	const userEmpty = {
		userId: "user-empty-uuid",
		keys: {},
	};

	// 1. In User A's context: User A sees only Anthropic and OpenAI
	userAuthStorage.run(userA, () => {
		assert.equal(keyValue("ANTHROPIC_API_KEY"), "sk-ant-usera-secret-key-123456");
		assert.equal(keyValue("OPENAI_API_KEY"), "sk-proj-usera-secret-key-654321");
		assert.equal(keyValue("GEMINI_API_KEY"), undefined);

		assert.equal(providerKeyPresent("anthropic"), true);
		assert.equal(providerKeyPresent("openai"), true);
		assert.equal(providerKeyPresent("google"), false);
		assert.equal(providerKeyPresent("openrouter"), false);
	});

	// 2. In User B's context: User B sees ONLY Gemini. Zero access to User A's Anthropic or OpenAI!
	userAuthStorage.run(userB, () => {
		assert.equal(keyValue("ANTHROPIC_API_KEY"), undefined);
		assert.equal(keyValue("OPENAI_API_KEY"), undefined);
		assert.equal(keyValue("GEMINI_API_KEY"), "AIzaSyUserBSecretKey987654321");

		assert.equal(providerKeyPresent("anthropic"), false);
		assert.equal(providerKeyPresent("openai"), false);
		assert.equal(providerKeyPresent("google"), true);
		assert.equal(providerKeyPresent("openrouter"), false);
	});

	// 3. In User Empty's context (fresh signup on iPad): completely empty, zero keys present!
	userAuthStorage.run(userEmpty, () => {
		assert.equal(keyValue("ANTHROPIC_API_KEY"), undefined);
		assert.equal(keyValue("OPENAI_API_KEY"), undefined);
		assert.equal(keyValue("GEMINI_API_KEY"), undefined);

		assert.equal(providerKeyPresent("anthropic"), false);
		assert.equal(providerKeyPresent("openai"), false);
		assert.equal(providerKeyPresent("google"), false);
		assert.equal(providerKeyPresent("openrouter"), false);
		assert.equal(providerKeyPresent("chatgpt"), false);
	});
});
