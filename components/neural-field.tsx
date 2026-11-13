"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { createNeuralRenderer, NEURAL_AXONS, NEURAL_CELLS, NEURAL_FIBRES, neuralCellPath, neuralFibrePath, neuralInteriorPaths, neuralPath } from "@/lib/neural-network";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

/** Decorative neural micrograph. No account or learning activity is visualised. */
export function NeuralField({ phase = 0 }: { phase?: number }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const restart = useRef<(() => void) | null>(null);
	const settings = useRef({ phase, paused: false, reduced: true });
	const time = useRef(0);
	const [paused, setPaused] = useState(false);
	const [engine, setEngine] = useState<"static" | "canvas">("static");
	const [generation, setGeneration] = useState(0);
	const reduced = useReducedMotionPreference();
	const id = useId();
	useEffect(() => { settings.current = { phase, paused, reduced }; restart.current?.(); }, [phase, paused, reduced]);
	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		const renderer = createNeuralRenderer(element);
		if (!renderer) { setEngine("static"); return; }
		setEngine("canvas");
		let frame = 0, last = 0, visible = false, lost = false, width = 1, height = 1;
		let pointerX = 0, pointerY = 0, x = 0, y = 0;
		const draw = (stamp: number) => {
			if (lost) return;
			const { paused: stopped, reduced: still, phase: targetPhase } = settings.current;
			const moving = !stopped && !still && visible && !document.hidden;
			if (moving && last && stamp - last < 32) { frame = requestAnimationFrame(draw); return; }
			if (moving && last) time.current += Math.min(stamp - last, 100) / 1000;
			last = stamp;
			if (moving) { x += (pointerX - x) * .05; y += (pointerY - y) * .05; }
			const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
			const renderWidth = Math.max(1, Math.round(width * ratio)), renderHeight = Math.max(1, Math.round(height * ratio));
			if (element.width !== renderWidth || element.height !== renderHeight) { element.width = renderWidth; element.height = renderHeight; }
			renderer.draw(still ? 3 : time.current, targetPhase, still ? [0, 0] : [x, y]);
			if (moving) frame = requestAnimationFrame(draw);
		};
		const resume = () => { cancelAnimationFrame(frame); last = 0; draw(performance.now()); };
		restart.current = resume;
		const resize = new ResizeObserver(([entry]) => { if (entry) { width = entry.contentRect.width; height = entry.contentRect.height; resume(); } });
		const intersection = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; resume(); }, { threshold: .1 });
		const pointer = (event: PointerEvent) => { const rect = element.getBoundingClientRect(); pointerX = (event.clientX - rect.left) / rect.width - .5; pointerY = (event.clientY - rect.top) / rect.height - .5; };
		const leave = () => { pointerX = 0; pointerY = 0; };
		const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); setEngine("static"); };
		const contextRestored = () => setGeneration(value => value + 1);
		resize.observe(element); intersection.observe(element);
		element.addEventListener("pointermove", pointer); element.addEventListener("pointerleave", leave);
		element.addEventListener("contextlost", contextLost); element.addEventListener("contextrestored", contextRestored);
		document.addEventListener("visibilitychange", resume);
		return () => {
			cancelAnimationFrame(frame); restart.current = null; resize.disconnect(); intersection.disconnect(); renderer.dispose();
			element.removeEventListener("pointermove", pointer); element.removeEventListener("pointerleave", leave);
			element.removeEventListener("contextlost", contextLost); element.removeEventListener("contextrestored", contextRestored);
			document.removeEventListener("visibilitychange", resume);
		};
	}, [generation]);
	return <figure className="neural-field" data-engine={engine} aria-label="Branching neurons connected by travelling signals">
		<div className="neural-field-stage" id={id}>
			<svg className="neural-field-static" viewBox="0 0 720 520" fill="none" aria-hidden="true">
				<defs>{NEURAL_CELLS.map((cell, index) => <g key={index}>
					<linearGradient id={`${id}-material-${index}`} gradientUnits="userSpaceOnUse" x1={cell.x - cell.r * 1.4} y1={cell.y - cell.r * 1.6} x2={cell.x + cell.r * 2} y2={cell.y + cell.r}><stop stopColor="#8ea9bc" /><stop offset=".42" stopColor="#566f83" /><stop offset="1" stopColor="#233a4b" /></linearGradient>
					<radialGradient id={`${id}-membrane-${index}`} gradientUnits="userSpaceOnUse" cx={cell.x - cell.r * .35} cy={cell.y - cell.r * .45} r={cell.r * 1.55}><stop stopColor="#d1e2ec" stopOpacity=".55" /><stop offset=".45" stopColor="#9bb4c8" stopOpacity=".24" /><stop offset=".8" stopColor="#395971" stopOpacity=".06" /><stop offset="1" stopColor="#395971" stopOpacity="0" /></radialGradient>
					<clipPath id={`${id}-body-${index}`}><path d={neuralCellPath(cell)} /></clipPath>
				</g>)}</defs>
				{[2, 1, 0].map(index => { const cell = NEURAL_CELLS[index]!, shape = neuralCellPath(cell) + NEURAL_FIBRES.filter(fibre => fibre.neuron === index).map(neuralFibrePath).join(""); return <g key={index}>
					<path opacity={cell.opacity * .8} fill={`url(#${id}-material-${index})`} d={shape} />
					<path opacity={cell.opacity * .7} fill={`url(#${id}-membrane-${index})`} d={shape} />
					<g clipPath={`url(#${id}-body-${index})`} stroke="#d5e4ec" strokeWidth=".45" opacity={cell.opacity * .24}>{neuralInteriorPaths(cell).map((path, i) => <path key={i} d={path} />)}</g>
				</g>; })}
				{NEURAL_AXONS.map((axon, index) => <path key={index} d={neuralPath(axon.points)} stroke="currentColor" strokeWidth=".75" opacity=".3" />)}
			</svg>
			<canvas ref={canvas} aria-hidden="true" />
		</div>
		<figcaption>From information to understanding.</figcaption>
		<button type="button" className="neural-field-pause" disabled={reduced || engine === "static"} aria-controls={id} aria-label={reduced ? "Animation off: Reduce Motion is enabled" : engine === "static" ? "Static artwork" : paused ? "Play neural animation" : "Pause neural animation"} onClick={() => setPaused(value => !value)}>{paused || reduced || engine === "static" ? <PlayIcon /> : <PauseIcon />}</button>
	</figure>;
}
