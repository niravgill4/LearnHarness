"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
	EraserIcon,
	ExpandIcon,
	Maximize2Icon,
	Minimize2Icon,
	PencilIcon,
	RotateCcwIcon,
	Undo2Icon,
	ZoomInIcon,
	ZoomOutIcon,
	ChevronDownIcon,
	ChevronUpIcon,
} from "lucide-react";
import type { ImageContent } from "@earendil-works/pi-ai";

type Point = { x: number; y: number; pressure: number };
type Stroke = { points: Point[]; color: string; width: number; erase: boolean };
const WIDTH = 1400;
const HEIGHT = 700;
const COLORS = ["#17231a", "#2456a6", "#a32f39", "#6e3b91", "#29754b"];

const PEN_WIDTHS = [
	{ label: "Fine (2px)", value: 2 },
	{ label: "Medium (4px)", value: 4 },
	{ label: "Bold (8px)", value: 8 },
	{ label: "Thick (14px)", value: 14 },
];

const ERASER_SIZES = [
	{ label: "Precision (20px)", value: 20 },
	{ label: "Medium (45px)", value: 45 },
	{ label: "Large (90px)", value: 90 },
	{ label: "Wide Sweep (160px)", value: 160 },
];

export interface PracticeDrawingProps {
	disabled?: boolean;
	onChange(image: ImageContent | undefined): void;
	onDrawing(active: boolean): void;
	question?: ReactNode;
}

