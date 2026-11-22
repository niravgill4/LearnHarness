"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
	clampZoom,
	contentBounds,
	pinchCamera,
	worldPoint,
	zoomAt,
	type Camera,
	type ViewPoint,
} from "@/lib/notebook-camera";
import type { NotePage, InkStroke, InkPoint } from "@/lib/notebook";
import { paintInk, type InkTool } from "./ink";
import { Maximize2Icon, Minimize2Icon, MinusIcon, PlusIcon, ScanIcon } from "lucide-react";

export function NotebookCanvas({
	page,
	account,
	mode,
	tool,
	finger,
	fullscreen,
	historyTick,
	onToggleFullscreen,
	onChange,
	onBusy,
	onPencilStart,
	children,
}: {
	page: NotePage;
	account: string;
	mode: "write" | "draw" | "hand";
	tool: InkTool;
	finger: boolean;
	fullscreen?: boolean;
	historyTick?: number;
	onToggleFullscreen?: () => void;
	onChange(strokes: InkStroke[]): void;
	onBusy(active: boolean): void;
	onPencilStart(): void;
	children: ReactNode;
}) {
	const viewport = useRef<HTMLDivElement>(null),
		canvas = useRef<HTMLCanvasElement>(null),
		world = useRef<HTMLElement>(null);
	const camera = useRef<Camera>({ x: 24, y: 24, zoom: 0.75 });
	const committed = useRef<{ canvas: HTMLCanvasElement; strokes?: InkStroke[]; camera?: Camera }>(null);
	const latest = useRef({ page, mode, tool, finger, onChange, onBusy });
	latest.current = { page, mode, tool, finger, onChange, onBusy };
	const pointers = useRef(new Map<number, ViewPoint>()),
		activePen = useRef<number | null>(null),
		lastPenTime = useRef(0),
		strokesRef = useRef<InkStroke[]>(page.strokes),
		gesture = useRef<{ id: number; type: string; stroke: InkStroke } | null>(null);
	const rect = useRef<DOMRect | null>(null),
		raf = useRef(0),
		persist = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
		panning = useRef(false);
	const [percent, setPercent] = useState(75),
		[moving, setMoving] = useState(false),
		lastPercent = useRef(75);
	const key = `nb-camera:${account}:${page.id}`;
	function remember() {
		clearTimeout(persist.current);
		persist.current = setTimeout(() => {
			try {
				localStorage.setItem(key, JSON.stringify(camera.current));
			} catch {}
		}, 200);
	}
	function render() {
		const host = viewport.current,
			c = canvas.current,
			w = world.current;
		if (!host || !c || !w) return;
		const view = camera.current,
			box = rect.current ?? host.getBoundingClientRect(),
			dpr = Math.min(2, devicePixelRatio || 1);
		rect.current = box;
		const width = Math.max(1, Math.round(box.width * dpr)),
			height = Math.max(1, Math.round(box.height * dpr));
		if (c.width !== width) c.width = width;
		if (c.height !== height) c.height = height;
		const context = c.getContext("2d");
		if (!context) return;
		const base = committed.current ??= { canvas: document.createElement("canvas") };
		const layer = base.canvas;
		if (base.strokes !== strokesRef.current || base.camera !== view || layer.width !== width || layer.height !== height) {
			if (layer.width !== width) layer.width = width;
			if (layer.height !== height) layer.height = height;
			layer.getContext("2d")?.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.x, dpr * view.y);
			const start = worldPoint(view, { x: 0, y: 0 });
			const end = worldPoint(view, { x: box.width, y: box.height });
			paintInk(layer, strokesRef.current, true, { ...start, right: end.x, bottom: end.y });
			base.strokes = strokesRef.current;
			base.camera = view;
		}
		context.resetTransform();
		context.globalCompositeOperation = "copy";
		context.drawImage(layer, 0, 0);
		context.globalCompositeOperation = "source-over";
		if (gesture.current) {
			context.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.x, dpr * view.y);
			paintInk(c, [gesture.current.stroke], false);
		}
		w.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.zoom})`;
		host.style.setProperty("--grid-size", `${40 * view.zoom}px`);
		host.style.setProperty("--grid-x", `${view.x}px`);
		host.style.setProperty("--grid-y", `${view.y}px`);
		host.dataset.camera = JSON.stringify(view);
		const percent = view.zoom < 0.01 ? Math.round(view.zoom * 10000) / 100 : Math.round(view.zoom * 100);
		if (percent !== lastPercent.current) {
			lastPercent.current = percent;
			setPercent(percent);
		}
	}
	function schedule() {
		if (!raf.current)
			raf.current = requestAnimationFrame(() => {
				raf.current = 0;
				render();
			});
	}
	function changeCamera(next: Camera) {
		camera.current = next;
		schedule();
		remember();
	}
	function centerZoom(value: number) {
		const box = viewport.current?.getBoundingClientRect();
		if (box) changeCamera(zoomAt(camera.current, value, { x: box.width / 2, y: box.height / 2 }));
	}
	function measure() {
		const heights: Record<string, number> = {};
		world.current
			?.querySelectorAll<HTMLElement>("[data-block-id]")
			.forEach((e) => (heights[e.dataset.blockId!] = e.offsetHeight));
		return contentBounds(latest.current.page, heights);
	}
	function fit() {
		const box = viewport.current!.getBoundingClientRect(),
			bounds = measure();
		const zoom = clampZoom(Math.min((box.width - 90) / bounds.width, (box.height - 130) / bounds.height));
		changeCamera({
			zoom,
			x: (box.width - bounds.width * zoom) / 2 - bounds.x * zoom,
			y: (box.height - bounds.height * zoom) / 2 - bounds.y * zoom - 20,
		});
	}
	useLayoutEffect(() => {
		const box = viewport.current!.getBoundingClientRect();
		camera.current = { x: 24, y: 24, zoom: clampZoom(Math.min(0.75, (box.width - 60) / 1100)) };
		try {
			const stored = JSON.parse(localStorage.getItem(key) ?? "null");
			if (stored && [stored.x, stored.y, stored.zoom].every(Number.isFinite))
				camera.current = { ...stored, zoom: clampZoom(stored.zoom) };
		} catch {}
		render();
		const observer = new ResizeObserver(() => {
			rect.current = null;
			schedule();
		});
		if (viewport.current) observer.observe(viewport.current);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(raf.current);
			raf.current = 0;
			clearTimeout(persist.current);
			try {
				localStorage.setItem(key, JSON.stringify(camera.current));
			} catch {}
		};
	}, [key]);
	useLayoutEffect(() => {
		// Only sync from props if the prop actually has more strokes or is a reset/undo/page-switch
		// Never let a stale asynchronous render overwrite newer strokes drawn in child
		if (page.strokes.length >= strokesRef.current.length) {
			strokesRef.current = page.strokes;
		} else {
			const isPrefix = page.strokes.every((s, i) => s === strokesRef.current[i] || s.points === strokesRef.current[i]?.points);
			if (!isPrefix) {
				strokesRef.current = page.strokes;
			}
		}
		schedule();
	}, [page.strokes, page.paper, page.tone]);
	useEffect(() => {
		// When undo/redo button is explicitly clicked, historyTick increments
		strokesRef.current = page.strokes;
		schedule();
	}, [historyTick]);
	useEffect(() => {
		const host = viewport.current!;
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			if (gesture.current) return;
			const box = host.getBoundingClientRect();
			if (e.ctrlKey || e.metaKey)
				changeCamera(
					zoomAt(camera.current, camera.current.zoom * Math.exp(-e.deltaY * 0.008), {
						x: e.clientX - box.left,
						y: e.clientY - box.top,
					}),
				);
			else
				changeCamera({ ...camera.current, x: camera.current.x - e.deltaX, y: camera.current.y - e.deltaY });
		};
		host.addEventListener("wheel", wheel, { passive: false });
		return () => host.removeEventListener("wheel", wheel);
	}, [key]);
	useEffect(() => {
		let print: HTMLDivElement | null = null;
		const before = () => {
			print?.remove();
			const bounds = measure(),
				scale = Math.min(700 / bounds.width, 1000 / bounds.height);
			print = document.createElement("div");
			print.className = `nb-print-output tone-light paper-${latest.current.page.paper}`;
			print.style.setProperty("--grid-size", `${40 * scale}px`);
			print.style.setProperty("--grid-x", `${-bounds.x * scale}px`);
			print.style.setProperty("--grid-y", `${-bounds.y * scale}px`);
			const clone = world.current!.cloneNode(true) as HTMLElement;
			clone.className = "nb-print-world";
			clone.style.cssText = `position:absolute;inset:0;transform-origin:0 0;transform:translate(${-bounds.x * scale}px,${-bounds.y * scale}px) scale(${scale})`;
			clone.querySelectorAll(".nb-block-handle,.nb-start-writing").forEach((e) => e.remove());
			const ink = document.createElement("canvas");
			ink.width = 1400;
			ink.height = 2000;
			ink.style.cssText = "position:absolute;inset:0;width:700px;height:1000px;pointer-events:none";
			ink
				.getContext("2d")
				?.setTransform(2 * scale, 0, 0, 2 * scale, -bounds.x * scale * 2, -bounds.y * scale * 2);
			// A print-friendly white sheet keeps dark-mode ink readable on paper.
			const printStrokes = latest.current.page.strokes.map((stroke) => {
				const rgb = stroke.color
					.slice(1)
					.match(/../g)!
					.map((v) => parseInt(v, 16));
				if (rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722 < 180) return stroke;
				return {
					...stroke,
					color:
						"#" +
						rgb
							.map((v) =>
								Math.round(v * 0.4)
									.toString(16)
									.padStart(2, "0"),
							)
							.join(""),
				};
			});
			paintInk(ink, printStrokes);
			print.append(clone, ink);
			document.body.append(print);
		};
		const after = () => {
			print?.remove();
			print = null;
		};
		window.addEventListener("beforeprint", before);
		window.addEventListener("afterprint", after);
		return () => {
			after();
			window.removeEventListener("beforeprint", before);
			window.removeEventListener("afterprint", after);
		};
	}, [key]);
	type InkEvent = Pick<globalThis.PointerEvent, "clientX" | "clientY" | "pressure" | "pointerType">;
	function local(event: Pick<InkEvent, "clientX" | "clientY">, sample = event) {
		const box = rect.current ?? viewport.current!.getBoundingClientRect();
		return { x: sample.clientX - box.left, y: sample.clientY - box.top };
	}
	function point(
		event: InkEvent,
		sample: Pick<globalThis.PointerEvent, "clientX" | "clientY" | "pressure"> = event,
	): InkPoint {
		return {
			...worldPoint(camera.current, local(event, sample)),
			p: event.pointerType === "pen" && sample.pressure ? sample.pressure : 0.5,
		};
	}
	function end(event: InkEvent & Pick<globalThis.PointerEvent, "pointerId" | "type">) {
		if (event.pointerId === activePen.current) {
			activePen.current = null;
			lastPenTime.current = Date.now();
		}
		pointers.current.delete(event.pointerId);
		try {
			if (viewport.current?.hasPointerCapture(event.pointerId)) {
				viewport.current.releasePointerCapture(event.pointerId);
			}
		} catch {}
		if (gesture.current?.id === event.pointerId) {
			const stroke = gesture.current.stroke;
			if (event.type === "pointercancel" && stroke.points.length <= 1) {
				// Discard single-point aborted gesture on pointercancel (don't commit stray dot)
				gesture.current = null;
				latest.current.onBusy(false);
				schedule();
				return;
			}
			// Guarantee that the final point of fast flick is included
			const lastPt = stroke.points[stroke.points.length - 1];
			if (event.type === "pointerup") {
				const endPt = point(event);
				if (!lastPt || Math.hypot(endPt.x - lastPt.x, endPt.y - lastPt.y) > 0.5)
					stroke.points.push({ ...endPt, p: lastPt?.p ?? endPt.p });
			}
			gesture.current = null;
			const nextStrokes = [...strokesRef.current, stroke];
			strokesRef.current = nextStrokes;
			latest.current.onChange(nextStrokes);
			latest.current.onBusy(false);
			schedule();
		}
		if (pointers.current.size === 0 && gesture.current === null) {
			panning.current = false;
			setMoving(false);
			rect.current = null;
		}
	}
	useEffect(() => {
		// Pencil capture can interfere with Safari's palm handling. Finish a
		// stroke lifted outside the editor without forcing pointer capture.
		const finishOutside = (event: globalThis.PointerEvent) => {
			if (event.pointerId !== activePen.current || (event.target instanceof Node && viewport.current?.contains(event.target))) return;
			end(event);
		};
		window.addEventListener("pointerup", finishOutside, true);
		window.addEventListener("pointercancel", finishOutside, true);
		return () => {
			window.removeEventListener("pointerup", finishOutside, true);
			window.removeEventListener("pointercancel", finishOutside, true);
		};
	}, [key]); // The handler reads the current stroke and callbacks from refs.
	return (
		<div className={`nb-canvas-shell tone-${page.tone ?? "light"}`}>
			<div
				ref={viewport}
				className={`nb-viewport paper-${page.paper} mode-${mode}${moving ? " is-moving" : ""}`}
				aria-label="Infinite notebook canvas"
				onPointerDownCapture={(event) => {
					// 1. Palm rejection: if Apple Pencil is active, or was used recently, or contact patch is large, drop touch completely
					if (event.pointerType === "touch") {
						const isPalm = (event.width && event.width > 24) || (event.height && event.height > 24);
						const penCooldown = 160;
						if (
							activePen.current !== null ||
							gesture.current?.type === "pen" ||
							Date.now() - lastPenTime.current < penCooldown ||
							isPalm
						) {
							event.preventDefault();
							event.stopPropagation();
							return;
						}
					}

					rect.current = viewport.current!.getBoundingClientRect();

					// 2. Apple Pencil handling
					if (event.pointerType === "pen") {
						lastPenTime.current = Date.now();
						activePen.current = event.pointerId;

						// Free any pointer captures held by earlier touch/palm events
						if (viewport.current) {
							for (const id of pointers.current.keys()) {
								try {
									viewport.current.releasePointerCapture(id);
								} catch {}
							}
						}
						pointers.current.clear();
						panning.current = false;
						setMoving(false);

						const editable = (event.target as Element).closest(".nb-text-block,input");
						if (mode === "draw" || (mode === "write" && !editable)) {
							if (mode === "write") onPencilStart();
							// If a previous stroke was still pending, finalize it immediately so it is never dropped
							if (gesture.current) {
								const prevStroke = gesture.current.stroke;
								strokesRef.current = [...strokesRef.current, prevStroke];
								latest.current.onChange(strokesRef.current);
								gesture.current = null;
							}
							event.preventDefault();
							event.stopPropagation();
							// Do not call setPointerCapture for Apple Pencil on iOS Safari:
							// The viewport is full-bleed, and capture triggers WebKit multi-touch cancellation when palm touches glass.
							gesture.current = {
								id: event.pointerId,
								type: "pen",
								stroke: { ...tool, points: [point(event)] },
							};
							latest.current.onBusy(true);
							schedule();
							return;
						}
					}

					// 3. Touch handling
					if (event.pointerType === "touch") {
						// In draw mode with finger drawing OFF:
						// Touches are NEVER drawing strokes. Only two-finger pinch-to-zoom is supported with separated contacts.
						if (mode === "draw" && !finger) {
							pointers.current.set(event.pointerId, local(event));
							if (pointers.current.size >= 2) {
								const pts = [...pointers.current.values()];
								const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
								if (dist >= 45) {
									event.preventDefault();
									event.stopPropagation();
									panning.current = true;
									setMoving(true);
									return;
								}
							}
							event.preventDefault();
							return;
						}

						pointers.current.set(event.pointerId, local(event));

						// Two or more touches: pinch zoom
						if (pointers.current.size >= 2) {
							if (gesture.current?.type === "touch") {
								gesture.current = null;
								latest.current.onBusy(false);
								schedule();
							}
							event.preventDefault();
							event.stopPropagation();
							try {
								viewport.current!.setPointerCapture(event.pointerId);
							} catch {}
							panning.current = true;
							setMoving(true);
							return;
						}

						const editable = (event.target as Element).closest(".nb-text-block,input,.nb-start-writing");

						// In hand mode or navigating without editing
						if (mode === "hand" || (!editable && mode === "write")) {
							event.preventDefault();
							try {
								viewport.current!.setPointerCapture(event.pointerId);
							} catch {}
							panning.current = true;
							setMoving(true);
							return;
						}

						// In draw mode with finger drawing explicitly enabled
						if (mode === "draw" && finger && !gesture.current && event.button === 0) {
							event.preventDefault();
							event.stopPropagation();
							try {
								viewport.current!.setPointerCapture(event.pointerId);
							} catch {}
							gesture.current = {
								id: event.pointerId,
								type: "touch",
								stroke: { ...tool, points: [point(event)] },
							};
							latest.current.onBusy(true);
							schedule();
							return;
						}
					}

					if (mode === "hand") {
						event.preventDefault();
						pointers.current.set(event.pointerId, local(event));
						try {
							viewport.current!.setPointerCapture(event.pointerId);
						} catch {}
						panning.current = true;
						setMoving(true);
						return;
					}

					if (mode !== "draw" || gesture.current || event.button !== 0) return;

					event.preventDefault();
					event.stopPropagation();
					try {
						viewport.current!.setPointerCapture(event.pointerId);
					} catch {}
					gesture.current = {
						id: event.pointerId,
						type: event.pointerType,
						stroke: { ...tool, points: [point(event)] },
					};
					latest.current.onBusy(true);
					schedule();
				}}
				onPointerMoveCapture={(event) => {
					// Palm rejection: if pencil is active or was used recently, completely drop touch movements
					if (event.pointerType === "touch") {
						const isPalm = (event.width && event.width > 24) || (event.height && event.height > 24);
						const penCooldown = 160;
						if (
							activePen.current !== null ||
							gesture.current?.type === "pen" ||
							Date.now() - lastPenTime.current < penCooldown ||
							isPalm
						) {
							event.preventDefault();
							event.stopPropagation();
							return;
						}
					}

					if (event.pointerType === "pen") {
						lastPenTime.current = Date.now();
					}

					if (pointers.current.has(event.pointerId)) {
						const before = [...pointers.current.values()],
							previous = pointers.current.get(event.pointerId)!,
							next = local(event);
						pointers.current.set(event.pointerId, next);
						if (before.length >= 2) {
							event.preventDefault();
							event.stopPropagation();
							changeCamera(
								pinchCamera(
									camera.current,
									before.slice(0, 2) as [ViewPoint, ViewPoint],
									[...pointers.current.values()].slice(0, 2) as [ViewPoint, ViewPoint],
								),
							);
							return;
						}
						if (!gesture.current && panning.current) {
							event.preventDefault();
							changeCamera({
								...camera.current,
								x: camera.current.x + next.x - previous.x,
								y: camera.current.y + next.y - previous.y,
							});
							return;
						}
					}

					if (gesture.current?.id !== event.pointerId) return;
					event.preventDefault();
					const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
					const points = gesture.current.stroke.points;
					for (const sample of samples.length ? samples : [event]) {
						const next = point(event, sample);
						const previous = points.at(-1)!;
						if (next.x === previous.x && next.y === previous.y) continue;
						if (event.pointerType === "pen") next.p = previous.p * 0.35 + next.p * 0.65;
						if (points.length < 14_999) points.push(next);
						else points[points.length - 1] = next;
					}
					schedule();
				}}
				onPointerUpCapture={end}
				onPointerCancelCapture={end}
			>
				<article ref={world} className={`nb-paper nb-world mode-${mode}`} style={{ transformOrigin: "0 0" }}>
					{children}
				</article>
				<canvas ref={canvas} className="nb-ink" aria-label="Notebook drawing sheet" />
			</div>
			<div className="nb-view-controls" aria-label="Canvas navigation">
				<button aria-label="Zoom out" onClick={() => centerZoom(camera.current.zoom / 1.2)}>
					<MinusIcon size={15} />
				</button>
				<output aria-label="Canvas zoom">{percent}%</output>
				<button aria-label="Zoom in" onClick={() => centerZoom(camera.current.zoom * 1.2)}>
					<PlusIcon size={15} />
				</button>
				<span />
				<button aria-label="Fit content" title="Fit all notes" onClick={fit}>
					<ScanIcon size={16} />
				</button>
				{onToggleFullscreen && (
					<>
						<span />
						<button
							aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
							title={fullscreen ? "Exit full screen (Esc)" : "Enter full screen"}
							onClick={onToggleFullscreen}
						>
							{fullscreen ? <Minimize2Icon size={15} /> : <Maximize2Icon size={15} />}
						</button>
					</>
				)}
			</div>
		</div>
	);
}
