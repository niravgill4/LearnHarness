"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	EraserIcon,
	HandIcon,
	Maximize2Icon,
	Minimize2Icon,
	PencilIcon,
	RotateCcwIcon,
	Trash2Icon,
	Undo2Icon,
	ZoomInIcon,
	ZoomOutIcon,
	SparklesIcon,
} from "lucide-react";
import type { ImageContent } from "@earendil-works/pi-ai";

type Point = { x: number; y: number; pressure: number };
type Stroke = { color: string; width: number; points: Point[]; erase?: boolean };

const WIDTH = 1400;
const HEIGHT = 700;
const COLORS = ["#17231a", "#1e40af", "#b91c1c", "#6b21a8", "#047857"];

const PEN_WIDTHS = [
	{ label: "Fine", value: 2, dotSize: 4 },
	{ label: "Medium", value: 4, dotSize: 7 },
	{ label: "Bold", value: 8, dotSize: 11 },
	{ label: "Heavy", value: 14, dotSize: 15 },
];

const ERASER_SIZES = [
	{ label: "Precision", value: 20, ringSize: 12 },
	{ label: "Medium", value: 45, ringSize: 18 },
	{ label: "Large", value: 90, ringSize: 24 },
	{ label: "Sweep", value: 160, ringSize: 30 },
];

