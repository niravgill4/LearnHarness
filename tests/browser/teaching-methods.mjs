import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
// Exact count and calculation come from the same core used by the API.
const { measureReadingPace, READING_PASSAGE, budgetLesson } = await import("../../src/core/reading-pace.ts");
const pace = measureReadingPace(READING_PASSAGE.id, 60000);
const recommendation = budgetLesson(
	{
		scope: "Relate momentum to mass and velocity",
		reason: "Connect the relationship and practise applying it.",
		explanationWords: 2000,
		questionCount: 4,
		questionMinutes: 8,
		activityMinutes: 4,
		feedbackMinutes: 4,
	},
	pace,
);
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	args: ["--no-sandbox"],
});
try {
	for (const entry of ["/", "/chat/new"]) {
		const page = await browser.newPage();
		await page.setViewport({ width: 1024, height: 1000, hasTouch: true });
		const errors = [];
		page.on("pageerror", (e) => {
			errors.push(String(e));
			console.error(e);
		});
		const choice = { model: { provider: "openai", id: "test-teacher" } };
		const catalog = {
			models: [
				{
					id: "test-teacher",
					name: "Test teacher",
					provider: "openai",
					reasoning: false,
					input: ["text", "image"],
					supportedLevels: ["off"],
					cost: null,
					contextWindow: 200000,
					maxTokens: 8000,
				},
			],
			defaults: choice,
			slots: { strong: choice, cheap: choice, vision: choice },
			rolePins: {},
			providers: [{ id: "openai", envVar: "OPENAI_API_KEY", keyPresent: true }],
		};
		let creationCount = 0,
			creation;
		let heldEstimate,
			failEstimate = false;
		await page.setRequestInterception(true);
		page.on("request", (r) => {
			if (r.url().endsWith("/api/reading-pace"))
				return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ pace }) });
			if (r.url().endsWith("/api/lesson-timing")) {
				assert.equal(JSON.parse(r.postData()).topic, "Understand momentum");
				if (failEstimate)
					return r.respond({
						status: 503,
						contentType: "application/json",
						body: JSON.stringify({ error: "Unavailable" }),
					});
				heldEstimate = r;
				return;
			}
			if (r.url().includes("/api/models"))
				return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify(catalog) });
			if (r.url().endsWith("/api/chats") && r.method() === "POST") {
				creationCount++;
				creation = JSON.parse(r.postData());
				return r.respond({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ id: "teaching-method-fixture" }),
				});
			}
			if (r.isNavigationRequest() && r.url().includes("/chat/teaching-method-fixture"))
				return r.respond({ status: 200, contentType: "text/html", body: "<p>Session fixture</p>" });
			return r.continue();
		});
		await page.goto(`${process.env.TEACH_TEST_URL || "http://localhost:3012"}${entry}`, {
			waitUntil: "networkidle2",
		});
		await page.waitForSelector('[data-testid="composer"] [data-file-path-input]');
		const estimateRequest = page.waitForRequest((r) => r.url().endsWith("/api/lesson-timing"));
		await page.type('[data-testid="composer"] [data-file-path-input]', "Understand momentum");
		await page.keyboard.press("Enter");
		await page.waitForSelector('[data-testid="teach-setup-panel"]');
		await page.waitForFunction(() => document.querySelector('[aria-label="Learning duration presets"]'));
		await page.evaluate(() =>
			[...document.querySelectorAll('[aria-label="Learning duration presets"] button')]
				.find((b) => b.textContent.trim() === "15 min")
				.click(),
		);
		await estimateRequest;
		assert.ok(heldEstimate);
		await heldEstimate.respond({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ pace, recommendation }),
		});
		await page.waitForFunction(() =>
			document.querySelector('[data-testid="lesson-recommendation"]')?.textContent.includes("Recommended:"),
		);
		assert.equal(
			await page.$eval('[aria-label="Learning duration presets"] [aria-pressed="true"]', (e) =>
				e.textContent.trim(),
			),
			"15 min",
			"late recommendations do not overwrite a chosen budget",
		);
		await page.evaluate(() =>
			[...document.querySelectorAll("button")]
				.find((b) => b.textContent.trim() === "Use recommendation")
				.click(),
		);
		const centered = async () => {
			const box = await page.$eval('[data-testid="teach-setup-panel"]', (e) => {
				const r = e.getBoundingClientRect(),
					v = visualViewport;
				return {
					x: r.x,
					y: r.y,
					w: r.width,
					h: r.height,
					vx: v?.offsetLeft ?? 0,
					vy: v?.offsetTop ?? 0,
					vw: v?.width ?? innerWidth,
					vh: v?.height ?? innerHeight,
				};
			});
			assert.ok(Math.abs(box.x + box.w / 2 - box.vx - box.vw / 2) < 3, "dialog horizontally centered");
			assert.ok(Math.abs(box.y + box.h / 2 - box.vy - box.vh / 2) < 3, "dialog vertically centered");
			assert.ok(box.w <= box.vw && box.h <= box.vh, "dialog fits visible viewport");
			assert.ok(
				await page.$eval(".teach-setup-footer", (e) => {
					const r = e.getBoundingClientRect();
					return (
						r.bottom <= (visualViewport?.height ?? innerHeight) + (visualViewport?.offsetTop ?? 0) &&
						r.top >= 0
					);
				}),
				"footer remains visible",
			);
		};
		for (const [width, height] of [
			[1440, 1000],
			[1024, 768],
			[768, 1024],
			[390, 844],
			[320, 568],
		]) {
			await page.setViewport({ width, height, hasTouch: true });
			await new Promise((r) => setTimeout(r, 220));
			await centered();
		}
		await page.setViewport({ width: 1024, height: 1000, hasTouch: true });
		await new Promise((r) => setTimeout(r, 220));
		await page.evaluate(() => document.querySelector(".teach-setup-time-group .teach-setup-custom").click());
		await page.waitForSelector("#probing-time-input", { visible: true });
		await page.click("#probing-time-input");
		await page.keyboard.down("Control");
		await page.keyboard.press("a");
		await page.keyboard.up("Control");
		await page.keyboard.type("3 quick questions");
		const click = async (text) =>
			page.evaluate(
				(text) =>
					[...document.querySelectorAll("button")]
						.find((b) => b.textContent.replace(/→/g, "").trim() === text)
						.click(),
				text,
			);
		await click("Continue");
		await page.waitForSelector('[aria-label="Teaching methods"]');
		for (const [width, height] of [
			[1440, 1000],
			[1024, 768],
			[768, 1024],
			[390, 844],
			[320, 568],
		]) {
			await page.setViewport({ width, height, hasTouch: true });
			await new Promise((r) => setTimeout(r, 220));
			await centered();
			if (entry === "/chat/new") await page.screenshot({ path: `/tmp/teach-methods-${width}.png` });
		}
		await page.setViewport({ width: 1024, height: 1000, hasTouch: true });
		await new Promise((r) => setTimeout(r, 220));
		assert.equal(creationCount, 0, "time confirmation must not create a session");
		const toggle = async (name) =>
			page.evaluate(
				(name) =>
					[...document.querySelectorAll('[aria-label="Teaching methods"] label')]
						.find((l) => l.textContent.includes(name))
						.querySelector("input")
						.click(),
				name,
			);
		await toggle("Feynman Mode");
		await toggle("Socratic Lockdown");
		await toggle("Pictures and Diagrams");
		await toggle("Interactive Simulations");
		await toggle("Free Response Questions");
		await toggle("Multiple Choice Questions");
		assert.equal(await page.$$eval('[aria-label="Teaching methods"] input:checked', (e) => e.length), 6);
		await click("Back");
		assert.equal(await page.$eval("#probing-time-input", (e) => e.value), "3 quick questions");
		await click("Continue");
		assert.equal(await page.$$eval('[aria-label="Teaching methods"] input:checked', (e) => e.length), 6);
		if (entry === "/chat/new") {
			await page.setViewport({ width: 390, height: 844, hasTouch: true });
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
			await page.screenshot({ path: "/tmp/teaching-methods-phone.png" });
		}
		await Promise.all([page.waitForNavigation(), click("Start Learning")]);
		assert.equal(creationCount, 1);
		assert.equal(creation.title, "Understand momentum");
		assert.deepEqual(creation.teachingSetup.methods, [
			"feynman",
			"socratic",
			"pictures-diagrams",
			"interactive-simulations",
			"free-response",
			"multiple-choice",
		]);
		assert.deepEqual(creation.teachingSetup.readingPace, pace);
		assert.deepEqual(creation.teachingSetup.recommendation, recommendation);
		assert.equal(creation.teachingSetup.learningTime, `${recommendation.lessonMinutes} minutes`);
		assert.equal(creation.teachingSetup.probingTime, "3 quick questions");
		assert.match(creation.openingPrompt, /Feynman Mode/);
		failEstimate = true;
		await page.goto(`${process.env.TEACH_TEST_URL || "http://localhost:3012"}${entry}`, {
			waitUntil: "networkidle2",
		});
		await page.waitForSelector('[data-testid="composer"] [data-file-path-input]');
		await page.type('[data-testid="composer"] [data-file-path-input]', "Understand momentum");
		await page.keyboard.press("Enter");
		await page.waitForFunction(() =>
			document.querySelector('[data-testid="lesson-recommendation"]')?.textContent.includes("unavailable"),
		);
		await page.evaluate(() =>
			[...document.querySelectorAll('[aria-label="Learning duration presets"] button')]
				.find((b) => b.textContent.trim() === "15 min")
				.click(),
		);
		await click("Continue");
		await Promise.all([page.waitForNavigation(), click("Start Learning")]);
		assert.equal(creationCount, 2, "a missing recommendation does not block session creation");
		assert.equal(creation.teachingSetup.learningTime, "15 minutes");
		assert.equal(creation.teachingSetup.recommendation, undefined);
		assert.deepEqual(errors, []);
		await page.close();
	}
	console.log(
		"PASS: home and New Teach setup, multiple selection, Back retention, no premature creation, exact session handover and phone layout",
	);
} finally {
	await browser.close();
}
