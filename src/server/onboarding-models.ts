import { piModels } from "../agent/models";

/** Static SDK catalog only; does not use keys or contact a model provider. */
export function onboardingProviderModels(provider: string) {
	return piModels().getModels(provider).map(model => ({ id: model.id, name: model.name, vision: model.input.includes("image") }));
}