/** Fixed sheet coordinates keep handwriting proportional through iPad rotation and zoom. */
export function PracticeDrawing({
	disabled = false,
	onChange,
	onDrawing,
	question,
}: PracticeDrawingProps) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const history = useRef<Stroke[]>([]);
	const gesture = useRef<{ id: number; stroke: Stroke } | null>(null);
	const changed = useRef(onChange);
	changed.current = onChange;

	const [color, setColor] = useState(COLORS[0]!);
	const [penWidth, setPenWidth] = useState(4);
	const [eraserSize, setEraserSize] = useState(45);
	const [erase, setErase] = useState(false);
	const [finger, setFinger] = useState(false);
	const [count, setCount] = useState(0);
	const [error, setError] = useState("");

	// Fullscreen & Question visibility
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [questionExpanded, setQuestionExpanded] = useState(true);

	// Zoom and Pan
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });

	// Multi-touch gestures for pinch zoom
	const activePointers = useRef(new Map<number, { x: number; y: number }>());
	const pinchDistance = useRef<number | null>(null);

	// Eraser visual cursor
	const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number; visible: boolean }>({
		x: 0,
		y: 0,
		visible: false,
	});

	function paintStroke(stroke: Stroke, start = 0) {
		const context = canvas.current?.getContext("2d");
		if (!context) return;
		context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
		context.strokeStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
		context.fillStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
		context.lineCap = "round";
		context.lineJoin = "round";

		stroke.points.slice(start).forEach((point, offset) => {
			const i = start + offset;
			const previous = stroke.points[Math.max(0, i - 1)]!;
			const baseWidth = stroke.erase ? stroke.width : stroke.width * (0.65 + 0.7 * point.pressure);
			context.lineWidth = baseWidth;
			context.beginPath();
			if (i === 0) {
				context.arc(point.x, point.y, baseWidth / 2, 0, Math.PI * 2);
				context.fill();
			} else {
				context.moveTo(previous.x, previous.y);
				context.lineTo(point.x, point.y);
				context.stroke();
			}
		});
		context.globalCompositeOperation = "source-over";
	}

	function paint() {
		const context = canvas.current?.getContext("2d");
		if (!context) return;
		context.clearRect(0, 0, WIDTH, HEIGHT);
		history.current.forEach((stroke) => paintStroke(stroke));
	}

	function publish() {
		paint();
		setCount(history.current.length);
		const source = canvas.current;
		if (!source) return;
		try {
			const context = source.getContext("2d");
			if (!context) throw new Error("Canvas is unavailable");
			const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
			let ink = false;
			for (let i = 3; i < pixels.length; i += 4) {
				if (pixels[i]) {
					ink = true;
					break;
				}
			}
			if (!ink) {
				changed.current(undefined);
				return;
			}
			const sheet = document.createElement("canvas");
			sheet.width = WIDTH;
			sheet.height = HEIGHT;
			const output = sheet.getContext("2d");
			if (!output) throw new Error("Canvas is unavailable");
			output.fillStyle = "#ffffff";
			output.fillRect(0, 0, WIDTH, HEIGHT);
			output.drawImage(source, 0, 0);
			changed.current({
				type: "image",
				mimeType: "image/png",
				data: sheet.toDataURL("image/png").split(",")[1]!,
			});
			setError("");
		} catch {
			changed.current(undefined);
			setError("Your drawing could not be prepared. Please try undoing the last stroke and drawing again.");
		}
	}

	useEffect(() => {
		if (!canvas.current?.getContext("2d")) {
			setError("Drawing is unavailable in this browser. You can still type your answer below.");
		}
	}, []);

	// Listen for Escape key to exit fullscreen
	useEffect(() => {
		if (!isFullscreen) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setIsFullscreen(false);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isFullscreen]);

	function point(
		event: PointerEvent<HTMLCanvasElement>,
		sample: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "pressure"> = event,
	): Point {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: ((sample.clientX - rect.left) / rect.width) * WIDTH,
			y: ((sample.clientY - rect.top) / rect.height) * HEIGHT,
			pressure: event.pointerType === "pen" && sample.pressure > 0 ? sample.pressure : 0.5,
		};
	}

	function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
		activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

		// Multi-touch pinch zoom detection (two fingers on screen)
		if (activePointers.current.size >= 2) {
			if (gesture.current) {
				// Cancel current stroke if a second finger joins for zooming
				history.current.pop();
				gesture.current = null;
				paint();
				onDrawing(false);
			}
			const pts = Array.from(activePointers.current.values());
			pinchDistance.current = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
			return;
		}

		if (
			disabled ||
			gesture.current ||
			(event.pointerType === "touch" && !finger) ||
			(event.pointerType === "mouse" && event.button !== 0)
		) {
			return;
		}

		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);

		const strokeWidth = erase ? eraserSize : penWidth;
		const stroke: Stroke = {
			points: [point(event)],
			color: erase ? "#000000" : color,
			width: strokeWidth,
			erase,
		};

		history.current.push(stroke);
		gesture.current = { id: event.pointerId, stroke };
		onDrawing(true);
		paintStroke(stroke);
	}

	function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
		if (activePointers.current.has(event.pointerId)) {
			activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
		}

		// Handle multi-touch pinch zooming
		if (activePointers.current.size >= 2 && pinchDistance.current !== null) {
			const pts = Array.from(activePointers.current.values());
			const currentDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
			if (currentDist > 10) {
				const factor = currentDist / pinchDistance.current;
				setZoom((prev) => Math.max(0.6, Math.min(3.0, Number((prev * (factor > 1 ? 1.03 : 0.97)).toFixed(2)))));
				pinchDistance.current = currentDist;
			}
			return;
		}

		// Update visual eraser cursor position
		if (erase) {
			const rect = event.currentTarget.getBoundingClientRect();
			setEraserCursor({
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
				visible: true,
			});
		}

		if (gesture.current?.id !== event.pointerId) return;
		event.preventDefault();

		const start = gesture.current.stroke.points.length;
		const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
		if (events.length) {
			for (const sample of events) gesture.current.stroke.points.push(point(event, sample));
		} else {
			gesture.current.stroke.points.push(point(event));
		}
		paintStroke(gesture.current.stroke, start);
	}

	function finish(event: PointerEvent<HTMLCanvasElement>) {
		activePointers.current.delete(event.pointerId);
		if (activePointers.current.size < 2) {
			pinchDistance.current = null;
		}

		if (gesture.current?.id !== event.pointerId) return;
		gesture.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		publish();
		onDrawing(false);
	}

	function handlePointerLeave() {
		setEraserCursor((prev) => ({ ...prev, visible: false }));
	}

	function zoomIn() {
		setZoom((prev) => Math.min(3.0, Number((prev + 0.25).toFixed(2))));
	}

	function zoomOut() {
		setZoom((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))));
	}

	function resetZoom() {
		setZoom(1);
		setPan({ x: 0, y: 0 });
	}

	const toolbar = (
		<div className="practice-drawing-toolbar-glass">
			<div className="practice-drawing-tool-group" role="group" aria-label="Drawing tools">
				<button
					type="button"
					aria-label="Pen"
					aria-pressed={!erase}
					disabled={disabled}
					className={`practice-tool-btn ${!erase ? "is-active" : ""}`}
					onClick={() => setErase(false)}
				>
					<PencilIcon aria-hidden="true" />
					<span>Pen</span>
				</button>
				<button
					type="button"
					aria-label="Eraser"
					aria-pressed={erase}
					disabled={disabled}
					className={`practice-tool-btn ${erase ? "is-active" : ""}`}
					onClick={() => setErase(true)}
				>
					<EraserIcon aria-hidden="true" />
					<span>Eraser</span>
				</button>
			</div>

			<div className="practice-drawing-divider" aria-hidden="true" />

			{/* Thickness / Size Selector */}
			{erase ? (
				<label className="practice-drawing-select-label">
					<span>Eraser size</span>
					<select
						aria-label="Eraser size"
						value={eraserSize}
						disabled={disabled}
						onChange={(e) => setEraserSize(Number(e.target.value))}
					>
						{ERASER_SIZES.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>
			) : (
				<label className="practice-drawing-select-label">
					<span>Pen thickness</span>
					<select
						aria-label="Pen thickness"
						value={penWidth}
						disabled={disabled}
						onChange={(e) => setPenWidth(Number(e.target.value))}
					>
						{PEN_WIDTHS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>
			)}

			{/* Color Swatches (Pen only) */}
			{!erase && (
				<div className="practice-drawing-tool-group" role="group" aria-label="Pen colors">
					{COLORS.map((value, index) => (
						<button
							key={value}
							type="button"
							aria-label={`${["Black", "Blue", "Red", "Purple", "Green"][index]} ink`}
							aria-pressed={color === value}
							disabled={disabled}
							className={`practice-color-btn ${color === value ? "is-selected" : ""}`}
							onClick={() => {
								setColor(value);
								setErase(false);
							}}
						>
							<span style={{ backgroundColor: value }} />
						</button>
					))}
				</div>
			)}

			<div className="practice-drawing-divider" aria-hidden="true" />

			{/* Undo & Clear */}
			<div className="practice-drawing-tool-group" role="group" aria-label="Actions">
				<button
					type="button"
					aria-label="Undo last stroke"
					disabled={disabled || !count}
					className="practice-tool-btn"
					onClick={() => {
						history.current.pop();
						publish();
					}}
				>
					<Undo2Icon aria-hidden="true" />
					<span>Undo</span>
				</button>
				<button
					type="button"
					className="practice-tool-btn practice-drawing-clear"
					disabled={disabled || !count}
					onClick={() => {
						if (window.confirm("Clear all handwriting on this sheet?")) {
							history.current = [];
							publish();
						}
					}}
				>
					Clear
				</button>
			</div>

			<div className="practice-drawing-divider" aria-hidden="true" />

			{/* Zoom Controls */}
			<div className="practice-drawing-tool-group" role="group" aria-label="Zoom controls">
				<button
					type="button"
					aria-label="Zoom out"
					disabled={disabled || zoom <= 0.5}
					className="practice-tool-btn practice-icon-only"
					onClick={zoomOut}
				>
					<ZoomOutIcon aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label="Reset zoom to 100%"
					disabled={disabled}
					className="practice-zoom-readout"
					onClick={resetZoom}
				>
					{Math.round(zoom * 100)}%
				</button>
				<button
					type="button"
					aria-label="Zoom in"
					disabled={disabled || zoom >= 3.0}
					className="practice-tool-btn practice-icon-only"
					onClick={zoomIn}
				>
					<ZoomInIcon aria-hidden="true" />
				</button>
			</div>

			<div className="practice-drawing-divider" aria-hidden="true" />

			{/* Fullscreen Toggle */}
			<button
				type="button"
				aria-label={isFullscreen ? "Exit full screen whiteboard" : "Full screen whiteboard"}
				aria-pressed={isFullscreen}
				className={`practice-tool-btn practice-fullscreen-btn ${isFullscreen ? "is-active" : ""}`}
				onClick={() => setIsFullscreen((prev) => !prev)}
			>
				{isFullscreen ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
				<span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
			</button>
		</div>
	);

	return (
		<section
			className={`practice-drawing ${isFullscreen ? "practice-drawing-fullscreen-mode" : ""}`}
			aria-label="Handwritten answer"
		>
			{/* Floating Glass Question Header in Fullscreen */}
			{isFullscreen && question && (
				<div className="practice-drawing-fs-question-card">
					<div className="practice-drawing-fs-question-header">
						<span className="practice-drawing-fs-badge">Question</span>
						<button
							type="button"
							className="practice-drawing-fs-toggle"
							onClick={() => setQuestionExpanded((prev) => !prev)}
							aria-label={questionExpanded ? "Collapse question" : "Expand question"}
						>
							{questionExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
							<span>{questionExpanded ? "Hide" : "Show"}</span>
						</button>
						<button
							type="button"
							className="practice-drawing-fs-close"
							onClick={() => setIsFullscreen(false)}
							aria-label="Exit fullscreen"
						>
							<Minimize2Icon />
						</button>
					</div>
					{questionExpanded && <div className="practice-drawing-fs-question-body">{question}</div>}
				</div>
			)}

			{/* Inline Toolbar */}
			{!isFullscreen && toolbar}

			{/* Canvas Viewport with Zoom & Pan */}
			<div className="practice-drawing-sheet-viewport">
				<div
					className="practice-drawing-sheet"
					style={{
						transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
						transformOrigin: "center center",
						transition: pinchDistance.current ? "none" : "transform 0.15s ease-out",
					}}
				>
					<canvas
						ref={canvas}
						width={WIDTH}
						height={HEIGHT}
						aria-label="Drawing sheet. Write your solution with a pencil, mouse, or enabled finger input."
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={finish}
						onPointerCancel={finish}
						onLostPointerCapture={finish}
						onPointerLeave={handlePointerLeave}
					/>
					{!count && <p className="practice-drawing-placeholder">Write your steps here</p>}

					{/* Eraser Cursor Indicator */}
					{erase && eraserCursor.visible && (
						<div
							className="practice-eraser-cursor"
							style={{
								left: eraserCursor.x,
								top: eraserCursor.y,
								width: eraserSize * (WIDTH / (canvas.current?.getBoundingClientRect().width || WIDTH)) * 0.5,
								height: eraserSize * (WIDTH / (canvas.current?.getBoundingClientRect().width || WIDTH)) * 0.5,
							}}
						/>
					)}
				</div>
			</div>

			{/* Fullscreen Floating Bottom Toolbar */}
			{isFullscreen && <div className="practice-drawing-fs-toolbar-float">{toolbar}</div>}

			{/* Inline Footer */}
			{!isFullscreen && (
				<div className="practice-drawing-footer">
					<label>
						<input
							type="checkbox"
							checked={finger}
							disabled={disabled}
							onChange={(event) => setFinger(event.target.checked)}
						/>
						Draw with finger
					</label>
					<span>Pinch to zoom · Stylus or mouse · Fullscreen for large canvas</span>
				</div>
			)}

			{error && <p role="alert" className="practice-drawing-error">{error}</p>}
		</section>
	);
}
