"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRightIcon, CheckIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

const chapters = [
	{ name: "Explore", caption: "A question is all you need to begin.", title: "Why do we\nforget?", detail: "Follow your curiosity." },
	{ name: "Connect", caption: "See the connections behind the explanation.", title: "Recall builds\nmemory.", detail: "Spacing your practice over time helps it last." },
	{ name: "Recall", caption: "Go from “that makes sense” to “I know this.”", title: "Which helps a\nmemory last?", detail: "Recall the connection you just made." },
];
const concepts = [
	{ name: "Memory", detail: "Where it begins", x: 92, y: 76, path: "M187 160C129 160 151 76 92 76" },
	{ name: "Connections", detail: "Link what you know", x: 464, y: 68, path: "M371 155C413 155 413 68 464 68" },
	{ name: "Active recall", detail: "Bring an idea back", x: 93, y: 281, path: "M187 213C126 213 157 281 93 281" },
	{ name: "Spaced practice", detail: "Return to it over time", x: 463, y: 284, path: "M372 216C426 216 410 284 463 284" },
];
const ease = [.22, 1, .36, 1] as const;
const answer = "Retrieval strengthens memory. Spacing helps it last.";

/** An illustrative, explorable lesson. Never a learner's saved activity. */
export function LearningPreview({ phase = 0 }: { phase?: number }) {
	const root = useRef<HTMLElement>(null);
	const map = useRef<SVGSVGElement>(null);
	const [chapter, setChapter] = useState(0);
	const [paused, setPaused] = useState(false);
	const [inView, setInView] = useState(false);
	const [pageVisible, setPageVisible] = useState(true);
	const [revealed, setRevealed] = useState(false);
	const [reading, setReading] = useState(false);
	const reduced = useReducedMotionPreference();
	const id = useId();
	const running = !paused && !reading && !reduced && inView && pageVisible;
	const content = chapters[chapter]!;
	useEffect(() => {
		const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold: .15 });
		if (root.current) observer.observe(root.current);
		const visibility = () => setPageVisible(!document.hidden);
		visibility();
		document.addEventListener("visibilitychange", visibility);
		return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
	}, []);
	useEffect(() => {
		setChapter(phase >= 3 ? 2 : phase >= 2 ? 1 : 0);
		setRevealed(false);
	}, [phase]);
	useEffect(() => {
		if (!running) return;
		const timer = window.setTimeout(() => { setChapter(value => (value + 1) % chapters.length); setRevealed(false); }, 6500);
		return () => window.clearTimeout(timer);
	}, [chapter, running]);
	useEffect(() => {
		if (running) map.current?.unpauseAnimations();
		else map.current?.pauseAnimations();
	}, [running]);
	const choose = (index: number) => { setChapter(index); setRevealed(false); setPaused(true); };
	return <figure ref={root} className="learning-preview" data-running={running} data-chapter={chapter} aria-label="Explore a sample Cognera learning journey" onFocusCapture={event => setReading(!!event.target.closest(".learning-preview-reveal"))} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setReading(false); }}>
		<div className="learning-preview-stage" id={`${id}-scene`}>
			<svg ref={map} className="learning-preview-map" viewBox="0 0 560 360" fill="none" aria-hidden="true">
				<path className="learning-preview-crosslink" d="M92 76C24 143 31 243 93 281M464 68C529 139 527 222 463 284M93 281C190 347 361 345 463 284" />
				{concepts.map((concept, index) => <g key={concept.name}>
					<path className="learning-preview-trace" d={concept.path} />
					<motion.path className="learning-preview-link" d={concept.path} pathLength={1} initial={false} animate={{ pathLength: chapter === 0 ? .2 : 1, opacity: chapter === 0 ? .5 : 1 }} transition={{ duration: reduced ? 0 : .85, delay: reduced ? 0 : index * .08, ease }} />
					<circle className="learning-preview-signal" r="2.5" opacity="0">
						<animateMotion path={concept.path} dur="5.5s" begin={`${index * -.9}s`} repeatCount="indefinite" />
						<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;.7;.85;1" dur="5.5s" begin={`${index * -.9}s`} repeatCount="indefinite" />
					</circle>
					<g className="learning-preview-concept" data-active={chapter === 1 || (chapter === 2 && index > 1)}>
						<circle className="learning-preview-node-ring" cx={concept.x} cy={concept.y} r="17" />
						<circle className="learning-preview-node" cx={concept.x} cy={concept.y} r="5" />
						<text x={concept.x} y={concept.y + 37} textAnchor="middle" className="learning-preview-concept-name">{concept.name}</text>
						<text x={concept.x} y={concept.y + 54} textAnchor="middle" className="learning-preview-concept-detail">{concept.detail}</text>
					</g>
				</g>)}
			</svg>
			<motion.div className="learning-preview-note" layout transition={{ duration: reduced ? 0 : .45, ease }}>
				<div className="learning-preview-note-symbol" aria-hidden="true">{chapter === 2 && revealed ? <CheckIcon /> : <ArrowUpRightIcon />}</div>
				<AnimatePresence mode="wait" initial={false}><motion.div key={`${chapter}-${revealed}`} id={`${id}-idea`} initial={reduced ? false : { opacity: 0, y: 6, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: reduced ? 0 : -5 }} transition={{ duration: reduced ? 0 : .22, ease }}>
					<h3>{revealed ? "Recall it.\nThen revisit it." : content.title}</h3>
					<p>{revealed ? answer : content.detail}</p>
				</motion.div></AnimatePresence>
				{chapter === 2 && <button type="button" className="learning-preview-reveal" aria-expanded={revealed} aria-controls={`${id}-idea`} onClick={() => { setRevealed(value => !value); setPaused(true); }}>{revealed ? "Try again" : "Reveal answer"}<ArrowUpRightIcon aria-hidden="true" /></button>}
			</motion.div>
		</div>
		<div className="learning-preview-controls">
			<div className="learning-preview-chapters" role="group" aria-label="Learning preview stages">{chapters.map((item, index) => <button type="button" key={item.name} aria-pressed={chapter === index} onClick={() => choose(index)}><span>{item.name}</span>{chapter === index && <span key={chapter} className="learning-preview-chapter-progress" aria-hidden="true" />}</button>)}</div>
			<button type="button" className="learning-preview-pause" disabled={!!reduced} aria-label={reduced ? "Animation off: Reduce Motion is enabled" : paused ? "Play learning preview" : "Pause learning preview"} aria-controls={`${id}-scene`} onClick={() => setPaused(value => !value)}>{paused || reduced ? <PlayIcon /> : <PauseIcon />}</button>
		</div>
		<figcaption><span>{content.caption}</span><small>Learning example<span className="learning-preview-example-detail">. Yours starts with any question.</span></small></figcaption>
		<span className="learning-preview-sr" role="status">{revealed ? `Recall it, then revisit it. ${answer}` : ""}</span>
	</figure>;
}
