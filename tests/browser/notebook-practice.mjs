import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	args: ["--no-sandbox"],
});
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 950, hasTouch: true });
	const errors = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.goto(`${process.env.NOTEBOOK_TEST_URL || "http://localhost:3012"}/notebook`, {
		waitUntil: "networkidle2",
	});
	const book = randomUUID(),
		section = randomUUID(),
		id = randomUUID(),
		second = randomUUID();
	const data = {
		notebooks: [{ id: book, title: "Physics" }],
		sections: [{ id: section, notebookId: book, title: "Mechanics", color: "#8899aa" }],
		pages: [
			{
				id,
				sectionId: section,
				title: "Momentum",
				paper: "plain",
				tone: "dark",
				updatedAt: new Date().toISOString(),
				blocks: [
					{
						id: randomUUID(),
						x: 80,
						y: 160,
						width: 800,
						content: {
							type: "doc",
							content: [
								{ type: "paragraph", content: [{ type: "text", text: "Momentum is mass times velocity." }] },
							],
						},
					},
				],
				strokes: [
					{
						tool: "pen",
						color: "#ffffff",
						width: 3,
						points: [
							{ x: -400, y: 300, p: 0.7 },
							{ x: -300, y: 350, p: 0.7 },
						],
					},
				],
			},
			{
				id: second,
				sectionId: section,
				title: "Energy",
				paper: "plain",
				blocks: [
					{
						id: randomUUID(),
						x: 80,
						y: 160,
						width: 800,
						content: {
							type: "doc",
							content: [
								{
									type: "paragraph",
									content: [{ type: "text", text: "Kinetic energy depends on speed squared." }],
								},
							],
						},
					},
				],
				strokes: [],
				updatedAt: new Date().toISOString(),
			},
		],
	};
	await page.evaluate(async (data) => {
		const current = await (await fetch("/api/notebook")).json();
		if (current.storage !== "local") throw Error("Use isolated local storage for this test");
		const r = await fetch("/api/notebook", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ version: current.version, data }),
		});
		if (!r.ok) throw Error("Fixture failed");
	}, data);
	await page.reload({ waitUntil: "networkidle2" });
	await page.waitForSelector(".nb-viewport");
	await page.evaluate(() => {
		window.fullscreenRequests = 0;
		document.documentElement.requestFullscreen = () => {
			window.fullscreenRequests++;
			return Promise.resolve();
		};
	});
	await page.click('[aria-label="Enter full screen"]');
	assert.equal(await page.evaluate(() => window.fullscreenRequests), 0);
	assert.equal(await page.evaluate(() => document.fullscreenElement), null);
	assert.ok(await page.$(".notebook.is-fullscreen"));
	await page.keyboard.press("Escape");
	await page.waitForFunction(() => !document.querySelector(".notebook.is-fullscreen"));
	const filter = await page.$eval('[data-testid="kind-filter-all"]', (b) => ({
		height: b.getBoundingClientRect().height,
		fg: getComputedStyle(b).color,
		bg: getComputedStyle(b).backgroundColor,
	}));
	assert.notEqual(filter.fg, filter.bg);
	let creation;
	await page.setRequestInterception(true);
	page.on("request", (r) => {
		if (r.url().endsWith("/api/chats") && r.method() === "POST") {
			creation = JSON.parse(r.postData());
			return r.respond({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ id: "note-practice-fixture" }),
			});
		}
		if (r.isNavigationRequest() && r.url().includes("/chat/note-practice-fixture"))
			return r.respond({ status: 200, contentType: "text/html", body: "<p>Practice handover fixture</p>" });
		return r.continue();
	});
	await page.click(".nb-note-practice");
	await page.waitForSelector("dialog[open]");
	await page.select('[aria-label="Practice source"]', "notebook");
	await Promise.all([
		page.waitForNavigation(),
		page.evaluate(() =>
			[...document.querySelectorAll("dialog button")].find((b) => b.textContent === "Start practice").click(),
		),
	]);
	assert.equal(creation.kind, "practice");
	const prompt = await page.evaluate(() =>
		JSON.parse(sessionStorage.getItem("lh.openingPrompt.note-practice-fixture")),
	);
	assert.match(prompt.text, /Momentum is mass times velocity/);
	assert.match(prompt.text, /Kinetic energy/);
	assert.match(prompt.text, new RegExp(id));
	assert.match(prompt.text, new RegExp(second));
	assert.ok(prompt.images.length > 0);
	assert.equal(prompt.images[0].mimeType, "image/png");
	assert.equal(prompt.attempted, false);
	assert.ok(Buffer.from(prompt.images[0].data, "base64").subarray(1, 4).equals(Buffer.from("PNG")));
	assert.deepEqual(errors, []);
	console.log(
		"PASS: app-only fullscreen, Escape, whole-notebook practice creation and retained typed/handwritten sources",
	);
} finally {
	await browser.close();
}
