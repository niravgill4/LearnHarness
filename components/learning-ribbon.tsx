"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

/** An interactive field; animation frames never trigger React renders. */
export function LearningRibbon({ phase = 0, compact = false }: { phase?: number; compact?: boolean }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const phaseRef = useRef(phase);
	const [paused, setPaused] = useState(false);
	const id = useId();
	useEffect(() => { phaseRef.current = phase; }, [phase]);
	useEffect(() => {
		const canvas = canvasRef.current, context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
		let width = 1, height = 1, frame = 0, time = 0, last = 0, visible = true;
		let pointerX = 0, pointerY = 0, x = 0, y = 0, currentPhase = phaseRef.current;
		const draw = (stamp = 0) => {
			const moving = !paused && !reduced.matches;
			if (last && moving) time += Math.min(stamp - last, 40) / 1000;
			last = stamp;
			x += (pointerX - x) * .035; y += (pointerY - y) * .035;
			currentPhase += (phaseRef.current - currentPhase) * .025;
			context.clearRect(0, 0, width, height);
			const scale = Math.min(width / 600, height / 440);
			const cx = width * .5 + x * 14, cy = height * .5 + y * 10;
			for (let band = 0; band < 60; band++) {
				const v = band / 59;
				context.beginPath();
				for (let point = 0; point <= 120; point++) {
					const angle = point / 120 * Math.PI * 2;
					const twist = angle * 2 + time * .21 + v * .68 + currentPhase * .38;
					const radius = 138 + (v - .5) * 60;
					const px = Math.cos(angle) * (radius + Math.sin(twist) * 22);
					const py = Math.sin(angle) * (72 + Math.cos(twist) * 48) + (v - .5) * 76;
					const rotation = -.48 + Math.sin(time * .12) * .06;
					const dx = (px * Math.cos(rotation) - py * Math.sin(rotation)) * scale;
					const dy = (px * Math.sin(rotation) + py * Math.cos(rotation)) * scale;
					if (point === 0) context.moveTo(cx + dx, cy + dy); else context.lineTo(cx + dx, cy + dy);
				}
				const ink = context.createLinearGradient(cx - 190 * scale, cy - 100 * scale, cx + 180 * scale, cy + 100 * scale);
				ink.addColorStop(0, `rgba(137,180,214,${.15 + v * .29})`);
				ink.addColorStop(.43, `rgba(212,206,241,${.22 + v * .5})`);
				ink.addColorStop(.72, `rgba(180,220,212,${.16 + v * .35})`);
				ink.addColorStop(1, `rgba(117,160,196,${.1 + v * .2})`);
				context.strokeStyle = ink; context.lineWidth = .65 * scale; context.stroke();
			}
			if (moving && visible && !document.hidden) frame = requestAnimationFrame(draw);
		};
		const restart = () => { cancelAnimationFrame(frame); last = 0; draw(performance.now()); };
		const resize = new ResizeObserver(([entry]) => {
			if (!entry) return;
			width = entry.contentRect.width; height = entry.contentRect.height;
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0); restart();
		});
		const intersection = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; restart(); });
		const pointer = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			pointerX = (event.clientX - rect.left) / rect.width - .5;
			pointerY = (event.clientY - rect.top) / rect.height - .5;
		};
		const leave = () => { pointerX = 0; pointerY = 0; };
		resize.observe(canvas); intersection.observe(canvas);
		canvas.addEventListener("pointermove", pointer); canvas.addEventListener("pointerleave", leave);
		document.addEventListener("visibilitychange", restart); reduced.addEventListener("change", restart);
		return () => {
			cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect();
			canvas.removeEventListener("pointermove", pointer); canvas.removeEventListener("pointerleave", leave);
			document.removeEventListener("visibilitychange", restart); reduced.removeEventListener("change", restart);
		};
	}, [paused]);
	return <div className={`learning-ribbon${compact ? " learning-ribbon-compact" : ""}`}>
		<canvas ref={canvasRef} id={id} aria-hidden="true" />
		<button type="button" className="ribbon-pause" aria-controls={id} aria-label={paused ? "Play illustration" : "Pause illustration"} onClick={() => setPaused(value => !value)}>{paused ? <PlayIcon /> : <PauseIcon />}</button>
	</div>;
}
