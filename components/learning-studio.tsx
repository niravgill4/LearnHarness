import { CompassIcon, RouteIcon, ScanLineIcon } from "lucide-react";

/** An explanatory empty state, never presented as a learner's saved knowledge. */
export function AtlasEmptyState() {
	return <figure className="atlas-empty">
		<svg viewBox="0 0 600 330" fill="none" role="img" aria-label="A question leads to exploration, understanding, and new connections">
			<path className="atlas-orbit" d="M90 180C90 55 470 38 505 165S170 320 125 210" />
			<path className="atlas-link" d="M145 175C210 175 215 119 296 119S374 210 459 210M296 119V265" />
			<circle cx="145" cy="175" r="39" className="atlas-node" />
			<circle cx="296" cy="119" r="54" className="atlas-node atlas-node-main" />
			<circle cx="459" cy="210" r="39" className="atlas-node" />
			<circle cx="296" cy="265" r="6" className="atlas-seed" />
			<text x="145" y="180" textAnchor="middle">Question</text>
			<text x="296" y="116" textAnchor="middle" className="atlas-core-label">Make a</text>
			<text x="296" y="134" textAnchor="middle" className="atlas-core-label">connection</text>
			<text x="459" y="215" textAnchor="middle">Recall</text>
			<text x="296" y="298" textAnchor="middle" className="atlas-future-label">The next idea starts here</text>
		</svg>
		<figcaption><strong>Your first connection is waiting.</strong><span>As you learn, your ideas and their reasoning take shape here.</span></figcaption>
	</figure>;
}

/** Stages reflect the real session phase; they are not mastery scores. */
export function LearningJourney({ phase, checking, practice }: { phase: string; checking: boolean; practice: boolean }) {
	const stages = practice
		? [{ label: "Recall", icon: CompassIcon }, { label: "Work it through", icon: RouteIcon }, { label: "Reflect", icon: ScanLineIcon }]
		: [{ label: "Your starting point", icon: CompassIcon }, { label: "A path through it", icon: RouteIcon }, { label: checking ? "Check your understanding" : "Build understanding", icon: ScanLineIcon }];
	const current = practice ? 0 : phase === "probe" ? 0 : phase === "plan" ? 1 : 2;
	return <nav className="learning-journey" aria-label="Learning stages"><ol>{stages.map(({ label, icon: Icon }, i) => <li key={i} aria-current={i === current ? "step" : undefined}><Icon aria-hidden="true" /><span>{label}</span>{i === current && <small>Now</small>}</li>)}</ol></nav>;
}
