"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
	BookOpenIcon,
	PlusIcon,
	SearchIcon,
	PanelLeftIcon,
	PencilIcon,
	TypeIcon,
	EraserIcon,
	HighlighterIcon,
	Undo2Icon,
	Redo2Icon,
	ImageIcon,
	PrinterIcon,
	DownloadIcon,
	HandIcon,
	MoreHorizontalIcon,
	Maximize2Icon,
	Minimize2Icon,
} from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import {
	emptyNotebook,
	newNotePage,
	noteText,
	sectionColors,
	validateNotebook,
	notebookFingerprint,
	type NotebookData,
	type NotebookSnapshot,
	type NotePage,
	type InkStroke,
} from "@/lib/notebook";
import { recoveryRead, recoveryWrite } from "@/lib/notebook-recovery";
import { notebookBackup, restoreNotebookBackup } from "@/lib/notebook-backup";
import type { InkTool } from "./ink";
import { NotebookCanvas } from "./canvas";
import { worldPoint } from "@/lib/notebook-camera";
import { TextBlock } from "./text-block";

export function Notebook() {
	const [data, setData] = useState<NotebookData>(emptyNotebook);
	const [loaded, setLoaded] = useState(false),
		[error, setError] = useState("");
	const [status, setStatus] = useState("Opening notebook…"),
		[storage, setStorage] = useState("local");
	const [book, setBook] = useState(""),
		[section, setSection] = useState(""),
		[pageId, setPage] = useState("");
	const [query, setQuery] = useState(""),
		[navigation, setNavigation] = useState(true);
	const [recent, setRecent] = useState(false),
		[exporting, setExporting] = useState(false);
	const [mode, setMode] = useState<"write" | "draw" | "hand">("write"),
		[finger, setFinger] = useState(false);
	const [tool, setTool] = useState<InkTool>({ tool: "pen", color: "#223b32", width: 3 });
	const [selected, setSelected] = useState("");
	const [busy, setBusy] = useState(false),
		[recoveryError, setRecoveryError] = useState("");
	const editor = useRef<Editor | null>(null),
		assetInput = useRef<HTMLInputElement>(null),
		backupInput = useRef<HTMLInputElement>(null);
	const live = useRef({
		data,
		version: 0,
		revision: 0,
		saved: 0,
		account: "",
		conflict: false,
		loading: true,
		saving: false,
	});
	const undo = useRef<InkStroke[][]>([]),
		redo = useRef<InkStroke[][]>([]);
	const [historyTick, setHistoryTick] = useState(0);
	const [fullscreen, setFullscreen] = useState(false);

	const toggleFullscreen = useCallback(() => {
		setFullscreen((prev) => {
			const next = !prev;
			if (next) {
				if (document.documentElement.requestFullscreen) {
					void document.documentElement.requestFullscreen().catch(() => {});
				}
			} else {
				if (document.fullscreenElement) {
					void document.exitFullscreen().catch(() => {});
				}
			}
			return next;
		});
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && fullscreen) {
				setFullscreen(false);
				if (document.fullscreenElement) {
					void document.exitFullscreen().catch(() => {});
				}
			}
		};
		const handleFsChange = () => {
			if (!document.fullscreenElement && fullscreen) {
				setFullscreen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		document.addEventListener("fullscreenchange", handleFsChange);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("fullscreenchange", handleFsChange);
		};
	}, [fullscreen]);

	// Prevent unwanted WebKit text selection / callout bleeds when drawing or interacting with notebook controls
	useEffect(() => {
		const handleSelectStart = (e: Event) => {
			const target = e.target as HTMLElement | null;
			if (target?.closest("input.nb-title, .nb-search input, .nb-text-block.is-selected .tiptap")) {
				return;
			}
			e.preventDefault();
		};
		window.addEventListener("selectstart", handleSelectStart);
		return () => window.removeEventListener("selectstart", handleSelectStart);
	}, []);

	const activePage = data.pages.find((p) => p.id === pageId),
		activeBook = data.notebooks.find((n) => n.id === book),
		activeSection = data.sections.find((s) => s.id === section);
	useEffect(() => {
		if (innerWidth < 700) setNavigation(false);
	}, []);
	useEffect(() => {
		setTool((v) => ({ ...v, color: activePage?.tone === "dark" ? "#e5ece7" : "#223b32" }));
	}, [pageId, activePage?.tone]);
	const update = useCallback(
		(change: (current: NotebookData) => NotebookData) => {
			const state = live.current;
			state.data = change(state.data);
			state.revision++;
			setData(state.data);
			setStatus("Unsaved changes");
			if (state.account)
				void recoveryWrite(state.account, {
					version: state.version,
					data: state.data,
					selection: pageId,
				}).catch(() =>
					setRecoveryError(
						"Local recovery is unavailable. Keep this tab open until saving succeeds, or export a backup.",
					),
				);
		},
		[pageId],
	);
	const changePage = (change: Partial<NotePage>) =>
		update((d) => ({
			...d,
			pages: d.pages.map((p) =>
				p.id === pageId ? { ...p, ...change, updatedAt: new Date().toISOString() } : p,
			),
		}));
	const flush = useCallback(async () => {
		const state = live.current;
		if (state.loading || state.saving || state.conflict || state.revision === state.saved) return;
		state.saving = true;
		const revision = state.revision,
			document = state.data;
		setStatus(navigator.onLine ? "Saving…" : "Offline · recovery draft kept");
		try {
			await recoveryWrite(state.account, { version: state.version, data: document }).catch(() =>
				setRecoveryError(
					"Local recovery is unavailable. Export a backup if you need to close this tab before saving.",
				),
			);
			const response = await fetch("/api/notebook", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ version: state.version, data: document }),
			});
			const result = await response.json();
			if (!response.ok) {
				if (response.status === 409) state.conflict = true;
				throw new Error(result.error);
			}
			state.version = result.version;
			state.saved = revision;
			// Store the current draft against the new base, even when edits arrived during save.
			await recoveryWrite(state.account, { version: state.version, data: state.data }).catch(() =>
				setRecoveryError("Saved, but local recovery is unavailable in this browser."),
			);
			setError("");
			setStatus(
				state.revision === revision
					? storage === "cloud"
						? "Saved to your account"
						: "Saved on this computer"
					: "Unsaved changes",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not save. Your recovery draft is kept.");
			setStatus(navigator.onLine ? "Save needs attention" : "Offline · recovery draft kept");
		} finally {
			state.saving = false;
			if (state.saved !== state.revision && !state.conflict && navigator.onLine)
				setTimeout(() => {
					if (live.current.revision !== revision) void flush();
				}, 800);
		}
	}, [storage]);
	async function load(discard = false) {
		if (
			discard &&
			!window.confirm(
				"Reload the saved copy? Your current draft will be replaced. Export a backup first if you want to keep it.",
			)
		)
			return;
		setError("");
		try {
			const response = await fetch("/api/notebook", { cache: "no-store" });
			const result = (await response.json()) as NotebookSnapshot & { account: string; error?: string };
			if (!response.ok) throw new Error(result.error);
			if (!validateNotebook(result.data))
				throw new Error("The stored notebook could not be read. Export your recovery draft before retrying.");
			if (discard) await recoveryWrite(result.account, { version: result.version, data: result.data });
			const draft = discard
				? undefined
				: await recoveryRead(result.account).catch(() => {
						setRecoveryError("Local recovery is unavailable in this browser.");
						return undefined;
					});
			const recovered =
				draft &&
				validateNotebook(draft.data) &&
				notebookFingerprint(draft.data) !== notebookFingerprint(result.data);
			const document = recovered ? draft.data : result.data;
			live.current = {
				data: document,
				version: result.version,
				revision: recovered ? 1 : 0,
				saved: 0,
				account: result.account,
				conflict: !!recovered && draft.version !== result.version,
				loading: false,
				saving: false,
			};
			setData(document);
			setStorage(result.storage);
			setLoaded(true);
			const last = localStorage.getItem(`nb-selection:${result.account}`);
			const first = document.pages.find((p) => p.id === last) ?? document.pages[0];
			setPage(first?.id ?? "");
			const s = document.sections.find((s) => s.id === first?.sectionId) ?? document.sections[0];
			setSection(s?.id ?? "");
			setBook(s?.notebookId ?? document.notebooks[0]?.id ?? "");
			setStatus(
				recovered
					? "Recovered unsaved notes"
					: result.storage === "cloud"
						? "Saved to your account"
						: "Saved on this computer",
			);
			if (live.current.conflict)
				setError(
					"A recovery draft and a newer saved copy both exist. Export your draft, then reload the saved copy to avoid overwriting newer work.",
				);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Notebook could not open.");
			setStatus("Could not open notebook");
		}
	}
	useEffect(() => {
		void load();
	}, []); // Initial load owns recovery and account identity.
	useEffect(() => {
		if (!loaded) return;
		const timer = setTimeout(() => void flush(), 900);
		return () => clearTimeout(timer);
	}, [data, loaded, flush]);
	useEffect(() => {
		const online = () => void flush();
		const leave = (e: BeforeUnloadEvent) => {
			if (live.current.revision !== live.current.saved) {
				e.preventDefault();
			}
		};
		window.addEventListener("online", online);
		window.addEventListener("beforeunload", leave);
		const visibility = () => {
			if (document.visibilityState === "hidden") void flush();
		};
		document.addEventListener("visibilitychange", visibility);
		return () => {
			window.removeEventListener("online", online);
			window.removeEventListener("beforeunload", leave);
			document.removeEventListener("visibilitychange", visibility);
		};
	}, [flush]);
	useEffect(() => {
		undo.current = [];
		redo.current = [];
		editor.current = null;
		setSelected("");
		setHistoryTick(0);
		setBusy(false);
		if (live.current.account && pageId) localStorage.setItem(`nb-selection:${live.current.account}`, pageId);
	}, [pageId]);
	function selectPage(p: NotePage) {
		setPage(p.id);
		setSection(p.sectionId);
		setBook(live.current.data.sections.find((s) => s.id === p.sectionId)!.notebookId);
	}
	function makeBook() {
		const title = window.prompt("Notebook name");
		if (!title?.trim()) return;
		const id = crypto.randomUUID();
		const s = { id: crypto.randomUUID(), notebookId: id, title: "Notes", color: sectionColors[0]! };
		const p = newNotePage(s.id);
		update((d) => ({
			...d,
			notebooks: [...d.notebooks, { id, title: title.trim().slice(0, 250) }],
			sections: [...d.sections, s],
			pages: [...d.pages, p],
		}));
		setBook(id);
		setSection(s.id);
		setPage(p.id);
	}
	function makeSection() {
		if (!book) return;
		const title = window.prompt("Section name");
		if (!title?.trim()) return;
		const s = {
			id: crypto.randomUUID(),
			notebookId: book,
			title: title.trim().slice(0, 250),
			color: sectionColors[data.sections.length % sectionColors.length]!,
		};
		const p = newNotePage(s.id);
		update((d) => ({ ...d, sections: [...d.sections, s], pages: [...d.pages, p] }));
		setSection(s.id);
		setPage(p.id);
	}
	function makePage() {
		if (!section) return;
		const p = newNotePage(section);
		update((d) => ({ ...d, pages: [...d.pages, p] }));
		setPage(p.id);
	}
	function reorderBook(direction: number) {
		update((d) => {
			const list = [...d.notebooks],
				index = list.findIndex((n) => n.id === book),
				next = index + direction;
			if (next < 0 || next >= list.length) return d;
			[list[index], list[next]] = [list[next]!, list[index]!];
			return { ...d, notebooks: list };
		});
	}
	function remove(kind: "book" | "section" | "page") {
		if (
			!window.confirm(
				`Delete this ${kind === "book" ? "notebook and all its notes" : kind === "section" ? "section and all its pages" : "page"}? This cannot be undone.`,
			)
		)
			return;
		update((d) => {
			const removedSections = d.sections
				.filter((s) => (kind === "book" ? s.notebookId === book : kind === "section" && s.id === section))
				.map((s) => s.id);
			return {
				notebooks: d.notebooks.filter((n) => kind !== "book" || n.id !== book),
				sections: d.sections.filter((s) => !removedSections.includes(s.id)),
				pages: d.pages.filter(
					(p) => !removedSections.includes(p.sectionId) && (kind !== "page" || p.id !== pageId),
				),
			};
		});
		setPage("");
		if (kind !== "page") setSection("");
		if (kind === "book") setBook("");
	}
	function rename(kind: "book" | "section") {
		const title = window.prompt(
			`Rename ${kind === "book" ? "notebook" : "section"}`,
			kind === "book" ? activeBook?.title : activeSection?.title,
		);
		if (!title?.trim()) return;
		update((d) => ({
			...d,
			...(kind === "book"
				? {
						notebooks: d.notebooks.map((n) =>
							n.id === book ? { ...n, title: title.trim().slice(0, 250) } : n,
						),
					}
				: {
						sections: d.sections.map((s) =>
							s.id === section ? { ...s, title: title.trim().slice(0, 250) } : s,
						),
					}),
		}));
	}
	function reorder(kind: "page" | "section", direction: number) {
		update((d) => {
			const key = kind === "page" ? "pages" : "sections";
			const list = [...d[key]];
			const id = kind === "page" ? pageId : section;
			const group = list.filter((v) => ("sectionId" in v ? v.sectionId === section : v.notebookId === book));
			const i = group.findIndex((v) => v.id === id),
				next = group[i + direction];
			if (!next) return d;
			const a = list.findIndex((v) => v.id === id),
				b = list.findIndex((v) => v.id === next.id);
			[list[a], list[b]] = [list[b]!, list[a]!];
			return { ...d, [key]: list };
		});
	}
	function addText() {
		if (!activePage) return;
		const id = crypto.randomUUID();
		const viewport = document.querySelector<HTMLElement>(".nb-viewport");
		const camera = viewport?.dataset.camera ? JSON.parse(viewport.dataset.camera) : { x: 0, y: 0, zoom: 1 };
		const origin = worldPoint(camera, { x: 70, y: 140 });
		changePage({
			blocks: [
				...activePage.blocks,
				{
					id,
					x: origin.x,
					y: origin.y,
					width: 900,
					content: { type: "doc", content: [{ type: "paragraph" }] },
				},
			],
		});
		setSelected(id);
		setMode("write");
	}
	function inkChange(strokes: InkStroke[]) {
		const state = live.current;
		const curPage = state.data.pages.find((p) => p.id === pageId);
		if (!curPage) return;
		undo.current.push(curPage.strokes);
		redo.current = [];
		changePage({ strokes });
	}
	function inkUndo(forward = false) {
		if (!activePage) return;
		const from = forward ? redo : undo,
			to = forward ? undo : redo;
		const value = from.current.pop();
		if (!value) return;
		to.current.push(activePage.strokes);
		setHistoryTick((v) => v + 1);
		changePage({ strokes: value });
	}
	async function upload(files: File[]) {
		const target = editor.current;
		if (!target || target.isDestroyed) {
			setError("Select a text block before adding an image.");
			return;
		}
		for (const file of files) {
			try {
				const form = new FormData();
				form.set("file", file);
				const response = await fetch("/api/notebook/assets", { method: "POST", body: form });
				const result = await response.json();
				if (!response.ok) throw new Error(result.error);
				if (!target.isDestroyed) target.chain().focus().setImage({ src: result.src, alt: file.name }).run();
			} catch (e) {
				setError(e instanceof Error ? e.message : "Image upload failed.");
			}
		}
	}
	useEffect(() => {
		const paste = (event: Event) => void upload((event as CustomEvent<File[]>).detail);
		const width = (event: Event) => {
			const { id, width } = (event as CustomEvent<{ id: string; width: number }>).detail;
			update((d) => ({
				...d,
				pages: d.pages.map((p) =>
					p.id === pageId ? { ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, width } : b)) } : p,
				),
			}));
		};
		window.addEventListener("nb-paste-images", paste);
		window.addEventListener("nb-block-width", width);
		return () => {
			window.removeEventListener("nb-paste-images", paste);
			window.removeEventListener("nb-block-width", width);
		};
	}, [pageId, update]);
	async function download() {
		setExporting(true);
		try {
			const blob = new Blob([JSON.stringify(await notebookBackup(live.current.data), null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "cognera-notebook-backup.json";
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not export the backup.");
		} finally {
			setExporting(false);
		}
	}
	async function restore(file: File) {
		if (
			!window.confirm(
				"Replace all current notebooks with this backup? Export your current notes first if you want to keep them.",
			)
		)
			return;
		try {
			const restored = await restoreNotebookBackup(file);
			update(() => restored);
			const p = restored.pages[0];
			if (p) {
				setPage(p.id);
				const s = restored.sections.find((s) => s.id === p.sectionId)!;
				setSection(s.id);
				setBook(s.notebookId);
			} else {
				setPage("");
				setSection("");
				setBook(restored.notebooks[0]?.id ?? "");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not restore this backup.");
		}
	}
	const run = (action: (e: Editor) => void) => {
		if (editor.current && !editor.current.isDestroyed) action(editor.current);
		else setError("Select a text block to format your notes.");
	};
	const results = data.pages
		.filter((p) =>
			query ? noteText(p).toLowerCase().includes(query.toLowerCase()) : recent || p.sectionId === section,
		)
		.sort((a, b) => (query || recent ? b.updatedAt.localeCompare(a.updatedAt) : 0));
	return (
		<main
			className={`notebook ${fullscreen ? "is-fullscreen" : ""} mode-${mode}`}
			data-native-keyboard="true"
			data-history={historyTick}
		>
			<header className="nb-header">
				<SidebarToggle />
				<BookOpenIcon size={20} />
				<h1>Notebook</h1>
				<span className="nb-save" role="status">
					{status}
				</span>
				<details className="nb-actions-menu">
					<summary aria-label="Notebook actions">
						<MoreHorizontalIcon size={20} />
					</summary>
					<div>
						<button onClick={() => void flush()} disabled={!loaded}>
							Save now
						</button>
						<button
							title="Export editable backup"
							onClick={() => void download()}
							disabled={!loaded || exporting}
						>
							<DownloadIcon size={16} />
							<span>{exporting ? "Exporting…" : "Backup"}</span>
						</button>
						<button
							aria-label="Restore notebook backup"
							onClick={() => backupInput.current?.click()}
							disabled={!loaded}
						>
							Restore
						</button>
						<button onClick={() => window.print()} disabled={!activePage}>
							<PrinterIcon size={16} />
							<span>Print / PDF</span>
						</button>
					</div>
				</details>
			</header>
			{(error || recoveryError) && (
				<div className="nb-error" role="alert">
					<span>{error || recoveryError}</span>
					<button onClick={() => (loaded ? void flush() : void load())}>Retry</button>
					{loaded && <button onClick={() => void load(true)}>Reload saved copy</button>}
				</div>
			)}
			<div className="nb-body">
				<aside className={`nb-navigation ${navigation ? "is-open" : ""}`}>
					<button
						className="nb-close-navigation"
						aria-label="Close notebook navigation"
						onClick={() => setNavigation(false)}
					>
						Close pages ×
					</button>
					<div className="nb-library">
						<label>
							Notebook
							<select
								aria-label="Choose notebook"
								value={book}
								onChange={(e) => {
									setBook(e.target.value);
									const s = data.sections.find((s) => s.notebookId === e.target.value);
									setSection(s?.id ?? "");
									setPage(data.pages.find((p) => p.sectionId === s?.id)?.id ?? "");
								}}
							>
								<option value="" disabled>
									Choose a notebook
								</option>
								{data.notebooks.map((n) => (
									<option key={n.id} value={n.id}>
										{n.title}
									</option>
								))}
							</select>
						</label>
						<button title="New notebook" aria-label="New notebook" onClick={makeBook} disabled={!loaded}>
							<PlusIcon size={18} />
						</button>
					</div>
					{activeBook && (
						<details className="nb-library-menu">
							<summary>Notebook options</summary>
							<div className="nb-small-actions">
								<button onClick={() => rename("book")}>Rename</button>
								<button onClick={() => remove("book")}>Delete</button>
								<button
									aria-label="Move notebook up"
									disabled={data.notebooks[0]?.id === book}
									onClick={() => reorderBook(-1)}
								>
									↑
								</button>
								<button
									aria-label="Move notebook down"
									disabled={data.notebooks.at(-1)?.id === book}
									onClick={() => reorderBook(1)}
								>
									↓
								</button>
							</div>
						</details>
					)}
					<label className="nb-search">
						<SearchIcon size={16} />
						<input
							aria-label="Search notes"
							placeholder="Search all notes"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</label>
					<div className="nb-small-actions">
						<button aria-pressed={!recent} onClick={() => setRecent(false)}>
							Section pages
						</button>
						<button aria-pressed={recent} onClick={() => setRecent(true)}>
							Recent pages
						</button>
					</div>
					<div className="nb-page-heading">
						<span>
							{query ? "Search results" : recent ? "Recently edited" : (activeSection?.title ?? "Pages")}
						</span>
						<button title="New page" aria-label="New page" onClick={makePage} disabled={!section}>
							<PlusIcon size={17} />
						</button>
					</div>
					<div className="nb-pages">
						{results.map((p) => (
							<button
								key={p.id}
								className={pageId === p.id ? "selected" : ""}
								onClick={() => {
									selectPage(p);
									if (innerWidth < 700) setNavigation(false);
								}}
							>
								<strong>{p.title || "Untitled page"}</strong>
								<span>
									{noteText(p).slice(p.title.length).trim().slice(0, 65) || "An open page for your thinking"}
								</span>
								<time>
									{new Date(p.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
								</time>
							</button>
						))}
						{!results.length && (
							<p className="nb-muted">{query ? "No matching notes." : "Your pages will appear here."}</p>
						)}
					</div>
					{activePage && (
						<details className="nb-page-settings">
							<summary>Organize page</summary>
							<label>
								Move to section
								<select
									aria-label="Move page to section"
									value={activePage.sectionId}
									onChange={(e) => {
										changePage({ sectionId: e.target.value });
										setSection(e.target.value);
										setBook(data.sections.find((s) => s.id === e.target.value)!.notebookId);
									}}
								>
									{data.sections.map((s) => (
										<option key={s.id} value={s.id}>
											{data.notebooks.find((n) => n.id === s.notebookId)?.title} / {s.title}
										</option>
									))}
								</select>
							</label>
							<div>
								<button onClick={() => reorder("page", -1)}>Move up</button>
								<button onClick={() => reorder("page", 1)}>Move down</button>
							</div>
							<button onClick={() => remove("page")}>Delete page</button>
						</details>
					)}
				</aside>
				<section className="nb-workspace">
					<div className="nb-sections">
						<button
							aria-label="Toggle notebook navigation"
							aria-expanded={navigation}
							onClick={() => setNavigation((v) => !v)}
						>
							<PanelLeftIcon size={17} />
						</button>
						<div role="tablist" aria-label="Sections">
							{data.sections
								.filter((s) => s.notebookId === book)
								.map((s) => (
									<button
										role="tab"
										aria-selected={section === s.id}
										key={s.id}
										style={{ "--section-color": s.color } as React.CSSProperties}
										onClick={() => {
											setSection(s.id);
											setPage(data.pages.find((p) => p.sectionId === s.id)?.id ?? "");
											setQuery("");
										}}
									>
										{s.title}
									</button>
								))}
						</div>
						<button aria-label="New section" disabled={!book} onClick={makeSection}>
							<PlusIcon size={17} />
						</button>
						{activeSection && (
							<details className="nb-section-menu">
								<summary>Section options</summary>
								<div>
									<button onClick={() => rename("section")}>Rename</button>
									<label>
										Tab color
										<input
											type="color"
											value={activeSection.color}
											onChange={(e) =>
												update((d) => ({
													...d,
													sections: d.sections.map((s) =>
														s.id === section ? { ...s, color: e.target.value } : s,
													),
												}))
											}
										/>
									</label>
									<label>
										Move to notebook
										<select
											value={book}
											onChange={(e) => {
												const id = e.target.value;
												update((d) => ({
													...d,
													sections: d.sections.map((s) => (s.id === section ? { ...s, notebookId: id } : s)),
												}));
												setBook(id);
											}}
										>
											{data.notebooks.map((n) => (
												<option key={n.id} value={n.id}>
													{n.title}
												</option>
											))}
										</select>
									</label>
									<button onClick={() => reorder("section", -1)}>Move left</button>
									<button onClick={() => reorder("section", 1)}>Move right</button>
									<button onClick={() => remove("section")}>Delete section</button>
								</div>
							</details>
						)}
					</div>
					{activePage ? (
						<>
							<div className="nb-tools" aria-label="Notebook tools">
								<div className="nb-tool-group">
									<button aria-pressed={mode === "write"} onClick={() => setMode("write")}>
										<TypeIcon size={16} />
										Write
									</button>
									<button aria-pressed={mode === "draw"} onClick={() => setMode("draw")}>
										<PencilIcon size={16} />
										Draw
									</button>
									<button aria-pressed={mode === "hand"} onClick={() => setMode("hand")}>
										<HandIcon size={16} />
										Hand
									</button>
								</div>
								{mode === "write" ? (
									<>
										<button onClick={addText}>
											<PlusIcon size={16} />
											Text block
										</button>
										<details className="nb-format-menu">
											<summary>Format & insert</summary>
											<div>
												<button title="Bold" onClick={() => run((e) => e.chain().focus().toggleBold().run())}>
													<b>B</b>
												</button>
												<button
													title="Italic"
													onClick={() => run((e) => e.chain().focus().toggleItalic().run())}
												>
													<i>I</i>
												</button>
												<button
													onClick={() => run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}
												>
													Heading
												</button>
												<button onClick={() => run((e) => e.chain().focus().toggleBulletList().run())}>
													List
												</button>
												<button onClick={() => run((e) => e.chain().focus().toggleTaskList().run())}>
													Checklist
												</button>
												<button
													onClick={() =>
														run((e) =>
															e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
														)
													}
												>
													Table
												</button>
												<button
													onClick={() =>
														run((e) => {
															const url = window.prompt("Link URL (https://…)");
															if (url && /^(https?:\/\/|mailto:)/i.test(url))
																e.chain().focus().setLink({ href: url }).run();
														})
													}
												>
													Link
												</button>
												<button onClick={() => assetInput.current?.click()}>
													<ImageIcon size={16} />
													Image
												</button>
											</div>
										</details>
										<button title="Undo text edit" onClick={() => run((e) => e.chain().focus().undo().run())}>
											<Undo2Icon size={16} />
										</button>
										<button title="Redo text edit" onClick={() => run((e) => e.chain().focus().redo().run())}>
											<Redo2Icon size={16} />
										</button>
									</>
								) : mode === "draw" ? (
									<>
										<div className="nb-tool-group">
											{(["pen", "highlighter", "eraser"] as const).map((t, i) => (
												<button
													key={t}
													aria-label={t}
													aria-pressed={tool.tool === t}
													onClick={() => setTool((v) => ({ ...v, tool: t }))}
												>
													{i === 0 ? (
														<PencilIcon size={17} />
													) : i === 1 ? (
														<HighlighterIcon size={17} />
													) : (
														<EraserIcon size={17} />
													)}
												</button>
											))}
										</div>
										<label>
											Size
											<input
												aria-label="Ink thickness"
												type="range"
												min="1"
												max="14"
												value={tool.width}
												onChange={(e) => setTool((v) => ({ ...v, width: Number(e.target.value) }))}
											/>
										</label>
										<input
											type="color"
											aria-label="Ink color"
											value={tool.color}
											onChange={(e) => setTool((v) => ({ ...v, color: e.target.value }))}
										/>
										<button
											aria-label="Undo ink"
											disabled={!undo.current.length || busy}
											onClick={() => inkUndo()}
										>
											<Undo2Icon size={16} />
										</button>
										<button
											aria-label="Redo ink"
											disabled={!redo.current.length || busy}
											onClick={() => inkUndo(true)}
										>
											<Redo2Icon size={16} />
										</button>
										<details className="nb-ink-options">
											<summary aria-label="More drawing options">
												<MoreHorizontalIcon size={17} />
											</summary>
											<div>
												<label>
													<input
														type="checkbox"
														checked={finger}
														onChange={(e) => setFinger(e.target.checked)}
													/>
													Finger drawing
												</label>
												<button
													disabled={busy || !activePage.strokes.length}
													onClick={() => {
														if (window.confirm("Clear all handwriting on this page? You can undo this."))
															inkChange([]);
													}}
												>
													Clear ink
												</button>
											</div>
										</details>
									</>
								) : (
									<span className="nb-hand-hint">Drag to explore</span>
								)}
								<details className="nb-paper-menu">
									<summary>Paper</summary>
									<div>
										<label className="nb-paper-control">
											Paper
											<select
												aria-label="Paper style"
												value={activePage.paper}
												onChange={(e) => changePage({ paper: e.target.value as NotePage["paper"] })}
											>
												<option value="plain">Plain</option>
												<option value="ruled">Ruled</option>
												<option value="grid">Grid</option>
											</select>
										</label>
										<label>
											Appearance
											<select
												aria-label="Paper appearance"
												value={activePage.tone ?? "light"}
												onChange={(e) => changePage({ tone: e.target.value as "light" | "dark" })}
											>
												<option value="dark">Dark</option>
												<option value="light">Light</option>
											</select>
										</label>
									</div>
								</details>
								<button
									type="button"
									className="nb-fullscreen-toggle"
									title={fullscreen ? "Exit full screen (Esc)" : "Full screen canvas"}
									aria-label={fullscreen ? "Exit full screen" : "Full screen canvas"}
									aria-pressed={fullscreen}
									onClick={toggleFullscreen}
								>
									{fullscreen ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
									<span>{fullscreen ? "Exit" : "Full screen"}</span>
								</button>
							</div>
							<NotebookCanvas
								key={pageId}
								page={activePage}
								account={live.current.account}
								mode={mode}
								tool={tool}
								finger={finger}
								fullscreen={fullscreen}
								historyTick={historyTick}
								onToggleFullscreen={toggleFullscreen}
								onChange={inkChange}
								onBusy={setBusy}
							>
								<input
									className="nb-title"
									aria-label="Page title"
									maxLength={250}
									value={activePage.title}
									onChange={(e) => changePage({ title: e.target.value })}
								/>
								{!activePage.blocks.length && mode === "write" && (
									<button className="nb-start-writing" onClick={addText}>
										Start writing, or switch to Draw for handwritten notes.
									</button>
								)}
								{activePage.blocks.map((block) => (
									<TextBlock
										key={`${pageId}:${block.id}`}
										block={block}
										selected={selected === block.id && mode === "write"}
										onSelect={() => setSelected(block.id)}
										onEditor={(e) => {
											editor.current = e;
										}}
										onChange={(content) =>
											update((d) => ({
												...d,
												pages: d.pages.map((p) =>
													p.id === pageId
														? {
																...p,
																updatedAt: new Date().toISOString(),
																blocks: p.blocks.map((b) => (b.id === block.id ? { ...b, content } : b)),
															}
														: p,
												),
											}))
										}
										onMove={(x, y) =>
											changePage({
												blocks: activePage.blocks.map((b) => (b.id === block.id ? { ...b, x, y } : b)),
											})
										}
										onDelete={() => {
											if (window.confirm("Delete this text block?"))
												changePage({ blocks: activePage.blocks.filter((b) => b.id !== block.id) });
										}}
									/>
								))}
							</NotebookCanvas>
							<footer className="nb-footer">
								<span>
									{mode === "draw"
										? finger
											? "Finger drawing enabled"
											: "Pencil writes · Finger scrolls"
										: "Write freely · Drag a block’s handle to arrange your page"}
								</span>
								<span>
									{activePage.strokes.length} strokes ·{" "}
									{storage === "cloud" ? "Private account notebook" : "Local notebook"}
								</span>
							</footer>
						</>
					) : (
						<div className="nb-empty">
							<BookOpenIcon size={42} strokeWidth={1} />
							<h2>A place to think on paper.</h2>
							<p>Keep ideas, work through equations, and make connections in your own handwriting.</p>
							<button disabled={!loaded} onClick={book ? (section ? makePage : makeSection) : makeBook}>
								<PlusIcon size={17} />
								{book ? (section ? "Create a page" : "Create a section") : "Create your first notebook"}
							</button>
						</div>
					)}
				</section>
			</div>
			<input
				ref={assetInput}
				hidden
				type="file"
				accept="image/png,image/jpeg,image/webp"
				multiple
				onChange={(e) => {
					void upload([...(e.target.files ?? [])]);
					e.target.value = "";
				}}
			/>
			<input
				ref={backupInput}
				hidden
				type="file"
				accept="application/json"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) void restore(file);
					e.target.value = "";
				}}
			/>
		</main>
	);
}
