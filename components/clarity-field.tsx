"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { clarityFallbackPaths, createClarityRenderer } from "@/lib/clarity-field";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

const fallback = clarityFallbackPaths();

export function ClarityField({ phase = 0 }: { phase?: number }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const restart = useRef<(() => void) | null>(null);
	const settings = useRef({ phase, paused: false, reduced: true });
	const time = useRef(0);
	const [paused, setPaused] = useState(false);
	const [engine, setEngine] = useState<"static" | "webgl">("static");
	const [generation, setGeneration] = useState(0);
	const reduced = useReducedMotionPreference();
	const id = useId();
	useEffect(() => { settings.current = { phase, paused, reduced }; restart.current?.(); }, [phase, paused, reduced]);
	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		const renderer = createClarityRenderer(element);
		if (!renderer) { setEngine("static"); return; }
		setEngine("webgl");
		let frame = 0, last = 0, visible = false, width = 1, height = 1;
		let pointerX = 0, pointerY = 0, x = 0, y = 0, currentPhase = settings.current.phase;
		let lost = false;
		let maxRatio = Math.min(window.devicePixelRatio || 1, 1.5), quality = maxRatio;
		let sampleStart = 0, sampleFrames = 0, fastWindows = 0;
		const draw = (stamp: number) => {
			if (lost) return;
			const { paused: stopped, reduced: still, phase: targetPhase } = settings.current;
			const moving = !stopped && !still && visible && !document.hidden;
			if (moving && last && stamp - last < 32) { frame = requestAnimationFrame(draw); return; }
			if (moving) {
				const now = performance.now();
				if (!sampleStart) sampleStart = now;
				sampleFrames++;
				if (now - sampleStart >= 900) {
					const fps = sampleFrames * 1000 / (now - sampleStart);
					if (fps < 21) { quality = Math.max(Math.min(.65, maxRatio), quality * .8); fastWindows = 0; }
					else if (fps > 28 && quality < maxRatio) { if (++fastWindows >= 3) { quality = Math.min(maxRatio, quality * 1.12); fastWindows = 0; } }
					else fastWindows = 0;
					sampleStart = now; sampleFrames = 0;
				}
			}
			if (moving && last) time.current += Math.min(stamp - last, 70) / 1000;
			last = stamp;
			if (moving) { x += (pointerX - x) * .04; y += (pointerY - y) * .04; currentPhase += (targetPhase - currentPhase) * .035; }
			else currentPhase = targetPhase;
			// Keep geometry intact, adapting pixel cost only when a device is slow.
			// A paused or reduced-motion composition is rendered at full quality.
			const ratio = stopped || still ? maxRatio : quality;
			const renderWidth = Math.max(1, Math.round(width * ratio)), renderHeight = Math.max(1, Math.round(height * ratio));
			if (element.width !== renderWidth || element.height !== renderHeight) { element.width = renderWidth; element.height = renderHeight; }
			renderer.draw(still ? 8.5 : time.current, currentPhase, still ? [0, 0] : [x, y]);
			if (moving) frame = requestAnimationFrame(draw);
		};
		const resume = () => { cancelAnimationFrame(frame); last = 0; sampleStart = 0; sampleFrames = 0; draw(performance.now()); };
		restart.current = resume;
		const resize = new ResizeObserver(([entry]) => {
			if (!entry) return;
			width = entry.contentRect.width; height = entry.contentRect.height;
			maxRatio = Math.min(window.devicePixelRatio || 1, 1.5); quality = maxRatio; fastWindows = 0; resume();
		});
		const intersection = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; resume(); }, { threshold: .1 });
		const pointer = (event: PointerEvent) => { const rect = element.getBoundingClientRect(); pointerX = (event.clientX - rect.left) / rect.width - .5; pointerY = (event.clientY - rect.top) / rect.height - .5; };
		const leave = () => { pointerX = 0; pointerY = 0; };
		const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); setEngine("static"); };
		const contextRestored = () => setGeneration(value => value + 1);
		resize.observe(element); intersection.observe(element);
		element.addEventListener("pointermove", pointer); element.addEventListener("pointerleave", leave);
		element.addEventListener("webglcontextlost", contextLost); element.addEventListener("webglcontextrestored", contextRestored);
		document.addEventListener("visibilitychange", resume);
		return () => {
			cancelAnimationFrame(frame); restart.current = null; resize.disconnect(); intersection.disconnect(); renderer.dispose();
			element.removeEventListener("pointermove", pointer); element.removeEventListener("pointerleave", leave);
			element.removeEventListener("webglcontextlost", contextLost); element.removeEventListener("webglcontextrestored", contextRestored);
			document.removeEventListener("visibilitychange", resume);
		};
	}, [generation]);
	return <figure className="clarity-field" data-engine={engine} aria-label="Three interwoven optical structures unfolding into connected layers">
		<div className="clarity-field-stage" id={id}>
			<svg className="clarity-field-static" viewBox="0 0 560 420" fill="none" aria-hidden="true">{fallback.map((d, index) => <path key={index} d={d} stroke="currentColor" strokeWidth=".65" opacity={.18 + index % 36 / 105} />)}</svg>
			<canvas ref={canvas} aria-hidden="true" />
		</div>
		<figcaption>From information to understanding.</figcaption>
		<button type="button" className="clarity-field-pause" disabled={reduced || engine === "static"} aria-controls={id} aria-label={reduced ? "Animation off: Reduce Motion is enabled" : engine === "static" ? "Static artwork" : paused ? "Play optical animation" : "Pause optical animation"} onClick={() => setPaused(value => !value)}>{paused || reduced || engine === "static" ? <PlayIcon /> : <PauseIcon />}</button>
	</figure>;
}
