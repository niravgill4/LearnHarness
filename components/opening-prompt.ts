/**
 * Same-tab handover of a new session's full opening text. Never put the
 * message in the navigation URL: long query payloads can be rejected before
 * the chat page loads. Storage is required for automatic delivery, not an
 * optional best-effort side effect of navigating away from the source draft.
 */
export const OPENING_PROMPT_FAILURE =
	"Couldn’t open the session. Your message is still here. Try sending again.";

import type { ImageContent } from "@earendil-works/pi-ai";
export interface OpeningPrompt {
	text: string;
	images?: ImageContent[];
	/** Written BEFORE sending. A later mount restores a draft, never reposts. */
	attempted: boolean;
}

const keyFor = (id: string) => `lh.openingPrompt.${id}`;

export function stashOpeningPrompt(
	id: string,
	text: string,
	attempted = false,
	images?: ImageContent[],
): boolean {
	try {
		const retained = images ?? readOpeningPromptEntry(id)?.images;
		const value = JSON.stringify({
			text,
			attempted,
			...(retained?.length ? { images: retained } : {}),
		} satisfies OpeningPrompt);
		// Catch both the storage getter and its methods (quota/security errors).
		const storage = globalThis.sessionStorage;
		storage.setItem(keyFor(id), value);
		return storage.getItem(keyFor(id)) === value;
	} catch {
		return false;
	}
}

export function readOpeningPromptEntry(id: string): OpeningPrompt | undefined {
	try {
		const value = globalThis.sessionStorage.getItem(keyFor(id));
		if (!value) return undefined;
		try {
			const entry: unknown = JSON.parse(value);
			if (
				entry &&
				typeof entry === "object" &&
				"text" in entry &&
				typeof entry.text === "string" &&
				entry.text.length > 0 &&
				"attempted" in entry &&
				typeof entry.attempted === "boolean"
			) {
				const images =
					"images" in entry && Array.isArray(entry.images)
						? entry.images.filter(
								(i): i is ImageContent =>
									i && i.type === "image" && typeof i.data === "string" && typeof i.mimeType === "string",
							)
						: undefined;
				return { text: entry.text, attempted: entry.attempted, ...(images?.length ? { images } : {}) };
			}
		} catch {
			/* Old raw-text stashes have no proof that sending never began. */
		}
		return { text: value, attempted: true };
	} catch {
		return undefined;
	}
}

export function readOpeningPrompt(id: string): string | undefined {
	return readOpeningPromptEntry(id)?.text;
}

export function clearOpeningPrompt(id: string): boolean {
	try {
		globalThis.sessionStorage.removeItem(keyFor(id));
		return true;
	} catch {
		// Canonical conversation/acknowledgment remains the truth. A later
		// mount with real conversation can try cleanup again; never crash it.
		return false;
	}
}
