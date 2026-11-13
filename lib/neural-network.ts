type Point = { x: number; y: number };
type Fibre = { points: Point[]; width: number; tip: number; opacity: number; neuron: number; distance: number; length: number };
type Cell = { x: number; y: number; r: number; angle: number; form: "pyramidal" | "fusiform" | "tapered"; fires: readonly number[]; opacity: number };
const CYCLE = 14;
const TAU = Math.PI * 2;

// The near cell is cropped by the field; the other two recede in scale and light.
export const NEURAL_CELLS: readonly Cell[] = [
	{ x: 310, y: 350, r: 35, angle: -1.3, form: "pyramidal", fires: [0], opacity: 1 },
	{ x: 570, y: 190, r: 20, angle: -2.05, form: "fusiform", fires: [4], opacity: .63 },
	{ x: 125, y: 175, r: 16, angle: -1.8, form: "tapered", fires: [8], opacity: .3 },
];
function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n; return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
function curve(a: Point, b: Point, c: Point, d: Point, samples = 24) {
	return Array.from({ length: samples + 1 }, (_, i) => { const t = i / samples, s = 1 - t; return { x: s ** 3 * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t ** 3 * d.x, y: s ** 3 * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t ** 3 * d.y }; });
}
const lengthOf = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y), 0);
function at(points: Point[], progress: number) {
	const index = Math.max(0, Math.min(1, progress)) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(index)), t = index - i;
	return { x: points[i]!.x * (1 - t) + points[i + 1]!.x * t, y: points[i]!.y * (1 - t) + points[i + 1]!.y * t };
}

