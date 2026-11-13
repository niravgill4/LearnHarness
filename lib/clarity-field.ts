/** Original optical surface: fragmented traces resolve into connected strata. */
export function clarityPoint(u: number, v: number, time = 0, phase = 0, layer = 0) {
	const envelope = Math.exp(-u * u * .75);
	const progress = Math.max(0, Math.min(1, time / 4.8));
	const opening = .82 + .18 * progress * progress * (3 - 2 * progress);
	const x = u * 2.32 + Math.sin(v * 2.1 + layer * .35) * .18;
	const y = Math.sin(u * 3.2 + .4 + layer * .28) * Math.cos(v * 1.55) * .73
		+ Math.exp(-Math.pow(u + .26 - layer * .07, 2) * 6) * .88
		+ Math.sin(v * 2.3 + u + layer * .4) * .15
		+ Math.sin(u * 5.4 - v * .9 + layer * 1.1) * .12;
	const z = v * 1.4 + Math.sin(u * 2.3) * .14 + Math.sin(v * 18 + u * 8 + time * .12) * .065 * envelope * (1 - phase * .22);
	const angle = layer === 1 ? 1.02 : layer === 2 ? -.56 : 0;
	const scale = layer === 1 ? .84 : layer === 2 ? 1.02 : 1;
	return [
		(x * Math.cos(angle) + z * Math.sin(angle)) * scale + (layer === 1 ? -.25 : layer === 2 ? .15 : 0),
		y * scale + (layer === 1 ? .7 : layer === 2 ? -.62 : 0) * opening + Math.sin(time * .18 + layer * .75) * .025,
		(-x * Math.sin(angle) + z * Math.cos(angle)) * scale + (layer === 1 ? -.42 : layer === 2 ? .28 : 0),
	] as const;
}

const vertex = `#version 300 es
precision highp float;
in vec4 aUvLayer;
in vec4 aBasePosition;
in vec4 aTangentU;
in vec4 aTangentV;
uniform float uTime;
uniform float uPhase;
uniform mat3 uCamera;
uniform vec3 uLift;
uniform float uAspect;
uniform float uPass;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
out float vDepth;
flat out float vLayer;
void main(){
 vec2 uv=aUvLayer.xy;
 float layer=aUvLayer.z;
 float angle=uv.y*18.+uv.x*8.+uTime*.12;
 float s=sin(angle),c=cos(angle);
 float amplitude=aUvLayer.w*(1.-uPhase*.22);
 vec3 axis=layer==1.?vec3(${(Math.sin(1.02) * .84).toFixed(9)},0.,${(Math.cos(1.02) * .84).toFixed(9)})
 :layer==2.?vec3(${(Math.sin(-.56) * 1.02).toFixed(9)},0.,${(Math.cos(-.56) * 1.02).toFixed(9)}):vec3(0.,0.,1.);
 vec3 p=aBasePosition.xyz+axis*(amplitude*s-aBasePosition.w);
 p.y+=uLift[int(layer)];
 vec3 du=aTangentU.xyz+axis*(amplitude*(8.*c-1.5*uv.x*s)-aTangentU.w);
 vec3 dv=aTangentV.xyz+axis*(amplitude*18.*c-aTangentV.w);
 vNormal=normalize(cross(du,dv));
 vPosition=p;vUv=uv;vLayer=layer;
 p=uCamera*p;
 p.y-=.1;
 float distance=8.6-p.z;
 float scale=4.25;
 gl_Position=vec4(p.x*scale/uAspect,p.y*scale,-p.z*.12,distance);
 if(uPass>0.5)gl_Position.z-=.001;
 vDepth=p.z;
}`;

