import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
const directory = await mkdtemp(`${tmpdir()}/cognera-simulation-`);
await build({
	entryPoints: ["tests/browser/simulation-fixture.tsx"],
	outfile: `${directory}/fixture.js`,
	bundle: true,
	jsx: "automatic",
	define: { "process.env.NODE_ENV": '"test"' },
	plugins: [
		{
			name: "chat-action-fixture",
			setup(builder) {
				builder.onResolve({ filter: /^@\/components\/chat$/ }, () => ({
					path: "chat",
					namespace: "fixture",
				}));
				builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
					contents:
						'import {createContext} from "react"; export const ChatActionsContext=createContext(null);',
					resolveDir: process.cwd(),
				}));
				builder.onResolve({ filter: /^node:crypto$/ }, () => ({ path: "crypto", namespace: "server-only" }));
				builder.onLoad({ filter: /.*/, namespace: "server-only" }, () => ({
					contents:
						'export function createHash(){throw new Error("Server hashing must not run in simulation fixture")}',
				}));
			},
		},
	],
});
const js = await readFile(`${directory}/fixture.js`);
const server = createServer((request, response) => {
	if (request.url === "/fixture.js") {
		response.setHeader("Content-Type", "text/javascript");
		response.end(js);
		return;
	}
	response.setHeader("Content-Type", "text/html; charset=utf-8");
	response.end(
		'<style>body{font:14px system-ui;margin:20px}iframe{width:100%;border:0}svg{height:16px;width:16px}button{min-height:44px}#fixture{max-width:700px;margin:auto}pre{white-space:pre-wrap}</style><div id="fixture"></div><script src="/fixture.js"></script>',
	);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	args: ["--no-sandbox"],
});
try {
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(String(error)));
	await page.setViewport({ width: 768, height: 1024, hasTouch: true });
	await page.goto(`http://127.0.0.1:${server.address().port}`);
	await page.waitForSelector('[data-testid="demo-observation-share"]');
	const frame = await (await page.$("iframe")).contentFrame();
	assert.equal(
		await page.$eval("#shared", (e) => e.textContent),
		"",
		"operating a demo does not send a message",
	);
	await frame.$eval("#force", (e) => {
		e.value = "12";
		e.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await page.waitForFunction(() => document.querySelector('[data-testid="demo-observation-share"] button'));
	await new Promise((resolve) => setTimeout(resolve, 220));
	assert.match(await frame.$eval("#result", (e) => e.textContent), /6 m\/s/);
	await page.click('[data-testid="demo-observation-share"] button');
	await page.waitForFunction(() => document.querySelector("#shared").textContent.includes("6 m/s"));
	assert.match(await page.$eval("#shared", (e) => e.textContent), /Force.*12/s);
	assert.equal(await page.$eval('[data-testid="demo-observation-share"] button', (e) => e.disabled), true);
	await frame.click("#reset");
	await new Promise((resolve) => setTimeout(resolve, 220));
	assert.match(await frame.$eval("#result", (e) => e.textContent), /2 m\/s/);
	assert.equal(await page.$eval('[data-testid="demo-observation-share"] button', (e) => e.disabled), false);
	const prior = await page.$eval("#shared", (e) => e.textContent);
	await page.evaluate(() =>
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "demo-observation", observation: { parameters: { Fake: 900 }, result: "forged" } },
			}),
		),
	);
	await page.click('[data-testid="demo-observation-share"] button');
	await page.waitForFunction(() => document.querySelector("#shared").textContent.includes("2 m/s"));
	assert.doesNotMatch(await page.$eval("#shared", (e) => e.textContent), /forged/);
	assert.notEqual(await page.$eval("#shared", (e) => e.textContent), prior);
	await frame.click("#pause");
	assert.equal(await frame.$eval("#pause", (e) => e.textContent), "Resume");
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	await page.setViewport({ width: 390, height: 844, hasTouch: true });
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	assert.equal(await page.$eval("iframe", (e) => e.getAttribute("sandbox")), "allow-scripts");
	assert.deepEqual(errors, []);
	console.log(
		"PASS: real sandboxed simulation controls/results, explicit tutor sharing, duplicate guard, reset/pause, forged-message rejection, phone fit",
	);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
	await rm(directory, { recursive: true, force: true });
}
