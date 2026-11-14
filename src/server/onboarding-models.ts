import { piModels } from "../agent/models";
import { chatGPTModels } from "../agent/chatgpt-bridge";

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
			{ id: "gpt-6-sol", name: "GPT 6 Sol", vision: true },
			{ id: "gpt-6-astra", name: "GPT 6 Astra", vision: true },
			{ id: "gpt-6-tera", name: "GPT 6 Tera", vision: true },
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
