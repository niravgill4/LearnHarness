"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SurfaceRegion, usePageSurfaceBoundary, useSurfaceChromeStyle } from "./plugin-surfaces";
import { DumbbellIcon } from "lucide-react";
import { GraphView } from "@/components/graph-view";
import { MinimalHome } from "@/components/minimal-home";
import { SetupDialog } from "@/components/setup-dialog";
import { ComposerActions, NodePickerControl } from "@/components/composer-actions";
import { useModelSetup, selectedModelUnavailable, openModelPicker, ZeroKeysPill } from "@/components/setup-cta";
import { DictationBar, joinDictation, useDictation } from "@/components/dictation";
import { useFieldCycle } from "@/components/field-cycle";
import { useOptionalInteractionLayers } from "./interaction-layers";
import { isInteractionScopeEligible } from "./plugin-input-focus";
import { SidebarToggle } from "@/components/sidebar";
import { StatsBar } from "@/components/stats-bar";
import { OPENING_PROMPT_FAILURE } from "@/components/opening-prompt";
import { Composer } from "@/components/composer";
import { SessionStarter } from "@/components/start-session";
import type { TurnUsage } from "@/src/core";

/**
 * Home — the knowledge graph is the main view, full-bleed edge to edge
 * (owner, graph-view round 1): the canvas owns the whole column, running
 * under the header and the new-session dock, both of which float over it
 * with no gradient scrims. Sessions live in the toggleable sidebar.
 */
