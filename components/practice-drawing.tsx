"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	EraserIcon,
	HandIcon,
	Maximize2Icon,
	Minimize2Icon,
	PencilIcon,
	RotateCcwIcon,
	SparklesIcon,
	Trash2Icon,
	Undo2Icon,
	ZoomInIcon,
	ZoomOutIcon,
} from "lucide-react";
import type { ImageContent } from "@earendil-works/pi-ai";

type Point = { x: number; y: number; pressure: number };
type Stroke = { color: string; width: number; points: Point[]; erase?: boolean };

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
	// Canvas ref for current visible view (inline or fullscreen)
	const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
	const fsCanvasRef = useRef<HTMLCanvasElement>(null);

	// All completed strokes in infinite world space
	const history = useRef<Stroke[]>([]);
	const gesture = useRef<{ id: number; stroke: Stroke } | null>(null);
	const changed = useRef(onChange);
	changed.current = onChange;

	// Mounted state for SSR portal safety
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Tool states
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

	// Infinite Canvas Navigation: Zoom and Pan
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });

	// Multi-touch gestures (Two-finger pan and pinch zoom)
	const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
	const prevCentroid = useRef<{ x: number; y: number } | null>(null);
	const prevDistance = useRef<number | null>(null);

	// Single pointer Pan dragging
	const isDraggingPan = useRef(false);
	const lastPointerPos = useRef<{ x: number; y: number } | null>(null);

	// Eraser visual cursor
	const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number; visible: boolean }>({
		x: 0,
		y: 0,
		visible: false,
	});

	// Get active canvas element depending on mode
	function getActiveCanvas(): HTMLCanvasElement | null {
		return isFullscreen ? fsCanvasRef.current : inlineCanvasRef.current;
	}

	// World coordinates to Screen coordinates
	function worldToScreen(p: Point, canvas: HTMLCanvasElement): { x: number; y: number } {
		const rect = canvas.getBoundingClientRect();
		return {
			x: p.x * zoom + pan.x + rect.width / 2,
			y: p.y * zoom + pan.y + rect.height / 2,
		};
	}

	// Screen coordinates to World coordinates
	function screenToWorld(clientX: number, clientY: number, canvas: HTMLCanvasElement): Point {
		const rect = canvas.getBoundingClientRect();
		const screenX = clientX - rect.left;
		const screenY = clientY - rect.top;
		return {
			x: (screenX - rect.width / 2 - pan.x) / zoom,
			y: (screenY - rect.height / 2 - pan.y) / zoom,
			pressure: 0.5,
		};
	}

	// Paint a single stroke onto the canvas context
	function drawStroke(
		context: CanvasRenderingContext2D,
		stroke: Stroke,
		canvas: HTMLCanvasElement,
		startIdx = 0,
	) {
		if (!stroke.points.length) return;
		context.save();
		context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
		context.strokeStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
		context.fillStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
		context.lineCap = "round";
		context.lineJoin = "round";

		const baseWidth = (stroke.erase ? stroke.width : stroke.width) * zoom;

		stroke.points.slice(startIdx).forEach((p, offset) => {
			const i = startIdx + offset;
			const screenPt = worldToScreen(p, canvas);
			const width = stroke.erase ? baseWidth : baseWidth * (0.65 + 0.7 * p.pressure);
			context.lineWidth = Math.max(1, width);
			context.beginPath();

			if (i === 0) {
				context.arc(screenPt.x, screenPt.y, Math.max(0.5, width / 2), 0, Math.PI * 2);
				context.fill();
			} else {
				const prevScreen = worldToScreen(stroke.points[i - 1]!, canvas);
				context.moveTo(prevScreen.x, prevScreen.y);
				context.lineTo(screenPt.x, screenPt.y);
				context.stroke();
			}
		});

		context.restore();
	}

	// Redraw all strokes onto the active canvas
	function repaint() {
		const canvas = getActiveCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;

		const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
		if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
			canvas.width = Math.round(rect.width * dpr);
			canvas.height = Math.round(rect.height * dpr);
		}

		const context = canvas.getContext("2d");
		if (!context) return;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.scale(dpr, dpr);

		for (const s of history.current) {
			drawStroke(context, s, canvas, 0);
		}

		if (gesture.current) {
			drawStroke(context, gesture.current.stroke, canvas, 0);
		}
	}

	// Re-render when pan, zoom, or mode changes
	useLayoutEffect(() => {
		repaint();
	}, [pan, zoom, isFullscreen]);

	// Window resize handler to maintain sharp infinite canvas
	useEffect(() => {
		function onResize() {
			repaint();
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [isFullscreen]);

	// Export bounded content to base64 PNG
	function updateOutput() {
		if (!history.current.length) {
			changed.current(undefined);
			return;
		}

		// Calculate world bounding box of all strokes
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const stroke of history.current) {
			for (const p of stroke.points) {
				if (p.x < minX) minX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.x > maxX) maxX = p.x;
				if (p.y > maxY) maxY = p.y;
			}
		}

		if (!isFinite(minX) || !isFinite(minY)) {
			changed.current(undefined);
			return;
		}

		const padding = 50;
		const contentW = Math.max(100, Math.ceil(maxX - minX + padding * 2));
		const contentH = Math.max(100, Math.ceil(maxY - minY + padding * 2));

		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = contentW;
		exportCanvas.height = contentH;
		const ctx = exportCanvas.getContext("2d");
		if (!ctx) return;

		// White background for submission export
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, contentW, contentH);

		ctx.save();
		ctx.translate(-minX + padding, -minY + padding);

		// Render all strokes onto export canvas
		for (const stroke of history.current) {
			ctx.save();
			ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
			ctx.strokeStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
			ctx.fillStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			stroke.points.forEach((p, i) => {
				const w = stroke.erase ? stroke.width : stroke.width * (0.65 + 0.7 * p.pressure);
				ctx.lineWidth = Math.max(1, w);
				ctx.beginPath();
				if (i === 0) {
					ctx.arc(p.x, p.y, Math.max(0.5, w / 2), 0, Math.PI * 2);
					ctx.fill();
				} else {
					const prev = stroke.points[i - 1]!;
					ctx.moveTo(prev.x, prev.y);
					ctx.lineTo(p.x, p.y);
					ctx.stroke();
				}
			});
			ctx.restore();
		}
		ctx.restore();

		try {
			const data = exportCanvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
			changed.current({ type: "image", mimeType: "image/png", data });
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Canvas export failed");
		}
	}

	function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
		if (disabled) return;
		const canvas = getActiveCanvas();
		if (!canvas) return;

		activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

		// Two-finger gesture started: pan + pinch zoom
		if (activePointers.current.size >= 2) {
			if (gesture.current) finishStroke();
			isDraggingPan.current = false;
			const pts = Array.from(activePointers.current.values());
			prevCentroid.current = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
			prevDistance.current = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
			return;
		}

		// Dedicated Hand/Pan mode
		if (activeTool === "pan") {
			isDraggingPan.current = true;
			lastPointerPos.current = { x: event.clientX, y: event.clientY };
			event.currentTarget.setPointerCapture(event.pointerId);
			return;
		}

		// Finger drawing check
		if (event.pointerType === "touch" && !finger) {
			return;
		}

		// Drawing stroke
		event.currentTarget.setPointerCapture(event.pointerId);
		onDrawing(true);

		const worldPt = screenToWorld(event.clientX, event.clientY, canvas);
		worldPt.pressure = event.pressure || 0.5;

		const isEraser = activeTool === "eraser";
		const strokeWidth = isEraser ? eraserSize : penWidth;

		gesture.current = {
			id: event.pointerId,
			stroke: {
				color: isEraser ? "rgba(0,0,0,1)" : color,
				width: strokeWidth,
				erase: isEraser,
				points: [worldPt],
			},
		};

		// Draw immediate point
		const ctx = canvas.getContext("2d");
		if (ctx) {
			const dpr = window.devicePixelRatio || 1;
			ctx.save();
			ctx.scale(dpr, dpr);
			drawStroke(ctx, gesture.current.stroke, canvas, 0);
			ctx.restore();
		}
	}

	function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
		const canvas = getActiveCanvas();
		if (!canvas) return;

		if (activePointers.current.has(event.pointerId)) {
			activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

			// Two-finger pan & pinch zoom active
			if (activePointers.current.size >= 2) {
				const pts = Array.from(activePointers.current.values());
				const currCentroid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
				const currDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);

				if (prevCentroid.current) {
					const dx = currCentroid.x - prevCentroid.current.x;
					const dy = currCentroid.y - prevCentroid.current.y;
					setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
				}

				if (prevDistance.current && prevDistance.current > 0) {
					const factor = currDist / prevDistance.current;
					setZoom((prev) => Math.min(4, Math.max(0.2, prev * factor)));
				}

				prevCentroid.current = currCentroid;
				prevDistance.current = currDist;
				return;
			}
		}

		// Single pointer Move/Pan tool
		if (isDraggingPan.current && lastPointerPos.current) {
			const dx = event.clientX - lastPointerPos.current.x;
			const dy = event.clientY - lastPointerPos.current.y;
			setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
			lastPointerPos.current = { x: event.clientX, y: event.clientY };
			return;
		}

		// Update eraser cursor ring
		if (activeTool === "eraser") {
			const rect = canvas.getBoundingClientRect();
			setEraserCursor({
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
				visible: true,
			});
		}

		// Continue drawing stroke
		if (!gesture.current || gesture.current.id !== event.pointerId) return;

		const worldPt = screenToWorld(event.clientX, event.clientY, canvas);
		worldPt.pressure = event.pressure || 0.5;

		const stroke = gesture.current.stroke;
		const startIdx = Math.max(0, stroke.points.length - 1);
		stroke.points.push(worldPt);

		const ctx = canvas.getContext("2d");
		if (ctx) {
			const dpr = window.devicePixelRatio || 1;
			ctx.save();
			ctx.scale(dpr, dpr);
			drawStroke(ctx, stroke, canvas, startIdx);
			ctx.restore();
		}
	}

	function finishStroke(event?: PointerEvent<HTMLCanvasElement>) {
		if (event) {
			activePointers.current.delete(event.pointerId);
		}
		if (activePointers.current.size < 2) {
			prevCentroid.current = null;
			prevDistance.current = null;
		}

		if (isDraggingPan.current) {
			isDraggingPan.current = false;
			lastPointerPos.current = null;
			return;
		}

		if (!gesture.current) return;
		if (event && gesture.current.id !== event.pointerId) return;

		history.current.push(gesture.current.stroke);
		gesture.current = null;
		setStrokeCount(history.current.length);
		onDrawing(false);
		repaint();
		updateOutput();
	}

	function handlePointerLeave() {
		setEraserCursor((prev) => ({ ...prev, visible: false }));
	}

	function handleUndo() {
		if (!history.current.length || disabled) return;
		history.current.pop();
		setStrokeCount(history.current.length);
		repaint();
		updateOutput();
	}

	function handleClear() {
		if (!history.current.length || disabled) return;
		history.current = [];
		setStrokeCount(0);
		repaint();
		updateOutput();
	}

	function zoomIn() {
		setZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
	}

	function zoomOut() {
		setZoom((prev) => Math.max(0.2, Number((prev - 0.25).toFixed(2))));
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

	// Prevent document body scrolling in fullscreen
	useEffect(() => {
		if (isFullscreen) {
			const original = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = original;
			};
		}
	}, [isFullscreen]);

	/* ── Shared Tool Selection Component ── */
	const toolSwitcher = (
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
				<span>Pen</span>
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
				<span>Eraser</span>
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={activeTool === "pan"}
				className={`practice-tool-segment ${activeTool === "pan" ? "is-active" : ""}`}
				onClick={() => setActiveTool("pan")}
				title="Move canvas (Drag with finger or stylus)"
			>
				<HandIcon className="size-4" aria-hidden="true" />
				<span>Move</span>
			</button>
		</div>
	);

	/* ── Shared Size Presets Component ── */
	const sizePresets = (
		<div className="practice-size-presets" role="radiogroup" aria-label="Tool size presets">
			{activeTool === "pen" &&
				PEN_WIDTHS.map((w) => (
					<button
						key={w.value}
						type="button"
						role="radio"
						aria-checked={penWidth === w.value}
						className={`practice-size-chip ${penWidth === w.value ? "is-active" : ""}`}
						onClick={() => setPenWidth(w.value)}
						title={`Pen thickness: ${w.label}`}
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

			{activeTool === "eraser" &&
				ERASER_SIZES.map((es) => (
					<button
						key={es.value}
						type="button"
						role="radio"
						aria-checked={eraserSize === es.value}
						className={`practice-size-chip ${eraserSize === es.value ? "is-active" : ""}`}
						onClick={() => setEraserSize(es.value)}
						title={`Eraser size: ${es.label}`}
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

			{activeTool === "pan" && (
				<button
					type="button"
					className="practice-recenter-btn"
					onClick={resetView}
					title="Recenter view and 100% zoom"
				>
					<RotateCcwIcon className="size-3.5" aria-hidden="true" />
					<span>Recenter</span>
				</button>
			)}
		</div>
	);

	/* ── Shared Color Swatches Component ── */
	const colorSwatches = (
		<div className="practice-color-swatches" role="radiogroup" aria-label="Ink color">
			{COLORS.map((swatch) => (
				<button
					key={swatch}
					type="button"
					role="radio"
					aria-checked={color === swatch && activeTool === "pen"}
					className={`practice-color-swatch ${color === swatch && activeTool === "pen" ? "is-active" : ""}`}
					onClick={() => {
						setColor(swatch);
						if (activeTool !== "pen") setActiveTool("pen");
					}}
					title={`Ink color ${swatch}`}
				>
					<span className="practice-color-fill" style={{ backgroundColor: swatch }} />
				</button>
			))}
		</div>
	);

	/* ── Action & Zoom Utilities ── */
	const actionAndZoom = (
		<>
			<div className="practice-action-buttons">
				<button
					type="button"
					aria-label="Undo"
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
					title="Clear"
				>
					<Trash2Icon className="size-4" aria-hidden="true" />
				</button>
			</div>

			<div className="practice-toolbar-separator" aria-hidden="true" />

			<div className="practice-zoom-cluster">
				<button
					type="button"
					aria-label="Zoom out"
					disabled={disabled || zoom <= 0.2}
					className="practice-action-btn"
					onClick={zoomOut}
					title="Zoom out"
				>
					<ZoomOutIcon className="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label="Reset zoom"
					disabled={disabled}
					className="practice-zoom-pill"
					onClick={resetView}
					title="Tap to recenter and reset 100%"
				>
					{Math.round(zoom * 100)}%
				</button>
				<button
					type="button"
					aria-label="Zoom in"
					disabled={disabled || zoom >= 4}
					className="practice-action-btn"
					onClick={zoomIn}
					title="Zoom in"
				>
					<ZoomInIcon className="size-4" aria-hidden="true" />
				</button>
			</div>

			<div className="practice-toolbar-separator" aria-hidden="true" />

			<button
				type="button"
				aria-pressed={finger}
				className={`practice-finger-toggle ${finger ? "is-active" : ""}`}
				onClick={() => setFinger((prev) => !prev)}
				title={finger ? "Finger drawing ON" : "Apple Pencil only"}
			>
				<span className="practice-finger-dot" />
				<span>{finger ? "Finger On" : "Pencil Only"}</span>
			</button>
		</>
	);

	/* ── Fullscreen Overlay Rendered Via React Portal ── */
	const fullscreenOverlay = isFullscreen && mounted && createPortal(
		<div className="practice-fullscreen-portal-root" role="dialog" aria-modal="true" aria-label="Unlimited Whiteboard">
			{/* Fixed Top Bar */}
			<header className="practice-fs-topbar" role="banner">
				{/* Question Card */}
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
										<span>Hide</span>
									</>
								) : (
									<>
										<ChevronDownIcon className="size-3.5" aria-hidden="true" />
										<span>Show Question</span>
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

				{/* Prominent iPad "Done" Exit Button */}
				<button
					type="button"
					className="practice-fs-done-btn"
					onClick={() => setIsFullscreen(false)}
					aria-label="Exit full screen whiteboard"
					title="Exit full screen (Esc)"
				>
					<Minimize2Icon className="size-4" aria-hidden="true" />
					<span>Done</span>
				</button>
			</header>

			{/* Infinite Whiteboard Canvas Viewport */}
			<div
				className={`practice-infinite-viewport is-fullscreen ${activeTool === "pan" ? "is-panning" : ""}`}
				style={{
					backgroundPosition: `${pan.x}px ${pan.y}px`,
					backgroundSize: `${32 * zoom}px ${32 * zoom}`,
				}}
			>
				<canvas
					ref={fsCanvasRef}
					className="practice-infinite-canvas"
					aria-label="Unlimited Whiteboard. Write with Apple Pencil, mouse, or touch."
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={finishStroke}
					onPointerCancel={finishStroke}
					onLostPointerCapture={finishStroke}
					onPointerLeave={handlePointerLeave}
				/>

				{!strokeCount && (
					<div className="practice-canvas-placeholder" aria-hidden="true">
						<span>Unlimited Whiteboard · Pan and zoom anywhere</span>
					</div>
				)}

				{/* Eraser Cursor Preview Ring */}
				{activeTool === "eraser" && eraserCursor.visible && (
					<div
						className="practice-eraser-cursor-ring"
						style={{
							left: `${eraserCursor.x}px`,
							top: `${eraserCursor.y}px`,
							width: `${eraserSize * zoom}px`,
							height: `${eraserSize * zoom}px`,
						}}
						aria-hidden="true"
					/>
				)}
			</div>

			{/* Floating Apple PencilKit Capsule Toolbar */}
			<div className="practice-fullscreen-toolbar-float">
				<nav className="practice-pencilkit-toolbar is-fullscreen" aria-label="Drawing tools">
					{toolSwitcher}
					<div className="practice-toolbar-separator" aria-hidden="true" />
					{sizePresets}
					<div className="practice-toolbar-separator" aria-hidden="true" />
					{colorSwatches}
					<div className="practice-toolbar-separator" aria-hidden="true" />
					{actionAndZoom}
				</nav>
			</div>
		</div>,
		document.body,
	);

	return (
		<section className="practice-drawing-root is-inline-view" aria-label="Handwritten answer workspace">
			{/* Inline 2-Row Responsive Toolbar */}
			<div className="practice-inline-two-row-toolbar">
				{/* Row 1: Tools, Sizes & Colors */}
				<div className="practice-inline-toolbar-row">
					{toolSwitcher}
					<div className="practice-toolbar-separator" aria-hidden="true" />
					{sizePresets}
					<div className="practice-toolbar-separator" aria-hidden="true" />
					{colorSwatches}
				</div>

				{/* Row 2: Actions, Zoom & Prominent Fullscreen Button */}
				<div className="practice-inline-toolbar-row is-secondary-row">
					<div className="practice-inline-actions-group">
						{actionAndZoom}
					</div>

					{/* Prominent Fullscreen Expand Button */}
					<button
						type="button"
						className="practice-expand-fullscreen-btn"
						onClick={() => setIsFullscreen(true)}
						title="Open unlimited full screen whiteboard"
						aria-label="Open unlimited full screen whiteboard"
					>
						<Maximize2Icon className="size-4" aria-hidden="true" />
						<span>Fullscreen</span>
					</button>
				</div>
			</div>

			{/* Inline Infinite Canvas Viewport */}
			<div
				className={`practice-infinite-viewport is-inline ${activeTool === "pan" ? "is-panning" : ""}`}
				style={{
					backgroundPosition: `${pan.x}px ${pan.y}px`,
					backgroundSize: `${28 * zoom}px ${28 * zoom}`,
				}}
			>
				<canvas
					ref={inlineCanvasRef}
					className="practice-infinite-canvas"
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

				{/* Eraser Cursor Preview Ring */}
				{activeTool === "eraser" && eraserCursor.visible && (
					<div
						className="practice-eraser-cursor-ring"
						style={{
							left: `${eraserCursor.x}px`,
							top: `${eraserCursor.y}px`,
							width: `${eraserSize * zoom}px`,
							height: `${eraserSize * zoom}px`,
						}}
						aria-hidden="true"
					/>
				)}
			</div>

			{/* Inline Hint Footer */}
			<footer className="practice-inline-footer">
				<span>Pinch or 2-finger drag to pan & zoom · Unlimited canvas</span>
			</footer>

			{error && <p role="alert" className="practice-error-banner">{error}</p>}

			{/* Fullscreen Portal */}
			{fullscreenOverlay}
		</section>
	);
}
