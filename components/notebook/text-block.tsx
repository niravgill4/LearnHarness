"use client";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect } from "react";
import { notebookFingerprint, type NoteBlock } from "@/lib/notebook";
export function TextBlock({
	block,
	selected,
	onChange,
	onSelect,
	onEditor,
	onMove,
	onDelete,
}: {
	block: NoteBlock;
	selected: boolean;
	onChange(content: Record<string, unknown>): void;
	onSelect(): void;
	onEditor(editor: Editor): void;
	onMove(x: number, y: number): void;
	onDelete(): void;
}) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({ link: { openOnClick: false, protocols: ["http", "https", "mailto"] } }),
			TableKit,
			Image.extend({
				parseHTML() {
					return [{ tag: 'img[src^="/api/notebook/assets/"]' }];
				},
			}).configure({ allowBase64: false }),
			TaskList,
			TaskItem.configure({ nested: true }),
		],
		content: block.content,
		immediatelyRender: false,
		onUpdate: ({ editor }) => onChange(editor.getJSON()),
		onFocus: ({ editor }) => {
			onSelect();
			onEditor(editor);
		},
		editorProps: {
			attributes: { "aria-label": "Note text", spellcheck: "true" },
			handlePaste: (_view, event) => {
				if (event.clipboardData?.files.length) {
					event.preventDefault();
					window.dispatchEvent(
						new CustomEvent("nb-paste-images", { detail: [...event.clipboardData.files] }),
					);
					return true;
				}
				return false;
			},
		},
	});
	useEffect(() => {
		if (selected && editor && !editor.isFocused) editor.commands.focus();
	}, [selected, editor]);
	useEffect(() => {
		if (editor && notebookFingerprint(editor.getJSON()) !== notebookFingerprint(block.content))
			editor.commands.setContent(block.content, { emitUpdate: false });
	}, [editor, block.content]);
	return (
		<div
			className={`nb-text-block ${selected ? "is-selected" : ""}`}
			data-block-id={block.id}
			style={{ left: block.x, top: block.y, width: block.width }}
			onFocus={onSelect}
		>
			<div className="nb-block-handle">
				<button
					aria-label="Move text block"
					title="Drag to move text"
					onPointerDown={(event) => {
						event.preventDefault();
						event.currentTarget.setPointerCapture(event.pointerId);
						onSelect();
						const startX = event.clientX,
							startY = event.clientY;
						const element = event.currentTarget;
						const camera = JSON.parse(element.closest(".nb-viewport")!.getAttribute("data-camera")!);
						const scale = camera.zoom;
						const move = (e: globalThis.PointerEvent) => {
							onMove(block.x + (e.clientX - startX) / scale, block.y + (e.clientY - startY) / scale);
						};
						const end = () => {
							element.removeEventListener("pointermove", move);
							element.removeEventListener("pointerup", end);
							element.removeEventListener("pointercancel", end);
						};
						element.addEventListener("pointermove", move);
						element.addEventListener("pointerup", end);
						element.addEventListener("pointercancel", end);
					}}
				>
					⠿
				</button>
				<button aria-label="Delete text block" onClick={onDelete}>
					×
				</button>
				<label>
					Width
					<input
						aria-label="Text block width"
						type="range"
						min="240"
						max={2400}
						value={block.width}
						onChange={(event) => {
							editor?.commands.focus();
							window.dispatchEvent(
								new CustomEvent("nb-block-width", {
									detail: { id: block.id, width: Number(event.target.value) },
								}),
							);
						}}
					/>
				</label>
			</div>
			<EditorContent editor={editor} />
		</div>
	);
}
