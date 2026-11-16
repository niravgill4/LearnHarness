"use client";
import { useEffect, useRef, type PointerEvent } from "react";
import type { InkStroke, InkPoint } from "@/lib/notebook";
export type InkTool = { tool: InkStroke["tool"]; color: string; width: number };
export function paintInk(canvas: HTMLCanvasElement, strokes: InkStroke[], clear = true) {
	const c = canvas.getContext("2d");
	if (!c) return;
	if (clear) c.clearRect(0, 0, 1400, 2000);
	for (const stroke of strokes) {
		c.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
		c.globalAlpha = stroke.tool === "highlighter" ? 0.26 : 1;
		c.strokeStyle = stroke.color;
		c.fillStyle = stroke.color;
		c.lineCap = "round";
		c.lineJoin = "round";
		if (stroke.tool === "highlighter") {
			c.lineWidth = stroke.width * 5;
			c.beginPath();
			stroke.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
			c.stroke();
		} else
			stroke.points.forEach((p, i) => {
				c.lineWidth = stroke.width * (stroke.tool === "eraser" ? 7 : 0.5 + p.p);
				c.beginPath();
				const prev = stroke.points[Math.max(0, i - 1)]!;
				if (!i) {
					c.arc(p.x, p.y, c.lineWidth / 2, 0, Math.PI * 2);
					c.fill();
				} else {
					c.moveTo(prev.x, prev.y);
					c.lineTo(p.x, p.y);
					c.stroke();
				}
			});
	}
	c.globalAlpha = 1;
	c.globalCompositeOperation = "source-over";
}
export function NotebookInk({
	strokes,
	tool,
	active,
	finger,
	onChange,
	onBusy,
}: {
	strokes: InkStroke[];
	tool: InkTool;
	active: boolean;
	finger: boolean;
	onChange(strokes: InkStroke[]): void;
	onBusy(active: boolean): void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const gesture = useRef<{ id: number; stroke: InkStroke } | null>(null);
	const background = useRef<HTMLCanvasElement | null>(null);
	const scrollGesture = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
	const current = useRef(strokes);
	current.current = strokes;
	useEffect(() => {
		if (canvas.current && !gesture.current) paintInk(canvas.current, strokes);
	}, [strokes]);
	function point(
		event: PointerEvent<HTMLCanvasElement>,
		sample: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "pressure"> = event,
	): InkPoint {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(1400, ((sample.clientX - rect.left) / rect.width) * 1400)),
			y: Math.max(0, Math.min(2000, ((sample.clientY - rect.top) / rect.height) * 2000)),
			p: event.pointerType === "pen" && sample.pressure ? sample.pressure : 0.5,
		};
	}
	function finish(event: PointerEvent<HTMLCanvasElement>) {
		if (scrollGesture.current?.id === event.pointerId) scrollGesture.current = null;
		if (gesture.current?.id !== event.pointerId) return;
		const next = [...current.current, gesture.current.stroke];
		gesture.current = null;
		onChange(next);
		onBusy(false);
	}
	return (
		<canvas
			ref={canvas}
			className="nb-ink"
			width={1400}
			height={2000}
			aria-label="Notebook drawing sheet"
			style={{ pointerEvents: active ? "auto" : "none", touchAction: "none" }}
			onPointerDown={(event) => {
				if (!active || gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return;
				if (event.pointerType === "touch" && !finger) {
					const scroll = event.currentTarget.closest(".nb-scroll")!;
					scrollGesture.current = {
						id: event.pointerId,
						x: event.clientX,
						y: event.clientY,
						left: scroll.scrollLeft,
						top: scroll.scrollTop,
					};
					event.currentTarget.setPointerCapture(event.pointerId);
					return;
				}
				event.preventDefault();
				scrollGesture.current = null;
				event.currentTarget.setPointerCapture(event.pointerId);
				background.current = document.createElement("canvas");
				background.current.width = 1400;
				background.current.height = 2000;
				background.current.getContext("2d")?.drawImage(event.currentTarget, 0, 0);
				gesture.current = {
					id: event.pointerId,
					stroke: { ...tool, tool: event.button === 5 ? "eraser" : tool.tool, points: [point(event)] },
				};
				onBusy(true);
				paintInk(event.currentTarget, [...current.current, gesture.current.stroke]);
			}}
			onPointerMove={(event) => {
				const scroll = scrollGesture.current;
				if (scroll?.id === event.pointerId && !gesture.current) {
					const viewport = event.currentTarget.closest(".nb-scroll")!;
					viewport.scrollLeft = scroll.left + scroll.x - event.clientX;
					viewport.scrollTop = scroll.top + scroll.y - event.clientY;
					return;
				}
				if (gesture.current?.id !== event.pointerId) return;
				event.preventDefault();
				const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
				gesture.current.stroke.points.push(
					...(samples.length ? samples.map((s) => point(event, s)) : [point(event)]),
				);
				const c = event.currentTarget.getContext("2d");
				c?.clearRect(0, 0, 1400, 2000);
				if (background.current) c?.drawImage(background.current, 0, 0);
				paintInk(event.currentTarget, [gesture.current.stroke], false);
			}}
			onPointerUp={finish}
			onPointerCancel={finish}
			onLostPointerCapture={finish}
		/>
	);
}
