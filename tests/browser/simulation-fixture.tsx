import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DemoOutputCard } from "@/components/artifacts/demo-card";
import { ChatActionsContext } from "@/components/chat";

const html = `<!doctype html><html><head><style>body{font:16px system-ui;margin:18px;background:#fbfaf6;color:#222}input,button{min-height:44px}button{margin:8px;padding:8px 14px}label,output{display:block;margin:12px 0}canvas{max-width:100%;border:1px solid #ddd}</style></head><body><h2>A force you can change</h2><p>Assumption: constant mass of 2 kg, no friction.</p><label>Force (N)<input id="force" aria-label="Force (N)" type="range" min="0" max="20" value="4"></label><output aria-label="Acceleration" data-cognera-result id="result"></output><button id="reset">Reset</button><button id="pause">Pause</button><canvas width="320" height="90"></canvas><script>
let paused=false,x=0;const f=document.querySelector('#force'),out=document.querySelector('#result'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
function update(){const a=Number(f.value)/2;out.textContent='Acceleration: '+a+' m/s²';window.cognera?.reportObservation({parameters:{'Force (N)':Number(f.value),'Mass (kg)':2},result:out.textContent})}f.addEventListener('input',update);document.querySelector('#reset').onclick=()=>{f.value=4;x=0;update()};document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Resume':'Pause'};function frame(){if(!paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches)x=(x+Number(f.value)/10)%280;ctx.clearRect(0,0,320,90);ctx.fillStyle='#566a61';ctx.fillRect(x,30,30,30);requestAnimationFrame(frame)}update();requestAnimationFrame(frame);
</script></body></html>`;
function Fixture() {
	const [shared, setShared] = useState("");
	return (
		<ChatActionsContext.Provider
			value={{ chatId: "simulation-fixture", sendText: (text: string) => setShared(text) } as any}
		>
			<DemoOutputCard output={{ title: "Force and acceleration", html, tested: true }} />
			<pre id="shared">{shared}</pre>
		</ChatActionsContext.Provider>
	);
}
createRoot(document.getElementById("fixture")!).render(<Fixture />);
