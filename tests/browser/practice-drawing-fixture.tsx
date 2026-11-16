import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PracticeDock } from "../../components/practice-dock";
import { InteractionLayersProvider } from "../../components/interaction-layers";

function Fixture() {
	const [expanded, setExpanded] = useState(true);
	const [problem, setProblem] = useState(1);
	return <InteractionLayersProvider><button id="fold" onClick={() => setExpanded(value => !value)}>Fold / unfold</button><button id="next" onClick={() => setProblem(value => value + 1)}>Next problem</button><PracticeDock problemCallId={`problem-${problem}`} input={{ statement: "Solve 2x + 3 = 11. Show your working." }} expanded={expanded} onExpand={() => setExpanded(true)} onSubmit={() => {}} onPrepareSubmission={(capture, accept, images) => {
		Object.assign(window, { submission: { text: capture(), images: images?.() }, accept: () => accept("") });
	}} /></InteractionLayersProvider>;
}
createRoot(document.getElementById("fixture")!).render(<Fixture />);
