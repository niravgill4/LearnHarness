// Browser coverage uses the real dock and canvas, with only transport replaced.
import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";

const directory = await mkdtemp(`${tmpdir()}/cognera-drawing-`);
await build({ entryPoints: ["tests/browser/practice-drawing-fixture.tsx"], bundle: true, outfile: `${directory}/fixture.js`, jsx: "automatic", define: { "process.env.NODE_ENV": '"test"', "process.env": "{}", "process.platform": '"browser"' }, plugins: [{ name: "unused-server-hash", setup(builder) {
	builder.onResolve({ filter: /^node:crypto$/ }, () => ({ path: "crypto", namespace: "server-only" }));
	builder.onLoad({ filter: /.*/, namespace: "server-only" }, () => ({ contents: 'export function createHash(){throw new Error("Server hashing must not run in drawing fixture")}' }));
} }] });
const js = await readFile(`${directory}/fixture.js`);
const css = await readFile("app/practice-drawing.css", "utf8");
const server = createServer((req, res) => {
	if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(js); return; }
	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.end(`<style>:root{--border:#43474b;--background:#171a1d;--foreground:#e5e9e6;--card:#24282b;--accent:#353d37;--muted-foreground:#a2aaa5;--destructive:#f99}*{box-sizing:border-box}body{margin:12px;background:var(--background);color:var(--foreground);font:14px system-ui}button,select{font:inherit;color:inherit;background:transparent}button{cursor:pointer}textarea{width:100%;min-height:65px}#fixture{max-width:760px;margin:auto}[hidden]{display:none!important}${css}</style><div id="fixture"></div><script src="/fixture.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
	const page = await browser.newPage();
	const errors = []; page.on("pageerror", error => { errors.push(String(error)); console.error(String(error)); });
	await page.setViewport({ width: 1024, height: 900, hasTouch: true });
	await page.goto(`http://127.0.0.1:${server.address().port}`);
	await page.waitForSelector('[aria-label="Answer method"]');
	await page.evaluate(() => [...document.querySelectorAll("button")].find(button => button.textContent === "Draw your answer").click());
	const draw = async (pointerType = "pen") => page.evaluate(type => {
		const canvas = document.querySelector("canvas"), rect = canvas.getBoundingClientRect();
		// Synthetic pointers cannot take browser pointer capture; physical devices do.
		canvas.setPointerCapture = () => {}; canvas.hasPointerCapture = () => false;
		for (const [event, x, y] of [["pointerdown", .15, .3], ["pointermove", .35, .65], ["pointermove", .75, .25], ["pointerup", .75, .25]]) canvas.dispatchEvent(new PointerEvent(event, { bubbles: true, pointerId: 1, pointerType: type, pressure: .6, clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * y, button: 0 }));
	}, pointerType);
	const disabled = () => page.$eval('[data-testid="practice-send"]', button => button.disabled);
	assert.equal(await disabled(), true);
	await draw("touch"); assert.equal(await disabled(), true, "palm input is ignored");
	await draw(); assert.equal(await disabled(), false, "image alone enables submission");
	await page.click('[data-testid="practice-send"]');
	let submission = await page.evaluate(() => window.submission);
	assert.equal(submission.text, ""); assert.equal(submission.images.length, 1);
	assert.equal(submission.images[0].mimeType, "image/png");
	assert.ok(Buffer.from(submission.images[0].data, "base64").subarray(1, 4).equals(Buffer.from("PNG")));
	assert.equal(await disabled(), false, "unaccepted submissions keep the draft");
	await page.click("#fold"); await page.click("#fold");
	await page.click('[data-testid="practice-send"]');
	assert.deepEqual(await page.evaluate(() => window.submission), submission, "folding preserves handwriting");
	await page.evaluate(() => window.accept());
	await page.waitForFunction(() => document.querySelector('[data-testid="practice-send"]').disabled);
	assert.equal(await disabled(), true, "accepted image is not resent unchanged");
	await page.click('[aria-label="Blue ink"]');
	await page.select('[aria-label="Pen thickness"]', "8");
	await draw(); assert.equal(await disabled(), false);
	await page.click('[aria-label="Undo last stroke"]'); assert.equal(await disabled(), true, "undo restores accepted sheet");
	await page.click("#next"); assert.equal(await disabled(), true, "new problem resets handwriting");
	await page.click('input[type="checkbox"]'); await draw("touch"); assert.equal(await disabled(), false);
	if (process.env.DRAWING_SCREENSHOT) await page.screenshot({ path: process.env.DRAWING_SCREENSHOT, fullPage: true });
	await page.click('[aria-label="Eraser"]'); await draw();
	await page.click('[aria-label="Undo last stroke"]'); assert.equal(await disabled(), false);
	page.on("dialog", dialog => dialog.accept());
	await page.click(".practice-drawing-clear"); assert.equal(await disabled(), true);
	for (const width of [1024, 768, 390, 320]) {
		await page.setViewport({ width, height: 900, hasTouch: true });
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${width}`);
	}
	assert.deepEqual(errors, []);
	console.log("PASS: tablet pen/palm/finger input, PNG-only submission, retained drafts, accept/edit/undo, eraser, clear, problem reset, responsive widths");
} finally { await browser.close(); server.close(); }
