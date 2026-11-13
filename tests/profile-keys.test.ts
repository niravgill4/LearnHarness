import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { encryptData, decryptData } from "../lib/crypto";
import { mutateProfileKey, readProfileKeys } from "../lib/supabase/profile-keys";

const previousSecret = process.env.ENCRYPTION_SECRET;
before(() => { process.env.ENCRYPTION_SECRET = "fixture-secret-with-at-least-32-bytes"; });
after(() => { if (previousSecret === undefined) delete process.env.ENCRYPTION_SECRET; else process.env.ENCRYPTION_SECRET = previousSecret; });

function fixture(initial: Record<string, Record<string, string>>, collide = false, failWrite = false) {
	const records = new Map(Object.entries(initial).map(([id, keys]) => [id, encryptData(JSON.stringify(keys))]));
	const writes: string[] = [];
	let collided = false;
	const client = { from(table: string) {
		assert.equal(table, "profiles");
		return {
			select() { return { eq(_column: string, id: string) { return { async single() { return { data: { encrypted_keys: records.get(id) }, error: null }; } }; } }; },
			update(payload: { encrypted_keys: string }) {
				let owner = "", expected: string | null;
				const query = {
					eq(column: string, value: string) { if (column === "id") owner = value; else expected = value; return query; },
					is(_column: string, value: null) { expected = value; return query; },
					async select() {
						if (failWrite) return { data: null, error: { message: "fixture write failure" } };
						if (collide && !collided) {
							collided = true;
							records.set(owner, encryptData(JSON.stringify({ ...readProfileKeys(records.get(owner)), OTHER_KEY: "concurrent-value" })));
							return { data: [], error: null };
						}
						if (records.get(owner) !== expected) return { data: [], error: null };
						records.set(owner, payload.encrypted_keys); writes.push(owner);
						return { data: [{ id: owner }], error: null };
					},
				};
				return query;
			},
		};
	} };
	return { client: client as unknown as Parameters<typeof mutateProfileKey>[0], records, writes };
}

test("encrypted keys use distinct ciphertext and authenticated round trips", () => {
	const first = encryptData('{"OPENAI_API_KEY":"private-key"}');
	assert.notEqual(first, encryptData('{"OPENAI_API_KEY":"private-key"}'));
	assert(!first.includes("private-key"));
	assert.equal(decryptData(first), '{"OPENAI_API_KEY":"private-key"}');
	const parts = first.split(":"); parts[2] = (parts[2]!.startsWith("00") ? "01" : "00") + parts[2]!.slice(2);
	assert.throws(() => decryptData(parts.join(":")));
});

test("missing encryption configuration fails closed", () => {
	delete process.env.ENCRYPTION_SECRET;
	try { assert.throws(() => encryptData("secret"), /not configured/); }
	finally { process.env.ENCRYPTION_SECRET = "fixture-secret-with-at-least-32-bytes"; }
});

test("unreadable and malformed key records cannot silently become empty", () => {
	assert.deepEqual(readProfileKeys(null), {});
	for (const invalid of ["broken", encryptData("[]"), encryptData('{"key":123}')]) assert.throws(() => readProfileKeys(invalid));
});

test("saving only mutates the authenticated owner's encrypted profile", async () => {
	const { client, records, writes } = fixture({ a: { KEEP: "kept" }, b: { PRIVATE: "other-user" } });
	const other = records.get("b");
	await mutateProfileKey(client, "a", "OPENAI_API_KEY", "new-key");
	assert.deepEqual(readProfileKeys(records.get("a")), { KEEP: "kept", OPENAI_API_KEY: "new-key" });
	assert.equal(records.get("b"), other);
	assert.deepEqual(writes, ["a"]);
});

test("concurrent key saves retry without discarding sibling credentials", async () => {
	const { client, records } = fixture({ a: { KEEP: "kept" } }, true);
	await mutateProfileKey(client, "a", "NEW_KEY", "new-value");
	assert.deepEqual(readProfileKeys(records.get("a")), { KEEP: "kept", OTHER_KEY: "concurrent-value", NEW_KEY: "new-value" });
});

test("deleting a key preserves siblings and database failure is not success", async () => {
	const { client, records } = fixture({ a: { KEEP: "kept", REMOVE: "gone" } });
	await mutateProfileKey(client, "a", "REMOVE");
	assert.deepEqual(readProfileKeys(records.get("a")), { KEEP: "kept" });
	const failed = fixture({ a: { KEEP: "kept" } }, false, true);
	await assert.rejects(mutateProfileKey(failed.client, "a", "NEW_KEY", "value"), /could not be saved/);
	assert.deepEqual(failed.writes, []);
});