const fragment = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uPhase;
uniform float uPass;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
in float vDepth;
flat in float vLayer;
out vec4 color;
void main(){
 vec3 n=normalize(vNormal);
 vec3 light=normalize(vec3(-.5,1.5,1.1));
 float diffuse=abs(dot(n,light));
 float edge=pow(1.-abs(dot(n,normalize(vec3(.15,.6,1.)))),2.);
 float sweep=sin(uTime*.18)*1.85;
 float focus=exp(-pow(vPosition.x+vPosition.z*.3-sweep,2.)*2.1);
 float caustic=exp(-pow(vPosition.x+vPosition.z*.3-sweep,2.)*45.);
 float crossing=exp(-pow(vPosition.z-vPosition.y*.4-cos(uTime*.13+.8)*1.4,2.)*9.);
 float glint=pow(max(0.,dot(reflect(-light,n),normalize(vec3(.2,.9,2.)))),20.);
 float fade=(1.-smoothstep(.82,1.025,abs(vUv.x)))*(1.-smoothstep(.83,1.035,abs(vUv.y)));
 float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 if(uPass<.5){
  vec3 base=vec3(.035,.04,.048)+vec3(.12,.13,.145)*diffuse;
  base+=vec3(.19,.20,.21)*edge+vec3(.09,.095,.10)*focus+glint*.27;
  base+=vec3(.19,.19,.18)*caustic*(.3+diffuse*.7);
  base+=vec3(.11,.115,.12)*crossing;
  base*=1.-vLayer*.055;
  base+=(grain-.5)*.035;
  color=vec4(base,fade*.97);
 }else{
  float energy=.23+diffuse*.17+focus*.34+edge*.24+glint*.24+crossing*.21;
  vec3 ink=mix(vec3(.55,.61,.68),vec3(.94,.94,.91),focus*.65+edge*.35);
  float depth=clamp(.7+vDepth*.15,.3,1.);
  color=vec4(ink,clamp(energy*depth*fade,0.,.92));
 }
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("No shader allocation");
	gl.shaderSource(shader, source); gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error("Optical renderer unavailable"); }
	return shader;
}

