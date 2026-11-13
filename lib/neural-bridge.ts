import { createNeuralRenderer, makeNeuralFibres, type Cell, type NeuralScene, type Point } from "@/lib/neural-network";

export type NeuralRect = { x: number; y: number; width: number; height: number };
export type NeuralBridgeGeometry = NeuralScene & { protectedRects: NeuralRect[]; copyRects: NeuralRect[] };
type Layout = { width: number; height: number; stage: NeuralRect; card: NeuralRect; content: NeuralRect; protectedRects: NeuralRect[]; copyRects: NeuralRect[] };
function curve(a: Point, b: Point, c: Point, d: Point) {
	return Array.from({ length: 121 }, (_, i) => { const t = i / 120, s = 1 - t; return { x: s ** 3 * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t ** 3 * d.x, y: s ** 3 * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t ** 3 * d.y }; });
}

/** One sprawling field across the whole welcome, behind the account controls. */
export function makeNeuralBridge({ width, height, stage, card, protectedRects, copyRects }: Layout): NeuralBridgeGeometry {
	const scale = Math.min(stage.width / 720, stage.height / 520), span = card.width / 720;
	const origin = { x: stage.x + (stage.width - 720 * scale) / 2, y: stage.y + (stage.height - 520 * scale) / 2 };
	const cells: Cell[] = [
		{ x: card.x + card.width * .91, y: card.y + card.height * .48, r: Math.max(19, Math.min(29, card.width * .045)), angle: -2.36, form: "pyramidal", fires: [4], opacity: .44, span: span * 1.65 },
		{ x: card.x + card.width * .15, y: card.y + card.height * .84, r: Math.max(13, Math.min(21, card.width * .032)), angle: -1.15, form: "fusiform", fires: [8], opacity: .32, span: span * 1.9 },
		{ x: stage.x + stage.width * .82, y: Math.max(60, stage.y - 105), r: Math.max(12, 17 * scale), angle: 2.2, form: "tapered", fires: [0], opacity: .19, span: stage.width / 720 * 1.45 },
	];
	const fibres = makeNeuralFibres(cells, 398451);
	const leftMid = { x: origin.x + 570 * scale, y: origin.y + 190 * scale }, leftNear = { x: origin.x + 310 * scale, y: origin.y + 350 * scale };
	const axons = [
		{ start: .6, duration: 3.4, points: curve(leftNear, { x: leftNear.x + (cells[0]!.x - leftNear.x) * .4, y: leftNear.y + 45 }, { x: cells[0]!.x - 150 * span, y: cells[0]!.y - 160 * span }, cells[0]!) },
		{ start: 4.8, duration: 3.2, points: curve(cells[0]!, { x: cells[0]!.x - 125 * span, y: cells[0]!.y + 90 * span }, { x: cells[1]!.x + 130 * span, y: cells[1]!.y - 20 * span }, cells[1]!) },
		{ start: 9, duration: 5, points: curve(cells[1]!, { x: cells[1]!.x - 100 * span, y: cells[1]!.y - 150 * span }, { x: leftMid.x + 100 * scale, y: leftMid.y + 140 * scale }, leftMid) },
	];
	return { width, height, cells, fibres, axons, signalOpacity: .38, protectedRects, copyRects };
}

export function createNeuralBridgeRenderer(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	const mask = document.createElement("canvas");
	let renderer: ReturnType<typeof createNeuralRenderer> = null;
	return {
		resize(next: NeuralBridgeGeometry, ratio: number) {
			renderer?.dispose();
			canvas.width = mask.width = Math.max(1, Math.round(next.width * ratio)); canvas.height = mask.height = Math.max(1, Math.round(next.height * ratio));
			renderer = createNeuralRenderer(canvas, next);
			const c = mask.getContext("2d")!; c.scale(ratio, ratio); c.fillStyle = "#fff"; c.fillRect(0, 0, next.width, next.height); c.globalCompositeOperation = "destination-out";
			c.filter = "blur(12px)"; c.fillStyle = "rgba(0,0,0,.74)";
			for (const r of next.copyRects) { c.beginPath(); c.roundRect(r.x, r.y, r.width, r.height, 10); c.fill(); }
			c.filter = "none"; c.fillStyle = "#000";
			for (const r of next.protectedRects) c.fillRect(r.x, r.y, r.width, r.height);
		},
		draw(time: number) {
			renderer?.draw(time, 0, [0, 0]);
			ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "destination-in"; ctx.drawImage(mask, 0, 0); ctx.restore();
		},
		dispose() { renderer?.dispose(); mask.width = mask.height = 1; },
	};
}
