/** Browser-safe setup vocabulary. Provider/model availability comes from the server. */
export interface OnboardingProviderDef {
	id: string;
	name: string;
	detail: string;
	url: string;
	keyless?: boolean;
}

export const ONBOARDING_PROVIDERS: readonly OnboardingProviderDef[] = [
	{ id: "claude-code", name: "Claude Code", detail: "Local CLI installation", url: "https://code.claude.com", keyless: true },
	{ id: "chatgpt", name: "Codex / ChatGPT", detail: "ChatGPT subscription", url: "https://chatgpt.com", keyless: true },
	{ id: "anthropic", name: "Anthropic", detail: "Claude API key", url: "https://console.anthropic.com/settings/keys" },
	{ id: "openai", name: "OpenAI", detail: "GPT API key", url: "https://platform.openai.com/api-keys" },
	{ id: "google", name: "Google", detail: "Gemini API key", url: "https://aistudio.google.com/apikey" },
	{ id: "openrouter", name: "OpenRouter", detail: "Many models, one key", url: "https://openrouter.ai/settings/keys" },
] as const;

export type OnboardingProvider = "claude-code" | "chatgpt" | "anthropic" | "openai" | "google" | "openrouter";
export type LearningIntent = "understand" | "exam" | "explore";
export const ONBOARDING_SLOTS = ["strong", "cheap", "vision"] as const;
export function validateOnboardingSlots(value: unknown, models: readonly { id: string; vision: boolean }[]) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const input = value as Record<string, unknown>;
	const strong = models.find(model => model.id === input.strong);
	const cheap = models.find(model => model.id === input.cheap);
	const vision = models.find(model => model.id === input.vision && model.vision);
	return strong && cheap && vision ? { strong, cheap, vision } : null;
}
export interface LearningSetup {
	version: 1;
	completedAt?: string;
	provider?: OnboardingProvider;
	modelId?: string;
	slots?: Record<"strong" | "cheap" | "vision", string>;
	topic?: string;
	intent?: LearningIntent;
}

/** Profile metadata is stored beside the model slots; only these three keys
 * may enter the strict models settings endpoint. */
export function profileModelSlots(value: unknown) {
	const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
	return Object.fromEntries(["strong", "cheap", "vision"].filter(key => {
		const slot = record[key];
		return slot && typeof slot === "object" && !Array.isArray(slot) && "model" in slot;
	}).map(key => [key, record[key]]));
}
export interface SetupSnapshot {
	email?: string;
	configured: boolean;
	setup: LearningSetup | null;
	connected: string[];
	models: { id: string; name: string; provider: string; vision: boolean }[];
}
