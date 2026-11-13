import { decryptData, encryptData } from "@/lib/crypto";
import { createClient } from "./server";

export function readProfileKeys(encrypted: string | null | undefined): Record<string, string> {
	if (!encrypted) return {};
	const value: unknown = JSON.parse(decryptData(encrypted));
	if (!value || typeof value !== "object" || Array.isArray(value) || Object.values(value).some(v => typeof v !== "string")) throw new Error("Invalid saved keys.");
	return value as Record<string, string>;
}

/** Optimistic compare-and-swap prevents concurrent key edits from losing siblings. */
export async function mutateProfileKey(client: NonNullable<Awaited<ReturnType<typeof createClient>>>, userId: string, id: string, value?: string) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const { data: profile, error } = await client.from("profiles").select("encrypted_keys").eq("id", userId).single();
		if (error || !profile) throw new Error("Your profile could not be read. Please try again.");
		const keys = readProfileKeys(profile.encrypted_keys);
		if (value === undefined) delete keys[id]; else keys[id] = value;
		let query = client.from("profiles").update({ encrypted_keys: encryptData(JSON.stringify(keys)), updated_at: new Date().toISOString() }).eq("id", userId);
		query = profile.encrypted_keys === null ? query.is("encrypted_keys", null) : query.eq("encrypted_keys", profile.encrypted_keys);
		const result = await query.select("id");
		if (result.error) throw new Error("Your key could not be saved. Please try again.");
		if (result.data?.length) return keys;
	}
	throw new Error("Another key change is being saved. Please try again.");
}
