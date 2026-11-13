import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
	const secret = process.env.ENCRYPTION_SECRET || "default-secret-must-be-32-chars-long!";
	// Ensure key is exactly 32 bytes
	return Buffer.from(secret.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encryptData(text: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	const tag = cipher.getAuthTag();
	return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptData(cipherText: string): string {
	try {
		const parts = cipherText.split(":");
		if (parts.length !== 3) return "{}";
		const iv = Buffer.from(parts[0]!, "hex");
		const tag = Buffer.from(parts[1]!, "hex");
		const encrypted = parts[2]!;
		const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
		decipher.setAuthTag(tag);
		let decrypted = decipher.update(encrypted, "hex", "utf8");
		decrypted += decipher.final("utf8");
		return decrypted;
	} catch {
		return "{}";
	}
}

