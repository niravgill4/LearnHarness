"use client";

import { useEffect, useRef, useState } from "react";
import {
	ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CheckIcon, GitBranchIcon, PencilIcon, PlayIcon, RotateCcwIcon,
} from "lucide-react";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

const slides = [
	{
		label: "Why Cognera",
		title: "Build understanding, one step at a time.",
		description: "Start with what you know, learn the next idea, then apply it. Cognera uses your answers to decide what to explain next and connects what you learn in a knowledge map.",
	},
	{
		label: "Teach",
		title: "Shape the lesson around you.",
		description: "Set your time budget and mix teaching methods. Ask for pictures and diagrams, then check what clicked with free-response or multiple-choice questions.",
	},
	{
		label: "Simulations",
		title: "Change something. See what happens.",
		description: "Try a controlled experiment inside a lesson. Change a variable, compare the results, and share what you observed with your tutor.",
	},
	{
		label: "Notebook & Practice",
		title: "Turn your notes into practice.",
		description: "Type notes or write with Apple Pencil, then start a practice session from a page. Work out an answer by hand and get feedback on where your reasoning went wrong.",
	},
	{
		label: "Knowledge",
		title: "See how your ideas connect.",
		description: "Explore the concepts and relationships from your lessons. Revisit a connection or use it as a starting point for your next session.",
	},
] as const;

function LearningCycle() {
	return <ol className="tour-cycle">
		<li className="tour-reveal"><span className="tour-cycle-mark">1</span><div><strong>Find your starting point</strong><p>What do you already know about acceleration?</p></div></li>
		<li className="tour-reveal"><span className="tour-cycle-mark">2</span><div><strong>Learn the next idea</strong><p>Acceleration describes how velocity changes over time.</p></div></li>
		<li className="tour-reveal"><span className="tour-cycle-mark">3</span><div><strong>Check and adapt</strong><p>A ball turning a corner changes velocity even at the same speed.</p></div></li>
	</ol>;
}

function TeachingPreview() {
	const [choice, setChoice] = useState<"yes" | "no" | null>(null);
	return <div className="tour-lesson">
		<div className="tour-lesson-methods tour-reveal"><span><CheckIcon /> Pictures and Diagrams</span><span><CheckIcon /> Multiple Choice Questions</span></div>
		<div className="tour-lesson-diagram tour-reveal" aria-label="At the top of the arc, velocity points right and gravity points down" role="img">
			<span className="tour-velocity">Velocity <ArrowRightIcon /></span>
			<span className="tour-lesson-ball" />
			<span className="tour-gravity">↓ Gravity</span>
		</div>
		<fieldset className="tour-question tour-reveal">
			<legend>At the top of its arc, is the ball still accelerating?</legend>
			{(["yes", "no"] as const).map(answer =>
				<button key={answer} type="button" aria-pressed={choice === answer} onClick={() => setChoice(answer)}>{answer === "yes" ? "Yes" : "No"}</button>
			)}
		</fieldset>
		<p className="tour-result" aria-live="polite">{choice === "yes" ? "Correct. Gravity still accelerates the ball downward." : choice === "no" ? "The upward velocity reaches zero. Gravity still acts downward." : "Choose an answer to see the feedback."}</p>
	</div>;
}

function SimulationPreview() {
	const [angle, setAngle] = useState(35);
	const [run, setRun] = useState(0);
	const canvas = useRef<HTMLCanvasElement>(null);
	const reduced = useReducedMotionPreference();
	const radians = angle * Math.PI / 180;
	const distance = 12 ** 2 * Math.sin(2 * radians) / 9.81;

	useEffect(() => {
		const surface = canvas.current;
		const ctx = surface?.getContext("2d");
		if (!surface || !ctx) return;
		const { width, height } = surface;
		const floor = height - 28;
		const margin = 26;
		const scale = (width - 2 * margin) / 16;
		const flight = 2 * 12 * Math.sin(radians) / 9.81;
		const point = (t: number) => [
			margin + 12 * Math.cos(radians) * t * scale,
			floor - (12 * Math.sin(radians) * t - 9.81 * t * t / 2) * scale,
		] as const;
		const start = performance.now();
		let frame = 0;
		function draw(now: number) {
			if (!ctx) return;
			const progress = reduced ? 1 : Math.min(1, (now - start) / 1050);
			ctx.clearRect(0, 0, width, height);
			ctx.lineWidth = 1;
			ctx.strokeStyle = "#34453a";
			for (let x = margin; x <= width; x += scale * 2) {
				ctx.beginPath();
				ctx.moveTo(x, 12); ctx.lineTo(x, floor); ctx.stroke();
			}
			ctx.beginPath();
			ctx.moveTo(margin, floor); ctx.lineTo(width - margin, floor); ctx.stroke();
			ctx.strokeStyle = "#b9d9b1";
			ctx.lineWidth = 2.5;
			ctx.beginPath();
			for (let i = 0; i <= 40; i++) ctx.lineTo(...point(flight * progress * i / 40));
			ctx.stroke();
			ctx.beginPath();
			ctx.fillStyle = "#e1efd9";
			ctx.arc(...point(flight * progress), 5, 0, Math.PI * 2);
			ctx.fill();
			if (progress < 1) frame = requestAnimationFrame(draw);
		}
		draw(start);
		return () => cancelAnimationFrame(frame);
	}, [radians, reduced, run]);

	return <div className="tour-simulation">
		<div className="tour-sim-heading"><strong>Ball trajectory</strong><span>Launch speed 12 m/s · no air resistance</span></div>
		<canvas ref={canvas} width={560} height={224} role="img" aria-label={`At ${angle} degrees, the ball lands ${distance.toFixed(1)} meters away.`} />
		<div className="tour-sim-controls">
			<label>Launch angle <output>{angle}°</output><input type="range" min={15} max={60} value={angle} onChange={event => setAngle(Number(event.target.value))} /></label>
			<button className="tour-icon" type="button" aria-label="Replay trajectory" onClick={() => setRun(value => value + 1)}><PlayIcon size={17} /></button>
		</div>
		<p className="tour-result" aria-live="polite">Distance <strong>{distance.toFixed(1)} m</strong></p>
	</div>;
}

