/** Browser-safe setup vocabulary. Provider/model availability comes from the server. */
export const ONBOARDING_PROVIDERS = [
	{ id: "openrouter", name: "OpenRouter", detail: "Many models, one key", url: "https://openrouter.ai/settings/keys" },
	{ id: "openai", name: "OpenAI", detail: "GPT models", url: "https://platform.openai.com/api-keys" },
	{ id: "anthropic", name: "Anthropic", detail: "Claude models", url: "https://console.anthropic.com/settings/keys" },
	{ id: "google", name: "Google", detail: "Gemini models", url: "https://aistudio.google.com/apikey" },
] as const;

export type OnboardingProvider = typeof ONBOARDING_PROVIDERS[number]["id"];
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
