// Run against an isolated local-mode server, never a shared or cloud workspace.
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const browser = await puppeteer.launch({
	executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
	headless: true,
	args: ["--no-sandbox"],
});
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 1000, hasTouch: true });
	const errors = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.goto(`${process.env.NOTEBOOK_TEST_URL || "http://localhost:3012"}/notebook`, {
		waitUntil: "networkidle2",
	});
	await page.waitForSelector(".nb-save");
	const book = randomUUID(),
		section = randomUUID(),
		id = randomUUID();
	const document = {
		notebooks: [{ id: book, title: "Canvas test" }],
		sections: [{ id: section, notebookId: book, title: "Legacy notes", color: "#8bb5a0" }],
		pages: [
			{
				id,
				sectionId: section,
				title: "A continuous notebook",
				paper: "grid",
				blocks: [{
					id: randomUUID(), x: 60, y: 140, width: 300,
					content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Selectable notes" }] }] },
				}],
				strokes: [],
				updatedAt: new Date().toISOString(),
			},
		],
	};
	await page.evaluate(async (data) => {
		const saved = await (await fetch("/api/notebook")).json();
		if (saved.storage !== "local") throw Error("This test requires disposable local storage");
		const response = await fetch("/api/notebook", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ version: saved.version, data }),
		});
		if (!response.ok) throw Error("Test setup failed");
	}, document);
	await page.reload({ waitUntil: "networkidle2" });
	await page.waitForSelector(".nb-viewport[data-camera]");
	assert.ok(await page.$(".nb-canvas-shell.tone-light"), "legacy notes keep light paper");
	await page.waitForSelector('.nb-text-block [contenteditable="true"]');
	await page.evaluate(() => {
		const editor = document.querySelector(".nb-text-block .tiptap");
		editor.focus();
		getSelection().selectAllChildren(editor);
		[...document.querySelectorAll(".nb-tools button")].find(button => button.textContent === "Draw").click();
	});
	await page.waitForFunction(() => document.querySelector(".nb-viewport").classList.contains("mode-draw"));
	await page.waitForFunction(() => !document.querySelector(".nb-text-block .tiptap").isContentEditable);
	assert.deepEqual(await page.evaluate(() => {
		const editor = document.querySelector(".nb-text-block .tiptap");
		const rejected = type => !editor.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
		return {
			cleared: getSelection().isCollapsed && document.activeElement !== editor,
			locked: document.querySelector(".nb-title").readOnly,
			selectstart: rejected("selectstart"),
			contextmenu: rejected("contextmenu"),
		};
	}), { cleared: true, locked: true, selectstart: true, contextmenu: true });
	await page.evaluate(() => [...document.querySelectorAll(".nb-tools button")].find(button => button.textContent === "Write").click());
	await page.waitForSelector('.nb-text-block [contenteditable="true"]');
	assert.equal(await page.$eval(".nb-title", element => element.readOnly), false);
	assert.equal(await page.$eval(".nb-text-block .tiptap", element =>
		element.dispatchEvent(new Event("contextmenu", { bubbles: true, cancelable: true }))), true);
	const camera = () => page.$eval(".nb-viewport", (e) => JSON.parse(e.dataset.camera));
	const send = async (events) =>
		page.evaluate((events) => {
			const v = document.querySelector(".nb-viewport"),
				r = v.getBoundingClientRect();
			v.setPointerCapture = () => {};
			for (const [type, id, x, y, pointerType = "touch"] of events)
				v.dispatchEvent(
					new PointerEvent(type, {
						bubbles: true,
						pointerId: id,
						pointerType,
						button: 0,
						pressure: 0.7,
						clientX: r.left + x,
						clientY: r.top + y,
					}),
				);
		}, events);
	const start = await camera();
	await send([
		["pointerdown", 1, 100, 200],
		["pointerdown", 2, 200, 200],
		["pointermove", 1, 50, 200],
		["pointermove", 2, 250, 200],
		["pointerup", 1, 50, 200],
		["pointerup", 2, 250, 200],
	]);
	await page.waitForFunction(
		(z) => Math.abs(JSON.parse(document.querySelector(".nb-viewport").dataset.camera).zoom - z) < 0.001,
		{},
		start.zoom * 2,
	);
	let next = await camera();
	const beforeWorld = { x: (150 - start.x) / start.zoom, y: (200 - start.y) / start.zoom };
	assert.ok(Math.abs((150 - next.x) / next.zoom - beforeWorld.x) < 0.001);
	assert.ok(Math.abs((200 - next.y) / next.zoom - beforeWorld.y) < 0.001, "pinch stays anchored");
	await page.evaluate(() =>
		[...document.querySelectorAll(".nb-tools button")].find((e) => e.textContent === "Draw").click(),
	);
	await page.click(".nb-ink-options summary");
	await page.click(".nb-ink-options input[type=checkbox]");
	await page.click(".nb-ink-options summary");
	await send([
		["pointerdown", 3, 100, 300],
		["pointermove", 3, 120, 320],
		["pointerdown", 4, 200, 300],
		["pointermove", 4, 240, 300],
		["pointerup", 3, 120, 320],
		["pointerup", 4, 240, 300],
	]);
	assert.match(
		await page.$eval(".nb-footer", (e) => e.textContent),
		/0 strokes/,
		"second finger cancels provisional ink",
	);
	await page.evaluate(() =>
		[...document.querySelectorAll(".nb-tools button")].find(e => e.textContent === "Write").click(),
	);
	const pageSave = page.waitForResponse(response =>
		new URL(response.url()).pathname === "/api/notebook" && response.request().method() === "PATCH",
	);
	await send([
		["pointerdown", 8, 150, 350, "pen"],
		["pointerdown", 9, 250, 400],
		["pointermove", 9, 300, 450],
		["pointermove", 8, 200, 380, "pen"],
		["pointerup", 8, 200, 380, "pen"],
		["pointerup", 9, 300, 450],
	]);
	await page.waitForFunction(() => document.querySelector(".nb-footer").textContent.includes("1 strokes"));
	await page.waitForSelector('.nb-pen-tray[aria-label="Pen tray"]');
	const patch = await pageSave;
	assert.equal(patch.status(), 200);
	const patchBody = JSON.parse(patch.request().postData());
	assert.deepEqual(Object.keys(patchBody).sort(), ["pages", "version"]);
	assert.equal(patchBody.pages[0].id, id);
	assert.equal(patchBody.pages[0].strokes.length, 1);
	const pixel = () =>
		page.$eval(".nb-ink", (c) => {
			const ratio = c.width / c.getBoundingClientRect().width;
			return c.getContext("2d").getImageData(Math.round(175 * ratio), Math.round(365 * ratio), 1, 1).data[3];
		});
	await page.waitForFunction(() => {
		const c = document.querySelector(".nb-ink"),
			r = c.width / c.getBoundingClientRect().width;
		return c.getContext("2d").getImageData(Math.round(175 * r), Math.round(365 * r), 1, 1).data[3] > 0;
	});
	assert.ok((await pixel()) > 0, "ink is painted live after zoom");
	await page.click('[aria-label="eraser"]');
	await send([
		["pointerdown", 15, 150, 350, "pen"],
		["pointermove", 15, 200, 380, "pen"],
		["pointerup", 15, 200, 380, "pen"],
	]);
	await page.waitForFunction(() => {
		const c = document.querySelector(".nb-ink"),
			r = c.width / c.getBoundingClientRect().width;
		return c.getContext("2d").getImageData(Math.round(175 * r), Math.round(365 * r), 1, 1).data[3] === 0;
	});
	await page.click('[aria-label="Undo ink"]');
	await page.waitForFunction(() => {
		const c = document.querySelector(".nb-ink"),
			r = c.width / c.getBoundingClientRect().width;
		return c.getContext("2d").getImageData(Math.round(175 * r), Math.round(365 * r), 1, 1).data[3] > 0;
	});
	await page.click('[aria-label="pen"]');
	// Pan far enough that drawing lands beyond both original positive bounds.
	await page.$eval(".nb-viewport", (v) =>
		v.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 12000, deltaY: 12000 })),
	);
	await page.waitForFunction(
		() => JSON.parse(document.querySelector(".nb-viewport").dataset.camera).x < -10000,
	);
	await send([
		["pointerdown", 10, 200, 250, "pen"],
		["pointermove", 10, 300, 350, "pen"],
		["pointerup", 10, 300, 350, "pen"],
	]);
	await page.waitForFunction(
		() => document.querySelector(".nb-save").textContent === "Saved on this computer",
	);
	let saved = await page.evaluate(async () => await (await fetch("/api/notebook")).json());
	assert.ok(saved.data.pages[0].strokes.some((s) => s.points.some((p) => p.x > 1400 && p.y > 2000)));
	// Pan back beyond the old top-left, then write in negative document space.
	await page.$eval(".nb-viewport", (v) =>
		v.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: -24000, deltaY: -24000 })),
	);
	await page.waitForFunction(
		() => JSON.parse(document.querySelector(".nb-viewport").dataset.camera).x > 10000,
	);
	await send([
		["pointerdown", 11, 200, 250, "pen"],
		["pointermove", 11, 300, 350, "pen"],
		["pointerup", 11, 300, 350, "pen"],
	]);
	await page.waitForFunction(
		() => document.querySelector(".nb-save").textContent === "Saved on this computer",
	);
	saved = await page.evaluate(async () => await (await fetch("/api/notebook")).json());
	assert.ok(saved.data.pages[0].strokes.some((s) => s.points.some((p) => p.x < 0 && p.y < 0)));
	const remembered = await camera();
	await page.reload({ waitUntil: "networkidle2" });
	await page.waitForSelector(".nb-viewport[data-camera]");
	assert.deepEqual(await camera(), remembered, "camera restores after reload");
	assert.match(await page.$eval(".nb-footer", (e) => e.textContent), /3 strokes/);
	await page.click('[aria-label="Fit content"]');
	await page.waitForFunction(
		() => JSON.parse(document.querySelector(".nb-viewport").dataset.camera).zoom < 0.2,
	);
	assert.ok(
		await page.$eval(".nb-ink", (e) => e.width <= innerWidth * 2 && e.height <= innerHeight * 2),
		"bitmap stays viewport-sized after huge pans",
	);
	for (const width of [1024, 768, 390, 320]) {
		await page.setViewport({ width, height: 900, hasTouch: true });
		assert.ok(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			`shell fits ${width}`,
		);
	}
	assert.deepEqual(errors, []);
	console.log(
		"PASS: legacy paper, pinch anchoring, finger-to-pinch cancellation, Pencil/palm separation, unlimited coordinates, bounded bitmap, camera persistence, responsive shell",
	);
} finally {
	await browser.close();
}
