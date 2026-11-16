"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { EraserIcon, PencilIcon, Undo2Icon } from "lucide-react";
import type { ImageContent } from "@earendil-works/pi-ai";

type Point = { x: number; y: number; pressure: number };
type Stroke = { points: Point[]; color: string; width: number; erase: boolean };
const WIDTH = 1400;
const HEIGHT = 700;
const COLORS = ["#17231a", "#2456a6", "#a32f39", "#6e3b91", "#29754b"];

/** Fixed sheet coordinates keep handwriting proportional through iPad rotation. */
export function PracticeDrawing({ disabled = false, onChange, onDrawing }: { disabled?: boolean; onChange(image: ImageContent | undefined): void; onDrawing(active: boolean): void }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const history = useRef<Stroke[]>([]);
	const gesture = useRef<{ id: number; stroke: Stroke } | null>(null);
	const changed = useRef(onChange); changed.current = onChange;
	const [color, setColor] = useState(COLORS[0]!);
	const [width, setWidth] = useState(4);
	const [erase, setErase] = useState(false);
	const [finger, setFinger] = useState(false);
	const [count, setCount] = useState(0);
	const [error, setError] = useState("");
	function paintStroke(stroke: Stroke, start = 0) {
		const context = canvas.current?.getContext("2d");
		if (!context) return;
			context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
			context.strokeStyle = stroke.color; context.fillStyle = stroke.color;
			context.lineCap = "round"; context.lineJoin = "round";
			stroke.points.slice(start).forEach((point, offset) => {
				const i = start + offset;
				const previous = stroke.points[Math.max(0, i - 1)]!;
				context.lineWidth = stroke.width * (.65 + .7 * point.pressure);
				context.beginPath();
				if (i === 0) { context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2); context.fill(); }
				else { context.moveTo(previous.x, previous.y); context.lineTo(point.x, point.y); context.stroke(); }
			});
		context.globalCompositeOperation = "source-over";
	}
	function paint() {
		canvas.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
		history.current.forEach(stroke => paintStroke(stroke));
	}
	function publish() {
		paint(); setCount(history.current.length);
		const source = canvas.current;
		if (!source) return;
		try {
			const context = source.getContext("2d");
			if (!context) throw new Error("Canvas is unavailable");
			const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
			let ink = false;
			for (let i = 3; i < pixels.length; i += 4) { if (pixels[i]) { ink = true; break; } }
			if (!ink) { changed.current(undefined); return; }
			const sheet = document.createElement("canvas"); sheet.width = WIDTH; sheet.height = HEIGHT;
			const output = sheet.getContext("2d");
			if (!output) throw new Error("Canvas is unavailable");
			output.fillStyle = "#ffffff"; output.fillRect(0, 0, WIDTH, HEIGHT); output.drawImage(source, 0, 0);
			changed.current({ type: "image", mimeType: "image/png", data: sheet.toDataURL("image/png").split(",")[1]! });
			setError("");
		} catch { changed.current(undefined); setError("Your drawing could not be prepared. Please try undoing the last stroke and drawing again."); }
	}
	useEffect(() => {
		if (!canvas.current?.getContext("2d")) setError("Drawing is unavailable in this browser. You can still type your answer below.");
	}, []);
	function point(event: PointerEvent<HTMLCanvasElement>, sample: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "pressure"> = event): Point {
		const rect = event.currentTarget.getBoundingClientRect();
		return { x: (sample.clientX - rect.left) / rect.width * WIDTH, y: (sample.clientY - rect.top) / rect.height * HEIGHT, pressure: event.pointerType === "pen" && sample.pressure > 0 ? sample.pressure : .5 };
	}
	function finish(event: PointerEvent<HTMLCanvasElement>) {
		if (gesture.current?.id !== event.pointerId) return;
		gesture.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		publish();
		onDrawing(false);
	}
	return <section className="practice-drawing" aria-label="Handwritten answer">
		<div className="practice-drawing-toolbar">
			<div role="group" aria-label="Drawing tools">
				<button type="button" aria-label="Pen" aria-pressed={!erase} disabled={disabled} onClick={() => setErase(false)}><PencilIcon aria-hidden="true" /></button>
				<button type="button" aria-label="Eraser" aria-pressed={erase} disabled={disabled} onClick={() => setErase(true)}><EraserIcon aria-hidden="true" /></button>
				<button type="button" aria-label="Undo last stroke" disabled={disabled || !count} onClick={() => { history.current.pop(); publish(); }}><Undo2Icon aria-hidden="true" /></button>
				<button type="button" className="practice-drawing-clear" disabled={disabled || !count} onClick={() => { if (window.confirm("Clear all handwriting on this sheet?")) { history.current = []; publish(); } }}>Clear</button>
			</div>
			<label>Thickness<select aria-label="Pen thickness" value={width} disabled={disabled} onChange={event => setWidth(Number(event.target.value))}><option value={2}>Fine</option><option value={4}>Medium</option><option value={8}>Bold</option><option value={14}>Thick</option></select></label>
			<div role="group" aria-label="Pen colors">{COLORS.map((value, index) => <button key={value} type="button" aria-label={`${["Black", "Blue", "Red", "Purple", "Green"][index]} ink`} aria-pressed={color === value} disabled={disabled} onClick={() => { setColor(value); setErase(false); }}><span style={{ background: value }} /></button>)}</div>
		</div>
		<div className="practice-drawing-sheet">
			<canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Drawing sheet. Write your solution with a pencil, mouse, or enabled finger input." onPointerDown={event => {
				if (disabled || gesture.current || (event.pointerType === "touch" && !finger) || (event.pointerType === "mouse" && event.button !== 0)) return;
				event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
				const stroke: Stroke = { points: [point(event)], color, width: erase ? width * 6 : width, erase: erase || event.button === 5 };
				history.current.push(stroke); gesture.current = { id: event.pointerId, stroke }; onDrawing(true); paintStroke(stroke);
			}} onPointerMove={event => {
				if (gesture.current?.id !== event.pointerId) return;
				event.preventDefault();
				const start = gesture.current.stroke.points.length;
				const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
				if (events.length) for (const sample of events) gesture.current.stroke.points.push(point(event, sample));
				else gesture.current.stroke.points.push(point(event));
				paintStroke(gesture.current.stroke, start);
			}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
			{!count && <p className="practice-drawing-placeholder">Write your steps here</p>}
		</div>
		<div className="practice-drawing-footer"><label><input type="checkbox" checked={finger} disabled={disabled} onChange={event => setFinger(event.target.checked)} />Draw with finger</label><span>Pencil or mouse · Scroll outside the sheet</span></div>
		{error && <p role="alert" className="practice-drawing-error">{error}</p>}
	</section>;
}
