"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { PauseIcon, PlayIcon } from "lucide-react";
import { createNeuralRenderer, NEURAL_AXONS, NEURAL_CELLS, NEURAL_FIBRES, neuralCellPath, neuralFibrePath, neuralInteriorPaths, neuralPath } from "@/lib/neural-network";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";
import { createNeuralBridgeRenderer, makeNeuralBridge, type NeuralBridgeGeometry, type NeuralRect } from "@/lib/neural-bridge";

/** Decorative neural micrograph. No account or learning activity is visualised. */
export function NeuralField({ phase = 0, extensionRoot }: { phase?: number; extensionRoot?: RefObject<HTMLDivElement | null> }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const extensionCanvas = useRef<HTMLCanvasElement>(null);
	const [extensionTarget, setExtensionTarget] = useState<HTMLDivElement | null>(null);
	const [bridgeGeometry, setBridgeGeometry] = useState<NeuralBridgeGeometry | null>(null);
	const [bridgeReady, setBridgeReady] = useState(false);
	const restart = useRef<(() => void) | null>(null);
	const settings = useRef({ phase, paused: false, reduced: true });
	const time = useRef(0);
	const [paused, setPaused] = useState(false);
	const [engine, setEngine] = useState<"static" | "canvas">("static");
	const [generation, setGeneration] = useState(0);
	const reduced = useReducedMotionPreference();
	const id = useId();
	useEffect(() => { setExtensionTarget(extensionRoot?.current ?? null); }, [extensionRoot]);
	useEffect(() => { settings.current = { phase, paused, reduced }; restart.current?.(); }, [phase, paused, reduced]);
	useEffect(() => {
		const element = canvas.current;
		if (!element || extensionRoot && !extensionTarget) return;
		const renderer = createNeuralRenderer(element);
		const extended = extensionCanvas.current, bridge = extended ? createNeuralBridgeRenderer(extended) : null;
		setEngine(renderer ? "canvas" : "static"); setBridgeReady(!!bridge);
		let frame = 0, measureFrame = 0, last = 0, leftVisible = false, bridgeVisible = false, lost = false, width = 1, height = 1, lastMeasurement = "";
		let pointerX = 0, pointerY = 0, x = 0, y = 0;
		const draw = (stamp: number) => {
			if (lost) return;
			const { paused: stopped, reduced: still, phase: targetPhase } = settings.current;
			const moving = !!renderer && !stopped && !still && (leftVisible || bridgeVisible) && !document.hidden;
			if (moving && last && stamp - last < 32) { frame = requestAnimationFrame(draw); return; }
			if (moving && last) time.current += Math.min(stamp - last, 100) / 1000;
			last = stamp;
			if (moving) { x += (pointerX - x) * .05; y += (pointerY - y) * .05; }
			const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
			const renderWidth = Math.max(1, Math.round(width * ratio)), renderHeight = Math.max(1, Math.round(height * ratio));
			if (element.width !== renderWidth || element.height !== renderHeight) { element.width = renderWidth; element.height = renderHeight; }
			if (leftVisible || !moving) renderer?.draw(still ? 3 : time.current, targetPhase, still ? [0, 0] : [x, y]);
			if (bridgeVisible || !moving) bridge?.draw(still ? 3 : time.current);
			if (moving) frame = requestAnimationFrame(draw);
		};
		const resume = () => { cancelAnimationFrame(frame); last = 0; draw(performance.now()); };
		restart.current = () => { measureBridge(); resume(); };
		const measureBridge = () => {
			if (!extensionTarget) return;
			const layout = extensionTarget.parentElement, card = layout?.querySelector<HTMLElement>(".onboarding-form-area"), content = layout?.querySelector<HTMLElement>(".onboarding-form-content");
			if (!card || !content) return;
			const host = extensionTarget.getBoundingClientRect();
			if (host.width < 1 || host.height < 1) return;
			const relative = (node: Element, pad = 0): NeuralRect => {
				const r = node.getBoundingClientRect(), motion = node.closest(".onboarding-scene-content,.onboarding-story-copy");
				const transform = motion ? new DOMMatrixReadOnly(getComputedStyle(motion).transform) : null;
				const round = (value: number) => Math.round(value * 100) / 100;
				return { x: round(r.left - host.left - pad - (transform?.m41 ?? 0)), y: round(r.top - host.top - pad - (transform?.m42 ?? 0)), width: round(r.width + pad * 2), height: round(r.height + pad * 2) };
			};
			const protectedRects = [...layout!.querySelectorAll(".onboarding-form-content input,.onboarding-form-content textarea,.onboarding-form-content button,.onboarding-secret-field,.onboarding-progress,.neural-field-pause")].map(node => relative(node, 1));
			const copyRects = [...layout!.querySelectorAll(".onboarding-step h2,.onboarding-intro,.onboarding-form > label,.onboarding-label-row,.onboarding-small,.onboarding-auth-tabs,.onboarding-auth-availability,.onboarding-key-note,.onboarding-intents,.onboarding-bottom,.onboarding-thought,.onboarding-story-copy,.neural-field > figcaption,.onboarding-story-footer")].map(node => relative(node, 3));
			const measured = { width: host.width, height: host.height, stage: relative(element), card: relative(card), content: relative(content), protectedRects, copyRects }, signature = JSON.stringify(measured);
			if (signature === lastMeasurement) return;
			lastMeasurement = signature;
			const next = makeNeuralBridge(measured);
			setBridgeGeometry(next); bridge?.resize(next, Math.min(window.devicePixelRatio || 1, 1.5));
		};
		const resize = new ResizeObserver(entries => { for (const entry of entries) if (entry.target === element) { width = entry.contentRect.width; height = entry.contentRect.height; } measureBridge(); resume(); });
		const changes = new MutationObserver(() => { cancelAnimationFrame(measureFrame); measureFrame = requestAnimationFrame(() => { measureBridge(); resume(); }); });
		const intersection = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.target === element) leftVisible = entry.isIntersecting; else bridgeVisible = entry.isIntersecting; } resume(); }, { threshold: .01 });
		const pointer = (event: PointerEvent) => { const rect = element.getBoundingClientRect(); pointerX = (event.clientX - rect.left) / rect.width - .5; pointerY = (event.clientY - rect.top) / rect.height - .5; };
		const leave = () => { pointerX = 0; pointerY = 0; };
		const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); setEngine("static"); setBridgeReady(false); };
		const contextRestored = () => setGeneration(value => value + 1);
		resize.observe(element); intersection.observe(element);
		if (extensionTarget) resize.observe(extensionTarget);
		const content = extensionTarget?.parentElement?.querySelector(".onboarding-form-content");
		if (content) { resize.observe(content); }
		if (extended) { intersection.observe(extended); extended.addEventListener("contextlost", contextLost); extended.addEventListener("contextrestored", contextRestored); }
		element.addEventListener("pointermove", pointer); element.addEventListener("pointerleave", leave);
		element.addEventListener("contextlost", contextLost); element.addEventListener("contextrestored", contextRestored);
		document.addEventListener("visibilitychange", resume);
		return () => {
			cancelAnimationFrame(frame); cancelAnimationFrame(measureFrame); restart.current = null; resize.disconnect(); changes.disconnect(); intersection.disconnect(); renderer?.dispose(); bridge?.dispose();
			element.removeEventListener("pointermove", pointer); element.removeEventListener("pointerleave", leave);
			element.removeEventListener("contextlost", contextLost); element.removeEventListener("contextrestored", contextRestored);
			extended?.removeEventListener("contextlost", contextLost); extended?.removeEventListener("contextrestored", contextRestored);
			document.removeEventListener("visibilitychange", resume);
		};
	}, [generation, extensionRoot, extensionTarget]);
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
		<button type="button" className="neural-field-pause" disabled={reduced || engine === "static"} aria-controls={extensionTarget ? `${id} ${id}-bridge` : id} aria-label={reduced ? "Animation off: Reduce Motion is enabled" : engine === "static" ? "Static artwork" : paused ? "Play neural animation" : "Pause neural animation"} onClick={() => setPaused(value => !value)}>{paused || reduced || engine === "static" ? <PlayIcon /> : <PauseIcon />}</button>
		{extensionTarget && createPortal(<div className="neural-bridge" id={`${id}-bridge`} data-engine={bridgeReady ? "canvas" : "static"} aria-hidden="true">
			<svg className="neural-bridge-static" viewBox={`0 0 ${bridgeGeometry?.width ?? 1} ${bridgeGeometry?.height ?? 1}`} fill="none">
				<defs>
					<filter id={`${id}-copy-feather`}><feGaussianBlur stdDeviation="12" /></filter>
					<mask id={`${id}-bridge-clear`} maskUnits="userSpaceOnUse"><rect width={bridgeGeometry?.width ?? 1} height={bridgeGeometry?.height ?? 1} fill="white" /><g filter={`url(#${id}-copy-feather)`} fill="black" opacity=".74">{bridgeGeometry?.copyRects.map((r, index) => <rect key={index} x={r.x} y={r.y} width={r.width} height={r.height} rx="10" />)}</g><g fill="black">{bridgeGeometry?.protectedRects.map((r, index) => <rect key={index} x={r.x} y={r.y} width={r.width} height={r.height} />)}</g></mask>
					{bridgeGeometry?.cells.map((cell, index) => <g key={index}>
						<linearGradient id={`${id}-canopy-material-${index}`} gradientUnits="userSpaceOnUse" x1={cell.x - cell.r * 1.4} y1={cell.y - cell.r * 1.6} x2={cell.x + cell.r * 2} y2={cell.y + cell.r}><stop stopColor="#8ea9bc" /><stop offset=".42" stopColor="#566f83" /><stop offset="1" stopColor="#233a4b" /></linearGradient>
						<radialGradient id={`${id}-canopy-membrane-${index}`} gradientUnits="userSpaceOnUse" cx={cell.x - cell.r * .35} cy={cell.y - cell.r * .45} r={cell.r * 1.55}><stop stopColor="#d1e2ec" stopOpacity=".55" /><stop offset=".45" stopColor="#9bb4c8" stopOpacity=".24" /><stop offset=".8" stopColor="#395971" stopOpacity=".06" /><stop offset="1" stopColor="#395971" stopOpacity="0" /></radialGradient>
						<path id={`${id}-canopy-shape-${index}`} d={neuralCellPath(cell) + bridgeGeometry.fibres.filter(fibre => fibre.neuron === index).map(neuralFibrePath).join("")} />
					</g>)}
				</defs>
				<g mask={`url(#${id}-bridge-clear)`}>{[2, 1, 0].map(index => bridgeGeometry && <g key={index}><use href={`#${id}-canopy-shape-${index}`} fill={`url(#${id}-canopy-material-${index})`} opacity={bridgeGeometry.cells[index]!.opacity * .8} /><use href={`#${id}-canopy-shape-${index}`} fill={`url(#${id}-canopy-membrane-${index})`} opacity={bridgeGeometry.cells[index]!.opacity * .7} /></g>)}{bridgeGeometry?.axons.map((axon, index) => <path key={index} d={neuralPath(axon.points)} stroke="#bacfdb" strokeWidth=".75" opacity=".09" />)}</g>
			</svg><canvas ref={extensionCanvas} />
		</div>, extensionTarget)}
	</figure>;
}
