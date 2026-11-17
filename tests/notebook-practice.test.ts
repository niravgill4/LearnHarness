import { test } from "node:test";
import assert from "node:assert/strict";
import { newNotePage } from "../lib/notebook.ts";
import { handwritingTiles } from "../lib/notebook-practice.ts";
test("handwriting regions preserve distant and negative ink without filling empty space", () => {
	const p = newNotePage("test");
	p.strokes = [
		{
			tool: "pen",
			width: 3,
			color: "#ffffff",
			points: [
				{ x: -400, y: 300, p: 0.7 },
				{ x: -300, y: 350, p: 0.7 },
			],
		},
		{ tool: "pen", width: 3, color: "#000000", points: [{ x: 30000, y: 30000, p: 0.7 }] },
	];
	const tiles = handwritingTiles(p);
	assert.ok(tiles.some((t) => t.x < 0));
	assert.ok(tiles.some((t) => t.x > 29000));
	assert.ok(tiles.length < 10);
});
test("oversized handwriting is rejected explicitly rather than silently cropped", () => {
	const p = newNotePage("test");
	p.strokes = [
		{
			tool: "pen",
			width: 3,
			color: "#000000",
			points: [
				{ x: 0, y: 0, p: 0.7 },
				{ x: 1000000, y: 1000000, p: 0.7 },
			],
		},
	];
	assert.throws(() => handwritingTiles(p), /too much space/);
});