export function Home({
	initialConfigured,
	rendering = true,
	initialTopic = "",
}: {
	initialConfigured: boolean;
	initialTopic?: string;
	/** GRAPH RENDERING off (owner, 2026-10-06): the home's main view is
	 * the chains view, not the canvas. Read server-side per navigation —
	 * changing the setting applies on the next visit home. */
	rendering?: boolean;
}) {
	const controller = useOptionalInteractionLayers();
	const router = useRouter();
	const pathname = usePathname();
	const bodyRef = useRef<HTMLDivElement>(null);
	const surfaceTarget = usePageSurfaceBoundary({ active: pathname === "/", viewKey: "/", bodyRef });
	const chromeStyle = useSurfaceChromeStyle(surfaceTarget);
	const [topic, setTopic] = useState(initialTopic);
	/* The topic MIRROR ("nothing gets lost" round, 2026-10-01 — same
	 * mechanics as the chat composer, owner's consistency ruling): a
	 * dictation flush lands via setState, invisible to a closure that
	 * waited through `await finish()`. Kept current at every write. */
	const topicRef = useRef(initialTopic);
	// First-run gate (model-slots wave, owner 2026-09-20): chats cannot
	// start until the user has picked all three slots — no defaults for
	// 33 providers. The dock shows the CTA while unconfigured; submitting
	// a topic opens the setup dialog WITH THE DRAFT PRESERVED (Save
	// stores slots only; the learner sends the message themselves).
	const { catalog, configured, zeroKeys } = useModelSetup(initialConfigured);
	const [setupOpen, setSetupOpen] = useState(false);
	// Voice dictation (STT wave, 2026-09-17): finals append at the end of the
	// topic draft; the strip lives in the stats bar's middle slot.
	const dictation = useDictation({
		// Ref-first: the join reads the mirror so the send resuming after
		// `await finish()` sees the dictated tail.
		append: (t) => {
			const v = joinDictation(topicRef.current, t);
			topicRef.current = v;
			setTopic(v);
		},
	});
	const [busy, setBusy] = useState(false);
	const startingRef = useRef(false);
	const starterRef = useRef(new SessionStarter());
	const [startError, setStartError] = useState(false);
	/* Run end focuses the topic input (owner, 2026-10-01): the hands are on
	 * the keyboard from the stop. Falling edge only; this surface's only
	 * dictation target IS this textarea, so no case-split is needed. */
	const topicInputRef = useRef<HTMLDivElement>(null);
	// Tab navigates INTO the topic composer (owner, keyboard round
	// 2026-10-06): the only text field on this surface — and home's
	// composer is its OWN textarea, not the shared Composer component,
	// so the chain is the ref itself (the smoke caught a selector that
	// matched nothing here).
	const cycleTopicField = useCallback(
		(): readonly HTMLElement[] => (topicInputRef.current ? [topicInputRef.current] : []),
		[],
	);
	useFieldCycle(cycleTopicField);
	const dictationWasActiveRef = useRef(false);
	useEffect(() => {
		if (dictation.active) {
			dictationWasActiveRef.current = true;
		} else if (dictationWasActiveRef.current) {
			dictationWasActiveRef.current = false;
			if (isInteractionScopeEligible(topicInputRef.current, controller)) topicInputRef.current!.focus();
		}
	}, [dictation.active, controller]);

	/* PRACTICE MODE (owner, 2026-10-04): the graph composer's teach |
	 *  practice switch — practice creates a kind:"practice" session and
	 *  may carry proposition picks from the chain table (the chip above
	 *  the composer opens the picker; the picks seed the opening prompt).
	 *  Not enforcing any input format — the picks are a convenience. */
	const [mode, setMode] = useState<"teach" | "practice">("teach");
	const [practiceProps, setPracticeProps] = useState<{ id: string; name: string; statement: string }[]>([]);
	const [chainSelectOpen, setChainSelectOpen] = useState(false);
	// The chain table is CONTROLLED off this id set (the lifted pick).
	const pickedIds = useMemo(() => new Set(practiceProps.map((p) => p.id)), [practiceProps]);

	/* FINISH DICTATION FIRST (owner, 2026-10-01): Enter may arrive while a
	 * run is live with the topic still deferred in the run's buffer — stop
	 * the run, let the last finals land, THEN read the REF mirror (not the
	 * state closure) and run. Applies before the setup/key guards too, so
	 * an intercepted draft is the complete one. */
	const start = () => {
		if (!dictation.active) {
			void begin();
			return;
		}
		void dictation.finish().then(() => begin());
	};
	const begin = async () => {
		const t = topicRef.current.trim();
		if (!t || startingRef.current) return;
		// Unconfigured: the send INTERCEPTS into the setup flow (the draft
		// stays in the textarea; the learner sends it after Save).
		if (!configured) {
			setSetupOpen(true);
			return;
		}
		// The pre-send KEY guards (owner interlude, no-orphan-chats): the
		// models case guards BEFORE creation; the key cases must too — a
		// refused first send would otherwise leave an orphan error-shell
		// chat in the sidebar (the 503 lands only after POST /api/chats
		// already created the record). Zero providers opens connection setup;
		// an unavailable selection with another provider opens its ordinary
		// picker. The server's admission gate remains the belt.
		if (zeroKeys) {
			setSetupOpen(true);
			return;
		}
		const strong = catalog?.slots.strong?.model;
		if (selectedModelUnavailable(catalog, strong ? `${strong.provider}:${strong.id}` : undefined)) {
			openModelPicker();
			return; // Preserve the draft and never create an orphan session.
		}
		startingRef.current = true;
		setBusy(true);
		setStartError(false);
		try {
			// The map context (owner, 2026-10-04): picks in EITHER mode ride
			// the CREATION as graphContext — the server writes a
			// graph-context marker as message[0] (a separate custom message
			// before the learner's first user message, propositions + the
			// chains among them); the prompt stays the learner's own words.
			const target = await starterRef.current.start({
				title: t,
				...(mode === "practice" ? { kind: "practice" } : {}),
				...(practiceProps.length > 0 ? { graphContext: { propositions: practiceProps } } : {}),
			}, fetch, JSON.stringify(catalog?.slots.strong));
			router.push(target);
		} catch {
			startingRef.current = false;
			setBusy(false);
			setStartError(true);
		}
	};

	return (
		<div className="home-page learning-studio relative h-dvh apple-canvas-bg">
			{/* Window-drag strip (merged chrome, owner 2026-09-17): a dedicated
			    mask element, deliberately FIRST in the DOM. Electron's app-region
			    mask resolves by DOM order — a no-drag element subtracts only drag
			    regions that came EARLIER in the tree — not by z-index, so the
			    header's old inline drag region (after <main>) re-added itself over
			    the graph chrome row's carve-out and the buttons dragged the window.
			    Placed first, every carved control (chrome row, node detail card,
			    the toggle) comes later and subtracts correctly. Pure mask: it
			    never needs to receive events — the mask routes the pixels. */}
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />

            <section className="studio-heading" aria-label="Learning studio">
                <h1>Your learning studio</h1>
                <p>Explore, practise, and connect what you learn.</p>
            </section>

			{/* The main view — full-bleed (owner, graph-view round 1): no
			    padding on any side; it runs from the sidebar to the right edge
			    and from the bottom to the top, under everything else. With
			    rendering OFF (graph.rendering, owner 2026-10-06) it is the
			    MINIMAL HOME — a quiet knowledge-base summary + the graph
			    chrome's survivors; data, extraction, and the pick flow are
			    untouched, and the chain table stays behind its button. */}
			<div ref={bodyRef} className="studio-content">
			<main className="studio-atlas">
				{rendering ? (
					<GraphView
						chainSelectOpen={chainSelectOpen}
						practiceSelection={pickedIds}
						onPracticeSelectionChange={setPracticeProps}
						onChainSelectClose={() => setChainSelectOpen(false)}
					/>
				) : (
					<MinimalHome
						chainSelectOpen={chainSelectOpen}
						practiceSelection={pickedIds}
						onPracticeSelectionChange={setPracticeProps}
						onChainSelectClose={() => setChainSelectOpen(false)}
					/>
				)}
			</main>


			{/* New session — same floating blob as the chat composer, docked
			    OVER the graph (no gradient: the graph runs clean under it to the
			    bottom edge). Matches chat.tsx's DOCK geometry (max-w-[46rem]
			    px-4) so nothing shifts when a session starts (owner). */}
			<div className="pointer-events-none home-composer-dock studio-desk">
				<div className="pointer-events-auto mx-auto w-full max-w-[48rem] px-5">
					{/* The pick bar (owner vision, 2026-10-04): the chain
					    table's selection is PERSISTENT — picked
					    propositions show here as a count + Clear in EITHER
					    mode (it survives mode switches; only a practice
					    send consumes it). Practice mode with nothing picked
					    shows the pick HINT so the affordance is discoverable;
					    teaching mode with nothing picked renders nothing. */}
					<div className="studio-editor-heading"><span>{mode === "practice" ? "Practice desk" : "A new learning thread"}</span><h2>{mode === "practice" ? "Practise an idea." : "Start a learning thread."}</h2><p>{mode === "practice" ? "Revisit an idea until you can reason through it." : "Pick a question. We’ll work through it together."}</p></div>
                    <ComposerActions
						picker={(practiceProps.length > 0 || mode === "practice") && (
							<NodePickerControl
								count={practiceProps.length}
								onOpen={() => setChainSelectOpen(true)}
								onClear={() => setPracticeProps([])}
							/>
						)}
						setup={zeroKeys ? (
							<ZeroKeysPill inline onOpen={() => setSetupOpen(true)} />
						) : (
							!configured && (
								<button
									type="button"
									data-testid="setup-cta"
									onClick={() => setSetupOpen(true)}
									className="rounded-sm border border-border bg-card px-3 py-1.5 font-ui text-xs text-foreground transition-colors hover:border-muted-foreground/50 hover:bg-accent cursor-pointer"
								>
									Set up your models
								</button>
							)
						)}
					/>
					{startError && <p role="alert" className="mb-2 text-sm text-destructive">{OPENING_PROMPT_FAILURE}</p>}


                    <div className="composer-surface home-composer" data-attachment-composer="">
                        <Composer
                            busy={busy}
                            value={topic}
                            onChange={(value) => { topicRef.current = value; setTopic(value); }}
                            onSend={() => { void start(); }}
                            onStop={() => {}}
                            canSend={!!topic.trim() || dictation.active}
                            inputRef={topicInputRef}
                            onEscape={dictation.active ? dictation.cancel : undefined}
                            sendLabel="Start session"
                            placeholder={mode === "practice" ? "What do you want to practice?" : "What do you want to learn?"}
                            toolbar={
					<StatsBar
						dictationSlot={<DictationBar dictation={dictation} />}
						turns={[] as TurnUsage[]}
						leadingSlot={
							<div className="flex items-center p-1 rounded-full bg-transparent" data-testid="home-mode-switch">
								{(["teach", "practice"] as const).map((m) => (
									<button
										key={m}
										type="button"
										data-testid={`home-mode-${m}`}
										onClick={() => setMode(m)}
                                        aria-pressed={mode === m}
										className={
											"flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors apple-btn-tactile cursor-pointer " +
											(mode === m
												? "bg-accent text-foreground "
												: "text-muted-foreground hover:text-foreground")
										}
									>
										{m === "practice" ? <DumbbellIcon aria-hidden="true" className="size-3" /> : null}
										{m === "teach" ? "Teach" : "Practice"}
									</button>
								))}
							</div>
						}
					/>}
                        />
                    </div>
					{!topic.trim() && !dictation.active && (
						<div className="mt-5 flex items-center justify-start sm:justify-center gap-3 overflow-x-auto py-1 scrollbar-none">
							{[
								{ label: "Quantum Computing", icon: "⚡" },
								{ label: "Transformer Attention", icon: "🧠" },
								{ label: "CRISPR-Cas9", icon: "🧬" },
								{ label: "Fourier Transform", icon: "📐" },
							].map((item) => (
								<button
									key={item.label}
									type="button"
									onClick={() => {
										topicRef.current = item.label;
										setTopic(item.label);
										topicInputRef.current?.focus();
									}}
									className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors apple-btn-tactile cursor-pointer shrink-0"
								>

									<span>{item.label}</span>
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			<SurfaceRegion target={surfaceTarget} />
			</div>
			{/* Floating host chrome stays outside page-content coverage, after
			    the region at the same owned-surface rank. The drag mask remains
			    first so later controls retain their Electron no-drag carve-outs. */}

            <header style={chromeStyle} className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-2">
				<div className="pointer-events-auto">
					<SidebarToggle />
				</div>
			</header>

			{/* First-run setup (unconfigured): the CTA's target and the send
			    interception's landing surface — stage 1 is the self-contained
			    first-key screen (zero-keys wave); Save never sends — the
			    draft stays for the learner to send (owner 2026-10-09). */}
			<SetupDialog
				open={setupOpen}
				onClose={() => setSetupOpen(false)}
				onDone={() => {
					setSetupOpen(false);
					// Save only saves: the draft waits in the composer.
				}}
				/>
		</div>
	);
}
