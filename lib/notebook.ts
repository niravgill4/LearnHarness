export type InkPoint = { x: number; y: number; p: number };
export type InkStroke = {
	points: InkPoint[];
	color: string;
	width: number;
	tool: "pen" | "highlighter" | "eraser";
};
export type NoteBlock = { id: string; x: number; y: number; width: number; content: Record<string, unknown> };
export type NotePage = {
	id: string;
	sectionId: string;
	title: string;
	paper: "plain" | "ruled" | "grid";
	tone?: "light" | "dark";
	blocks: NoteBlock[];
	strokes: InkStroke[];
	updatedAt: string;
};
export type NoteSection = { id: string; notebookId: string; title: string; color: string };
export type NoteBook = { id: string; title: string };
export type NotebookData = { notebooks: NoteBook[]; sections: NoteSection[]; pages: NotePage[] };
export type NotebookSnapshot = { version: number; data: NotebookData; storage: "cloud" | "local" };
export const emptyNotebook = (): NotebookData => ({ notebooks: [], sections: [], pages: [] });
export const newNotePage = (sectionId: string): NotePage => ({
	id: crypto.randomUUID(),
	sectionId,
	title: "Untitled page",
	paper: "plain",
	tone: "dark",
	blocks: [],
	strokes: [],
	updatedAt: new Date().toISOString(),
});
export const sectionColors = ["#8bb5a0", "#a8a0ce", "#d3aa77", "#86aeca", "#d29da7"];
export const NOTEBOOK_PATCH_LIMIT = 3_900_000;
export const NOTEBOOK_PATCH_PAGES = 32;

/** null requires a full save because the library structure changed. */
export function editedNotePages(base: NotebookData, next: NotebookData): NotePage[] | null {
	if (base.notebooks !== next.notebooks || base.sections !== next.sections || base.pages.length !== next.pages.length)
		return null;
	const edited: NotePage[] = [];
	for (const [index, page] of next.pages.entries()) {
		const previous = base.pages[index]!;
		if (previous.id !== page.id || previous.sectionId !== page.sectionId) return null;
		if (previous !== page) edited.push(page);
	}
	return edited.length <= NOTEBOOK_PATCH_PAGES ? edited : null;
}
export function notebookFingerprint(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(notebookFingerprint).join(",")}]`;
	if (value && typeof value === "object")
		return (
			"{" +
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, v]) => `${JSON.stringify(key)}:${notebookFingerprint(v)}`)
				.join(",") +
			"}"
		);
	return JSON.stringify(value);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const color = /^#[0-9a-f]{6}$/i;
const finite = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const coordinate = (v: unknown) =>
	typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
const title = (v: unknown) => typeof v === "string" && v.length <= 250;
export function validateNotebook(value: unknown): value is NotebookData {
	if (!value || typeof value !== "object") return false;
	const d = value as NotebookData;
	if (
		![d.notebooks, d.sections, d.pages].every(Array.isArray) ||
		d.notebooks.length > 100 ||
		d.sections.length > 500 ||
		d.pages.length > 500
	)
		return false;
	const ids = new Set<string>();
	for (const item of [...d.notebooks, ...d.sections, ...d.pages]) {
		if (!item || !uuid.test(item.id) || ids.has(item.id) || !title(item.title)) return false;
		ids.add(item.id);
	}
	if (d.sections.some((s) => !d.notebooks.some((n) => n.id === s.notebookId) || !color.test(s.color)))
		return false;
	return d.pages.every(p => d.sections.some(s => s.id === p.sectionId) && validateNotePage(p));
}
export function validateNotePage(value: unknown): value is NotePage {
	if (!value || typeof value !== "object") return false;
	const p = value as NotePage;
	if (
		typeof p.id !== "string" ||
		!uuid.test(p.id) ||
		typeof p.sectionId !== "string" ||
		!uuid.test(p.sectionId) ||
		!title(p.title) ||
		!["plain", "ruled", "grid"].includes(p.paper) ||
		(p.tone !== undefined && !["light", "dark"].includes(p.tone)) ||
		typeof p.updatedAt !== "string" ||
		Number.isNaN(Date.parse(p.updatedAt))
	)
		return false;
	if (!Array.isArray(p.blocks) || p.blocks.length > 100 || !Array.isArray(p.strokes) || p.strokes.length > 15000)
		return false;
	const blockIds = new Set<string>();
	for (const b of p.blocks) {
		if (
			!b ||
			!uuid.test(b.id) ||
			blockIds.has(b.id) ||
			!coordinate(b.x) ||
			!coordinate(b.y) ||
			!finite(b.width, 10000) ||
			b.width < 100 ||
			!validContent(b.content)
		)
			return false;
		blockIds.add(b.id);
	}
	return p.strokes.every(
		(s) =>
			s &&
			["pen", "highlighter", "eraser"].includes(s.tool) &&
			color.test(s.color) &&
			finite(s.width, 80) &&
			Array.isArray(s.points) &&
			s.points.length <= 15000 &&
			s.points.every((pt) => pt && coordinate(pt.x) && coordinate(pt.y) && finite(pt.p, 1)),
	);
}
function validContent(node: unknown, depth = 0): boolean {
	if (!node || typeof node !== "object" || depth > 40) return false;
	const n = node as {
		type?: unknown;
		text?: unknown;
		attrs?: Record<string, unknown>;
		content?: unknown[];
		marks?: unknown[];
	};
	const types = [
		"doc",
		"text",
		"paragraph",
		"heading",
		"bulletList",
		"orderedList",
		"listItem",
		"taskList",
		"taskItem",
		"blockquote",
		"codeBlock",
		"horizontalRule",
		"hardBreak",
		"table",
		"tableRow",
		"tableHeader",
		"tableCell",
		"image",
	];
	if (
		!types.includes(String(n.type)) ||
		(n.text !== undefined && (typeof n.text !== "string" || n.text.length > 200000))
	)
		return false;
	if (n.type === "image" && !/^\/api\/notebook\/assets\/[0-9a-f-]{36}$/.test(String(n.attrs?.src)))
		return false;
	if (
		n.marks !== undefined &&
		(!Array.isArray(n.marks) ||
			n.marks.some((mark) => {
				const m = mark as { type: string; attrs?: { href?: unknown } };
				return (
					!m ||
					!["bold", "italic", "strike", "code", "underline", "link"].includes(m.type) ||
					(m.type === "link" && !/^(https?:\/\/|mailto:)/i.test(String(m.attrs?.href)))
				);
			}))
	)
		return false;
	return (
		n.content === undefined ||
		(Array.isArray(n.content) && n.content.every((child) => validContent(child, depth + 1)))
	);
}
export function noteText(page: NotePage): string {
	const text = (n: unknown): string => {
		const v = n as { text?: string; content?: unknown[] };
		return v.text ?? v.content?.map(text).join(" ") ?? "";
	};
	return `${page.title} ${page.blocks.map((b) => text(b.content)).join(" ")}`;
}
