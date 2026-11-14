"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon, ArrowUpIcon, SquareIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PathInput } from "@/components/path-input";
import { AttachFilesButton } from "@/components/attach-files-button";
import { ATTACH_IMAGE_EVENT, type AttachedImage } from "@/lib/file-attachments";
import { useOptionalInteractionLayers } from "./interaction-layers";
import { isInteractionScopeEligible } from "./plugin-input-focus";

/** Keeps the chat's controller-owned toolbar in its existing data scope. */
export const ComposerToolbarContext = createContext<ReactNode>(null);

/**
 * The chat composer — content row ONLY (the persistent rounded shell lives in
 * the chat view's overlay, so the shell can later morph chat → question
 * without remounting).
 */
export function enterAction(state: {
	busy: boolean;
	canSend: boolean;
	nextProblem?: boolean;
}): "stop" | "send" | "next" | "none" {
	if (state.busy) return state.canSend ? "send" : "stop";
	if (state.canSend) return "send";
	if (state.nextProblem) return "next";
	return "none";
}

/**
 * Session composer with local keystroke state. The owning Chat keeps the
 * current draft in a ref for send/dictation, so typing doesn't rerender the
 * transcript; revision signals explicit parent-driven draft resets.
 */
export function ChatSessionComposer({
	busy,
	value,
	revision,
	onChange,
	onSend,
	onStop,
	sendAllowed,
	dictationActive,
	autoFocus,
	inputRef,
	onEscape,
	placeholder,
	nextProblem,
	onNext,
	pendingInput = false,
	attachedImages,
	onAttachedImagesChange,
}: {
	busy: boolean;
	value: string;
	revision: number;
	onChange: (value: string) => void;
	onSend: () => void;
	onStop: () => void;
	sendAllowed: boolean;
	dictationActive: boolean;
	autoFocus?: boolean;
	inputRef?: React.RefObject<HTMLDivElement | null>;
	onEscape?: () => void;
	placeholder?: string;
	nextProblem?: boolean;
	onNext?: () => void;
	pendingInput?: boolean;
	attachedImages?: AttachedImage[];
	onAttachedImagesChange?: (images: AttachedImage[] | ((prev: AttachedImage[]) => AttachedImage[])) => void;
}) {
	const [draft, setDraft] = useState(value);
	useLayoutEffect(() => { setDraft(value); }, [revision, value]);
	const canSend = sendAllowed && (draft.trim().length > 0 || dictationActive || pendingInput || Boolean(attachedImages && attachedImages.length > 0));
	const applyDraft = useCallback((next: string) => {
		setDraft(next);
		onChange(next);
	}, [onChange]);

	return (
		<Composer
			busy={busy}
			value={draft}
			onChange={applyDraft}
			onSend={onSend}
			onStop={onStop}
			canSend={canSend}
			autoFocus={autoFocus}
			inputRef={inputRef}
			onEscape={onEscape}
			placeholder={placeholder}
			nextProblem={nextProblem}
			onNext={onNext}
			attachedImages={attachedImages}
			onAttachedImagesChange={onAttachedImagesChange}
		/>
	);
}

