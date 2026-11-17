export interface DemoObservation {
	parameters: Record<string, string | number | boolean>;
	result: string;
}
/** Iframe messages are untrusted, even when authored by a lesson builder. */
export function parseDemoObservation(value: unknown): DemoObservation | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	if (
		typeof v.result !== "string" ||
		v.result.length > 1200 ||
		!v.parameters ||
		typeof v.parameters !== "object" ||
		Array.isArray(v.parameters)
	)
		return null;
	const entries = Object.entries(v.parameters);
	if (entries.length > 24 || (!entries.length && !v.result.trim())) return null;
	for (const [label, item] of entries) {
		if (
			!label.trim() ||
			label.length > 100 ||
			["__proto__", "prototype", "constructor"].includes(label) ||
			!(
				typeof item === "boolean" ||
				(typeof item === "number" && Number.isFinite(item)) ||
				(typeof item === "string" && item.length <= 240)
			)
		)
			return null;
	}
	return { parameters: Object.fromEntries(entries), result: v.result.trim() };
}
export function demoObservationText(title: string, observation: DemoObservation): string {
	return `I tried the simulation ${JSON.stringify(title.slice(0, 200))}. Here are my current settings and observed results (not a correctness grade):\n${JSON.stringify(observation, null, 2)}\nHelp me understand why this happened and check my reasoning.`;
}
