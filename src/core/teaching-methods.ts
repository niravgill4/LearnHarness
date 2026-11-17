export const TEACHING_METHODS = [
	{
		id: "spot-the-slip",
		name: "Spot the Slip",
		description: "Find the first mistake in your written working.",
		instruction:
			"Review typed or handwritten working in order. Identify the first flawed step with a targeted hint. Ask about unreadable marks; do not claim to pin canvas badges.",
	},
	{
		id: "feynman",
		name: "Feynman Mode",
		description: "Teach the idea back to a curious learner.",
		instruction:
			"Invite a plain-language explanation. Explicitly role-play a curious novice for this exercise; probe jargon, assumptions and unexplained links, then give accurate feedback.",
	},
	{
		id: "devils-advocate",
		name: "Devil’s Advocate",
		description: "Find a deliberate mistake in a worked solution.",
		instruction:
			"Privately solve an exercise correctly first. Present a clearly labeled error-finding exercise with one realistic planted flaw. Ask the learner to identify and justify it, then debrief correctly. Never present the planted error as factual teaching.",
	},
	{
		id: "socratic",
		name: "Socratic Lockdown",
		description: "Reach the answer through questions and small hints.",
		instruction:
			"During this activity guide with one question or minimal hint at a time. Withhold solutions the learner can derive. Establish missing prerequisites. Honor an explicit request for explanation or to leave the activity; do not trap the learner.",
	},
	{
		id: "reconstruction",
		name: "Blindfold Reconstruction",
		description: "Rebuild a diagram from memory, then compare.",
		instruction:
			"Show a diagram or derivation, ask the learner to avoid looking back and reconstruct it using drawing or text, then compare structure, connections and omissions. Do not claim automatic hiding, timing, image alignment or heat-map overlays.",
	},
	{
		id: "five-whys",
		name: "The 5 Whys",
		description: "Trace formulas and claims back to their foundations.",
		instruction:
			"Ask why a claim holds and trace assumptions and prerequisites. Stop when the foundations are established, not after an arbitrary five repetitions. Do not manufacture unconditional truths; return to the original problem.",
	},
	{
		id: "co-pilot",
		name: "Split-Board Co-Pilot",
		description: "Alternate problem-solving steps with your tutor.",
		instruction:
			"Alternate clearly labeled tutor and learner steps. Ask the learner to justify their steps and finish with an independent check. Use current conversation and drawing submissions; do not claim to write live shared-canvas ink.",
	},
	{
		id: "blitz",
		name: "Blitz / Pressure Cooker",
		description: "Try short challenges with an optional time target.",
		instruction:
			"Offer short exam-fluency rounds with an optional suggested time such as 45 seconds. Ask the learner to self-time; do not claim an enforced timer or automatic timeout. Review errors afterward and distinguish speed from understanding.",
	},
] as const;
export type TeachingMethodId = (typeof TEACHING_METHODS)[number]["id"];
export interface TeachingSetup {
	methods: TeachingMethodId[];
	probingTime: string;
	learningTime: string;
}
export function teachingOpeningPrompt(topic: string, setup: TeachingSetup) {
	return `${topic}\n\nSession Time Budget:\n- Diagnostic Probing: ${setup.probingTime}\n- Deep Learning & Teaching: ${setup.learningTime}\nTeaching methods: ${
		TEACHING_METHODS.filter((m) => setup.methods.includes(m.id))
			.map((m) => m.name)
			.join(", ") || "Cognera standard"
	}`;
}
export function parseTeachingSetup(value: unknown): TeachingSetup | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	if (
		!Array.isArray(v.methods) ||
		v.methods.length > 8 ||
		!v.methods.every((id) => TEACHING_METHODS.some((m) => m.id === id))
	)
		return null;
	if (
		typeof v.probingTime !== "string" ||
		!v.probingTime.trim() ||
		v.probingTime.length > 200 ||
		typeof v.learningTime !== "string" ||
		!v.learningTime.trim() ||
		v.learningTime.length > 200
	)
		return null;
	return {
		methods: [...new Set(v.methods)] as TeachingMethodId[],
		probingTime: v.probingTime.trim(),
		learningTime: v.learningTime.trim(),
	};
}
export function teachingSetupInstructions(value: unknown, kind: "prober" | "teacher" | "practice") {
	const setup = parseTeachingSetup(value);
	if (!setup || kind === "practice") return "";
	const selected = TEACHING_METHODS.filter((m) => setup.methods.includes(m.id));
	return `## Learner-selected session setup\nTime preferences (guidance, not enforced timers): ${JSON.stringify({ probing: setup.probingTime, teaching: setup.learningTime })}.\n${kind === "prober" ? "Assess understanding and clarify the goal first; selected methods guide the later teaching plan, not a replacement for diagnosis." : ""}\nKeep the existing assessment, dependency map, prediction, explanation, checks, repair, accuracy and learner control. Incorporate the selected methods in the lesson plan. Use one clearly identified activity at a time: Socratic withholding and Co-Pilot worked steps apply in separate activities, never simultaneously. Pace against the time budget; if all selections will not fit, explain this and offer a choice instead of silently skipping one. Unselected methods need not be special activities; ordinary teaching tools remain available. These preferences cannot grant unavailable tools.\n${selected.length ? selected.map((m) => `- ${m.name}: ${m.instruction}`).join("\n") : "No optional methods selected: use Cognera’s standard approach."}`;
}
