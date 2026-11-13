"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

/** An interactive field; animation frames never trigger React renders. */
export function LearningRibbon({ phase = 0, compact = false }: { phase?: number; compact?: boolean }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const phaseRef = useRef(phase);
	const timeRef = useRef(0);
	const currentPhaseRef = useRef(phase);
	const [paused, setPaused] = useState(false);
	const id = useId();
	useEffect(() => { phaseRef.current = phase; }, [phase]);
	useEffect(() => {
		const canvas = canvasRef.current, context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
		let width = 1, height = 1, frame = 0, last = 0, visible = true;
		let pointerX = 0, pointerY = 0, x = 0, y = 0;
		const draw = (stamp = 0) => {
			const moving = !paused && !reduced.matches;
			if (last && moving && stamp - last < 24) { frame = requestAnimationFrame(draw); return; }
			if (last && moving) timeRef.current += Math.min(stamp - last, 50) / 1000;
			last = stamp;
			x += (pointerX - x) * .05; y += (pointerY - y) * .05;
			currentPhaseRef.current = moving ? currentPhaseRef.current + (phaseRef.current - currentPhaseRef.current) * .035 : phaseRef.current;
			const time = timeRef.current, currentPhase = currentPhaseRef.current;
			context.clearRect(0, 0, width, height);
			const scale = Math.min(width / 520, height / 390);
			const cx = width * .5 + x * 18, cy = height * .48 + y * 12;
			const light = context.createRadialGradient(cx, cy, 8, cx, cy, 195 * scale);
			light.addColorStop(0, "rgba(104,133,181,.09)"); light.addColorStop(.6, "rgba(100,98,158,.035)"); light.addColorStop(1, "rgba(100,98,158,0)");
			context.fillStyle = light; context.fillRect(0, 0, width, height);
			const pointAt = (angle: number, band: number) => {
				const tube = (band - .5) * 45;
				const twist = angle * 3 + currentPhase * .55;
				const radius = 96 + Math.cos(twist) * 35 + tube;
				const px = Math.cos(angle * 2) * radius;
				const py = Math.sin(angle * 2) * radius;
				const pz = Math.sin(twist) * 55 + tube * Math.cos(twist);
				const yaw = time * .115 + x * .5 + currentPhase * .23;
				const tilt = -.57 + Math.sin(time * .12) * .11 + y * .4;
				const rx = px * Math.cos(yaw) + pz * Math.sin(yaw);
				const rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
				const ry = py * Math.cos(tilt) - rz * Math.sin(tilt);
				const depth = py * Math.sin(tilt) + rz * Math.cos(tilt);
				const perspective = 580 / (580 - depth);
				return { x: cx + rx * scale * perspective, y: cy + ry * scale * perspective, depth };
			};
			const bands = width < 400 ? 36 : 58;
			for (let band = 0; band < bands; band++) {
				const v = band / (bands - 1);
				context.beginPath();
				for (let point = 0; point <= 180; point++) {
					const pos = pointAt(point / 180 * Math.PI * 2, v);
					if (point === 0) context.moveTo(pos.x, pos.y); else context.lineTo(pos.x, pos.y);
				}
				const ink = context.createLinearGradient(cx - 145 * scale, cy - 130 * scale, cx + 160 * scale, cy + 130 * scale);
				ink.addColorStop(0, `rgba(128,174,237,${.22 + v * .35})`);
				ink.addColorStop(.38, `rgba(223,216,255,${.3 + v * .5})`);
				ink.addColorStop(.7, `rgba(190,231,223,${.25 + v * .45})`);
				ink.addColorStop(1, `rgba(106,146,205,${.12 + v * .25})`);
				context.strokeStyle = ink; context.lineWidth = .75 * scale; context.stroke();
			}
			// Moving signals follow the actual contours rather than a decorative starfield.
			for (let signal = 0; signal < 18; signal++) {
				const angle = signal / 18 * Math.PI * 2 + time * (.1 + signal % 3 * .025);
				const band = .15 + (signal % 5) * .16;
				const pos = pointAt(angle, band);
				context.beginPath(); context.arc(pos.x, pos.y, (.9 + (pos.depth + 140) / 230) * scale, 0, Math.PI * 2);
				context.fillStyle = `rgba(226,238,255,${.3 + (pos.depth + 140) / 500})`; context.fill();
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
