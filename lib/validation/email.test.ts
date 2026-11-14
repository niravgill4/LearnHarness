import test from "node:test";
import assert from "node:assert/strict";
import { validateEmail } from "./email";

test("validateEmail accepts legitimate emails", () => {
	const validEmails = [
		"alice@gmail.com",
		"bob.smith+tag@outlook.com",
		"researcher@university.edu",
		"dev@company.co.uk",
		"user@domain.ai",
		"nirav@cognera.app",
	];

	for (const email of validEmails) {
		const result = validateEmail(email);
		assert.equal(result.valid, true, `Expected ${email} to be valid`);
		assert.equal(result.normalized, email.toLowerCase());
		assert.equal(result.error, undefined);
	}
});

test("validateEmail rejects malformed emails", () => {
	const invalidEmails = [
		"",
		"   ",
		"plainaddress",
		"@missingusername.com",
		"missingdomain@",
		"two@@signs.com",
		"spaces in@address.com",
		"user@domain..com",
		"user@domain.c", // 1-letter TLD
		"user@domain.123", // Numeric TLD
	];

	for (const email of invalidEmails) {
		const result = validateEmail(email);
		assert.equal(result.valid, false, `Expected ${email} to be rejected`);
		assert.ok(result.error, `Expected an error message for ${email}`);
	}
});

test("validateEmail rejects dummy test patterns", () => {
	const dummyEmails = [
		"test@test.com",
		"asdf@asdf.com",
		"admin@admin.com",
		"fake@fake.com",
		"user@user.com",
		"abc@abc.com",
	];

	for (const email of dummyEmails) {
		const result = validateEmail(email);
		assert.equal(result.valid, false, `Expected dummy email ${email} to be rejected`);
		assert.match(result.error ?? "", /real, personal or work email/i);
	}
});

test("validateEmail blocks disposable and burner domains", () => {
	const disposableEmails = [
		"random123@mailinator.com",
		"burner@10minutemail.com",
		"temp@tempmail.com",
		"anon@guerrillamail.com",
		"throwaway@trashmail.com",
		"test@yopmail.com",
		"quick@burnermail.io",
	];

	for (const email of disposableEmails) {
		const result = validateEmail(email);
		assert.equal(result.valid, false, `Expected disposable email ${email} to be blocked`);
		assert.match(result.error ?? "", /temporary or disposable/i);
	}
});
