import { validateNotebook, type NotebookData } from "./notebook";
function sources(data: NotebookData) {
	const result = new Set<string>();
	const walk = (value: unknown) => {
		if (!value || typeof value !== "object") return;
		const v = value as { type?: string; attrs?: { src?: string }; content?: unknown[] };
		if (v.type === "image" && v.attrs?.src) result.add(v.attrs.src);
		v.content?.forEach(walk);
	};
	data.pages.forEach((p) => p.blocks.forEach((b) => walk(b.content)));
	return [...result];
}
export async function notebookBackup(data: NotebookData) {
	const assets: Record<string, { mime: string; data: string }> = {};
	for (const src of sources(data)) {
		const response = await fetch(src);
		if (!response.ok)
			throw new Error("An image could not be read. Reconnect before exporting a complete backup.");
		const bytes = new Uint8Array(await response.arrayBuffer());
		let binary = "";
		for (let i = 0; i < bytes.length; i += 8192)
			binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
		assets[src] = { mime: response.headers.get("Content-Type") ?? "image/png", data: btoa(binary) };
	}
	return { format: "cognera-notebook-v1", data, assets };
}
export async function restoreNotebookBackup(file: File): Promise<NotebookData> {
	if (file.size > 50000000) throw new Error("Choose a backup smaller than 50 MB.");
	const backup = JSON.parse(await file.text());
	if (backup.format !== "cognera-notebook-v1" || !validateNotebook(backup.data))
		throw new Error("This is not a valid Cognera notebook backup.");
	let serialized = JSON.stringify(backup.data);
	for (const src of sources(backup.data)) {
		const asset = backup.assets?.[src];
		if (!asset || typeof asset.data !== "string" || asset.data.length > 7000000)
			throw new Error("This backup is missing an image or contains an oversized image.");
		const bytes = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0));
		const form = new FormData();
		form.set("file", new Blob([bytes], { type: asset.mime }), "restored-image");
		const response = await fetch("/api/notebook/assets", { method: "POST", body: form });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error);
		serialized = serialized.split(src).join(result.src);
	}
	return JSON.parse(serialized);
}