export function Composer({
	busy,
	value,
	onChange,
	onSend,
	onStop,
	canSend,
	autoFocus,
	inputRef,
	onEscape,
	placeholder = "Ask, answer, or steer the lesson…",
	nextProblem = false,
	onNext,
	defaultDropTarget = true,
	fileInsertion = true,
	toolbar,
	sendLabel,
	attachedImages,
	onAttachedImagesChange,
}: {
	busy: boolean;
	value: string;
	onChange: (v: string) => void;
	onSend: () => void;
	onStop: () => void;
	canSend: boolean;
	autoFocus?: boolean;
	inputRef?: React.RefObject<HTMLDivElement | null>;
	onEscape?: () => void;
	placeholder?: string;
	nextProblem?: boolean;
	onNext?: () => void;
	defaultDropTarget?: boolean;
	fileInsertion?: boolean;
	toolbar?: ReactNode;
	sendLabel?: string;
	attachedImages?: AttachedImage[];
	onAttachedImagesChange?: (images: AttachedImage[] | ((prev: AttachedImage[]) => AttachedImage[])) => void;
}) {
	const controller = useOptionalInteractionLayers();
	const inheritedToolbar = useContext(ComposerToolbarContext);
	const [localImages, setLocalImages] = useState<AttachedImage[]>([]);
	const effectiveImages = attachedImages ?? localImages;

	const act = () => {
		const action = enterAction({ busy, canSend, nextProblem });
		if (action === "stop") onStop();
		else if (action === "send") onSend();
		else if (action === "next") onNext?.();
	};

	const ownInputRef = useRef<HTMLDivElement>(null);
	const editorRef = inputRef ?? ownInputRef;

	useEffect(() => {
		const el = editorRef.current;
		if (!el) return;
		const handler = (e: Event) => {
			const detail = (e as CustomEvent<AttachedImage[]>).detail;
			if (Array.isArray(detail)) {
				if (onAttachedImagesChange) {
					onAttachedImagesChange((prev) => [...prev, ...detail]);
				} else {
					setLocalImages((prev) => [...prev, ...detail]);
				}
			}
		};
		el.addEventListener(ATTACH_IMAGE_EVENT, handler);
		return () => el.removeEventListener(ATTACH_IMAGE_EVENT, handler);
	}, [editorRef, onAttachedImagesChange]);

	const removeImage = (id: string) => {
		if (onAttachedImagesChange) {
			onAttachedImagesChange((prev) => prev.filter((img) => img.id !== id));
		} else {
			setLocalImages((prev) => prev.filter((img) => img.id !== id));
		}
	};

	const handleAttachImages = (newImages: AttachedImage[]) => {
		if (onAttachedImagesChange) {
			onAttachedImagesChange((prev) => [...prev, ...newImages]);
		} else {
			setLocalImages((prev) => [...prev, ...newImages]);
		}
	};

	return (
		<form
			data-testid="composer"
			className="session-composer flex flex-col gap-2 p-4"
			onSubmit={(e) => {
				e.preventDefault();
				act();
			}}
		>
			{/* Attached image preview chips */}
			{effectiveImages.length > 0 && (
				<div className="flex flex-wrap gap-2 px-1 pt-1 pb-1">
					{effectiveImages.map((img) => (
						<div
							key={img.id}
							className="group relative flex items-center gap-2 rounded-xl border border-border bg-card/90 px-2 py-1.5 shadow-sm"
						>
							<img
								src={`data:${img.mimeType};base64,${img.data}`}
								alt={img.name}
								className="size-8 rounded-lg object-cover border border-border/40"
							/>
							<span className="max-w-[120px] truncate text-xs text-foreground font-medium">{img.name}</span>
							<button
								type="button"
								onClick={() => removeImage(img.id)}
								aria-label={`Remove ${img.name}`}
								className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
							>
								<XIcon className="size-3" />
							</button>
						</div>
					))}
				</div>
			)}

			<PathInput
				ref={editorRef}
				value={value}
				onValueChange={onChange}
				defaultDropTarget={defaultDropTarget}
				fileInsertion={fileInsertion}
				onKeyDown={(e) => {
					if (!isInteractionScopeEligible(e.currentTarget, controller)) return;
					if (e.key === "Escape" && onEscape) {
						controller?.claimEscape(e);
						e.preventDefault();
						e.stopPropagation();
						onEscape();
						return;
					}
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
						e.preventDefault();
						act();
					}
				}}
				placeholder={placeholder}
				autoFocus={autoFocus}
				className="field-sizing-content lh-input max-h-48 min-h-12 w-full resize-none bg-transparent px-2 py-2 outline-none placeholder:text-muted-foreground"
			/>
			<div className="composer-toolbar flex w-full items-end gap-2">
				<AttachFilesButton editorRef={editorRef} onAttachImages={handleAttachImages} />
				<div className="min-w-0 flex-1">{toolbar ?? inheritedToolbar}</div>
				{nextProblem && !busy && !canSend ? (
					<button
						type="submit"
						data-testid="next-problem-button"
						aria-label="Next problem"
						className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 font-sans text-xs font-medium tracking-normal text-primary-foreground transition-colors hover:bg-primary/90 apple-btn-tactile cursor-pointer"
					>
						Next problem
						<ArrowRightIcon className="size-4" />
					</button>
				) : (
					<button
						type="submit"
						aria-label={busy && !canSend ? "Stop" : (sendLabel ?? "Send")}
						disabled={!busy && !canSend}
						className={cn(
							"flex size-11 shrink-0 items-center justify-center rounded-full transition-colors apple-btn-tactile cursor-pointer",
							busy && !canSend
								? "bg-[#2c2c2e] text-foreground hover:bg-[#3a3a3c]"
								: "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-35",
						)}
					>
						{busy && !canSend ? <SquareIcon className="size-4" /> : <ArrowUpIcon className="size-5" />}
					</button>
				)}
			</div>
		</form>
	);
}