export interface PracticeDrawingProps {
	disabled?: boolean;
	onChange(image: ImageContent | undefined): void;
	onDrawing(active: boolean): void;
	question?: ReactNode;
}

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

	// Tool state: "pen" | "eraser" | "pan"
	const [activeTool, setActiveTool] = useState<"pen" | "eraser" | "pan">("pen");
	const [color, setColor] = useState(COLORS[0]!);
	const [penWidth, setPenWidth] = useState(4);
	const [eraserSize, setEraserSize] = useState(45);
	const [finger, setFinger] = useState(false);
	const [strokeCount, setStrokeCount] = useState(0);
	const [error, setError] = useState("");

	// Fullscreen & Question visibility
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [questionExpanded, setQuestionExpanded] = useState(true);

	// Zoom and Pan
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });

	// Multi-touch gestures (Pinch-to-zoom & Two-finger Pan)
	const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
	const prevCentroid = useRef<{ x: number; y: number } | null>(null);
	const prevDistance = useRef<number | null>(null);

	// Single-touch Pan dragging
	const isPanning = useRef(false);
	const lastPanPos = useRef<{ x: number; y: number } | null>(null);

	// Eraser visual cursor preview
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

		stroke.points.slice(start).forEach((p, offset) => {
			const i = start + offset;
			const prev = stroke.points[Math.max(0, i - 1)]!;
			const baseWidth = stroke.erase ? stroke.width : stroke.width * (0.65 + 0.7 * p.pressure);
			context.lineWidth = baseWidth;
			context.beginPath();
			if (i === 0) {
				context.arc(p.x, p.y, baseWidth / 2, 0, Math.PI * 2);
				context.fill();
			} else {
				context.moveTo(prev.x, prev.y);
				context.lineTo(p.x, p.y);
				context.stroke();
			}
		});
	}

	function repaintAll() {
		const context = canvas.current?.getContext("2d");
		if (!context) return;
		context.clearRect(0, 0, WIDTH, HEIGHT);
		history.current.forEach((stroke) => paintStroke(stroke));
	}

	function updateOutput() {
		const c = canvas.current;
		if (!c) return;
		if (!history.current.length) {
			changed.current(undefined);
			return;
		}
		try {
			const data = c.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
			changed.current({ type: "image", mimeType: "image/png", data });
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Canvas export failed");
		}
	}

	function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>): Point {
		const rect = canvas.current?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) {
			return { x: 0, y: 0, pressure: 0.5 };
		}
		const x = Math.max(0, Math.min(WIDTH, ((event.clientX - rect.left) / rect.width) * WIDTH));
		const y = Math.max(0, Math.min(HEIGHT, ((event.clientY - rect.top) / rect.height) * HEIGHT));
		return { x, y, pressure: event.pressure || 0.5 };
	}

	function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
		if (disabled) return;

		// Track active pointers for multi-touch
		activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

		// Multi-touch gesture initiated (2 fingers: Pan + Pinch Zoom)
		if (activePointers.current.size >= 2) {
			if (gesture.current) finishStroke();
			isPanning.current = false;
			const pts = Array.from(activePointers.current.values());
			prevCentroid.current = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
			prevDistance.current = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
			return;
		}

		// Dedicated Pan Tool drag
		if (activeTool === "pan") {
			isPanning.current = true;
			lastPanPos.current = { x: event.clientX, y: event.clientY };
			event.currentTarget.setPointerCapture(event.pointerId);
			return;
		}

		// Ignore touch drawing if finger draw is disabled and pointer is touch
		if (event.pointerType === "touch" && !finger) {
			return;
		}

		// Drawing stroke (Pen or Eraser)
		event.currentTarget.setPointerCapture(event.pointerId);
		onDrawing(true);
		const initialPoint = getCanvasPoint(event);
		const isEraser = activeTool === "eraser";
		const strokeWidth = isEraser ? eraserSize : penWidth;

		gesture.current = {
			id: event.pointerId,
			stroke: {
				color: isEraser ? "rgba(0,0,0,1)" : color,
				width: strokeWidth,
				erase: isEraser,
				points: [initialPoint],
			},
		};
		paintStroke(gesture.current.stroke, 0);
	}

	function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
		// Update active pointers
		if (activePointers.current.has(event.pointerId)) {
			activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

			// Two-finger gesture active: compute centroid shift (pan) + distance shift (zoom)
			if (activePointers.current.size >= 2) {
				const pts = Array.from(activePointers.current.values());
				const currentCentroid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
				const currentDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);

				if (prevCentroid.current) {
					const dx = currentCentroid.x - prevCentroid.current.x;
					const dy = currentCentroid.y - prevCentroid.current.y;
					setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
				}

				if (prevDistance.current && prevDistance.current > 0) {
					const factor = currentDist / prevDistance.current;
					setZoom((prev) => Math.min(3.5, Math.max(0.5, prev * factor)));
				}

				prevCentroid.current = currentCentroid;
				prevDistance.current = currentDist;
				return;
			}
		}

		// Single pointer Pan tool drag
		if (isPanning.current && lastPanPos.current) {
			const dx = event.clientX - lastPanPos.current.x;
			const dy = event.clientY - lastPanPos.current.y;
			setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
			lastPanPos.current = { x: event.clientX, y: event.clientY };
			return;
		}

		// Update eraser cursor position
		if (activeTool === "eraser") {
			const rect = canvas.current?.getBoundingClientRect();
			if (rect) {
				setEraserCursor({
					x: event.clientX - rect.left,
					y: event.clientY - rect.top,
					visible: true,
				});
			}
		}

		// Continue drawing stroke
		if (!gesture.current || gesture.current.id !== event.pointerId) return;
		const nextPoint = getCanvasPoint(event);
		const stroke = gesture.current.stroke;
		const startIdx = Math.max(0, stroke.points.length - 1);
		stroke.points.push(nextPoint);
		paintStroke(stroke, startIdx);
	}

	function finishStroke(event?: PointerEvent<HTMLCanvasElement>) {
		if (event) {
			activePointers.current.delete(event.pointerId);
		}
		if (activePointers.current.size < 2) {
			prevCentroid.current = null;
			prevDistance.current = null;
		}

		if (isPanning.current) {
			isPanning.current = false;
			lastPanPos.current = null;
			return;
		}

		if (!gesture.current) return;
		if (event && gesture.current.id !== event.pointerId) return;

		history.current.push(gesture.current.stroke);
		gesture.current = null;
		setStrokeCount(history.current.length);
		onDrawing(false);
		updateOutput();
	}

	function handlePointerLeave() {
		setEraserCursor((prev) => ({ ...prev, visible: false }));
	}

	function handleUndo() {
		if (!history.current.length || disabled) return;
		history.current.pop();
		repaintAll();
		setStrokeCount(history.current.length);
		updateOutput();
	}

	function handleClear() {
		if (!history.current.length || disabled) return;
		history.current = [];
		repaintAll();
		setStrokeCount(0);
		updateOutput();
	}

	function zoomIn() {
		setZoom((prev) => Math.min(3.5, Number((prev + 0.25).toFixed(2))));
	}

	function zoomOut() {
		setZoom((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))));
	}

	function resetView() {
		setZoom(1);
		setPan({ x: 0, y: 0 });
	}

	// Escape key exits fullscreen
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape" && isFullscreen) {
				setIsFullscreen(false);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isFullscreen]);

	// Lock body scroll when in fullscreen
	useEffect(() => {
		if (isFullscreen) {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}
	}, [isFullscreen]);

	/* ── Apple PencilKit Floating Capsule Toolbar ── */
	const toolbar = (
		<nav
			className={`practice-pencilkit-toolbar ${isFullscreen ? "is-fullscreen" : "is-inline"}`}
			aria-label="Drawing tools"
		>
			{/* Segmented Tool Switcher: Pen | Eraser | Hand */}
			<div className="practice-segmented-tools" role="radiogroup" aria-label="Tool selection">
				<button
					type="button"
					role="radio"
					aria-checked={activeTool === "pen"}
					className={`practice-tool-segment ${activeTool === "pen" ? "is-active" : ""}`}
					onClick={() => setActiveTool("pen")}
					title="Pen (Draw)"
				>
					<PencilIcon className="size-4" aria-hidden="true" />
					<span className="practice-segment-label">Pen</span>
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={activeTool === "eraser"}
					className={`practice-tool-segment ${activeTool === "eraser" ? "is-active" : ""}`}
					onClick={() => setActiveTool("eraser")}
					title="Eraser"
				>
					<EraserIcon className="size-4" aria-hidden="true" />
					<span className="practice-segment-label">Eraser</span>
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={activeTool === "pan"}
					className={`practice-tool-segment ${activeTool === "pan" ? "is-active" : ""}`}
					onClick={() => setActiveTool("pan")}
					title="Hand tool (Drag to move canvas)"
				>
					<HandIcon className="size-4" aria-hidden="true" />
					<span className="practice-segment-label">Move</span>
				</button>
			</div>

			<div className="practice-toolbar-separator" aria-hidden="true" />

			{/* Sub-tool Preset Dots / Chips */}
			{activeTool === "pen" && (
				<div className="practice-size-presets" role="radiogroup" aria-label="Pen thickness">
					{PEN_WIDTHS.map((w) => (
						<button
							key={w.value}
							type="button"
							role="radio"
							aria-checked={penWidth === w.value}
							className={`practice-size-chip ${penWidth === w.value ? "is-active" : ""}`}
							onClick={() => setPenWidth(w.value)}
							title={`Pen: ${w.label}`}
						>
							<span
								className="practice-pen-dot"
								style={{
									width: `${w.dotSize}px`,
									height: `${w.dotSize}px`,
									backgroundColor: color,
								}}
							/>
						</button>
					))}
				</div>
			)}

			{activeTool === "eraser" && (
				<div className="practice-size-presets" role="radiogroup" aria-label="Eraser diameter">
					{ERASER_SIZES.map((es) => (
						<button
							key={es.value}
							type="button"
							role="radio"
							aria-checked={eraserSize === es.value}
							className={`practice-size-chip ${eraserSize === es.value ? "is-active" : ""}`}
							onClick={() => setEraserSize(es.value)}
							title={`Eraser: ${es.label}`}
						>
							<span
								className="practice-eraser-ring"
								style={{
									width: `${es.ringSize}px`,
									height: `${es.ringSize}px`,
								}}
							/>
						</button>
					))}
				</div>
			)}

			{activeTool === "pan" && (
				<button
					type="button"
					className="practice-recenter-btn"
					onClick={resetView}
					title="Recenter canvas position and 100% zoom"
				>
					<RotateCcwIcon className="size-3.5" aria-hidden="true" />
					<span>Recenter</span>
				</button>
			)}

			<div className="practice-toolbar-separator" aria-hidden="true" />

			{/* Color Swatches */}
			<div className="practice-color-swatches" role="radiogroup" aria-label="Colors">
				{COLORS.map((swatch) => (
					<button
						key={swatch}
						type="button"
						role="radio"
						aria-checked={color === swatch && activeTool === "pen"}
						className={`practice-color-swatch ${color === swatch && activeTool === "pen" ? "is-active" : ""}`}
						style={{ "--swatch-bg": swatch } as React.CSSProperties}
						onClick={() => {
							setColor(swatch);
							if (activeTool !== "pen") setActiveTool("pen");
						}}
						title={`Color ${swatch}`}
					>
						<span className="practice-color-fill" style={{ backgroundColor: swatch }} />
					</button>
				))}
			</div>

			<div className="practice-toolbar-separator" aria-hidden="true" />

			{/* Canvas Actions: Undo & Clear */}
			<div className="practice-action-buttons">
				<button
					type="button"
					aria-label="Undo stroke"
					disabled={disabled || !strokeCount}
					className="practice-action-btn"
					onClick={handleUndo}
					title="Undo"
				>
					<Undo2Icon className="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label="Clear whiteboard"
					disabled={disabled || !strokeCount}
					className="practice-action-btn"
					onClick={handleClear}
					title="Clear canvas"
				>
					<Trash2Icon className="size-4" aria-hidden="true" />
				</button>
			</div>

			<div className="practice-toolbar-separator" aria-hidden="true" />

			{/* Zoom Controls */}
			<div className="practice-zoom-cluster">
				<button
					type="button"
					aria-label="Zoom out"
					disabled={disabled || zoom <= 0.5}
					className="practice-action-btn"
					onClick={zoomOut}
					title="Zoom out"
				>
					<ZoomOutIcon className="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label="Reset zoom and center"
					disabled={disabled}
					className="practice-zoom-pill"
					onClick={resetView}
					title="Tap to reset zoom and center"
				>
					{Math.round(zoom * 100)}%
				</button>
				<button
					type="button"
					aria-label="Zoom in"
					disabled={disabled || zoom >= 3.5}
					className="practice-action-btn"
					onClick={zoomIn}
					title="Zoom in"
				>
					<ZoomInIcon className="size-4" aria-hidden="true" />
				</button>
			</div>

			<div className="practice-toolbar-separator" aria-hidden="true" />

			{/* Finger Draw Toggle */}
			<button
				type="button"
				aria-pressed={finger}
				className={`practice-finger-toggle ${finger ? "is-active" : ""}`}
				onClick={() => setFinger((prev) => !prev)}
				title={finger ? "Drawing with finger enabled" : "Apple Pencil / Stylus only (finger draws disabled)"}
			>
				<span className="practice-finger-dot" />
				<span className="practice-finger-text">{finger ? "Finger On" : "Pencil Only"}</span>
			</button>

			{/* Inline Expand button (only shown when not in fullscreen) */}
			{!isFullscreen && (
				<>
					<div className="practice-toolbar-separator" aria-hidden="true" />
					<button
						type="button"
						aria-label="Full screen whiteboard"
						className="practice-expand-fullscreen-btn"
						onClick={() => setIsFullscreen(true)}
						title="Open full screen whiteboard"
					>
						<Maximize2Icon className="size-4" aria-hidden="true" />
						<span>Fullscreen</span>
					</button>
				</>
			)}
		</nav>
	);

	return (
		<section
			className={`practice-drawing-root ${isFullscreen ? "is-fullscreen-view" : "is-inline-view"}`}
			aria-label="Handwritten answer workspace"
		>
			{/* Fixed Top Bar (Fullscreen Only) */}
			{isFullscreen && (
				<header className="practice-fs-topbar" role="banner">
					{/* Left / Center: Readable Question Card */}
					<div className={`practice-fs-question-card ${questionExpanded ? "is-expanded" : "is-collapsed"}`}>
						<div className="practice-fs-question-meta">
							<span className="practice-fs-question-badge">
								<SparklesIcon className="size-3" aria-hidden="true" />
								Question
							</span>
							{question && (
								<button
									type="button"
									className="practice-fs-collapse-toggle"
									onClick={() => setQuestionExpanded((prev) => !prev)}
									aria-label={questionExpanded ? "Collapse question" : "Expand question"}
								>
									{questionExpanded ? (
										<>
											<ChevronUpIcon className="size-3.5" aria-hidden="true" />
											<span>Collapse</span>
										</>
									) : (
										<>
											<ChevronDownIcon className="size-3.5" aria-hidden="true" />
											<span>View Question</span>
										</>
									)}
								</button>
							)}
						</div>
						{questionExpanded && (
							<div className="practice-fs-question-content">
								{question || <p className="text-muted-foreground text-xs italic">No question statement attached.</p>}
							</div>
						)}
					</div>

					{/* Right: Prominent Native iPad "Done" Button (ALWAYS visible) */}
					<button
						type="button"
						className="practice-fs-done-btn"
						onClick={() => setIsFullscreen(false)}
						aria-label="Exit full screen whiteboard"
						title="Exit full screen"
					>
						<Minimize2Icon className="size-4" aria-hidden="true" />
						<span>Done</span>
					</button>
				</header>
			)}

			{/* Inline Toolbar (placed above sheet when inline) */}
			{!isFullscreen && <div className="practice-inline-toolbar-wrap">{toolbar}</div>}

			{/* Whiteboard Canvas Viewport */}
			<div className={`practice-canvas-viewport ${activeTool === "pan" ? "is-panning-mode" : ""}`}>
				<div
					className="practice-canvas-surface"
					style={{
						transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
						transformOrigin: "center center",
						transition: activePointers.current.size >= 2 || isPanning.current ? "none" : "transform 0.12s ease-out",
					}}
				>
					<canvas
						ref={canvas}
						width={WIDTH}
						height={HEIGHT}
						aria-label="Whiteboard canvas. Draw with Apple Pencil, mouse, or touch."
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={finishStroke}
						onPointerCancel={finishStroke}
						onLostPointerCapture={finishStroke}
						onPointerLeave={handlePointerLeave}
					/>
					{!strokeCount && (
						<div className="practice-canvas-placeholder" aria-hidden="true">
							<span>Write or draw your solution here</span>
						</div>
					)}

					{/* Eraser Visual Cursor Preview Ring */}
					{activeTool === "eraser" && eraserCursor.visible && (
						<div
							className="practice-eraser-cursor-ring"
							style={{
								left: `${eraserCursor.x}px`,
								top: `${eraserCursor.y}px`,
								width: `${eraserSize * (WIDTH / (canvas.current?.getBoundingClientRect().width || WIDTH)) * 0.5}px`,
								height: `${eraserSize * (WIDTH / (canvas.current?.getBoundingClientRect().width || WIDTH)) * 0.5}px`,
							}}
							aria-hidden="true"
						/>
					)}
				</div>
			</div>

			{/* Fullscreen Floating Bottom Capsule Toolbar */}
			{isFullscreen && <div className="practice-fullscreen-toolbar-float">{toolbar}</div>}

			{/* Inline Hint Footer */}
			{!isFullscreen && (
				<footer className="practice-inline-footer">
					<span>Pinch or 2-finger drag to zoom & pan · Apple Pencil supported</span>
				</footer>
			)}

			{error && <p role="alert" className="practice-error-banner">{error}</p>}
		</section>
	);
}
