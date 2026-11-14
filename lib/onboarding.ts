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
export interface LearningSetup {
	version: 1;
	completedAt?: string;
	provider?: OnboardingProvider;
	modelId?: string;
	topic?: string;
	intent?: LearningIntent;
}
export interface SetupSnapshot {
	email?: string;
	setup: LearningSetup | null;
	connected: string[];
	models: { id: string; name: string; provider: string; vision: boolean }[];
}
