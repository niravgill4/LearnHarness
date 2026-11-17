"use client";

import { useRef, useState, useEffect } from "react";
import { HostDialog } from "@/components/host-dialog";
import { ClockIcon, HelpCircleIcon, SparklesIcon, CheckIcon } from "lucide-react";
import { TEACHING_METHODS, type TeachingMethodId } from "@/src/core";

export interface TeachTimingValues {
	probingTime: string;
	learningTime: string;
	methods?: TeachingMethodId[];
}

export interface TeachTimingDialogProps {
	open: boolean;
	topic: string;
	onClose: () => void;
	onConfirm: (timings: TeachTimingValues) => void;
}

const PROBING_CHIPS = [
	{ label: "3 mins", value: "3 minutes" },
	{ label: "5 mins (Recommended)", value: "5 minutes" },
	{ label: "10 mins", value: "10 minutes" },
	{ label: "Skip probing", value: "Skip probing (dive straight into teaching)" },
];

const LEARNING_CHIPS = [
	{ label: "10 mins", value: "10 minutes" },
	{ label: "15 mins", value: "15 minutes" },
	{ label: "25 mins (Pomodoro)", value: "25 minutes" },
	{ label: "45 mins", value: "45 minutes" },
	{ label: "60 mins", value: "60 minutes" },
];

