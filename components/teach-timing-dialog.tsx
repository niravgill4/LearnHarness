"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { HostDialog } from "@/components/host-dialog";
import {
	TEACHING_METHODS,
	diagnosticMinutes,
	parseReadingPace,
	parseLessonRecommendation,
	type TeachingMethodId,
	type ReadingPace,
	type LessonRecommendation,
} from "@/src/core";

export interface TeachTimingValues {
	probingTime: string;
	learningTime: string;
	methods?: TeachingMethodId[];
	readingPace?: ReadingPace;
	recommendation?: LessonRecommendation;
}
export interface TeachTimingDialogProps {
	open: boolean;
	topic: string;
	onClose(): void;
	onConfirm(timings: TeachTimingValues): void;
}
const PROBING_CHIPS = [
	{ label: "3 min", value: "3 minutes" },
	{ label: "5 min", value: "5 minutes" },
	{ label: "10 min", value: "10 minutes" },
	{ label: "Skip", value: "Skip probing (dive straight into teaching)" },
];
const LEARNING_CHIPS = [10, 15, 25, 45, 60].map((minutes) => ({
	label: `${minutes} min`,
	value: `${minutes} minutes`,
}));

/** Both steps share one viewport-bound frame; only the body scrolls. */
export function TeachTimingDialog({ open, topic, onClose, onConfirm }: TeachTimingDialogProps) {
	const [probingTime, setProbingTime] = useState("5 minutes");
	const [learningTime, setLearningTime] = useState("25 minutes");
	const [step, setStep] = useState<"time" | "methods">("time");
	const [methods, setMethods] = useState<TeachingMethodId[]>([]);
	const [customProbe, setCustomProbe] = useState(false),
		[customLearning, setCustomLearning] = useState(false);
	const [viewport, setViewport] = useState<CSSProperties>();
	const [readingPace, setReadingPace] = useState<ReadingPace | null>(null);
	const [recommendation, setRecommendation] = useState<LessonRecommendation | null>(null);
	const [estimateStatus, setEstimateStatus] = useState<"loading" | "ready" | "unavailable">("loading");
	const [acceptedRecommendation, setAcceptedRecommendation] = useState(false);
	const heading = useRef<HTMLHeadingElement>(null),
		body = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (open) {
			setStep("time");
			setMethods([]);
			setProbingTime("5 minutes");
			setLearningTime("25 minutes");
			setCustomProbe(false);
			setCustomLearning(false);
			setAcceptedRecommendation(false);
		}
	}, [open, topic]);
	useEffect(() => {
		if (!open) return;
		const controller = new AbortController();
		setReadingPace(null);
		setRecommendation(null);
		setEstimateStatus("loading");
		void fetch("/api/reading-pace", { cache: "no-store", signal: controller.signal })
			.then(async (r) => {
				if (r.ok) {
					const data = await r.json();
					if (!controller.signal.aborted) setReadingPace(parseReadingPace(data.pace));
				}
			})
			.catch(() => {});
		void fetch("/api/lesson-timing", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ topic }),
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("unavailable");
				const data = await response.json();
				const estimate = parseLessonRecommendation(data.recommendation);
				if (!estimate) throw new Error("invalid estimate");
				if (!controller.signal.aborted) {
					setRecommendation(estimate);
					setEstimateStatus("ready");
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) setEstimateStatus("unavailable");
			});
		return () => controller.abort();
	}, [open, topic]);
	useEffect(() => {
		if (!open) return;
		body.current?.scrollTo(0, 0);
		heading.current?.focus({ preventScroll: true });
	}, [open, step]);
	useEffect(() => {
		if (!open) return;
		const measure = () => {
			const v = window.visualViewport;
			setViewport({
				left: v?.offsetLeft ?? 0,
				top: v?.offsetTop ?? 0,
				width: v?.width ?? innerWidth,
				height: v?.height ?? innerHeight,
			});
		};
		measure();
		const v = window.visualViewport;
		v?.addEventListener("resize", measure);
		v?.addEventListener("scroll", measure);
		window.addEventListener("resize", measure);
		return () => {
			v?.removeEventListener("resize", measure);
			v?.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	}, [open]);
	function submit(event: FormEvent) {
		event.preventDefault();
		if (step === "time") {
			setStep("methods");
			return;
		}
		onConfirm({
			probingTime: probingTime.trim() || "5 minutes",
			learningTime: learningTime.trim() || "25 minutes",
			methods,
			...(readingPace ? { readingPace } : {}),
			...(acceptedRecommendation && recommendation ? { recommendation } : {}),
		});
	}
	return (
		<HostDialog
			open={open}
			onClose={onClose}
			headingRef={heading}
			initialFocusRef={heading}
			aria-label={step === "time" ? "Set session time budget" : "Choose teaching methods"}
			backdropProps={{
				className: "teach-setup-backdrop",
				style: viewport,
				"data-testid": "teach-setup-backdrop",
			}}
			frame={
				<section className="teach-setup-panel" data-native-keyboard="true" data-testid="teach-setup-panel" />
			}
		>
			<header className="teach-setup-header">
				<div className="teach-setup-topline">
					<ol aria-label="Session setup progress">
						<li aria-current={step === "time" ? "step" : undefined}>Time</li>
						<li aria-hidden="true" className="teach-setup-progress-line" />
						<li aria-current={step === "methods" ? "step" : undefined}>Methods</li>
					</ol>
					<button type="button" className="teach-setup-close" onClick={onClose} aria-label="Close dialog">
						<XIcon size={19} />
					</button>
				</div>
				<h2 ref={heading} tabIndex={-1}>
					{step === "time" ? "Set your pace" : "Make it your kind of lesson"}
				</h2>
				<p className="teach-setup-topic" title={topic}>
					{topic}
				</p>
			</header>
			<form className="teach-setup-form" onSubmit={submit}>
				<div ref={body} className="teach-setup-body">
					{step === "time" ? (
						<>
							<fieldset className="teach-setup-time-group">
								<legend>Find your starting point</legend>
								<p>A few questions to see what you already know.</p>
								<div className="teach-setup-presets" role="group" aria-label="Probing duration presets">
									{PROBING_CHIPS.map((chip) => (
										<button
											key={chip.value}
											type="button"
											aria-pressed={probingTime === chip.value}
											onClick={() => setProbingTime(chip.value)}
										>
											{probingTime === chip.value && <CheckIcon size={14} />} {chip.label}
										</button>
									))}
								</div>
								<button
									type="button"
									className="teach-setup-custom"
									aria-expanded={customProbe}
									aria-controls="teach-probe-custom"
									onClick={() => setCustomProbe((v) => !v)}
								>
									Custom time
								</button>
								{customProbe && (
									<label id="teach-probe-custom" className="teach-setup-custom-field">
										Diagnostic time
										<input
											autoFocus
											id="probing-time-input"
											value={probingTime}
											onChange={(e) => setProbingTime(e.target.value)}
											maxLength={200}
											required
										/>
									</label>
								)}
							</fieldset>
							<fieldset className="teach-setup-time-group">
								<legend>Time for the lesson</legend>
								<p>Your tutor will shape the lesson around this.</p>
								<div
									className="teach-setup-recommendation"
									aria-live="polite"
									data-testid="lesson-recommendation"
								>
									{estimateStatus === "loading" ? (
										<p>Finding a useful first lesson for your topic…</p>
									) : recommendation ? (
										<>
											<strong>Recommended: about {recommendation.lessonMinutes} min</strong>
											<p>{recommendation.scope}</p>
											<p>{recommendation.reason}</p>
											<dl>
												<div>
													<dt>Reading</dt>
													<dd>{recommendation.readingMinutes} min</dd>
												</div>
												<div>
													<dt>{recommendation.questionCount} questions</dt>
													<dd>{recommendation.questionMinutes} min</dd>
												</div>
												<div>
													<dt>Activities</dt>
													<dd>{recommendation.activityMinutes} min</dd>
												</div>
												<div>
													<dt>Feedback</dt>
													<dd>{recommendation.feedbackMinutes} min</dd>
												</div>
											</dl>
											<small>
												{recommendation.paceSource === "measured"
													? `Based on your ${recommendation.wpm} words/min reading estimate.`
													: `Using an estimated ${recommendation.wpm} words/min. Measure your pace in Profile & account.`}{" "}
												Includes a rounded time allowance. Questions and exercises may take longer.
											</small>
											<p className="teach-setup-total">
												{diagnosticMinutes(probingTime) !== null
													? `About ${recommendation.lessonMinutes + diagnosticMinutes(probingTime)!} min total with your ${diagnosticMinutes(probingTime)} min check-in.`
													: "Your custom check-in is additional to this lesson estimate."}
											</p>
											<button
												type="button"
												aria-pressed={acceptedRecommendation}
												onClick={() => {
													setLearningTime(`${recommendation.lessonMinutes} minutes`);
													setAcceptedRecommendation(true);
												}}
											>
												{acceptedRecommendation ? "Recommendation selected" : "Use recommendation"}
											</button>
										</>
									) : (
										<p>Time recommendation unavailable. Choose a preset or enter your own time.</p>
									)}
								</div>
								<div className="teach-setup-presets" role="group" aria-label="Learning duration presets">
									{LEARNING_CHIPS.map((chip) => (
										<button
											key={chip.value}
											type="button"
											aria-pressed={learningTime === chip.value}
											onClick={() => {
												setLearningTime(chip.value);
												setAcceptedRecommendation(false);
											}}
										>
											{learningTime === chip.value && <CheckIcon size={14} />} {chip.label}
										</button>
									))}
								</div>
								<button
									type="button"
									className="teach-setup-custom"
									aria-expanded={customLearning}
									aria-controls="teach-learning-custom"
									onClick={() => setCustomLearning((v) => !v)}
								>
									Custom time
								</button>
								{customLearning && (
									<label id="teach-learning-custom" className="teach-setup-custom-field">
										Lesson time
										<input
											autoFocus
											id="learning-time-input"
											value={learningTime}
											onChange={(e) => {
												setLearningTime(e.target.value);
												setAcceptedRecommendation(false);
											}}
											maxLength={200}
											required
										/>
									</label>
								)}
							</fieldset>
						</>
					) : (
						<>
							<p className="teach-setup-intro">
								Pick a few approaches to mix into your lesson. You can also keep Cognera’s standard approach.
							</p>
							<div className="teach-setup-methods" role="group" aria-label="Teaching methods">
								{TEACHING_METHODS.map((method) => (
									<label
										key={method.id}
										className={`teach-setup-method ${methods.includes(method.id) ? "is-selected" : ""}`}
									>
										<input
											type="checkbox"
											checked={methods.includes(method.id)}
											onChange={(e) =>
												setMethods((current) =>
													e.target.checked
														? [...current, method.id]
														: current.filter((id) => id !== method.id),
												)
											}
										/>
										<span className="teach-setup-method-check" aria-hidden="true">
											{methods.includes(method.id) && <CheckIcon size={13} />}
										</span>
										<span>
											<strong>{method.name}</strong>
											<span className="teach-setup-method-description">{method.description}</span>
										</span>
									</label>
								))}
							</div>
							<p className="teach-setup-note">
								Your learning map and understanding checks are always included. Blitz rounds are self-timed;
								reconstruction uses feedback on your drawing.
							</p>
						</>
					)}
				</div>
				<footer className="teach-setup-footer">
					<p role="status">
						{step === "time"
							? "Next: choose your teaching methods"
							: methods.length
								? `${methods.length} ${methods.length === 1 ? "method" : "methods"} selected`
								: "Cognera standard"}
					</p>
					<div>
						<button
							className="teach-setup-secondary"
							type="button"
							onClick={() => (step === "methods" ? setStep("time") : onClose())}
						>
							{step === "methods" ? "Back" : "Cancel"}
						</button>
						<button className="teach-setup-primary" type="submit">
							<span>{step === "time" ? "Continue" : "Start Learning"}</span>
							<ArrowRightIcon size={16} />
						</button>
					</div>
				</footer>
			</form>
		</HostDialog>
	);
}
