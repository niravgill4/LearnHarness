import { piModels } from "../agent/models";

/** Static SDK catalog only; does not use keys or contact a model provider. */
export function onboardingProviderModels(provider: string) {
	if (provider === "claude-code") {
		return [
			{ id: "sonnet", name: "Claude Sonnet", vision: true },
			{ id: "opus", name: "Claude Opus", vision: true },
			{ id: "haiku", name: "Claude Haiku", vision: true },
		];
	}
	if (provider === "chatgpt") {
		return [
			{ id: "chatgpt-4o", name: "ChatGPT 4o", vision: true },
			{ id: "chatgpt-4o-mini", name: "ChatGPT 4o mini", vision: true },
			{ id: "o1", name: "o1", vision: true },
		];
	}
	try {
		return piModels().getModels(provider).map(model => ({ id: model.id, name: model.name, vision: model.input.includes("image") }));
	} catch {
		return [];
	}
}