function makeFibres() {
	const rng = random(728413), fibres: Fibre[] = [];
	NEURAL_CELLS.forEach((cell, neuron) => {
		function branch(start: Point, direction: number, length: number, depth: number, width: number, distance: number, bend?: number) {
			const turn = bend ?? (rng() - .5) * .95, endAngle = direction + turn;
			const end = { x: start.x + Math.cos(endAngle) * length, y: start.y + Math.sin(endAngle) * length };
			const points = curve(start,
				{ x: start.x + Math.cos(direction) * length * .46, y: start.y + Math.sin(direction) * length * .46 },
				{ x: end.x - Math.cos(endAngle + turn * .6) * length * .35, y: end.y - Math.sin(endAngle + turn * .6) * length * .35 }, end);
			const pathLength = lengthOf(points), tip = Math.max(.15, width * (.42 + rng() * .13));
			fibres.push({ points, width, tip, opacity: cell.opacity, neuron, distance, length: pathLength });
			if (depth < 1 || length < 7) return;
			// Unequal continuations and lateral offshoots, rather than a radial binary tree.
			branch(end, endAngle + (rng() - .5) * .33, length * (.57 + rng() * .18), depth - 1, tip, distance + pathLength);
			const station = .48 + rng() * .29, origin = at(points, station), side = rng() > .5 ? 1 : -1;
			branch(origin, direction + turn * station + side * (.62 + rng() * .47), length * (.44 + rng() * .24), depth - 1, (width * (1 - station) + tip * station) * .47, distance + pathLength * station);
			if (depth > 2) {
				const station2 = .23 + rng() * .15, origin2 = at(points, station2);
				branch(origin2, direction - side * (.75 + rng() * .4), length * (.31 + rng() * .24), depth - 2, width * .27, distance + pathLength * station2);
			}
		}
		const near = neuron === 0;
		const scale = near ? 1 : neuron === 1 ? .8 : .66;
		const roots = near
			? [[cell.angle, 143, 5, 19, .04], [2.95, 142, 4, 10, -.12], [.38, 149, 4, 11, .28], [1.85, 132, 4, 8, .26], [-.27, 108, 3, 7, -.18]]
			: neuron === 1
				? [[cell.angle, 133, 4, 11, -.1], [.52, 140, 4, 6, .2], [1.74, 155, 4, 7, -.2], [2.7, 103, 3, 5, .24]]
				: [[cell.angle, 128, 4, 8, .3], [.74, 154, 4, 5, -.3], [2.3, 132, 3, 5, .15], [-.2, 90, 3, 4, -.3]];
		for (const [angle, length, depth, width, bend] of roots) branch({ x: cell.x, y: cell.y }, angle!, length! * scale, depth!, width! * scale, 0, bend);
	});
	return fibres;
}
export const NEURAL_FIBRES = makeFibres();
export const NEURAL_AXONS = [
	{ start: .6, duration: 3.4, points: curve({ x: 321, y: 365 }, { x: 433, y: 401 }, { x: 455, y: 208 }, { x: 568, y: 193 }, 140) },
	{ start: 4.8, duration: 3.2, points: curve({ x: 559, y: 192 }, { x: 428, y: 285 }, { x: 287, y: 111 }, { x: 126, y: 176 }, 160) },
	{ start: 9, duration: 5, points: curve({ x: 127, y: 188 }, { x: 151, y: 319 }, { x: 251, y: 258 }, { x: 308, y: 345 }, 130) },
];
export function neuralPath(points: Point[]) { return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(""); }
function localPoint(cell: Cell, x: number, y: number) {
	const a = cell.angle + Math.PI / 2;
	return { x: cell.x + (x * Math.cos(a) - y * Math.sin(a)) * cell.r, y: cell.y + (x * Math.sin(a) + y * Math.cos(a)) * cell.r };
}
export function neuralCellPath(cell: Cell) {
	const segments = cell.form === "pyramidal" ? [
		[[0, -1.15], [-.17, -.56], [-.38, -.17], [-.64, .39]],
		[[-.64, .39], [-.92, .92], [-.38, 1.02], [.03, .83]],
		[[.03, .83], [.45, .66], [.77, .7], [.58, .26]],
		[[.58, .26], [.41, -.05], [.19, -.66], [0, -1.15]],
	] : cell.form === "fusiform" ? [
		[[0, -1.38], [-.14, -.87], [-.44, -.57], [-.43, -.07]],
		[[-.43, -.07], [-.5, .48], [-.19, .77], [.03, 1.25]],
		[[.03, 1.25], [.2, .68], [.41, .3], [.34, -.08]],
		[[.34, -.08], [.4, -.53], [.13, -.88], [0, -1.38]],
	] : [
		[[0, -1.1], [-.12, -.65], [-.7, -.48], [-.78, -.02]],
		[[-.78, -.02], [-.92, .49], [-.27, .7], [.2, .81]],
		[[.2, .81], [.53, .94], [.72, .58], [.54, .18]],
		[[.54, .18], [.39, -.21], [.17, -.72], [0, -1.1]],
	];
	return neuralPath(segments.flatMap(segment => curve(...segment.map(([x, y]) => localPoint(cell, x!, y!)) as [Point, Point, Point, Point], 16))) + "Z";
}
export function neuralInteriorPaths(cell: Cell) {
	return [
		[[-.08, -.8], [-.3, -.4], [-.55, .3], [-.38, .62]],
		[[-.23, -.6], [-.05, -.2], [.2, .1], [.27, .48]],
	].map(segment => neuralPath(curve(...segment.map(([x, y]) => localPoint(cell, x!, y!)) as [Point, Point, Point, Point], 20)));
}
export function neuralFibrePath(fibre: Fibre) {
	const left: Point[] = [], right: Point[] = [];
	fibre.points.forEach((p, i) => {
		const before = fibre.points[Math.max(0, i - 1)]!, after = fibre.points[Math.min(fibre.points.length - 1, i + 1)]!;
		const angle = Math.atan2(after.y - before.y, after.x - before.x) + Math.PI / 2;
		const t = i / (fibre.points.length - 1), radius = (fibre.width * (1 - t) ** 1.25 + fibre.tip * t) / 2;
		left.push({ x: p.x + Math.cos(angle) * radius, y: p.y + Math.sin(angle) * radius });
		right.push({ x: p.x - Math.cos(angle) * radius, y: p.y - Math.sin(angle) * radius });
	});
	return neuralPath([...left, ...right.reverse()]) + "Z";
}
function trace(ctx: CanvasRenderingContext2D, points: Point[]) { ctx.beginPath(); points.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); }

