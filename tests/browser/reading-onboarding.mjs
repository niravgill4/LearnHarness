import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import { measureReadingPace } from "../../src/core/reading-pace.ts";
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	args: ["--no-sandbox"],
});
try {
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (error) => {
		errors.push(String(error));
		console.error(error);
	});
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	await page.evaluateOnNewDocument(() => {
		const original = performance.now.bind(performance);
		window.readingTestOffset = 0;
		Object.defineProperty(performance, "now", { value: () => original() + window.readingTestOffset });
	});
	let savedPace = null,
		failSave = true,
		completion,
		connection;
	const gemini = "gemini-3.5-flash-lite";
	const snapshot = {
		configured: false,
		setup: null,
		connected: [],
		models: [
			{ provider: "google", id: "gemini-pro-fixture", name: "Gemini Pro", vision: true },
			{ provider: "google", id: gemini, name: "Gemini 3.5 Flash-Lite", vision: true },
		],
	};
	await page.setRequestInterception(true);
	page.on("request", (request) => {
		const url = new URL(request.url());
		const reply = (body, status = 200) =>
			request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
		if (url.pathname === "/api/onboarding") {
			if (request.method() === "POST") {
				const body = JSON.parse(request.postData());
				if (body.action === "connect") {
					connection = body;
					snapshot.connected = ["google"];
				} else completion = body;
				return reply({ saved: true });
			}
			return reply(snapshot);
		}
		if (url.pathname === "/api/reading-pace") {
			if (request.method() === "GET") return reply({ pace: savedPace, accountAvailable: true });
			if (failSave) {
				failSave = false;
				return reply({ error: "Temporary save failure. Try again." }, 503);
			}
			const body = JSON.parse(request.postData());
			assert.equal(body.wpm, undefined, "server derives the rate");
			savedPace = measureReadingPace(body.passageId, body.elapsedMs);
			return reply({ pace: savedPace });
		}
		return request.continue();
	});
	const click = async (text) => {
		await page.waitForFunction(
			(text) =>
				[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === text && !b.disabled),
			{},
			text,
		);
		await page.evaluate(
			(text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text).click(),
			text,
		);
	};
	await page.setViewport({ width: 1440, height: 1000, hasTouch: true });
	await page.goto(`${process.env.TEACH_TEST_URL || "http://localhost:3012"}/onboarding`, {
		waitUntil: "networkidle2",
	});
	await click("Don’t have any of these?");
	assert.equal(await page.$eval("#onboarding-gemini-guide a", a => a.href), "https://aistudio.google.com/apikey");
	await click("Use a Gemini key");
	await page.waitForFunction(() => document.querySelector('label[for="provider-key"]')?.textContent === "Google API key");
	assert.equal(await page.evaluate(() => document.activeElement?.id), "provider-key");
	await page.type("#provider-key", "gemini-fixture-key");
	await click("Save and continue");
	await page.waitForSelector(".onboarding-slot-tabs");
	assert.deepEqual(connection, { action: "connect", provider: "google", key: "gemini-fixture-key" });
	assert.deepEqual(
		await page.$$eval(".onboarding-slot-tabs strong", nodes => nodes.map(node => node.textContent)),
		Array(3).fill("Gemini 3.5 Flash-Lite"),
	);
	await click("Continue");
	await page.waitForSelector('[data-testid="reading-pace-test"]');
	await page.waitForFunction(() => document.querySelector(".reading-pace-preview"));
	assert.equal(await page.$(".reading-pace-passage"), null, "passage is hidden before Start");
	await click("Start reading");
	await page.waitForSelector(".reading-pace-passage");
	await click("Finished reading");
	await page.waitForFunction(() =>
		document.querySelector(".reading-pace-error")?.textContent.includes("too short"),
	);
	await click("Start reading");
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, value: true });
		document.dispatchEvent(new Event("visibilitychange"));
		Object.defineProperty(document, "hidden", { configurable: true, value: false });
	});
	await page.waitForFunction(() =>
		document.querySelector(".reading-pace-error")?.textContent.includes("interrupted"),
	);
	await click("Start reading");
	for (const [width, height] of [
		[1440, 1000],
		[1024, 768],
		[768, 1024],
		[390, 844],
		[320, 568],
	]) {
		await page.setViewport({ width, height, hasTouch: true });
		await new Promise((resolve) => setTimeout(resolve, 200));
		assert.ok(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			"onboarding fits viewport",
		);
		await page.screenshot({ path: `/tmp/reading-onboarding-${width}.png`, fullPage: true });
	}
	await page.evaluate(() => {
		window.readingTestOffset += 60000;
	});
	await click("Finished reading");
	await page.waitForSelector(".reading-pace-result");
	await click("Try again");
	await page.evaluate(() => {
		window.readingTestOffset += 60000;
	});
	await click("Finished reading");
	await click("Use this pace");
	await page.waitForFunction(() =>
		document.querySelector(".reading-pace-error")?.textContent.includes("Temporary"),
	);
	assert.ok(await page.$(".reading-pace-result"), "save failure preserves the measured result");
	await click("Use this pace");
	await page.waitForSelector("#tour-title");
	assert.ok(savedPace?.wpm > 150);
	await click("Back");
	await page.waitForFunction(() =>
		document.querySelector(".reading-pace-result")?.textContent.includes("Saved to your account"),
	);
	await click("Continue");
	await page.waitForSelector("#tour-title");
	assert.match(await page.$eval("#tour-title", node => node.textContent), /Build understanding/);
	assert.equal(await page.$('[aria-label="Replay preview"]'), null, "reduced motion disables animation replay");
	await page.setViewport({ width: 1440, height: 1000, hasTouch: true });
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
	await page.waitForSelector('[aria-label="Replay preview"]');
	const firstDemo = await page.$(".tour-demo-content");
	await page.click('[aria-label="Replay preview"]');
	assert.equal(await firstDemo.evaluate(node => node.isConnected), false, "replay restarts the preview");
	await page.click(".tour-footer .onboarding-primary");
	await click("No");
	assert.match(await page.$eval(".tour-result", node => node.textContent), /Gravity still acts/);
	await page.click(".tour-footer .onboarding-primary");
	await page.waitForSelector(".tour-simulation input");
	await page.focus(".tour-simulation input");
	await page.keyboard.press("End");
	assert.equal(await page.$eval(".tour-simulation output", node => node.textContent), "60°");
	assert.match(await page.$eval(".tour-result", node => node.textContent), /12.7 m/);
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 568]]) {
		await page.setViewport({ width, height, hasTouch: true });
		assert.ok(await page.$eval(".tour-demo", node => {
			const rect = node.getBoundingClientRect();
			return rect.left >= 0 && rect.right <= innerWidth && node.scrollWidth <= node.clientWidth;
		}), `simulation preview fits at ${width}px`);
		await page.screenshot({ path: `/tmp/cognera-tour-${width}.png` });
	}
	await page.click(".tour-footer .onboarding-primary");
	await click("Practice from this note");
	await click("Review this answer");
	assert.match(await page.$eval(".tour-result", node => node.textContent), /included the right units/);
	await page.click(".tour-footer .onboarding-primary");
	await click("Velocity");
	assert.match(await page.$eval(".tour-map-detail", node => node.textContent), /over time/);
	await page.click(".tour-footer .onboarding-primary");
	await page.waitForSelector("#first-topic");
	await click("Back");
	await page.waitForSelector('.tour-pagination [aria-label="Knowledge"][aria-current="step"]');
	await click("Set your first goal");
	await page.type("#first-topic", "Understand projectile motion");
	await click("Enter your learning studio");
	await page.waitForFunction(() => location.pathname === "/");
	assert.equal(completion.action, "complete");
	assert.deepEqual(completion.slots, { strong: gemini, cheap: gemini, vision: gemini });
	assert.equal(completion.topic, "Understand projectile motion");
	await page.goto(`${process.env.TEACH_TEST_URL || "http://localhost:3012"}/onboarding`, {
		waitUntil: "networkidle2",
	});
	await click("Continue");
	await page.waitForSelector('[data-testid="reading-pace-test"]');
	await click("Skip for now");
	await page.waitForSelector("#tour-title");
	await click("Skip tour");
	await page.waitForSelector("#first-topic");
	await click("Back");
	await click("Back");
	await page.setViewport({ width: 390, height: 844, hasTouch: true });
	await click("Measure again");
	await page.waitForFunction(() => {
		const box = document.querySelector(".reading-pace-passage")?.getBoundingClientRect();
		return box && box.top >= 0 && box.bottom <= innerHeight;
	});
	await page.screenshot({ path: "/tmp/reading-mobile-active.png" });
	assert.deepEqual(errors, []);
	console.log(
		"PASS: Gemini guide and model roles, reading timer and retry, interactive tour, back and skip, responsive layouts",
	);
} finally {
	await browser.close();
}
