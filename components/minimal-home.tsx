"use client";

/**
 * THE MINIMAL HOME (owner, 2026-10-06 — the no-graph home, take two):
 * when GRAPH RENDERING is off (graph.rendering in settings), the home's
 * main view is this — deliberately quiet, deliberately minimal. The
 * eventual plan is the DATA VIEW as home; until that is designed and
 * built, this is the placeholder that asks for nothing new: the SAME
 * composer blob home already floats (teach/practice switcher + pick
 * pill — untouched), the graph chrome's survivors in the SAME places
 * the graph view keeps them (top-right column: actions row, cost pill
 * BELOW it), and a centered, quiet summary of the knowledge base in
 * numbers. No recent sessions (the sidebar owns that), no canvas, no
 * list scrolling under the composer.
 *
 * The CHAIN TABLE stays behind its button exactly as on the graph view:
 * the standard overlay, unchanged — this component owns only the button.
 * The practice pick flow mirrors GraphView's contract verbatim (home
 * lifts the pick set; the chip opens the overlay in select mode).
 */
import { useCallback, useEffect, useState } from "react";
import { BookOpenIcon, DumbbellIcon, FileTextIcon, ListTreeIcon, SparklesIcon } from "lucide-react";
import { ChainTableOverlay } from "@/components/chain-table.tsx";
import { GraphCostControl } from "@/components/graph-view.tsx";
import { NotesImportControl, NotesImportErrors, NotesImportNotices, useNotesImport } from "@/components/notes-import.tsx";
import { Hint } from "@/components/ui/hint";
import type { ChatSummary, GraphCostSummary, GraphSnapshot } from "@/src/core";

/** Apple Bento Dashboard Knowledge Summary */
export function KnowledgeSummary({
	propositions,
	chains,
	teachSessions,
	practiceSessions,
	importedNotes,
}: {
	propositions: number;
	chains: number;
	teachSessions: number;
	practiceSessions: number;
	importedNotes: number;
}) {
	const empty =
		propositions === 0 && chains === 0 && teachSessions === 0 && practiceSessions === 0 && importedNotes === 0;

	return (
		<div data-testid="knowledge-summary" className="flex flex-col items-center text-center max-w-xl w-full px-6 pointer-events-auto">
			{/* Apple Headline */}
			<div className="mb-6 flex flex-col items-center">
				<div className="size-12 rounded-2xl bg-gradient-to-br from-[#007aff] to-[#5856d6] flex items-center justify-center text-white shadow-lg mb-3">
					<SparklesIcon className="size-6" />
				</div>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to LearnHarness</h1>
				<p className="text-sm text-muted-foreground mt-1">An adaptive agent harness for deliberate learning</p>
			</div>

			{/* Apple Bento Grid */}
			<div className="grid grid-cols-3 gap-3 w-full mb-4">
				{/* Bento 1: Knowledge Graph */}
				<div className="apple-glass rounded-2xl p-4 flex flex-col items-center justify-center border border-white/10 shadow-lg text-center">
					<div className="size-8 rounded-xl bg-[#007aff]/15 flex items-center justify-center text-[#007aff] mb-2">
						<BookOpenIcon className="size-4" />
					</div>
					<span className="text-xl font-bold tracking-tight text-foreground">{propositions}</span>
					<p className="font-ui text-xs text-muted-foreground mt-0.5">
						{propositions} {propositions === 1 ? "proposition" : "propositions"}
					</p>
					<span className="text-[11px] text-muted-foreground/75 mt-1 font-mono">
						{chains} {chains === 1 ? "chain" : "chains"}
					</span>
				</div>

				{/* Bento 2: Study Sessions */}
				<div className="apple-glass rounded-2xl p-4 flex flex-col items-center justify-center border border-white/10 shadow-lg text-center">
					<div className="size-8 rounded-xl bg-[#34c759]/15 flex items-center justify-center text-[#34c759] mb-2">
						<DumbbellIcon className="size-4" />
					</div>
					<span className="text-xl font-bold tracking-tight text-foreground">{teachSessions + practiceSessions}</span>
					<p className="font-ui text-xs text-muted-foreground mt-0.5">
						{teachSessions} {teachSessions === 1 ? "teaching session" : "teaching sessions"}
					</p>
					<span className="text-[11px] text-muted-foreground/75 mt-1 font-mono">
						{practiceSessions} {practiceSessions === 1 ? "practice session" : "practice sessions"}
					</span>
				</div>

				{/* Bento 3: Sources & Notes */}
				<div className="apple-glass rounded-2xl p-4 flex flex-col items-center justify-center border border-white/10 shadow-lg text-center">
					<div className="size-8 rounded-xl bg-[#af52de]/15 flex items-center justify-center text-[#af52de] mb-2">
						<FileTextIcon className="size-4" />
					</div>
					<span className="text-xl font-bold tracking-tight text-foreground">{importedNotes}</span>
					<p className="font-ui text-xs text-muted-foreground mt-0.5">
						{importedNotes} {importedNotes === 1 ? "imported note" : "imported notes"}
					</p>
					<span className="text-[11px] text-muted-foreground/75 mt-1 font-mono">
						sources
					</span>
				</div>
			</div>

			{empty && (
				<div className="apple-glass-pill rounded-full px-4 py-2 border border-white/10 text-xs text-muted-foreground">
					<span>Start a session below to begin learning • Attach material with the paperclip</span>
				</div>
			)}
		</div>
	);
}

