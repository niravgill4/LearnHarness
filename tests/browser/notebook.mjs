// Run against an isolated local-mode server, e.g. LH_DATA_DIR=/tmp/notebook-test next dev -p 3012.
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
const browser = await puppeteer.launch({
	executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
	headless: true,
	args: ["--no-sandbox"],
});
try {
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (e) => {
		errors.push(String(e));
		console.error(e);
	});
	await page.setViewport({ width: 1440, height: 1050, hasTouch: true });
	page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "Biology notebook" : undefined));
	await page.goto(`${process.env.NOTEBOOK_TEST_URL || "http://localhost:3012"}/notebook`, {
		waitUntil: "networkidle2",
	});
	await page.waitForFunction(() => !document.querySelector('[aria-label="New notebook"]').disabled);
	await page.click('[aria-label="New notebook"]');
	await page.waitForSelector(".nb-paper");
	await page.click(".nb-title");
	await page.keyboard.down("Control");
	await page.keyboard.press("a");
	await page.keyboard.up("Control");
	await page.keyboard.type("Neurons and memory");
	await page.click(".nb-start-writing");
	await page.waitForSelector(".tiptap");
	await page.click(".tiptap");
	await page.keyboard.type("Synapses strengthen through repeated practice.");
	await page.waitForFunction(
		() => document.querySelector(".nb-save").textContent === "Saved on this computer",
	);
	await page.select('[aria-label="Paper style"]', "grid");
	await page.evaluate(() =>
		[...document.querySelectorAll(".nb-tools button")].find((e) => e.textContent === "Draw").click(),
	);
	await page.evaluate(() => {
		const c = document.querySelector(".nb-ink"),
			r = c.getBoundingClientRect();
		c.setPointerCapture = () => {};
		for (const [type, x, y] of [
			["pointerdown", 0.1, 0.2],
			["pointermove", 0.3, 0.3],
			["pointermove", 0.5, 0.22],
			["pointerup", 0.5, 0.22],
		])
			c.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerId: 8,
					pointerType: "pen",
					button: 0,
					pressure: 0.8,
					clientX: r.left + r.width * x,
					clientY: r.top + r.height * y,
				}),
			);
	});
	await page.waitForFunction(() => document.querySelector(".nb-footer").textContent.includes("1 strokes"));
	await page.click('[aria-label="Undo ink"]');
	await page.waitForFunction(() => document.querySelector(".nb-footer").textContent.includes("0 strokes"));
	await page.click('[aria-label="Redo ink"]');
	await page.waitForFunction(
		() => document.querySelector(".nb-save").textContent === "Saved on this computer",
	);
	await page.reload({ waitUntil: "networkidle2" });
	await page.waitForSelector(".tiptap");
	assert.match(await page.$eval(".tiptap", (e) => e.textContent), /Synapses strengthen/);
	assert.equal(await page.$eval(".nb-title", (e) => e.value), "Neurons and memory");
	assert.ok(await page.$eval(".nb-paper", (e) => e.classList.contains("paper-grid")));
	assert.match(await page.$eval(".nb-footer", (e) => e.textContent), /1 strokes/);
	// Image uploads use the private asset endpoint and survive a document reload.
	const temp = await mkdtemp(`${tmpdir()}/notebook-browser-`);
	const imagePath = `${temp}/pixel.png`;
	await writeFile(
		imagePath,
		Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
			"base64",
		),
	);
	await page.click(".tiptap");
	await page.keyboard.press("End");
	await (await page.$('input[accept="image/png,image/jpeg,image/webp"]')).uploadFile(imagePath);
	await page.waitForFunction(() => document.querySelector(".tiptap img")?.complete);
	await page.waitForFunction(
		() => document.querySelector(".nb-save").textContent === "Saved on this computer",
	);
	const cdp = await page.createCDPSession();
	await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: temp });
	await page.click('[title="Export editable backup"]');
	await page.waitForFunction(() => !document.querySelector('[title="Export editable backup"]').disabled);
	let backup;
	for (let i = 0; i < 30; i++) {
		const files = await readdir(temp);
		if (files.includes("cognera-notebook-backup.json")) {
			backup = JSON.parse(await readFile(`${temp}/cognera-notebook-backup.json`, "utf8"));
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	assert.equal(backup.format, "cognera-notebook-v1");
	assert.ok(Object.keys(backup.assets).length >= 1, "backup includes actual image bytes");
	// Offline work reaches IndexedDB before the failed transport, then retries online.
	await page.setOfflineMode(true);
	await page.click(".tiptap");
	await page.keyboard.type(" Offline recovery.");
	await page.waitForFunction(() => document.querySelector(".nb-save").textContent.includes("Offline"));
	const recovered = await page.evaluate(
		() =>
			new Promise((resolve) => {
				const r = indexedDB.open("cognera-notebook", 1);
				r.onsuccess = () => {
					const q = r.result.transaction("drafts").objectStore("drafts").get("local");
					q.onsuccess = () => {
						resolve(JSON.stringify(q.result));
						r.result.close();
					};
				};
			}),
	);
	assert.match(recovered, /Offline recovery/);
	await page.setOfflineMode(false);
	await page.waitForFunction(
		() => document.querySelector(".nb-save").textContent === "Saved on this computer",
	);
	// A competing tab wins its version; this tab cannot silently replace it.
	await page.evaluate(async () => {
		const saved = await (await fetch("/api/notebook")).json();
		saved.data.notebooks[0].title = "Changed on another device";
		await fetch("/api/notebook", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ version: saved.version, data: saved.data }),
		});
	});
	await page.click(".tiptap");
	await page.keyboard.type(" Kept after conflict.");
	await page.waitForFunction(() => document.querySelector(".nb-error")?.textContent.includes("changed"));
	assert.match(await page.$eval(".tiptap", (e) => e.textContent), /Kept after conflict/);
	await page.reload({ waitUntil: "networkidle2" });
	await page.waitForFunction(() =>
		document.querySelector(".nb-error")?.textContent.includes("recovery draft"),
	);
	assert.match(await page.$eval(".tiptap", (e) => e.textContent), /Kept after conflict/);
	await page.evaluate(() =>
		[...document.querySelectorAll(".nb-error button")]
			.find((b) => b.textContent === "Reload saved copy")
			.click(),
	);
	await page.waitForFunction(() => !document.querySelector(".nb-error"));
	await page.waitForFunction(
		() => !document.querySelector(".tiptap").textContent.includes("Kept after conflict"),
	);
	await page.reload({ waitUntil: "networkidle2" });
	await page.waitForSelector(".tiptap");
	assert.equal(await page.$(".nb-error"), null, "discarded recovery draft stays discarded on reload");
	assert.doesNotMatch(await page.$eval(".tiptap", (e) => e.textContent), /Kept after conflict/);
	await page.pdf({ path: `${temp}/notes.pdf`, preferCSSPageSize: true, printBackground: true });
	assert.ok((await readFile(`${temp}/notes.pdf`)).length > 1500, "printable PDF is generated");
	if (process.env.NOTEBOOK_SCREENSHOT)
		await page.screenshot({ path: process.env.NOTEBOOK_SCREENSHOT, fullPage: true });
	await page.setViewport({ width: 768, height: 1024, hasTouch: true });
	await page.select('[aria-label="Page zoom"]', "35");
	assert.ok(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		"tablet shell does not overflow",
	);
	await page.setViewport({ width: 390, height: 844, hasTouch: true });
	assert.ok(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		"phone shell does not overflow",
	);
	assert.deepEqual(errors, []);
	console.log(
		"PASS: notebook creation, text/ink editing, private image uploads, portable backups, offline recovery, stale-save conflicts, reload, PDF, tablet/phone layout",
	);
} finally {
	await browser.close();
}
