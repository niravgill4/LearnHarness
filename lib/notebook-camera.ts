import type { NotePage } from "./notebook";
export type Camera = { x: number; y: number; zoom: number };
export type ViewPoint = { x: number; y: number };
export const clampZoom = (zoom: number) => Math.max(0.001, Math.min(5, zoom));
export function worldPoint(camera: Camera, point: ViewPoint): ViewPoint {
	return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}
export function zoomAt(camera: Camera, zoom: number, anchor: ViewPoint): Camera {
	const world = worldPoint(camera, anchor);
	zoom = clampZoom(zoom);
	return { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom, zoom };
}
export function pinchCamera(
	camera: Camera,
	before: [ViewPoint, ViewPoint],
	after: [ViewPoint, ViewPoint],
): Camera {
	const midpoint = (p: [ViewPoint, ViewPoint]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
	const distance = (p: [ViewPoint, ViewPoint]) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
	const a = midpoint(before),
		b = midpoint(after),
		next = zoomAt(camera, (camera.zoom * distance(after)) / Math.max(1, distance(before)), a);
	return { ...next, x: next.x + b.x - a.x, y: next.y + b.y - a.y };
}
export function contentBounds(page: NotePage, heights: Record<string, number> = {}) {
	let left = 60,
		top = 40,
		right = 1100,
		bottom = 160;
	for (const b of page.blocks) {
		left = Math.min(left, b.x);
		top = Math.min(top, b.y - 40);
		right = Math.max(right, b.x + b.width);
		bottom = Math.max(bottom, b.y + (heights[b.id] ?? 160));
	}
	for (const s of page.strokes)
		for (const p of s.points) {
			const r = s.width * 8;
			left = Math.min(left, p.x - r);
			top = Math.min(top, p.y - r);
			right = Math.max(right, p.x + r);
			bottom = Math.max(bottom, p.y + r);
		}
	return { x: left - 50, y: top - 50, width: right - left + 100, height: bottom - top + 100 };
}
