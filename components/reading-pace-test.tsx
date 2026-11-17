"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import {
	measureReadingPace,
	parseReadingPace,
	READING_PASSAGE,
	READING_WORD_COUNT,
	type ReadingPace,
} from "@/src/core";

export function ReadingPaceTest({
	onContinue,
	allowSkip = false,
}: {
	onContinue?: () => void;
	allowSkip?: boolean;
}) {
	const [phase, setPhase] = useState<"intro" | "reading" | "result" | "saved">("intro");
	const [pace, setPace] = useState<ReadingPace | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const start = useRef<number | null>(null);
	const passage = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const controller = new AbortController();
		void fetch("/api/reading-pace", { cache: "no-store", signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error("Your saved reading pace could not be loaded.");
				const data = await response.json();
				if (controller.signal.aborted) return;
				const saved = parseReadingPace(data.pace);
				if (saved) {
					setPace(saved);
					setPhase("saved");
				}
			})
			.catch((cause) => {
				if (!controller.signal.aborted) setError(cause.message);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, []);
	useEffect(() => {
		if (phase !== "reading") return;
		const tick = window.setInterval(() => {
			if (start.current !== null) setElapsed(performance.now() - start.current);
		}, 200);
		const interrupt = () => {
			if (!document.hidden) return;
			start.current = null;
			setPhase("intro");
			setElapsed(0);
			setError(
				"Your reading was interrupted. Start again when you’re ready; that attempt hasn’t been saved.",
			);
		};
		document.addEventListener("visibilitychange", interrupt);
		return () => {
			clearInterval(tick);
			document.removeEventListener("visibilitychange", interrupt);
		};
	}, [phase]);
	function begin() {
		setError("");
		setElapsed(0);
		start.current = performance.now();
		setPhase("reading");
		requestAnimationFrame(() => {
			passage.current?.focus({ preventScroll: true });
			passage.current?.scrollIntoView({ block: "center" });
		});
	}
	function finish() {
		if (start.current === null) return;
		const duration = performance.now() - start.current;
		start.current = null;
		setElapsed(duration);
		const measured = measureReadingPace(READING_PASSAGE.id, duration);
		if (!measured) {
			setError(
				"That attempt was too short or too long to estimate your pace. Read the full passage at your normal pace and try again.",
			);
			setPhase("intro");
			return;
		}
		setPace(measured);
		setPhase("result");
	}
	async function save() {
		if (!pace) return;
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/reading-pace", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ passageId: pace.passageId, elapsedMs: pace.elapsedMs }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Your reading pace could not be saved.");
			const saved = parseReadingPace(data.pace);
			if (!saved) throw new Error("Your reading pace could not be confirmed. Please retry.");
			setPace(saved);
			setPhase("saved");
			onContinue?.();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Your reading pace could not be saved.");
		} finally {
			setBusy(false);
		}
	}
	const seconds = Math.floor(elapsed / 1000);
	return (
		<div className="reading-pace" data-testid="reading-pace-test" data-native-keyboard="true">
			{loading ? (
				<p role="status" className="reading-pace-muted">
					Loading your reading preferences…
				</p>
			) : (
				<>
					{phase === "intro" && (
						<>
							<p className="reading-pace-muted">
								Read a short passage at your normal pace. This helps us leave the right amount of room for
								explanations, questions, and practice.
							</p>
							<div className="reading-pace-preview">
								<span>One short read</span>
								<strong>{READING_WORD_COUNT} words</strong>
								<p>No countdown. No speed target. Start when you’re ready.</p>
							</div>
							<button type="button" className="reading-pace-primary" onClick={begin}>
								Start reading
								<ArrowRightIcon size={16} />
							</button>
						</>
					)}
					{phase === "reading" && (
						<>
							<div className="reading-pace-timer">
								<span>Read at your own pace</span>
								<time aria-label="Elapsed reading time">
									{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
								</time>
							</div>
							<div ref={passage} tabIndex={-1} className="reading-pace-passage" aria-label="Reading passage">
								<h3>{READING_PASSAGE.title}</h3>
								{READING_PASSAGE.text.split("\n\n").map((p, i) => (
									<p key={i}>{p}</p>
								))}
							</div>
							<button type="button" className="reading-pace-primary" onClick={finish}>
								Finished reading
								<CheckIcon size={16} />
							</button>
						</>
					)}
					{(phase === "result" || phase === "saved") && pace && (
						<>
							<div className="reading-pace-result" role="status">
								<span>Estimated reading pace</span>
								<p>
									<strong>{pace.wpm}</strong> words / min
								</p>
								<small>
									{pace.wordCount} words in {Math.round(pace.elapsedMs / 1000)} seconds
									{phase === "saved" ? " · Saved to your account" : ""}
								</small>
							</div>
							<p className="reading-pace-muted">
								A starting point, not a score. New ideas and equations can take longer. We’ll allow time for
								thinking, answering, and feedback too.
							</p>
							{phase === "result" ? (
								<button
									type="button"
									className="reading-pace-primary"
									onClick={() => void save()}
									disabled={busy}
								>
									{busy ? "Saving your pace…" : "Use this pace"}
									<ArrowRightIcon size={16} />
								</button>
							) : (
								onContinue && (
									<button type="button" className="reading-pace-primary" onClick={onContinue}>
										Continue
										<ArrowRightIcon size={16} />
									</button>
								)
							)}
							<button type="button" className="reading-pace-secondary" onClick={begin} disabled={busy}>
								<RotateCcwIcon size={14} /> {phase === "saved" ? "Measure again" : "Try again"}
							</button>
						</>
					)}
					{error && (
						<p className="reading-pace-error" role="alert">
							{error}
						</p>
					)}
					{allowSkip && (
						<button type="button" className="reading-pace-secondary" disabled={busy} onClick={onContinue}>
							Skip for now
						</button>
					)}
				</>
			)}
		</div>
	);
}