export function createNeuralRenderer(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d", { alpha: true });
	if (!ctx) return null;
	const bodies = NEURAL_CELLS.map(cell => new Path2D(neuralCellPath(cell)));
	const structures = NEURAL_CELLS.map((cell, index) => new Path2D(neuralCellPath(cell) + NEURAL_FIBRES.filter(fibre => fibre.neuron === index).map(neuralFibrePath).join("")));
	const interiors = NEURAL_CELLS.map(cell => neuralInteriorPaths(cell).map(path => new Path2D(path)));
	const anatomy = document.createElement("canvas"), glow = document.createElement("canvas");
	let cacheScale = 0;
	glow.width = glow.height = 128;
	const g = glow.getContext("2d")!, light = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	light.addColorStop(0, "rgba(243,239,222,.6)"); light.addColorStop(.14, "rgba(224,233,235,.25)"); light.addColorStop(.48, "rgba(161,188,207,.07)"); light.addColorStop(1, "rgba(161,188,207,0)");
	g.fillStyle = light; g.fillRect(0, 0, 128, 128);
	function cache(scale: number) {
		cacheScale = scale; anatomy.width = Math.ceil(720 * scale); anatomy.height = Math.ceil(520 * scale);
		const c = anatomy.getContext("2d")!; c.scale(scale, scale); c.lineCap = "round"; c.lineJoin = "round";
		// Back-to-front anatomy, including membrane texture, is cached on resize.
		for (const index of [2, 1, 0]) {
			const cell = NEURAL_CELLS[index]!;
			c.filter = index === 2 ? "blur(.65px)" : "none";
			const material = c.createLinearGradient(cell.x - cell.r * 1.4, cell.y - cell.r * 1.6, cell.x + cell.r * 2, cell.y + cell.r);
			material.addColorStop(0, "#8ea9bc"); material.addColorStop(.42, "#566f83"); material.addColorStop(1, "#233a4b");
			c.globalAlpha = cell.opacity * .8; c.fillStyle = material;
			c.fill(structures[index]!);
			const membrane = c.createRadialGradient(cell.x - cell.r * .35, cell.y - cell.r * .45, 0, cell.x - cell.r * .35, cell.y - cell.r * .45, cell.r * 1.55);
			membrane.addColorStop(0, "rgba(209,226,236,.55)"); membrane.addColorStop(.45, "rgba(155,180,200,.24)"); membrane.addColorStop(.8, "rgba(57,89,113,.06)"); membrane.addColorStop(1, "rgba(57,89,113,0)");
			c.fillStyle = membrane; c.globalAlpha = cell.opacity * .7; c.fill(structures[index]!);
			c.filter = "none";
			NEURAL_FIBRES.forEach(fibre => {
				if (fibre.neuron !== index) return;
				trace(c, fibre.distance === 0 ? fibre.points.slice(5) : fibre.points); c.globalAlpha = cell.opacity * .36; c.lineWidth = Math.min(.75, fibre.width * .24); c.strokeStyle = "#d5e4ec"; c.stroke();
				if (fibre.width > 2) {
					for (const offset of [-.22, .19]) {
						const filament = fibre.points.map((p, i) => { const next = fibre.points[Math.min(i + 1, fibre.points.length - 1)]!, prev = fibre.points[Math.max(0, i - 1)]!; const a = Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2, w = fibre.width * (1 - i / fibre.points.length); return { x: p.x + Math.cos(a) * w * offset, y: p.y + Math.sin(a) * w * offset }; });
						trace(c, fibre.distance === 0 ? filament.slice(6) : filament); c.globalAlpha = cell.opacity * .2; c.lineWidth = .45; c.stroke();
					}
				}
			});
			// Fine intracellular material avoids the repeated dot-in-a-star silhouette.
			c.save(); c.clip(bodies[index]!); const rng = random(5291 + index);
			c.globalAlpha = cell.opacity * .24; c.strokeStyle = "#d5e4ec"; c.lineWidth = .45;
			for (const path of interiors[index]!) c.stroke(path);
			for (let i = 0; i < 480; i++) { const x = cell.x + (rng() - .5) * cell.r * 2.6, y = cell.y + (rng() - .5) * cell.r * 2.6; c.globalAlpha = cell.opacity * (.04 + rng() * .12); c.fillStyle = i % 3 ? "#c8d9e2" : "#0e2232"; c.fillRect(x, y, .5 + rng() * .7, .5 + rng()); }
			c.restore(); c.globalAlpha = 1;
		}
		for (const axon of NEURAL_AXONS) { trace(c, axon.points); c.lineWidth = .75; c.strokeStyle = "rgba(186,207,219,.24)"; c.stroke(); }
	}
	function pulse(points: Point[], progress: number, intensity: number, width: number, tailLength: number, bloom = false) {
		if (progress <= 0 || progress >= 1 + tailLength || intensity < .015) return;
		const begin = Math.max(0, progress - tailLength), end = Math.min(1, progress);
		if (begin >= end) return;
		const tail = at(points, begin), head = at(points, end);
		const ink = ctx!.createLinearGradient(tail.x, tail.y, head.x + .001, head.y);
		const recede = Math.min(1, (1 + tailLength - progress) / tailLength);
		ink.addColorStop(0, "rgba(215,228,235,0)"); ink.addColorStop(.6, `rgba(218,232,239,${intensity * .5 * recede})`); ink.addColorStop(1, `rgba(247,239,217,${intensity * recede})`);
		ctx!.beginPath(); for (let i = 0; i <= 18; i++) { const p = at(points, begin + (end - begin) * i / 18); if (i) ctx!.lineTo(p.x, p.y); else ctx!.moveTo(p.x, p.y); }
		ctx!.strokeStyle = ink; ctx!.lineWidth = width; ctx!.stroke();
		if (bloom) { ctx!.globalAlpha = intensity * .65 * recede; ctx!.drawImage(glow, head.x - 19, head.y - 19, 38, 38); ctx!.globalAlpha = 1; }
	}
	return {
		draw(time: number, phase: number, pointer: readonly number[]) {
			const scale = Math.min(canvas.width / 720, canvas.height / 520);
			if (Math.abs(cacheScale - scale) > .015) cache(scale);
			ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.translate((canvas.width - 720 * scale) / 2 + (pointer[0] ?? 0) * 7, (canvas.height - 520 * scale) / 2 + (pointer[1] ?? 0) * 5);
			ctx.scale(scale, scale); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.drawImage(anatomy, 0, 0, 720, 520);
			const cycle = time % CYCLE, ages = NEURAL_CELLS.map(cell => Math.min(...cell.fires.map(fire => (cycle - fire + CYCLE) % CYCLE)));
			for (const fibre of NEURAL_FIBRES) {
				const age = ages[fibre.neuron]!;
				if (age < .22 || age > 4.5) continue;
				const progress = ((age - .22) * 105 - fibre.distance) / fibre.length;
				pulse(fibre.points, progress, (.55 + fibre.opacity * .4) * Math.max(.45, 1 - fibre.distance / 800), Math.max(.65, fibre.width * .52), Math.min(1.8, 85 / fibre.length));
			}
			for (const axon of NEURAL_AXONS) pulse(axon.points, (cycle - axon.start) / axon.duration, .95, 1.6, .2, true);
			NEURAL_CELLS.forEach((cell, i) => {
				const age = ages[i]!, arrival = Math.exp(-Math.pow((CYCLE - age) / .25, 2)) * .3;
				const firing = Math.exp(-Math.pow(age / .72, 2)) + arrival;
				if (firing < .003) return;
				const size = cell.r * 5.7; ctx.globalAlpha = firing * .55; ctx.drawImage(glow, cell.x - size / 2, cell.y - size / 2, size, size);
				ctx.globalAlpha = firing * (.42 + (phase % 3 === i ? .04 : 0)); ctx.fillStyle = "#eee9d9"; ctx.fill(bodies[i]!); ctx.globalAlpha = 1;
			});
		},
		dispose() { anatomy.width = anatomy.height = 1; glow.width = glow.height = 1; },
	};
}
