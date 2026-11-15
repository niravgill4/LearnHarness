import { piModels } from "../agent/models";
import { chatGPTModels } from "../agent/chatgpt-bridge";
import { chatGPTConnected } from "../agent/chatgpt-bridge";
import { claudeCodeAvailable } from "./claude-code-config";

export function onboardingAccountAvailable(provider: string): boolean {
	return provider === "chatgpt" ? chatGPTConnected() : provider === "claude-code" ? claudeCodeAvailable() : false;
}

/** Static SDK catalog + live connected account models. */
export function onboardingProviderModels(provider: string) {
	if (provider === "claude-code") {
		return [
			{ id: "sonnet", name: "Claude Sonnet", vision: true },
			{ id: "opus", name: "Claude Opus", vision: true },
			{ id: "haiku", name: "Claude Haiku", vision: true },
		];
	}
	if (provider === "chatgpt") {
		const live = chatGPTModels();
		if (live.length > 0) {
			return live.map(m => ({ id: m.id, name: m.name, vision: m.input.includes("image") }));
		}
		return [
			{ id: "gpt-6.1-sol", name: "GPT 6.1 Sol", vision: true },
			{ id: "gpt-6-sol", name: "GPT 6 Sol", vision: true },
			{ id: "gpt-5.6-tera", name: "GPT 5.6 Tera", vision: true },
			{ id: "gpt-5.6-terra", name: "GPT 5.6 Terra", vision: true },
			{ id: "gpt-6-tera", name: "GPT 6 Tera", vision: true },
			{ id: "gpt-6-astra", name: "GPT 6 Astra", vision: true },
			{ id: "gpt-5.6-astra", name: "GPT 5.6 Astra", vision: true },
			{ id: "chatgpt-4o", name: "ChatGPT 4o", vision: true },
			{ id: "chatgpt-4o-mini", name: "ChatGPT 4o mini", vision: true },
			{ id: "o1", name: "o1", vision: true },
			{ id: "o3-mini", name: "o3-mini", vision: true },
		];
	}
	try {
		return piModels().getModels(provider).map(model => ({ id: model.id, name: model.name, vision: model.input.includes("image") }));
	} catch {
		return [];
	}
}
