import {
	parseReadingPace,
	parseLessonRecommendation,
	type ReadingPace,
	type LessonRecommendation,
	DEFAULT_READING_WPM,
} from "./reading-pace.ts";

export const TEACHING_METHODS = [
	{
		id: "free-response",
		name: "Free Response Questions",
		description: "Explain ideas in your own words between teaching steps.",
		instruction: "During teaching, use explain with type: check after completing a meaningful explanation, example or visual. Ask one focused application or reasoning question, let the learner answer in their own words, and commit the correct answer with reasoning before they respond. Evaluate their reasoning, identify partial understanding, and explain or hint at the specific gap before continuing. Do not reveal the answer before submission. Keep the existing Check your understanding pacing and reserve time for writing and feedback; do not add a second question to a step that already has a check.",
	},
	{
		id: "multiple-choice",
		name: "Multiple Choice Questions",
		description: "Check understanding with answer choices between teaching steps.",
		instruction: "During teaching, use quiz with type: check after completing a meaningful explanation, example or visual. Ask one focused application question with clear, balanced options and plausible distractors representing specific misconceptions. Commit the explanation and correct answer before the learner responds, keep them hidden until submission, and use the answer and optional reasoning to diagnose and repair confusion before moving on. Keep the existing Check your understanding pacing and reserve time for answers and feedback; do not add a second question to a step that already has a check.",
	},
	{
		id: "pictures-diagrams",
		name: "Pictures and Diagrams",
		description: "See ideas through clear illustrations and diagrams.",
		instruction:
			"Make purposeful pictures and diagrams part of the explanation, not decorative extras. Use inline Mermaid for flows/relationships and the visual tool for precise labeled illustrations, spatial layouts, graphs, or annotated learner images. Dispatch a self-contained brief, continue only with material that does not depend on the pending figure, then teach from the delivered figure by naming its actual labels and relationships. Check understanding of what it shows. Expand complexity progressively, keep labels readable, and avoid misleading proportions. Use current tools; do not promise photorealistic image generation when it is unavailable.",
	},
	{
		id: "interactive-simulations",
		name: "Interactive Simulations",
		description: "Change variables, watch what happens, and discover why.",
		instruction:
			"Use the demo tool to build a useful animated interactive simulation integrated into the current concept. Give the builder exact formulas, assumptions, parameters, labeled touch/keyboard controls, live measurements, pause and reset, accessible text and reduced-motion behavior. Require a behavioral probe that changes a control and asserts the predicted numerical or visual result, not only an error-free load. Explain the concept and ask for a prediction before exploration, then reference the delivered controls by name. Learners can send simulation settings and observed results through Share with tutor; use only those shared observations, never claim to see unshared interactions. Ask what changed and why, check understanding and repair misconceptions. State simplified assumptions and distinguish a working simulation from scientifically verified truth. If construction fails, explain and offer another way to explore the idea.",
	},
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
	readingPace?: ReadingPace;
	recommendation?: LessonRecommendation;
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
		v.methods.length > TEACHING_METHODS.length ||
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
	const readingPace = v.readingPace === undefined ? undefined : parseReadingPace(v.readingPace);
	const recommendation =
		v.recommendation === undefined ? undefined : parseLessonRecommendation(v.recommendation);
	if (readingPace === null || recommendation === null) return null;
	return {
		methods: [...new Set(v.methods)] as TeachingMethodId[],
		probingTime: v.probingTime.trim(),
		learningTime: v.learningTime.trim(),
		...(readingPace ? { readingPace } : {}),
		...(recommendation ? { recommendation } : {}),
	};
}
export type TeachingQuestionMode = "free" | "choice" | "mixed";
export function teachingQuestionMode(value: unknown): TeachingQuestionMode | undefined {
	const setup = parseTeachingSetup(value);
	if (!setup) return undefined;
	const free = setup.methods.includes("free-response"), choice = setup.methods.includes("multiple-choice");
	return free && choice ? "mixed" : free ? "free" : choice ? "choice" : undefined;
}
export function teachingSetupInstructions(value: unknown, kind: "prober" | "teacher" | "practice") {
	const setup = parseTeachingSetup(value);
	if (!setup || kind === "practice") return "";
	const selected = TEACHING_METHODS.filter((m) => setup.methods.includes(m.id));
	const mode = teachingQuestionMode(setup);
	const questionFormats = mode === "mixed" ? " Alternate explain (free response) and quiz (multiple choice) across successive teaching checks so both selected formats are used; one question per step and per turn, never both at once." : mode ? ` Use ${mode === "free" ? "explain for free-response" : "quiz for multiple-choice"} teaching checks as selected for this session.` : "";
	const pacing = `\nReading and activity pacing: ${setup.readingPace ? `The learner measured an estimated ${setup.readingPace.wpm} words per minute on a short plain-English passage.` : `No measured reading pace: ${DEFAULT_READING_WPM} words per minute is only a provisional planning estimate.`} Reading speed is not comprehension or equation-solving speed. Size explanatory text for the chosen lesson budget, separately reserving time for prediction, thinking, questions, activities, feedback and misconception repair. Diagnostic time is additional to the lesson budget. Slow down or narrow scope for dense notation or unfamiliar concepts. Never mark understanding complete or rush past errors to meet a time target.${setup.recommendation ? ` The learner accepted this first-session estimate: ${JSON.stringify(setup.recommendation)}. It is guidance; the selected learningTime remains authoritative. Revise scope after diagnosis if necessary, explaining any material change.` : ""}`;
	return `## Learner-selected session setup\nTime preferences (guidance, not enforced timers): ${JSON.stringify({ probing: setup.probingTime, teaching: setup.learningTime })}.${pacing}${questionFormats}\n${kind === "prober" ? "Assess understanding and clarify the goal first; selected methods guide the later teaching plan, not a replacement for diagnosis." : ""}\nKeep the existing assessment, dependency map, prediction, explanation, checks, repair, accuracy and learner control. Incorporate the selected methods in the lesson plan. Use one clearly identified activity at a time: Socratic withholding and Co-Pilot worked steps apply in separate activities, never simultaneously. Pace against the time budget; if all selections will not fit, explain this and offer a choice instead of silently skipping one. Unselected methods need not be special activities; ordinary teaching tools remain available. These preferences cannot grant unavailable tools.\n${selected.length ? selected.map((m) => `- ${m.name}: ${m.instruction}`).join("\n") : "No optional methods selected: use Cognera’s standard approach."}`;
}