export function createClarityRenderer(canvas: HTMLCanvasElement) {
	const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, depth: true, powerPreference: "low-power", preserveDrawingBuffer: true });
	if (!gl) return null;
	const program = gl.createProgram();
	if (!program) return null;
	const shaders: WebGLShader[] = [];
	const buffers: WebGLBuffer[] = [];
	try {
		shaders.push(compile(gl, gl.VERTEX_SHADER, vertex));
		shaders.push(compile(gl, gl.FRAGMENT_SHADER, fragment));
		for (const shader of shaders) gl.attachShader(program, shader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Optical renderer unavailable");
		const compact = canvas.clientWidth < 520;
		const cols = compact ? 36 : 48, rows = compact ? 88 : 116;
		const nodeCount = (cols + 1) * (rows + 1) * 3;
		const vertices = new Float32Array(nodeCount * 16);
		const mesh: number[] = [], lines: number[] = [];
		// Shared indexed vertices avoid recalculating a folded surface for every
		// triangle and contour. Only its small live displacement runs in the GPU.
		for (let layer = 0; layer < 3; layer++) {
			const base = layer * (cols + 1) * (rows + 1);
			for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
				const u = col / cols * 2 - 1, v = row / rows * 2 - 1;
				const index = base + row * (cols + 1) + col;
				const p = clarityPoint(u, v, 0, 0, layer);
				const du = clarityPoint(u + .003, v, 0, 0, layer), dv = clarityPoint(u, v + .003, 0, 0, layer);
				const envelope = .065 * Math.exp(-u * u * .75), angle = v * 18 + u * 8;
				const s = Math.sin(angle), c = Math.cos(angle);
				vertices.set([
					u, v, layer, envelope,
					p[0], p[1], p[2], envelope * s,
					(du[0] - p[0]) / .003, (du[1] - p[1]) / .003, (du[2] - p[2]) / .003, envelope * (8 * c - 1.5 * u * s),
					(dv[0] - p[0]) / .003, (dv[1] - p[1]) / .003, (dv[2] - p[2]) / .003, envelope * 18 * c,
				], index * 16);
				if (row < rows && col < cols) {
					const next = index + cols + 1;
					mesh.push(index, index + 1, next, index + 1, next + 1, next);
					lines.push(index, index + 1);
					if (col % 12 === 0) lines.push(index, next);
				}
			}
		}
		const vertexBuffer = gl.createBuffer();
		if (!vertexBuffer) throw new Error("No vertex allocation");
		buffers.push(vertexBuffer); gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
		const uploadIndices = (indices: number[]) => {
			const buffer = gl.createBuffer();
			if (!buffer) throw new Error("No buffer allocation");
			buffers.push(buffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
			const wide = nodeCount > 65535;
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wide ? new Uint32Array(indices) : new Uint16Array(indices), gl.STATIC_DRAW);
			return { buffer, count: indices.length, type: wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
		};
		const surface = uploadIndices(mesh), contours = uploadIndices(lines);
		gl.useProgram(program);
		for (const [index, name] of ["aUvLayer", "aBasePosition", "aTangentU", "aTangentV"].entries()) {
			const location = gl.getAttribLocation(program, name);
			gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 64, index * 16);
		}
		const uniforms = Object.fromEntries(["uTime", "uPhase", "uCamera", "uLift", "uAspect", "uPass"].map(name => [name, gl.getUniformLocation(program, name)]));
		const camera = new Float32Array(9), lift = new Float32Array(3);
		gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		return {
			draw(time: number, phase: number, pointer: readonly number[]) {
				gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				gl.useProgram(program);
				gl.uniform1f(uniforms.uTime!, time); gl.uniform1f(uniforms.uPhase!, phase);
				const yaw = -.56 + (pointer[0] ?? 0) * .18 + Math.sin(time * .11) * .12;
				const tilt = .36 + (pointer[1] ?? 0) * .12 + Math.cos(time * .08) * .065;
				const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
				camera.set([cy, st * sy, -ct * sy, 0, ct, st, sy, -st * cy, ct * cy]);
				const progress = Math.min(1, time / 4.8), opening = .18 * progress * progress * (3 - 2 * progress);
				for (let layer = 0; layer < 3; layer++) lift[layer] = (layer === 1 ? .7 : layer === 2 ? -.62 : 0) * opening + (Math.sin(time * .18 + layer * .75) - Math.sin(layer * .75)) * .025;
				gl.uniformMatrix3fv(uniforms.uCamera!, false, camera); gl.uniform3fv(uniforms.uLift!, lift);
				gl.uniform1f(uniforms.uAspect!, canvas.width / canvas.height);
				for (const [geometry, pass, mode] of [[surface, 0, gl.TRIANGLES], [contours, 1, gl.LINES]] as const) {
					gl.uniform1f(uniforms.uPass!, pass); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.buffer); gl.drawElements(mode, geometry.count, geometry.type, 0);
				}
			},
			dispose() { for (const buffer of buffers) gl.deleteBuffer(buffer); for (const shader of shaders) gl.deleteShader(shader); gl.deleteProgram(program); },
		};
	} catch {
		for (const buffer of buffers) gl.deleteBuffer(buffer);
		for (const shader of shaders) gl.deleteShader(shader);
		gl.deleteProgram(program);
		return null;
	}
}

/** The same surface remains legible without a graphics context. */
export function clarityFallbackPaths() {
	const time = 8.5;
	const yaw = -.56 + Math.sin(time * .11) * .12, tilt = .36 + Math.cos(time * .08) * .065;
	return Array.from({ length: 3 }, (_, layer) => Array.from({ length: 36 }, (_, row) => {
		const v = row / 35 * 2 - 1;
		return Array.from({ length: 96 }, (_, index) => {
			const [x, y, z] = clarityPoint(index / 95 * 2 - 1, v, time, 0, layer);
			const rx = x * Math.cos(yaw) + z * Math.sin(yaw), rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
			const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
			const distance = 8.6 - (y * Math.sin(tilt) + rz * Math.cos(tilt));
			return `${index ? "L" : "M"}${(280 + rx * 892.5 / distance).toFixed(2)},${(210 - (ry - .1) * 892.5 / distance).toFixed(2)}`;
		}).join("");
	})).flat();
}
