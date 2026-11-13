"use client";

import { CogneraMark } from "@/components/cognera-mark";
import { LearningRibbon } from "@/components/learning-ribbon";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

const story = [
	["A little curiosity.\nA different way to learn.", "Go beyond an answer. Build an understanding you can make your own."],
	["Your mind.\nYour choice of model.", "Connect the intelligence you trust. Give your curiosity somewhere to go."],
	["Good questions\nlead somewhere.", "A learning partner that helps you connect ideas, work things through, and remember."],
	["Start with a question.\nSee what unfolds.", "From a first spark of curiosity to a web of ideas. This space becomes yours."],
];

export function OnboardingShell({ step, children }: { step: number; children: ReactNode }) {
	const content = story[step] ?? story[0]!;
	return <main className="onboarding-page">
		<div className="onboarding-brand"><CogneraMark /><span>Cognera</span></div>
		<div className="onboarding-layout">
			<section className="onboarding-story" aria-label="Welcome to Cognera">
				<div className="onboarding-story-copy" key={step}><h1>{content[0]}</h1><p>{content[1]}</p></div>
				<div className="onboarding-art"><LearningRibbon phase={step} /><div className="ribbon-caption"><span>Curiosity</span><span className={step > 0 ? "is-reached" : ""}>Connection</span><span className={step > 1 ? "is-reached" : ""}>Understanding</span></div></div>
				<div className="onboarding-story-footer"><span>A place to think things through.</span><span>Made for your curious mind.</span></div>
			</section>
			<section className="onboarding-form-area" aria-label="Set up your workspace">
				<nav aria-label="Setup progress" className="onboarding-progress"><ol>{["Account", "Connect", "Make it yours"].map((label, index) => {
					const current = step === 0 ? 0 : step === 1 || step === 2 ? 1 : 2;
					return <li key={label} aria-current={current === index ? "step" : undefined} data-complete={current > index}><span>{current > index ? <CheckIcon /> : index + 1}</span>{label}</li>;
				})}</ol></nav>
				<div className="onboarding-form-content">{children}</div>
				<p className="onboarding-footnote">Space to explore. Tools to understand.</p>
			</section>
		</div>
	</main>;
}
