"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { HostDialog } from "@/components/host-dialog";
import { TEACHING_METHODS, type TeachingMethodId } from "@/src/core";

export interface TeachTimingValues {
	probingTime: string;
	learningTime: string;
	methods?: TeachingMethodId[];
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
		}
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
								<div className="teach-setup-presets" role="group" aria-label="Learning duration presets">
									{LEARNING_CHIPS.map((chip) => (
										<button
											key={chip.value}
											type="button"
											aria-pressed={learningTime === chip.value}
											onClick={() => setLearningTime(chip.value)}
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
											onChange={(e) => setLearningTime(e.target.value)}
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