export function TeachTimingDialog({ open, topic, onClose, onConfirm }: TeachTimingDialogProps) {
	const [probingTime, setProbingTime] = useState("5 minutes");
	const [learningTime, setLearningTime] = useState("25 minutes");
	const [step, setStep] = useState<"time" | "methods">("time");
	const [methods, setMethods] = useState<TeachingMethodId[]>([]);
	const methodFocusRef = useRef<HTMLHeadingElement>(null);
	const initialFocusRef = useRef<HTMLInputElement>(null);

	// Reset to defaults when dialog opens with a new topic
	useEffect(() => {
		if (open) {
			setStep("time");
			setMethods([]);
			setProbingTime("5 minutes");
			setLearningTime("25 minutes");
		}
	}, [open, topic]);
	useEffect(() => {
		if (open) (step === "methods" ? methodFocusRef.current : initialFocusRef.current)?.focus();
	}, [open, step]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (step === "time") {
			setStep("methods");
			return;
		}
		onConfirm({
			probingTime: probingTime.trim() || "5 minutes",
			learningTime: learningTime.trim() || "25 minutes",
			methods,
		});
	};

	return (
		<HostDialog
			open={open}
			onClose={onClose}
			initialFocusRef={initialFocusRef}
			aria-label={step === "time" ? "Set session time budget" : "Choose teaching methods"}
		>
			<div
				role="dialog"
				aria-modal="true"
				className="w-[36rem] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl text-foreground font-ui"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Dialog Header */}
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary mb-2">
							<SparklesIcon className="size-3.5" aria-hidden="true" />
							Teach Session Setup
						</div>
						<h2
							ref={methodFocusRef}
							tabIndex={-1}
							className="text-lg font-semibold tracking-tight text-foreground"
						>
							{step === "time" ? "Plan Your Teach Session" : "How would you like to learn?"}
						</h2>
						{topic && (
							<p className="mt-1 text-sm font-medium text-muted-foreground line-clamp-1">
								Topic: <span className="text-foreground">“{topic}”</span>
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close dialog"
						className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
					>
						✕
					</button>
				</div>

				<form onSubmit={handleSubmit} className="mt-6 space-y-6">
					{step === "time" ? (
						<>
							{/* Question 1: Testing Understanding (Probing) */}
							<div className="space-y-2.5 rounded-xl border border-border/70 bg-accent/20 p-4">
								<div className="flex items-center justify-between gap-2">
									<label
										htmlFor="probing-time-input"
										className="text-sm font-semibold text-foreground flex items-center gap-1.5"
									>
										<HelpCircleIcon className="size-4 text-emerald-500 shrink-0" aria-hidden="true" />
										1. Testing your understanding first (Probing)
									</label>
									<span className="text-[11px] font-medium text-muted-foreground">Diagnostic</span>
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									How long do you want to spend testing what you already know and catching misconceptions
									before the lesson begins?
								</p>

								{/* Quick chips */}
								<div
									className="flex flex-wrap gap-1.5 pt-1"
									role="group"
									aria-label="Probing duration presets"
								>
									{PROBING_CHIPS.map((chip) => {
										const active = probingTime === chip.value;
										return (
											<button
												key={chip.value}
												type="button"
												onClick={() => setProbingTime(chip.value)}
												className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
													active
														? "bg-primary text-primary-foreground shadow-sm"
														: "bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground/40"
												}`}
											>
												{active && <CheckIcon className="size-3" aria-hidden="true" />}
												{chip.label}
											</button>
										);
									})}
								</div>

								{/* Text input */}
								<div className="pt-1.5">
									<input
										id="probing-time-input"
										ref={initialFocusRef}
										type="text"
										value={probingTime}
										onChange={(e) => setProbingTime(e.target.value)}
										placeholder="e.g. 5 minutes, 3 quick questions"
										className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
										required
									/>
								</div>
							</div>

							{/* Question 2: Learning & Explanations (Teaching) */}
							<div className="space-y-2.5 rounded-xl border border-border/70 bg-accent/20 p-4">
								<div className="flex items-center justify-between gap-2">
									<label
										htmlFor="learning-time-input"
										className="text-sm font-semibold text-foreground flex items-center gap-1.5"
									>
										<ClockIcon className="size-4 text-blue-500 shrink-0" aria-hidden="true" />
										2. Deep learning & explanations (Teaching)
									</label>
									<span className="text-[11px] font-medium text-muted-foreground">Core Lesson</span>
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									How much time do you want to spend learning? Your tutor will calibrate derivations, visual
									explanations, and whiteboard exercises to fit this window.
								</p>

								{/* Quick chips */}
								<div
									className="flex flex-wrap gap-1.5 pt-1"
									role="group"
									aria-label="Learning duration presets"
								>
									{LEARNING_CHIPS.map((chip) => {
										const active = learningTime === chip.value;
										return (
											<button
												key={chip.value}
												type="button"
												onClick={() => setLearningTime(chip.value)}
												className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
													active
														? "bg-primary text-primary-foreground shadow-sm"
														: "bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground/40"
												}`}
											>
												{active && <CheckIcon className="size-3" aria-hidden="true" />}
												{chip.label}
											</button>
										);
									})}
								</div>

								{/* Text input */}
								<div className="pt-1.5">
									<input
										id="learning-time-input"
										type="text"
										value={learningTime}
										onChange={(e) => setLearningTime(e.target.value)}
										placeholder="e.g. 25 minutes, 45 mins, 1 hour"
										className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
										required
									/>
								</div>
							</div>

							{/* Actions Footer */}
						</>
					) : (
						<div className="space-y-3">
							<p className="text-sm text-muted-foreground">
								Choose any combination. Cognera’s assessment, learning map, explanations, and understanding
								checks are always included.
							</p>
							<div role="group" aria-label="Teaching methods" className="grid gap-2 sm:grid-cols-2">
								{TEACHING_METHODS.map((method) => (
									<label
										key={method.id}
										className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${methods.includes(method.id) ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}
									>
										<input
											type="checkbox"
											className="mt-1 size-4 shrink-0 accent-current"
											checked={methods.includes(method.id)}
											onChange={(e) =>
												setMethods((current) =>
													e.target.checked
														? [...current, method.id]
														: current.filter((id) => id !== method.id),
												)
											}
										/>
										<span>
											<span className="block text-sm font-medium">{method.name}</span>
											<span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
												{method.description}
											</span>
										</span>
									</label>
								))}
							</div>
							<p role="status" className="text-xs text-muted-foreground">
								{methods.length
									? `${methods.length} selected · Your tutor will blend these into your lesson.`
									: "No optional methods selected · Use Cognera’s standard approach."}
							</p>
							<p className="text-xs text-muted-foreground">
								Reconstruction uses tutor feedback on your submitted drawing. Blitz time targets are
								self-timed.
							</p>
						</div>
					)}
					<div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-border bg-card py-3">
						<button
							type="button"
							onClick={() => (step === "methods" ? setStep("time") : onClose())}
							className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
						>
							{step === "methods" ? "Back" : "Cancel"}
						</button>
						<button
							type="submit"
							className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all active:scale-[0.98]"
						>
							<span>{step === "time" ? "Continue" : "Start Learning"}</span>
							<span>→</span>
						</button>
					</div>
				</form>
			</div>
		</HostDialog>
	);
}
