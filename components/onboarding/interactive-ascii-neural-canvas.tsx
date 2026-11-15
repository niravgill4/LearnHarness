"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

interface Node {
	baseX: number;
	baseY: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	char: string;
	activeChar: string;
	alpha: number;
	targetAlpha: number;
	size: number;
}

interface Ripple {
	x: number;
	y: number;
	radius: number;
	maxRadius: number;
	speed: number;
	strength: number;
}

const CHAR_SET = ["·", "•", "+", "×", "▫", ":", "÷", "⋄", "⁖", "░", "1", "0"];
const ACTIVE_CHARS = ["*", "⬡", "+", "░", "▒", "✕", "◈", "1"];

export function InteractiveAsciiNeuralCanvas({ className = "" }: { className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const reduced = useReducedMotionPreference();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const parent = canvas.parentElement;
		if (!parent) return;

		const ctx = canvas.getContext("2d", { alpha: true });
		if (!ctx) return;

		let animId = 0;
		let width = 0;
		let height = 0;
		let dpr = 1;

		let nodes: Node[] = [];
		const ripples: Ripple[] = [];

		let mouseX = -1000;
		let mouseY = -1000;
		let isMouseIn = false;
		let isHidden = document.hidden;
		let isIntersecting = true;

		const SPACING = 26;

		function getAccentRgb(): [number, number, number] {
			if (!parent) return [184, 213, 170];
			const raw = getComputedStyle(parent).getPropertyValue("--landscape-accent").trim() || "#b8d5aa";
			if (raw.startsWith("#")) {
				const hex = raw.slice(1);
				if (hex.length === 6) {
					return [
						parseInt(hex.slice(0, 2), 16),
						parseInt(hex.slice(2, 4), 16),
						parseInt(hex.slice(4, 6), 16),
					];
				}
			}
			return [184, 213, 170];
		}

		function initGrid() {
			nodes = [];
			const cols = Math.ceil(width / SPACING) + 1;
			const rows = Math.ceil(height / SPACING) + 1;

			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const baseX = c * SPACING + ((r % 2) * (SPACING / 2));
					const baseY = r * SPACING;
					const char = CHAR_SET[(r * 7 + c * 13) % CHAR_SET.length] || "·";
					const activeChar = ACTIVE_CHARS[(r * 3 + c * 5) % ACTIVE_CHARS.length] || "+";

					nodes.push({
						baseX,
						baseY,
						x: baseX,
						y: baseY,
						vx: 0,
						vy: 0,
						char,
						activeChar,
						alpha: 0.05 + Math.random() * 0.05,
						targetAlpha: 0.05 + Math.random() * 0.05,
						size: 9 + (Math.random() > 0.8 ? 2 : 0),
					});
				}
			}
		}

		function handleResize() {
			if (!parent || !canvas) return;
			const rect = parent.getBoundingClientRect();
			width = Math.max(1, Math.floor(rect.width));
			height = Math.max(1, Math.floor(rect.height));
			dpr = Math.min(window.devicePixelRatio || 1, 2);

			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;

			initGrid();
			if (reduced) {
				renderStatic();
			}
		}

		function spawnRipple(originX: number, originY: number, strength = 1) {
			ripples.push({
				x: originX,
				y: originY,
				radius: 0,
				maxRadius: Math.max(width, height) * 0.85,
				speed: 7.5,
				strength,
			});
		}

		function onPointerMove(e: PointerEvent) {
			if (!parent) return;
			const rect = parent.getBoundingClientRect();
			mouseX = e.clientX - rect.left;
			mouseY = e.clientY - rect.top;
			isMouseIn = true;
		}

		function onPointerLeave() {
			isMouseIn = false;
			mouseX = -1000;
			mouseY = -1000;
		}

		function onInputOrKey(e: Event) {
			if (!parent) return;
			const target = e.target as HTMLElement | null;
			if (!target) return;

			const targetRect = target.getBoundingClientRect();
			const parentRect = parent.getBoundingClientRect();
			const centerX = (targetRect.left + targetRect.width / 2) - parentRect.left;
			const centerY = (targetRect.top + targetRect.height / 2) - parentRect.top;

			spawnRipple(
				Math.max(0, Math.min(width, centerX)),
				Math.max(0, Math.min(height, centerY)),
				1.2
			);
		}

		function renderStatic() {
			if (!ctx) return;
			ctx.save();
			ctx.scale(dpr, dpr);
			ctx.clearRect(0, 0, width, height);
			const [r, g, b] = getAccentRgb();

			ctx.font = '10px "JetBrains Mono", monospace';
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			for (let i = 0; i < nodes.length; i++) {
				const n = nodes[i];
				if (!n) continue;
				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${n.alpha * 0.8})`;
				ctx.fillText(n.char, n.x, n.y);
			}
			ctx.restore();
		}

		let time = 0;

		function loop() {
			if (isHidden || !isIntersecting || reduced) return;
			time += 0.02;

			if (!ctx) return;
			ctx.save();
			ctx.scale(dpr, dpr);
			ctx.clearRect(0, 0, width, height);

			const [r, g, b] = getAccentRgb();
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			// Update ripples
			for (let ri = ripples.length - 1; ri >= 0; ri--) {
				const rip = ripples[ri];
				if (!rip) continue;
				rip.radius += rip.speed;
				rip.strength *= 0.985;
				if (rip.radius > rip.maxRadius || rip.strength < 0.05) {
					ripples.splice(ri, 1);
				}
			}

			// Filament line connections between nearby excited nodes
			const excitedNodes: Node[] = [];

			// Update and render nodes
			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i];
				if (!node) continue;

				// Ambient breathing motion
				const ambient = Math.sin(time + node.baseX * 0.02 + node.baseY * 0.03) * 0.03;
				node.targetAlpha = 0.04 + Math.max(0, ambient);

				// Mouse repulsion & lighting
				let isNearMouse = false;
				if (isMouseIn) {
					const dx = mouseX - node.x;
					const dy = mouseY - node.y;
					const dist = Math.hypot(dx, dy);
					const mouseRadius = 90;

					if (dist < mouseRadius) {
						isNearMouse = true;
						const force = (1 - dist / mouseRadius) * 4;
						const angle = Math.atan2(dy, dx);
						node.vx -= Math.cos(angle) * force * 0.6;
						node.vy -= Math.sin(angle) * force * 0.6;
						node.targetAlpha = Math.max(node.targetAlpha, 0.45 * (1 - dist / mouseRadius));
					}
				}

				// Ripple effects
				for (let ri = 0; ri < ripples.length; ri++) {
					const rip = ripples[ri];
					if (!rip) continue;
					const dist = Math.hypot(node.baseX - rip.x, node.baseY - rip.y);
					const diff = Math.abs(dist - rip.radius);
					if (diff < 45) {
						const factor = (1 - diff / 45) * rip.strength;
						node.targetAlpha = Math.max(node.targetAlpha, 0.6 * factor);
						const angle = Math.atan2(node.baseY - rip.y, node.baseX - rip.x);
						node.vx += Math.cos(angle) * factor * 2.5;
						node.vy += Math.sin(angle) * factor * 2.5;
					}
				}

				// Spring physics returning to baseX, baseY
				const k = 0.12;
				const damp = 0.78;
				node.vx += (node.baseX - node.x) * k;
				node.vy += (node.baseY - node.y) * k;
				node.vx *= damp;
				node.vy *= damp;
				node.x += node.vx;
				node.y += node.vy;

				// Smooth alpha interpolation
				node.alpha += (node.targetAlpha - node.alpha) * 0.14;

				if (node.alpha > 0.18) {
					excitedNodes.push(node);
				}

				// Render glyph
				const isEx = node.alpha > 0.25 || isNearMouse;
				const char = isEx ? node.activeChar : node.char;
				ctx.font = `${node.size}px "JetBrains Mono", monospace`;
				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${node.alpha.toFixed(3)})`;
				ctx.fillText(char, node.x, node.y);
			}

			// Render neural filament connections
			if (excitedNodes.length > 1) {
				ctx.lineWidth = 0.8;
				const maxConnectDist = SPACING * 1.6;
				for (let i = 0; i < excitedNodes.length; i++) {
					const na = excitedNodes[i];
					if (!na) continue;
					for (let j = i + 1; j < excitedNodes.length; j++) {
						const nb = excitedNodes[j];
						if (!nb) continue;
						const dist = Math.hypot(na.x - nb.x, na.y - nb.y);
						if (dist < maxConnectDist) {
							const connAlpha = (1 - dist / maxConnectDist) * Math.min(na.alpha, nb.alpha) * 0.8;
							ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${connAlpha.toFixed(3)})`;
							ctx.beginPath();
							ctx.moveTo(na.x, na.y);
							ctx.lineTo(nb.x, nb.y);
							ctx.stroke();
						}
					}
				}
			}

			ctx.restore();
			animId = requestAnimationFrame(loop);
		}

		// Observers and event bindings
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(parent);

		const intersectionObserver = new IntersectionObserver(([entry]) => {
			isIntersecting = entry?.isIntersecting ?? true;
			if (isIntersecting && !reduced && !isHidden) {
				cancelAnimationFrame(animId);
				animId = requestAnimationFrame(loop);
			}
		}, { threshold: 0.05 });
		intersectionObserver.observe(canvas);

		function onVisibilityChange() {
			isHidden = document.hidden;
			if (!isHidden && isIntersecting && !reduced) {
				cancelAnimationFrame(animId);
				animId = requestAnimationFrame(loop);
			}
		}

		document.addEventListener("visibilitychange", onVisibilityChange);
		parent.addEventListener("pointermove", onPointerMove, { passive: true });
		parent.addEventListener("pointerleave", onPointerLeave, { passive: true });
		parent.addEventListener("input", onInputOrKey, { passive: true });
		parent.addEventListener("keydown", onInputOrKey, { passive: true });

		handleResize();
		if (!reduced) {
			animId = requestAnimationFrame(loop);
		}

		return () => {
			cancelAnimationFrame(animId);
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			parent.removeEventListener("pointermove", onPointerMove);
			parent.removeEventListener("pointerleave", onPointerLeave);
			parent.removeEventListener("input", onInputOrKey);
			parent.removeEventListener("keydown", onInputOrKey);
		};
	}, [reduced]);

	return (
		<canvas
			ref={canvasRef}
			className={`onboarding-interactive-canvas ${className}`}
			aria-hidden="true"
		/>
	);
}
