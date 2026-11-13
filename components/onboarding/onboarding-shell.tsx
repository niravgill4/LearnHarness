"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { ArrowRightIcon, CheckIcon, MoveUpRightIcon } from "lucide-react";
import { CogneraMark } from "@/components/cognera-mark";
import { ClarityField } from "@/components/clarity-field";
import { useReducedMotionPreference } from "@/lib/use-reduced-motion";

const story = [
	{ title: "A curious mind.\nAn open world.", description: "Follow a question. Find a connection. Make an idea your own.", thought: "What if learning felt like discovery?" },
	{ title: "Every great idea\nstarts with a spark.", description: "Bring the intelligence you trust. We’ll make room for your curiosity.", thought: "The right connections change everything." },
	{ title: "Find your\nthinking partner.", description: "A new perspective. A clearer explanation. A way through the things that don’t quite click.", thought: "Understanding is a conversation, too." },
	{ title: "Your next idea\nis out there.", description: "Start with something that stays on your mind. See where it takes you.", thought: "One question can open a whole new world." },
];
const stages = ["Your account", "Your connection", "Your curiosity"];
const SceneContext = createContext<{ setStep: (step: number) => void } | null>(null);
const ease = [.22, 1, .36, 1] as const;

export function OnboardingFrame({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const [step, setStep] = useState(pathname === "/onboarding" ? 1 : 0);
	const controller = useMemo(() => ({ setStep }), []);
	const reduced = useReducedMotionPreference();
	const content = story[step] ?? story[0]!;
	const current = step === 0 ? 0 : step < 3 ? 1 : 2;
	return <SceneContext.Provider value={controller}><main className="onboarding-page" data-scene={step}>
		<a href="#onboarding-form" className="onboarding-skip">Skip to account setup</a>
		<header className="onboarding-topline"><div className="onboarding-brand"><CogneraMark /><span>Cognera</span></div><span className="onboarding-topline-note">A space for your curious mind.</span><a className="onboarding-mobile-start" href="#onboarding-form">{step === 0 ? "Get started" : "Continue setup"}<ArrowRightIcon aria-hidden="true" /></a></header>
		<div className="onboarding-layout">
			<section className="onboarding-story" aria-label="Welcome to Cognera">
				<div className="onboarding-story-backdrop" aria-hidden="true" />
				<motion.div className="onboarding-story-copy" key={step} initial={reduced ? false : { opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: .65, ease }}><h1>{content.title}</h1><p>{content.description}</p></motion.div>
				<div className="onboarding-art"><ClarityField phase={step} /></div>
				<div className="onboarding-thought"><span className="onboarding-thought-mark" aria-hidden="true"><MoveUpRightIcon /></span><p key={step}>{content.thought}</p><span className="onboarding-thought-dots" aria-hidden="true">{story.map((_, i) => <i key={i} data-active={step === i} />)}</span></div>
				<div className="onboarding-story-footer"><span>Explore. Connect. Understand.</span><span>Entirely your journey.</span></div>
			</section>
			<section className="onboarding-form-area" aria-label="Set up your workspace">
				<LayoutGroup id="cognera-onboarding-progress"><nav aria-label="Setup progress" className="onboarding-progress"><ol>{stages.map((label, index) => <li key={label} aria-current={current === index ? "step" : undefined} data-complete={current > index}>
					{current === index && <motion.span className="onboarding-progress-selection" layoutId="current-step" transition={reduced ? { type: "tween", duration: 0 } : { type: "spring", stiffness: 340, damping: 35 }} />}
					<span className="onboarding-progress-number">{current > index ? <CheckIcon aria-hidden="true" /> : `0${index + 1}`}</span><span className="onboarding-progress-label">{label}</span>
				</li>)}</ol></nav></LayoutGroup>
				<div className="onboarding-form-content" id="onboarding-form" tabIndex={-1}>{children}</div>
				<div className="onboarding-bottom"><p className="onboarding-footnote">Good things start with a question.</p><span aria-hidden="true">{step + 1} / 4</span></div>
				<div className="onboarding-bottom-track" aria-hidden="true"><motion.div animate={{ scaleX: (step + 1) / 4 }} transition={{ duration: reduced ? 0 : .8, ease }} /></div>
			</section>
		</div>
	</main></SceneContext.Provider>;
}

/** The route registers its scene without remounting the learning preview. */
export function OnboardingShell({ step, children }: { step: number; children: ReactNode }) {
	const controller = useContext(SceneContext);
	const reduced = useReducedMotionPreference();
	useEffect(() => { controller?.setStep(step); }, [controller, step]);
	return <motion.div className="onboarding-scene-content" key={step} initial={reduced ? false : { opacity: 0, x: 18, filter: "blur(5px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: reduced ? 0 : .5, ease }}>{children}</motion.div>;
}
