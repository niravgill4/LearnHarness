import { piModels } from "../agent/models";
import { chatGPTModels, chatGPTConnected, DEFAULT_CHATGPT_MODELS } from "../agent/chatgpt-bridge";
import { claudeCodeAvailable } from "./claude-code-config";
import { isFakeModel } from "../core/contracts/models";

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
		const live = chatGPTModels().filter(m => !isFakeModel(m.id, m.name));
		if (live.length > 0) {
			return live.map(m => ({ id: m.id, name: m.name, vision: m.input.includes("image") }));
		}
		return DEFAULT_CHATGPT_MODELS.filter(m => !isFakeModel(m.id, m.name)).map(m => ({ id: m.id, name: m.name, vision: m.input.includes("image") }));
	}
	try {
		return piModels().getModels(provider)
			.filter(model => !isFakeModel(model.id, model.name))
			.map(model => ({ id: model.id, name: model.name, vision: model.input.includes("image") }));
	} catch {
		return [];
	}
}
