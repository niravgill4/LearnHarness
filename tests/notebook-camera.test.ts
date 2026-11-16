import { test } from "node:test";
import assert from "node:assert/strict";
import { zoomAt, worldPoint, pinchCamera, contentBounds } from "../lib/notebook-camera.ts";
import { newNotePage, validateNotebook } from "../lib/notebook.ts";
import { randomUUID } from "node:crypto";
test("zoom preserves the world point beneath its anchor, including negative coordinates", () => {
	const before = { x: 4500, y: -9000, zoom: 0.5 },
		anchor = { x: 300, y: 200 };
	assert.deepEqual(worldPoint(zoomAt(before, 2, anchor), anchor), worldPoint(before, anchor));
});
test("pinch follows the moving midpoint and clamps zoom without an anchor jump", () => {
	const before = { x: 40, y: 20, zoom: 1 };
	const next = pinchCamera(
		before,
		[
			{ x: 100, y: 100 },
			{ x: 200, y: 100 },
		],
		[
			{ x: 50, y: 130 },
			{ x: 250, y: 130 },
		],
	);
	assert.equal(next.zoom, 2);
	assert.deepEqual(worldPoint(next, { x: 150, y: 130 }), worldPoint(before, { x: 150, y: 100 }));
	const clamped = zoomAt(before, 100, { x: 100, y: 100 });
	assert.equal(clamped.zoom, 5);
	assert.deepEqual(worldPoint(clamped, { x: 100, y: 100 }), worldPoint(before, { x: 100, y: 100 }));
});
test("old pages and new notes beyond all former edges survive validation and content bounds", () => {
	const book = randomUUID(),
		section = randomUUID(),
		page = newNotePage(section);
	delete page.tone;
	page.blocks.push({
		id: randomUUID(),
		x: -9000,
		y: 12000,
		width: 900,
		content: { type: "doc", content: [{ type: "paragraph" }] },
	});
	page.strokes.push({ tool: "pen", color: "#123456", width: 3, points: [{ x: 30000, y: -20000, p: 0.8 }] });
	const data = {
		notebooks: [{ id: book, title: "Notes" }],
		sections: [{ id: section, notebookId: book, title: "Ideas", color: "#112233" }],
		pages: [page],
	};
	assert.equal(validateNotebook(data), true);
	const bounds = contentBounds(page);
	assert.ok(bounds.x < -9000 && bounds.y < -20000);
	assert.ok(bounds.x + bounds.width > 30000 && bounds.y + bounds.height > 12000);
});
