import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { emptyNotebook, newNotePage, validateNotebook, noteText } from "../lib/notebook.ts";

test("notebook hierarchy, editable ink, and safe rich content validate together", () => {
	const book = randomUUID(),
		section = randomUUID();
	const p = newNotePage(section);
	p.blocks.push({
		id: randomUUID(),
		x: 80,
		y: 160,
		width: 900,
		content: {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "Conservation of energy" }] }],
		},
	});
	p.strokes.push({ tool: "pen", color: "#123456", width: 3, points: [{ x: 100, y: 200, p: 0.8 }] });
	const d = {
		notebooks: [{ id: book, title: "Physics" }],
		sections: [{ id: section, notebookId: book, title: "Mechanics", color: "#8899aa" }],
		pages: [p],
	};
	assert.equal(validateNotebook(d), true);
	assert.match(noteText(p), /Conservation/);
	assert.equal(validateNotebook({ ...d, sections: [{ ...d.sections[0], notebookId: randomUUID() }] }), false);
	assert.equal(
		validateNotebook({
			...d,
			pages: [{ ...p, strokes: [{ ...p.strokes[0], points: [{ x: NaN, y: 0, p: 1 }] }] }],
		}),
		false,
	);
	assert.equal(validateNotebook({ ...d, pages: [{ ...p, blocks: [null] }] }), false);
	assert.equal(validateNotebook({ ...d, pages: [{ ...p, strokes: [null] }] }), false);
	assert.equal(
		validateNotebook({
			...d,
			pages: [
				{
					...p,
					blocks: [
						{
							...p.blocks[0],
							content: { type: "doc", content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }] },
						},
					],
				},
			],
		}),
		false,
	);
	assert.equal(
		validateNotebook({
			...d,
			pages: [
				{
					...p,
					blocks: [
						{
							...p.blocks[0],
							content: {
								type: "doc",
								content: [
									{
										type: "paragraph",
										content: [
											{
												type: "text",
												text: "unsafe",
												marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
											},
										],
									},
								],
							},
						},
					],
				},
			],
		}),
		false,
	);
});
test("local API saves atomically, rejects stale writes, and preserves stored work", async () => {
	const directory = await mkdtemp(`${tmpdir()}/notebook-api-`);
	process.env.LH_DATA_DIR = directory;
	delete process.env.NEXT_PUBLIC_SUPABASE_URL;
	delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	try {
		const { GET, PUT } = await import("../app/api/notebook/route.ts");
		assert.equal((await (await GET()).json()).version, 0);
		const data = emptyNotebook();
		data.notebooks.push({ id: randomUUID(), title: "My notebook" });
		const save = (version: number, d: unknown = data) =>
			PUT(
				new Request("http://localhost/api/notebook", {
					method: "PUT",
					body: JSON.stringify({ version, data: d }),
				}),
			);
		assert.equal((await save(0)).status, 200);
		assert.equal((await save(0)).status, 409);
		assert.equal((await save(1, { pages: [] })).status, 400);
		assert.equal((await save(1, { ...data, notebooks: [data.notebooks[0], data.notebooks[0]] })).status, 400);
		const stored = await (await GET()).json();
		assert.equal(stored.version, 1);
		assert.deepEqual(stored.data, data);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
