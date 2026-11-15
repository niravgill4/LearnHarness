"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLinkIcon, PauseIcon, PlayIcon, ShuffleIcon } from "lucide-react";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

export const LANDSCAPES = [
	{ id: "rainforest-falls-mist", name: "Rainforest falls", color: "#b8d5aa", place: "A little room to grow." },
	{ id: "lighthouse-storm", name: "Lighthouse in the storm", color: "#b8cddd", place: "A different point of view." },
	{ id: "cherry-blossom-river", name: "Cherry blossom river", color: "#e3b9cc", place: "Let your curiosity wander." },
	{ id: "camel-caravan-dusk", name: "Caravan at dusk", color: "#e4c69c", place: "There’s always more to discover." },
	{ id: "autumn-pagoda-maples", name: "Autumn among the maples", color: "#e3b59c", place: "See where an idea takes you." },
] as const;
const SCENE_KEY = "cognera:landscape:v1";
const MOTION_KEY = "cognera:landscape-motion:v1";
const LandscapeContext = createContext({ scene: 0, paused: false, shuffle: () => {}, toggle: () => {} });

/** Select once per document load, never during a form step or workspace navigation. */
export function LandscapeProvider({ children }: { children: ReactNode }) {
	const [scene, setScene] = useState(0);
	const [paused, setPaused] = useState(false);
	const initialized = useRef(false);
	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;
		let previous = -1;
		try { previous = Number(sessionStorage.getItem(SCENE_KEY) ?? -1); setPaused(localStorage.getItem(MOTION_KEY) === "paused"); } catch { /* Private browsing can disable storage. */ }
		const candidates = LANDSCAPES.map((_, i) => i).filter(i => i !== previous);
		const next = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
		setScene(next);
		try { sessionStorage.setItem(SCENE_KEY, String(next)); } catch { /* Scene still works without persistence. */ }
	}, []);
	function shuffle() {
		setScene(previous => {
			const next = (previous + 1 + Math.floor(Math.random() * (LANDSCAPES.length - 1))) % LANDSCAPES.length;
			try { sessionStorage.setItem(SCENE_KEY, String(next)); } catch { /* Optional preference. */ }
			return next;
		});
	}
	function toggle() {
		setPaused(previous => {
			try { localStorage.setItem(MOTION_KEY, previous ? "play" : "paused"); } catch { /* Optional preference. */ }
			return !previous;
		});
	}
	const selected = LANDSCAPES[scene]!;
	return <LandscapeContext.Provider value={{ scene, paused, shuffle, toggle }}><div className="landscape-world" style={{ "--landscape-accent": selected.color, "--landscape-poster": `url(/landscapes/${selected.id}.webp)` } as CSSProperties}>{children}</div></LandscapeContext.Provider>;
}

/** A native, non-interactive video plane. The still is always present underneath. */
export function AsciiLandscape({ className = "" }: { className?: string }) {
	const { scene, paused } = useContext(LandscapeContext);
	const reduced = useReducedMotionPreference();
	const video = useRef<HTMLVideoElement>(null);
	const root = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	const [hidden, setHidden] = useState(false);
	const [saveData, setSaveData] = useState(false);
	const [failed, setFailed] = useState(false);
	const selected = LANDSCAPES[scene]!;
	useEffect(() => {
		const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
		setSaveData(connection?.saveData === true);
		const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), { threshold: .01 });
		if (root.current) observer.observe(root.current);
		const visibility = () => setHidden(document.hidden);
		visibility(); document.addEventListener("visibilitychange", visibility);
		return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
	}, []);
	useEffect(() => { setFailed(false); }, [scene]);
	const shouldLoad = visible && !reduced && !saveData;
	useEffect(() => {
		const element = video.current;
		if (!element) return;
		if (shouldLoad && !paused && !hidden && !failed) void element.play().catch(() => { /* Poster remains when autoplay is blocked. */ });
		else element.pause();
	}, [shouldLoad, paused, hidden, failed, scene]);
	return <div ref={root} className={`ascii-landscape ${className}`} data-landscape={selected.id} aria-hidden="true" style={{ backgroundImage: `url(/landscapes/${selected.id}.webp)` }}>
		<video key={selected.id} ref={video} src={shouldLoad ? `/landscapes/${selected.id}.mp4` : undefined} poster={`/landscapes/${selected.id}.webp`} muted loop playsInline preload="none" disablePictureInPicture onError={() => setFailed(true)} tabIndex={-1} />
	</div>;
}

export function LandscapeControls({ compact = false }: { compact?: boolean }) {
	const { scene, paused, shuffle, toggle } = useContext(LandscapeContext);
	const reduced = useReducedMotionPreference();
	const selected = LANDSCAPES[scene]!;
	return <div className={`landscape-controls${compact ? " landscape-controls-compact" : ""}`} role="group" aria-label="Landscape settings">
		<div className="landscape-caption"><span className="landscape-dot" aria-hidden="true" /><span aria-live="polite">{selected.name}</span></div>
		<div className="landscape-control-actions">
			<button type="button" onClick={shuffle} aria-label="Change landscape" title="Change landscape"><ShuffleIcon aria-hidden="true" /></button>
			<button type="button" onClick={toggle} disabled={reduced} aria-pressed={paused || reduced} aria-label={reduced ? "Animation off: reduced motion" : paused ? "Play landscape animation" : "Pause landscape animation"} title={reduced ? "Reduced motion is on" : paused ? "Play animation" : "Pause animation"}>{paused || reduced ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}</button>
			{!compact && <a href="https://www.ascii-magic.com/ascii" target="_blank" rel="noopener noreferrer" aria-label="Landscape artwork by ASCII Magic (opens in new tab)" title="Art by ASCII Magic"><ExternalLinkIcon aria-hidden="true" /></a>}
		</div>
	</div>;
}

export function LandscapeMiniature() {
	const { scene, shuffle } = useContext(LandscapeContext);
	const selected = LANDSCAPES[scene]!;
	return <button type="button" className="landscape-miniature" onClick={shuffle} aria-label={`Change landscape. Current scene: ${selected.name}`} style={{ backgroundImage: `linear-gradient(0deg,#101713ee,transparent),url(/landscapes/${selected.id}.webp)` }}><span>{selected.name}</span><ShuffleIcon aria-hidden="true" /></button>;
}
