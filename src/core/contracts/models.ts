/**
 * Model-catalog contracts (model-control wave, 2026-09-12) — the client-safe
 * shapes of GET /api/models and PUT /api/chats/[id]/settings responses.
 * Pure types; the server projection lives in src/server/model-catalog.ts
 * (which OWNS these shapes — the contract is defined here only so client
 * components never import from the server band).
 */
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { BackgroundModelRole, ModelSlotName, ModelSlot } from "../settings.ts";

/** One picker row: everything the UI shows about a model, projected from
 *  pi-ai's catalog. Costs are USD per 1M tokens (the same catalog, the same
 *  units as Pi's server-side pricing calculator). */
export interface ModelCatalogEntry {
	id: string;
	name: string;
	provider: string;
	reasoning: boolean;
	input: ("text" | "image")[];
	/** Thinking levels accepted by this model, as reported by the host catalog. */
	supportedLevels: ThinkingLevel[];
	/** Null when LearnHarness cannot estimate prices for this connection. */
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
	/** Null for native CLI aliases whose effective limits are session-specific. */
	contextWindow: number | null;
	maxTokens: number | null;
}

/** Conversation default resolved from the strong slot, used for new sessions
 * and as fallback for sessions without their own choices. An omitted thinking
 * level is selected from the host's supported-level preference at engine build. */
export interface CatalogDefaults {
	model: { provider: string; id: string };
	thinkingLevel?: ThinkingLevel;
}

/** Resolved model choice per background role: role override, then its assigned
 * tier slot. Null means no model is configured and work requiring that role
 * is unavailable; there is no implicit factory model fallback. */
export type RolePins = Record<
	BackgroundModelRole,
	{ model: { provider: string; id: string }; thinkingLevel?: ThinkingLevel } | null
>;

/** Resolved model choice for each slot tier. Null means that tier has no model;
 * configured entries include optional thinking and cache-retention preferences. */
export type SlotPins = Record<ModelSlotName, (ModelSlot & { model: { provider: string; id: string } }) | null>;

/** GET /api/models response. */
export interface ModelCatalogResponse {
	models: ModelCatalogEntry[];
	/** Strong-slot conversation default, or null when no default model is
	 * configured. A session's explicit model choice resolves separately. */
	defaults: CatalogDefaults | null;
	/** Resolved background-role models, using the same resolution as execution.
	 * Each unconfigured role is null. */
	rolePins: RolePins;
	/** Resolved strong/cheap/vision slot choices, null for each unset tier.
	 * Per-role overrides are represented in rolePins, not in these slot values. */
	slots: SlotPins;
	/** Provider/connection rows with availability flags, including disconnected
	 * providers where exposed by the host. This is not a guarantee that each
	 * provider has currently selectable models; inspect models and keyPresent. */
	providers: CatalogProvider[];
}

/** One row of the providers surface. */
export interface CatalogProvider {
	id: string;
	/** Credential environment-variable name; empty for subscription/native CLI routes. */
	envVar: string;
	/** Host credential/connection availability flag, not a remote health check.
	 * Custom keyless connections can be available without an API key. */
	keyPresent: boolean;
}

/** Identifies typo / hallucinated models (e.g. gpt-6-tera with one 'r', 5.6-astra). */
export function isFakeModel(id: string, name?: string): boolean {
	const text = `${id} ${name ?? ""}`.toLowerCase();
	// Typo single-'r' variants of terra
	if (/\bgpt-(?:5\.6|6)-tera\b/i.test(text)) return true;
	// Non-existent astra for 5.6 (astra is only for 6)
	if (/\b(?:gpt-)?5\.6-astra\b/i.test(text)) return true;
	if (/\bclaude-fable\b/i.test(text)) return true;
	return false;
}

/** Heals any historical or legacy typo/fake model ID into a real model ID. */
export function healFakeModel(provider: string, id: string, slot?: "strong" | "cheap" | "vision"): string {
	if (!isFakeModel(id)) return id;
	const text = id.toLowerCase();
	if (/\bgpt-6-tera\b/i.test(text)) {
		return "gpt-6-astra";
	}
	if (/\bgpt-5\.6-tera\b/i.test(text)) {
		return "gpt-5.6-terra";
	}
	if (/\b(?:gpt-)?5\.6-astra\b/i.test(text)) {
		return "gpt-6-astra";
	}
	if (provider === "chatgpt") {
		if (slot === "cheap") return "chatgpt-4o-mini";
		return "gpt-6.1-sol";
	}
	if (provider === "openai") {
		if (slot === "cheap") return "gpt-4o-mini";
		return "gpt-4o";
	}
	if (provider === "claude-code") {
		if (slot === "cheap") return "haiku";
		return "sonnet";
	}
	if (provider === "anthropic") {
		if (slot === "cheap") return "claude-3-5-haiku-20241022";
		return "claude-3-7-sonnet-20250219";
	}
	if (provider === "google") {
		if (slot === "cheap") return "gemini-2.0-flash-lite";
		return "gemini-2.0-flash";
	}
	return "chatgpt-4o";
}
