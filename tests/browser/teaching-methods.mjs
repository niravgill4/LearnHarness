import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
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
		await page.setRequestInterception(true);
		page.on("request", (r) => {
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
		await page.type('[data-testid="composer"] [data-file-path-input]', "Understand momentum");
		await page.keyboard.press("Enter");
		await page.waitForSelector("#probing-time-input");
		await page.click("#probing-time-input");
		await page.keyboard.down("Control");
		await page.keyboard.press("a");
		await page.keyboard.up("Control");
		await page.keyboard.type("3 quick questions");
		const click = async (text) =>
			page.evaluate(
				(text) => [...document.querySelectorAll("button")].find((b) => b.textContent.replace(/→/g, '').trim() === text).click(),
				text,
			);
		await click("Continue");
		await page.waitForSelector('[aria-label="Teaching methods"]');
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
		assert.equal(await page.$$eval('[aria-label="Teaching methods"] input:checked', (e) => e.length), 2);
		await click("Back");
		assert.equal(await page.$eval("#probing-time-input", (e) => e.value), "3 quick questions");
		await click("Continue");
		assert.equal(await page.$$eval('[aria-label="Teaching methods"] input:checked', (e) => e.length), 2);
		if (entry === "/chat/new") {
			await page.setViewport({ width: 390, height: 844, hasTouch: true });
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
			await page.screenshot({ path: "/tmp/teaching-methods-phone.png" });
		}
		await Promise.all([page.waitForNavigation(), click("Start Learning")]);
		assert.equal(creationCount, 1);
		assert.equal(creation.title, "Understand momentum");
		assert.deepEqual(creation.teachingSetup.methods, ["feynman", "socratic"]);
		assert.equal(creation.teachingSetup.probingTime, "3 quick questions");
		assert.match(creation.openingPrompt, /Feynman Mode/);
		assert.deepEqual(errors, []);
		await page.close();
	}
	console.log(
		"PASS: home and New Teach setup, multiple selection, Back retention, no premature creation, exact session handover and phone layout",
	);
} finally {
	await browser.close();
}