export function MinimalHome({
	chainSelectOpen = false,
	practiceSelection,
	onPracticeSelectionChange,
	onChainSelectClose,
}: {
	/** The lifted pick set drives the overlay's select mode (Done instead
	 * of the delete fence); the chip in home's composer reflects it. */
	chainSelectOpen?: boolean;
	practiceSelection?: ReadonlySet<string>;
	onPracticeSelectionChange?: (nodes: { id: string; name: string; statement: string }[]) => void;
	onChainSelectClose?: () => void;
}) {
	const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
	const [costs, setCosts] = useState<GraphCostSummary | null>(null);
	const [chats, setChats] = useState<ChatSummary[]>([]);
	const [chainsOpen, setChainsOpen] = useState(false);

	const readState = useCallback(() => {
		fetch("/api/graph")
			.then((res) => res.json() as Promise<GraphSnapshot>)
			.then(setSnapshot)
			.catch(() => {});
		fetch("/api/graph/costs")
			.then((res) => res.json() as Promise<GraphCostSummary>)
			.then(setCosts)
			.catch(() => {});
		fetch("/api/chats")
			.then((res) => res.json() as Promise<{ chats: ChatSummary[] }>)
			.then((body) => setChats(body.chats))
			.catch(() => {});
	}, []);
	useEffect(() => {
		readState();
		window.addEventListener("lh:graph-revision", readState);
		return () => window.removeEventListener("lh:graph-revision", readState);
	}, [readState]);

	// The practice chip opens the table in select mode (GraphView's law):
	// the pick intent raises the overlay; Done/close reports back down.
	useEffect(() => {
		if (chainSelectOpen) setChainsOpen(true);
	}, [chainSelectOpen]);

	// Refetch even after incomplete imports: earlier writes and spend remain.
	const notesImport = useNotesImport({ onFinish: readState });
	const { importing, onImportFiles } = notesImport;

	const teachSessions = chats.filter((c) => c.kind === "teach").length;
	const practiceSessions = chats.filter((c) => c.kind === "practice").length;

	return (
		<div className="relative h-full">
			{/* The quiet summary — centered, biased up off the composer. */}
			<div className="pointer-events-none flex h-full items-center justify-center pb-40">
				<KnowledgeSummary
					propositions={snapshot?.propositions.length ?? 0}
					chains={snapshot?.chains.length ?? 0}
					teachSessions={teachSessions}
					practiceSessions={practiceSessions}
					importedNotes={Object.keys(snapshot?.fileSources ?? {}).length}
				/>
			</div>

			{/* The chrome survivors in the graph view's own places (owner,
			    2026-10-06): the top-right column — actions row (Chains +
			    Import, the same 36px band pills), the cost pill BELOW it.
			    The column carries lh-no-drag EXACTLY like the graph
			    chrome's (the DOM-order mask law): without it the drag band
			    swallows the clicks in Electron — the buttons dragged the
			    window instead. Node search and the render-settings gear are
			    canvas things and stay gone; Import ALWAYS renders (the
			    entry law). */}
			<div className="lh-no-drag lh-wco-floating absolute right-2 top-2 z-10 flex max-w-[calc(100%-5.5rem)] flex-col items-end gap-2">
				<div className="flex min-w-0 items-start gap-2">
					<div className="graph-chrome-fade-in shrink-0 rounded-full border border-white/10 apple-glass-pill px-1.5 py-1 shadow-lg backdrop-blur">
						<Hint label="Every reasoning chain" side="bottom">
							<button
								type="button"
								onClick={() => setChainsOpen(true)}
								data-testid="open-chain-table"
								className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-all hover:text-foreground hover:bg-white/10 apple-btn-tactile cursor-pointer"
							>
								<ListTreeIcon className="size-3" />
								Chains
							</button>
						</Hint>
					</div>
					<NotesImportControl importing={importing} onImportFiles={onImportFiles} />
				</div>
				<NotesImportErrors errors={notesImport.errors} />
				<NotesImportNotices notices={notesImport.notices} />
				{costs && costs.runs.length > 0 && <GraphCostControl costs={costs} />}
			</div>

			{/* The chain table — the STANDARD overlay, unchanged, behind its
			    button. LAST CHILD OF THE ROOT, DELIBERATELY (the graph view's
			    DOM-order drag law): app-region subtraction resolves by DOM
			    order, so a full-bleed surface covering the drag band must
			    paint after everything it covers. */}
			<ChainTableOverlay
				open={chainsOpen}
				nodes={snapshot?.propositions ?? []}
				chains={snapshot?.chains ?? []}
				sessions={snapshot?.sessions ?? {}}
				fileSources={snapshot?.fileSources ?? {}}
				onClose={() => {
					setChainsOpen(false);
					onChainSelectClose?.();
				}}
				selectMode={chainSelectOpen}
				controlledSelection={practiceSelection}
				onSelectionChange={(ids) => {
					// Resolve ids → nodes against the live snapshot; the
					// caller holds the pick set (count + seed).
					const props = snapshot?.propositions ?? [];
					const picked: { id: string; name: string; statement: string }[] = [];
					for (const id of ids) {
						const n = props.find((node) => node.id === id);
						if (n) picked.push({ id: n.id, name: n.name, statement: n.statement });
					}
					onPracticeSelectionChange?.(picked);
				}}
			/>
		</div>
	);
}
