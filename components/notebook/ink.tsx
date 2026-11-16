import type { InkStroke } from "@/lib/notebook";
export type InkTool = { tool: InkStroke["tool"]; color: string; width: number };
type Bounds = { x: number; y: number; right: number; bottom: number };
const boundsCache = new WeakMap<InkStroke, { length: number; bounds: Bounds }>();
function bounds(stroke: InkStroke) {
	const cached = boundsCache.get(stroke);
	if (cached?.length === stroke.points.length) return cached.bounds;
	const result = { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity };
	for (const point of stroke.points) {
		result.x = Math.min(result.x, point.x);
		result.y = Math.min(result.y, point.y);
		result.right = Math.max(result.right, point.x);
		result.bottom = Math.max(result.bottom, point.y);
	}
	const padding = stroke.width * 8;
	result.x -= padding;
	result.y -= padding;
	result.right += padding;
	result.bottom += padding;
	boundsCache.set(stroke, { length: stroke.points.length, bounds: result });
	return result;
}
/** Canvas size stays tied to the viewport; ink lives in document coordinates. */
export function paintInk(canvas: HTMLCanvasElement, strokes: InkStroke[], clear = true, visible?: Bounds) {
	const c = canvas.getContext("2d");
	if (!c) return;
	if (clear) {
		c.save();
		c.resetTransform();
		c.clearRect(0, 0, canvas.width, canvas.height);
		c.restore();
	}
	for (const stroke of strokes) {
		if (visible) {
			const box = bounds(stroke);
			if (box.right < visible.x || box.x > visible.right || box.bottom < visible.y || box.y > visible.bottom)
				continue;
		}
		c.save();
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
			if (stroke.points.length === 1) {
				const p = stroke.points[0]!;
				c.lineTo(p.x + 0.01, p.y);
			}
			c.stroke();
		} else
			stroke.points.forEach((p, i) => {
				c.lineWidth = stroke.width * (stroke.tool === "eraser" ? 7 : 0.5 + p.p);
				c.beginPath();
				const previous = stroke.points[Math.max(0, i - 1)]!;
				if (!i) {
					c.arc(p.x, p.y, c.lineWidth / 2, 0, Math.PI * 2);
					c.fill();
				} else {
					c.moveTo(previous.x, previous.y);
					c.lineTo(p.x, p.y);
					c.stroke();
				}
			});
		c.restore();
	}
}
