/** Shared, versioned calibration and lesson-budget vocabulary. No browser or IO dependencies. */
export const READING_PASSAGE = {
	id: "small-city-garden-v1",
	title: "A small change in the city",
	text: `On a quiet street, a group of neighbours turned an empty corner into a small garden. At first, they planned only to grow herbs for their kitchens. They brought a few pots, filled them with soil, and agreed to take turns watering. Within a month, the corner looked different, but something less visible had changed too.

People who had passed one another for years began to stop and talk. One neighbour knew which plants could survive in shade. Another could repair the broken wooden bench. A child suggested leaving a shallow dish of water for birds. Each contribution made the space more useful without requiring anyone to plan the whole garden alone.

The group also learned through small experiments. When some leaves began to fade, they moved one pot into brighter light and left another where it was. Comparing the two helped them decide what to change next. A failed planting became information rather than a reason to give up.

By autumn, the garden was still modest. It could not feed the street, and it needed regular care. Yet it gave the neighbours a shared place to notice, question, and improve things together. Its value came from both what grew there and the habits people built around it.`,
} as const;
export const DEFAULT_READING_WPM = 250;
export function countReadingWords(text: string): number {
	return text.trim().match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
export const READING_WORD_COUNT = countReadingWords(READING_PASSAGE.text);
export interface ReadingPace {
	version: 1;
	passageId: string;
	wordCount: number;
	elapsedMs: number;
	wpm: number;
	measuredAt: string;
}
export function measureReadingPace(
	passageId: unknown,
	elapsedMs: unknown,
	now = new Date(),
): ReadingPace | null {
	if (passageId !== READING_PASSAGE.id || typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs))
		return null;
	const duration = Math.round(elapsedMs);
	const wpm = Math.round((READING_WORD_COUNT * 60000) / duration);
	// An accidental tap or a long interruption cannot become a calibration.
	if (duration < 15000 || duration > 20 * 60000 || wpm < 30 || wpm > 900) return null;
	return {
		version: 1,
		passageId,
		wordCount: READING_WORD_COUNT,
		elapsedMs: duration,
		wpm,
		measuredAt: now.toISOString(),
	};
}
export function parseReadingPace(value: unknown): ReadingPace | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	if (v.version !== 1 || typeof v.measuredAt !== "string" || !Number.isFinite(Date.parse(v.measuredAt)))
		return null;
	const result = measureReadingPace(v.passageId, v.elapsedMs, new Date(v.measuredAt));
	return result && result.wordCount === v.wordCount && result.wpm === v.wpm ? result : null;
}
export interface LessonScope {
	scope: string;
	reason: string;
	explanationWords: number;
	questionCount: number;
	questionMinutes: number;
	activityMinutes: number;
	feedbackMinutes: number;
}
export interface LessonRecommendation extends LessonScope {
	version: 1;
	wpm: number;
	paceSource: "measured" | "estimated";
	readingMinutes: number;
	lessonMinutes: number;
}
const finite = (v: unknown, min: number, max: number): v is number =>
	typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function parseLessonScope(value: unknown): LessonScope | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	if (
		typeof v.scope !== "string" ||
		!v.scope.trim() ||
		v.scope.length > 300 ||
		typeof v.reason !== "string" ||
		!v.reason.trim() ||
		v.reason.length > 500 ||
		!finite(v.explanationWords, 150, 12000) ||
		!Number.isInteger(v.explanationWords) ||
		!finite(v.questionCount, 1, 20) ||
		!Number.isInteger(v.questionCount) ||
		!finite(v.questionMinutes, 1, 45) ||
		!finite(v.activityMinutes, 0, 30) ||
		!finite(v.feedbackMinutes, 1, 30)
	)
		return null;
	return {
		scope: v.scope.trim(),
		reason: v.reason.trim(),
		explanationWords: v.explanationWords,
		questionCount: v.questionCount,
		questionMinutes: v.questionMinutes,
		activityMinutes: v.activityMinutes,
		feedbackMinutes: v.feedbackMinutes,
	};
}
export function budgetLesson(scope: LessonScope, pace: ReadingPace | null): LessonRecommendation {
	const wpm = pace?.wpm ?? DEFAULT_READING_WPM;
	const readingMinutes = Math.ceil((scope.explanationWords / wpm) * 10) / 10;
	const total = readingMinutes + scope.questionMinutes + scope.activityMinutes + scope.feedbackMinutes;
	return {
		...scope,
		version: 1,
		wpm,
		paceSource: pace ? "measured" : "estimated",
		readingMinutes,
		lessonMinutes: Math.max(5, Math.ceil(total / 5) * 5),
	};
}
export function parseLessonRecommendation(value: unknown): LessonRecommendation | null {
	const scope = parseLessonScope(value);
	if (!scope) return null;
	const v = value as Record<string, unknown>;
	if (
		v.version !== 1 ||
		!finite(v.wpm, 30, 900) ||
		!["measured", "estimated"].includes(v.paceSource as string)
	)
		return null;
	const expected = budgetLesson(scope, v.paceSource === "measured" ? ({ wpm: v.wpm } as ReadingPace) : null);
	return expected.wpm === v.wpm &&
		expected.readingMinutes === v.readingMinutes &&
		expected.lessonMinutes === v.lessonMinutes
		? expected
		: null;
}
/** Custom prose budgets remain valid; only explicit minutes can be totaled in the UI. */
export function diagnosticMinutes(value: string): number | null {
	if (/^skip/i.test(value.trim())) return 0;
	const match = /^(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)$/i.exec(value.trim());
	return match && Number(match[1]) <= 120 ? Number(match[1]) : null;
}