function NotebookPreview() {
	const [practicing, setPracticing] = useState(false);
	const [reviewed, setReviewed] = useState(false);
	return <div className="tour-notebook">
		<div className="tour-notebook-tabs"><span><BookOpenIcon /> Physics</span><span>{practicing ? "Practice from note" : "Motion notes"}</span></div>
		<div className="tour-paper" key={String(practicing)}>
			<p className="tour-reveal">{practicing ? "A 6 N force acts on a 2 kg ball. Find its acceleration." : "Newton’s second law"}</p>
			<p className="tour-ink tour-reveal">F = ma</p>
			<p className="tour-ink tour-reveal">{practicing ? "a = 6 ÷ 2 = 3 m/s²" : "a = F ÷ m"}</p>
		</div>
		<p className="tour-result" aria-live="polite">{reviewed ? "Correct. You isolated acceleration and included the right units." : practicing ? "Sample handwritten answer" : "Generate a question from this sample note."}</p>
		{!reviewed && <button className="tour-demo-action" type="button" onClick={() => practicing ? setReviewed(true) : setPracticing(true)}><PencilIcon />{practicing ? "Review this answer" : "Practice from this note"}</button>}
	</div>;
}

const concepts = [
	{ title: "Net force", detail: "Add the forces acting on an object to find its net force." },
	{ title: "Acceleration", detail: "Net force divided by mass determines acceleration." },
	{ title: "Velocity", detail: "Acceleration changes an object’s velocity over time." },
] as const;

function KnowledgePreview() {
	const [selected, setSelected] = useState(1);
	return <div className="tour-map">
		<div className="tour-map-graph" role="group" aria-label="Connected concepts">
			{concepts.map((concept, index) => <button className="tour-reveal" key={concept.title} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
				{concept.title}{index < concepts.length - 1 && <ArrowRightIcon className="tour-map-edge" aria-hidden="true" />}
			</button>)}
		</div>
		<div className="tour-map-detail" aria-live="polite"><GitBranchIcon /><p>{concepts[selected]?.detail}</p></div>
	</div>;
}

const previews = [LearningCycle, TeachingPreview, SimulationPreview, NotebookPreview, KnowledgePreview] as const;

export function FeatureTour({ slide, onSlideChange, onBack, onDone }: {
	slide: number;
	onSlideChange: (index: number) => void;
	onBack: () => void;
	onDone: () => void;
}) {
	const [replay, setReplay] = useState(0);
	const heading = useRef<HTMLHeadingElement>(null);
	const reduced = useReducedMotionPreference();
	const item = slides[slide]!;
	const Preview = previews[slide]!;
	const last = slide === slides.length - 1;

	useEffect(() => {
		heading.current?.focus({ preventScroll: true });
		heading.current?.closest(".onboarding-form-area")?.scrollTo({ top: 0 });
		heading.current?.closest(".onboarding-page")?.scrollTo({ top: 0 });
	}, [slide]);

	return <section className="onboarding-tour" aria-labelledby="tour-title" data-native-keyboard="true">
		<div className="tour-toolbar">
			<button className="onboarding-back" type="button" onClick={() => slide === 0 ? onBack() : onSlideChange(slide - 1)}><ArrowLeftIcon />Back</button>
			<button className="tour-quiet" type="button" onClick={onDone}>Skip tour</button>
		</div>
		<div className="tour-copy" key={slide}>
			<h2 id="tour-title" ref={heading} tabIndex={-1}>{item.title}</h2>
			<p>{item.description}</p>
		</div>
		<div className="tour-demo">
			<div className="tour-demo-header"><span>{item.label}</span><span>{slide === 0 ? "Lesson preview" : "Interactive preview"}</span>
				{!reduced && Preview !== SimulationPreview && <button className="tour-icon" type="button" aria-label="Replay preview" onClick={() => setReplay(value => value + 1)}><RotateCcwIcon size={15} /></button>}
			</div>
			<div className="tour-demo-content" key={`${slide}-${replay}`}><Preview /></div>
		</div>
		<div className="tour-footer">
			<nav aria-label="Tour slides" className="tour-pagination">
				{slides.map(({ label }, index) => <button key={label} type="button" aria-label={label} aria-current={slide === index ? "step" : undefined} onClick={() => onSlideChange(index)} />)}
			</nav>
			<button className="onboarding-primary" type="button" onClick={() => last ? onDone() : onSlideChange(slide + 1)}>{last ? "Set your first goal" : slide === 0 ? "Explore features" : "Next feature"}<ArrowRightIcon aria-hidden="true" /></button>
		</div>
	</section>;
}
