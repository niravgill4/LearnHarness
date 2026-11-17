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

	// DOM elements for direct cursor transforms (bypassing React re-renders)
	const inlineCursorRef = useRef<HTMLDivElement>(null);
	const fsCursorRef = useRef<HTMLDivElement>(null);

	// Cached bounding rect during gestures to eliminate DOM reflows
	const cachedRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

	// All completed strokes in infinite world space
	const history = useRef<Stroke[]>([]);
	const gesture = useRef<{ id: number; stroke: Stroke } | null>(null);
	const changed = useRef(onChange);
	changed.current = onChange;

	// Debounce timer for base64 PNG export
	const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Mounted state for SSR portal safety
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Tool states
	const [activeTool, setActiveTool] = useState<"pen" | "eraser" | "pan">("pen");
	const activeToolRef = useRef(activeTool);
	activeToolRef.current = activeTool;

	const [color, setColor] = useState(COLORS[0]!);
	const colorRef = useRef(color);
	colorRef.current = color;

	const [penWidth, setPenWidth] = useState(4);
	const penWidthRef = useRef(penWidth);
	penWidthRef.current = penWidth;

	const [eraserSize, setEraserSize] = useState(45);
	const eraserSizeRef = useRef(eraserSize);
	eraserSizeRef.current = eraserSize;

	const [finger, setFinger] = useState(false);
	const fingerRef = useRef(finger);
	fingerRef.current = finger;

	const [strokeCount, setStrokeCount] = useState(0);
	const [error, setError] = useState("");

	// Fullscreen & Question visibility
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [questionExpanded, setQuestionExpanded] = useState(true);

	// Infinite Canvas Navigation: Zoom and Pan
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const zoomRef = useRef(zoom);
	zoomRef.current = zoom;
	const panRef = useRef(pan);
	panRef.current = pan;

	// Dedicated stylus/pen tracking for hardware palm rejection & fast writing grace period
	const activePenId = useRef<number | null>(null);
	const lastPenTime = useRef(0);

	// Multi-touch gestures (Two-finger pan and pinch zoom - touch only, never pen)
	const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map());
	const prevCentroid = useRef<{ x: number; y: number } | null>(null);
	const prevDistance = useRef<number | null>(null);

	// Single pointer Pan dragging
	const isDraggingPan = useRef(false);
	const lastPointerPos = useRef<{ x: number; y: number } | null>(null);
	const rafId = useRef<number | null>(null);

	// Get active canvas element depending on mode
	function getActiveCanvas(): HTMLCanvasElement | null {
		return isFullscreen ? fsCanvasRef.current : inlineCanvasRef.current;
	}

	function getActiveCursor(): HTMLDivElement | null {
		return isFullscreen ? fsCursorRef.current : inlineCursorRef.current;
	}

	function updateCachedRect(canvas: HTMLCanvasElement) {
		const r = canvas.getBoundingClientRect();
		cachedRectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
		return cachedRectRef.current;
	}

	// Screen coordinates to World coordinates (using cached rect)
	function screenToWorld(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point {
		const z = zoomRef.current;
		const p = panRef.current;
		const screenX = clientX - rect.left;
		const screenY = clientY - rect.top;
		return {
			x: (screenX - rect.width / 2 - p.x) / z,
			y: (screenY - rect.height / 2 - p.y) / z,
			pressure: 0.5,
		};
	}

	// Apply hardware transform matrix to 2D context
	function applyTransform(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
		const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
		const z = zoomRef.current;
		const p = panRef.current;
		const rect = cachedRectRef.current || { width: canvas.clientWidth, height: canvas.clientHeight };
		ctx.setTransform(
			dpr * z,
			0,
			0,
			dpr * z,
			(p.x + rect.width / 2) * dpr,
			(p.y + rect.height / 2) * dpr,
		);
	}

	// Draw a stroke using GPU-accelerated world coordinates
	function drawStrokeInWorld(ctx: CanvasRenderingContext2D, stroke: Stroke, startIdx = 0) {
		if (!stroke.points.length) return;
		ctx.save();
		ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
		ctx.strokeStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
		ctx.fillStyle = stroke.erase ? "rgba(0,0,0,1)" : stroke.color;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		stroke.points.slice(startIdx).forEach((pt, offset) => {
			const i = startIdx + offset;
			const width = stroke.erase ? stroke.width : stroke.width * (0.65 + 0.7 * pt.pressure);
			ctx.lineWidth = Math.max(1, width);
			ctx.beginPath();

			if (i === 0) {
				ctx.arc(pt.x, pt.y, Math.max(0.5, width / 2), 0, Math.PI * 2);
				ctx.fill();
			} else {
				const prev = stroke.points[i - 1]!;
				ctx.moveTo(prev.x, prev.y);
				ctx.lineTo(pt.x, pt.y);
				ctx.stroke();
			}
		});

		ctx.restore();
	}

	// High-performance repaint using hardware transforms
	function repaint() {
		const canvas = getActiveCanvas();
		if (!canvas) return;
		const rect = updateCachedRect(canvas);
		if (rect.width === 0 || rect.height === 0) return;

		const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
		const targetW = Math.round(rect.width * dpr);
		const targetH = Math.round(rect.height * dpr);

		if (canvas.width !== targetW || canvas.height !== targetH) {
			canvas.width = targetW;
			canvas.height = targetH;
		}

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		applyTransform(ctx, canvas);

		for (const s of history.current) {
			drawStrokeInWorld(ctx, s, 0);
		}

		if (gesture.current) {
			drawStrokeInWorld(ctx, gesture.current.stroke, 0);
		}
	}

	// Repaint on zoom/pan/mode change
	useLayoutEffect(() => {
		repaint();
	}, [pan, zoom, isFullscreen]);

	// Window resize handler
	useEffect(() => {
		function onResize() {
			repaint();
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [isFullscreen]);

	// Debounced background export to avoid stutter during pen drawing
	function scheduleExport() {
		if (exportTimer.current) clearTimeout(exportTimer.current);
		exportTimer.current = setTimeout(() => {
			performExport();
		}, 250);
	}

	function performExport() {
		if (!history.current.length) {
			changed.current(undefined);
			return;
		}

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

		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, contentW, contentH);

		ctx.save();
		ctx.translate(-minX + padding, -minY + padding);

		for (const stroke of history.current) {
			drawStrokeInWorld(ctx, stroke, 0);
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

		// Clear any accidental browser text selection
		if (typeof window !== "undefined" && window.getSelection) {
			const sel = window.getSelection();
			if (sel && sel.rangeCount > 0) {
				sel.removeAllRanges();
			}
		}

		const rect = updateCachedRect(canvas);

		// 1. APPLE PENCIL / STYLUS or MOUSE (Highest Priority)
		if (event.pointerType === "pen" || event.pointerType === "mouse") {
			activePenId.current = event.pointerId;
			lastPenTime.current = Date.now();
			// Discard any previous touch pointers so palm touches never trigger pinch zoom
			activeTouches.current.clear();
			prevCentroid.current = null;
			prevDistance.current = null;

			// Dedicated Move/Pan mode
			if (activeToolRef.current === "pan") {
				isDraggingPan.current = true;
				lastPointerPos.current = { x: event.clientX, y: event.clientY };
				try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
				return;
			}

			// Commit any pending gesture immediately so no strokes are lost in rapid succession
			if (gesture.current) {
				finishStroke();
			}

			// Drawing stroke
			onDrawing(true);

			const worldPt = screenToWorld(event.clientX, event.clientY, rect);
			worldPt.pressure = event.pressure || 0.5;

			const isEraser = activeToolRef.current === "eraser";
			const strokeWidth = isEraser ? eraserSizeRef.current : penWidthRef.current;

			gesture.current = {
				id: event.pointerId,
				stroke: {
					color: isEraser ? "rgba(0,0,0,1)" : colorRef.current,
					width: strokeWidth,
					erase: isEraser,
					points: [worldPt],
				},
			};

			const ctx = canvas.getContext("2d");
			if (ctx) {
				applyTransform(ctx, canvas);
				drawStrokeInWorld(ctx, gesture.current.stroke, 0);
			}
			return;
		}

		// 2. TOUCH POINTER (Finger or Palm)
		if (event.pointerType === "touch") {
			// Palm rejection: If Apple Pencil is currently active OR was used recently, or large contact patch, ignore touch!
			const isPalm = (event.width && event.width > 24) || (event.height && event.height > 24);
			const penCooldown = !fingerRef.current ? 2500 : 1500;
			if (activePenId.current !== null || Date.now() - lastPenTime.current < penCooldown || isPalm) {
				return;
			}

			activeTouches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

			// Two-finger gesture (pan + pinch zoom)
			if (activeTouches.current.size >= 2) {
				// Never interrupt an active Apple Pencil stroke due to touch contact
				if (gesture.current) {
					return;
				}
				const pts = Array.from(activeTouches.current.values());
				const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
				if (dist < 45) {
					// Contacts too close to be two fingers (palm patch)
					return;
				}
				isDraggingPan.current = false;
				prevCentroid.current = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
				prevDistance.current = dist;
				return;
			}

			// Dedicated Move/Pan mode with single touch
			if (activeToolRef.current === "pan") {
				isDraggingPan.current = true;
				lastPointerPos.current = { x: event.clientX, y: event.clientY };
				try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
				return;
			}

			// Finger drawing gate (if finger drawing is OFF, reject touch input as accidental palm/hand)
			if (!fingerRef.current) {
				return;
			}

			// Single finger drawing
			try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
			onDrawing(true);

			const worldPt = screenToWorld(event.clientX, event.clientY, rect);
			worldPt.pressure = event.pressure || 0.5;

			const isEraser = activeToolRef.current === "eraser";
			const strokeWidth = isEraser ? eraserSizeRef.current : penWidthRef.current;

			gesture.current = {
				id: event.pointerId,
				stroke: {
					color: isEraser ? "rgba(0,0,0,1)" : colorRef.current,
					width: strokeWidth,
					erase: isEraser,
					points: [worldPt],
				},
			};

			const ctx = canvas.getContext("2d");
			if (ctx) {
				applyTransform(ctx, canvas);
				drawStrokeInWorld(ctx, gesture.current.stroke, 0);
			}
		}
	}

	function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
		const canvas = getActiveCanvas();
		if (!canvas) return;
		const rect = cachedRectRef.current || updateCachedRect(canvas);

		// Direct DOM cursor transform for zero lag
		if (activeToolRef.current === "eraser") {
			const cursor = getActiveCursor();
			if (cursor) {
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;
				cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
				cursor.style.display = "block";
			}
		}

		// 1. TOUCH POINTER MOVE
		if (event.pointerType === "touch") {
			// Palm rejection: if pencil is active or was used recently, or large contact patch, ignore touch movements!
			const isPalm = (event.width && event.width > 24) || (event.height && event.height > 24);
			const penCooldown = !fingerRef.current ? 2500 : 1500;
			if (activePenId.current !== null || Date.now() - lastPenTime.current < penCooldown || isPalm) {
				return;
			}

			if (activeTouches.current.has(event.pointerId)) {
				activeTouches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

				// Two-finger pan & pinch zoom (batched via RAF)
				if (activeTouches.current.size >= 2) {
					const pts = Array.from(activeTouches.current.values());
					const currCentroid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
					const currDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);

					if (!rafId.current) {
						rafId.current = requestAnimationFrame(() => {
							rafId.current = null;
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
						});
					}
					return;
				}
			}
		}

		if (event.pointerType === "pen") {
			lastPenTime.current = Date.now();
		}

		// Single pointer Move/Pan tool
		if (isDraggingPan.current && lastPointerPos.current) {
			const dx = event.clientX - lastPointerPos.current.x;
			const dy = event.clientY - lastPointerPos.current.y;
			lastPointerPos.current = { x: event.clientX, y: event.clientY };
			setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
			return;
		}

		// Active stroke drawing: Ultra-fast hardware draw with coalesced Apple Pencil events
		if (!gesture.current || gesture.current.id !== event.pointerId) return;

		const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
		const rawPoints = samples.length ? samples : [event];
		const stroke = gesture.current.stroke;
		const startIdx = Math.max(0, stroke.points.length - 1);

		for (const s of rawPoints) {
			const pt = screenToWorld(s.clientX, s.clientY, rect);
			pt.pressure = s.pressure || 0.5;
			stroke.points.push(pt);
		}

		const ctx = canvas.getContext("2d");
		if (ctx) {
			applyTransform(ctx, canvas);
			drawStrokeInWorld(ctx, stroke, startIdx);
		}
	}

	function finishStroke(event?: PointerEvent<HTMLCanvasElement>) {
		if (event) {
			if (event.pointerType === "pen" || event.pointerType === "mouse") {
				if (activePenId.current === event.pointerId) {
					activePenId.current = null;
					lastPenTime.current = Date.now();
				}
			} else if (event.pointerType === "touch") {
				activeTouches.current.delete(event.pointerId);
				// Palm rejection: If pen is active or used recently, ignore touch lift completely
				const penCooldown = !fingerRef.current ? 2500 : 1500;
				if (activePenId.current !== null || Date.now() - lastPenTime.current < penCooldown) {
					return;
				}
			}
			try {
				if (event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}
			} catch {}
		} else {
			activePenId.current = null;
			activeTouches.current.clear();
		}

		if (activeTouches.current.size < 2) {
			prevCentroid.current = null;
			prevDistance.current = null;
		}

		if (isDraggingPan.current) {
			if (!event || activeTouches.current.size === 0) {
				isDraggingPan.current = false;
				lastPointerPos.current = null;
			}
			return;
		}

		if (!gesture.current) return;
		if (event && gesture.current.id !== event.pointerId) return;

		// Discard single-point aborted gesture on pointercancel so no stray dot is committed
		if (event?.type === "pointercancel" && gesture.current.stroke.points.length <= 1) {
			gesture.current = null;
			onDrawing(false);
			return;
		}

		const canvas = getActiveCanvas();
		const rect = cachedRectRef.current || (canvas ? updateCachedRect(canvas) : null);
		if (event && rect) {
			const endPt = screenToWorld(event.clientX, event.clientY, rect);
			endPt.pressure = event.pressure || 0.5;
			const lastPt = gesture.current.stroke.points[gesture.current.stroke.points.length - 1];
			if (!lastPt || Math.hypot(endPt.x - lastPt.x, endPt.y - lastPt.y) > 0.5) {
				const startIdx = Math.max(0, gesture.current.stroke.points.length - 1);
				gesture.current.stroke.points.push(endPt);
				const ctx = canvas?.getContext("2d");
				if (ctx && canvas) {
					applyTransform(ctx, canvas);
					drawStrokeInWorld(ctx, gesture.current.stroke, startIdx);
				}
			}
		}

		// Ensure single-point fast taps/dots render correctly before storing
		if (gesture.current.stroke.points.length === 1 && canvas) {
			const ctx = canvas.getContext("2d");
			if (ctx) {
				applyTransform(ctx, canvas);
				drawStrokeInWorld(ctx, gesture.current.stroke, 0);
			}
		}

		history.current.push(gesture.current.stroke);
		gesture.current = null;
		setStrokeCount(history.current.length);
		onDrawing(false);
		scheduleExport();
	}

	function handlePointerLeave() {
		const cursor = getActiveCursor();
		if (cursor) cursor.style.display = "none";
	}

	function handleUndo() {
		if (!history.current.length || disabled) return;
		history.current.pop();
		setStrokeCount(history.current.length);
		repaint();
		scheduleExport();
	}

	function handleClear() {
		if (!history.current.length || disabled) return;
		history.current = [];
		setStrokeCount(0);
		repaint();
		scheduleExport();
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

	// Prevent document body scrolling and text selection while in fullscreen whiteboard
	useEffect(() => {
		if (isFullscreen) {
			const originalOverflow = document.body.style.overflow;
			const originalUserSelect = document.body.style.userSelect;
			const originalWebkitUserSelect = (document.body.style as unknown as { webkitUserSelect?: string }).webkitUserSelect;
			document.body.style.overflow = "hidden";
			document.body.style.userSelect = "none";
			(document.body.style as unknown as { webkitUserSelect?: string }).webkitUserSelect = "none";

			// Clear any accidental selection
			if (typeof window !== "undefined" && window.getSelection) {
				const sel = window.getSelection();
				if (sel && sel.rangeCount > 0) sel.removeAllRanges();
			}

			function handleSelectStart(e: Event) {
				e.preventDefault();
			}
			window.addEventListener("selectstart", handleSelectStart);

			return () => {
				document.body.style.overflow = originalOverflow;
				document.body.style.userSelect = originalUserSelect;
				(document.body.style as unknown as { webkitUserSelect?: string }).webkitUserSelect = originalWebkitUserSelect;
				window.removeEventListener("selectstart", handleSelectStart);
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
		<div
			className="practice-fullscreen-portal-root"
			role="dialog"
			aria-modal="true"
			aria-label="Unlimited Whiteboard"
			onContextMenu={(e) => e.preventDefault()}
		>
			{/* Fixed Top Bar */}
			<header className="practice-fs-topbar" role="banner">
				{/* Question Card */}
				<div
					className={`practice-fs-question-card ${questionExpanded ? "is-expanded" : "is-collapsed"}`}
				>
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
						<div
							className="practice-fs-question-content"
						>
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
					onContextMenu={(e) => e.preventDefault()}
				/>

				{!strokeCount && (
					<div className="practice-canvas-placeholder" aria-hidden="true">
						<span>Unlimited Whiteboard · Pan and zoom anywhere</span>
					</div>
				)}

				{/* Fast Direct DOM Eraser Preview Ring */}
				<div
					ref={fsCursorRef}
					className="practice-eraser-cursor-ring"
					style={{
						width: `${eraserSize * zoom}px`,
						height: `${eraserSize * zoom}px`,
						display: "none",
					}}
					aria-hidden="true"
				/>
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
					onContextMenu={(e) => e.preventDefault()}
				/>

				{!strokeCount && (
					<div className="practice-canvas-placeholder" aria-hidden="true">
						<span>Write or draw your solution here</span>
					</div>
				)}

				{/* Fast Direct DOM Eraser Preview Ring */}
				<div
					ref={inlineCursorRef}
					className="practice-eraser-cursor-ring"
					style={{
						width: `${eraserSize * zoom}px`,
						height: `${eraserSize * zoom}px`,
						display: "none",
					}}
					aria-hidden="true"
				/>
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
