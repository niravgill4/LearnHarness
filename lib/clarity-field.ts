/** Original optical surface: fragmented traces resolve into connected strata. */
export function clarityPoint(u: number, v: number, time = 0, phase = 0) {
	const envelope = Math.exp(-u * u * .75);
	return [
		u * 2.15 + Math.sin(v * 2.1) * .16,
		Math.sin(u * 2.8 + .4) * Math.cos(v * 1.55) * .68 + Math.exp(-Math.pow(u + .26, 2) * 6) * .7 + Math.sin(v * 2.3 + u) * .12,
		v * 1.33 + Math.sin(u * 2.3) * .12 + Math.sin(v * 18 + u * 8 + time * .12) * .065 * envelope * (1 - phase * .22),
	] as const;
}

const vertex = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform float uTime;
uniform float uPhase;
uniform vec2 uPointer;
uniform float uAspect;
uniform float uPass;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
out float vDepth;
vec3 surface(vec2 p) {
 float u=p.x,v=p.y;
 float envelope=exp(-u*u*.75);
 float disorder=sin(v*18.+u*8.+uTime*.12)*.065*envelope*(1.-uPhase*.22);
 return vec3(u*2.15+sin(v*2.1)*.16,
 sin(u*2.8+.4)*cos(v*1.55)*.68+exp(-pow(u+.26,2.)*6.)*.7+sin(v*2.3+u)*.12,
 v*1.33+sin(u*2.3)*.12+disorder);
}
void main(){
 vec2 uv=aPosition;
 vec3 p=surface(uv);
 vec3 du=surface(uv+vec2(.003,0.))-p;
 vec3 dv=surface(uv+vec2(0.,.003))-p;
 vNormal=normalize(cross(du,dv));
 vPosition=p;vUv=uv;
 float yaw=-.48+uPointer.x*.12+sin(uTime*.055)*.035;
 float tilt=.51+uPointer.y*.08;
 mat2 y=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw));
 p.xz=y*p.xz;
 mat2 x=mat2(cos(tilt),sin(tilt),-sin(tilt),cos(tilt));
 p.yz=x*p.yz;
 p.y-=.15;
 float distance=6.7-p.z;
 float scale=3.05;
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
out vec4 color;
void main(){
 vec3 n=normalize(vNormal);
 vec3 light=normalize(vec3(-.5,1.5,1.1));
 float diffuse=abs(dot(n,light));
 float edge=pow(1.-abs(dot(n,normalize(vec3(.15,.6,1.)))),2.);
 float sweep=sin(uTime*.18)*1.35;
 float focus=exp(-pow(vPosition.x-sweep,2.)*2.1);
 float caustic=exp(-pow(vPosition.x-sweep,2.)*45.);
 float glint=pow(max(0.,dot(reflect(-light,n),normalize(vec3(.2,.9,2.)))),20.);
 float fade=(1.-smoothstep(.82,1.025,abs(vUv.x)))*(1.-smoothstep(.83,1.035,abs(vUv.y)));
 float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 if(uPass<.5){
  vec3 base=vec3(.035,.04,.048)+vec3(.12,.13,.145)*diffuse;
  base+=vec3(.19,.20,.21)*edge+vec3(.09,.095,.10)*focus+glint*.27;
  base+=vec3(.19,.19,.18)*caustic*(.3+diffuse*.7);
  base+=(grain-.5)*.035;
  color=vec4(base,fade*.97);
 }else{
  float energy=.25+diffuse*.17+focus*.34+edge*.24+glint*.24;
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
		const mesh: number[] = [], lines: number[] = [];
		const cols = 90, rows = 96;
		for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
			const u = col / cols * 2 - 1, v = row / rows * 2 - 1;
			const du = 2 / cols, dv = 2 / rows;
			mesh.push(u, v, u + du, v, u, v + dv, u + du, v, u + du, v + dv, u, v + dv);
			lines.push(u, v, u + du, v);
			if (col % 24 === 0) lines.push(u, v, u, v + dv);
		}
		const upload = (vertices: number[]) => {
			const buffer = gl.createBuffer();
			if (!buffer) throw new Error("No buffer allocation");
			buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
			return { buffer, count: vertices.length / 2 };
		};
		const surface = upload(mesh), contours = upload(lines);
		gl.useProgram(program);
		const position = gl.getAttribLocation(program, "aPosition");
		gl.enableVertexAttribArray(position);
		const uniforms = Object.fromEntries(["uTime", "uPhase", "uPointer", "uAspect", "uPass"].map(name => [name, gl.getUniformLocation(program, name)]));
		gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		return {
			draw(time: number, phase: number, pointer: readonly number[]) {
				gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				gl.useProgram(program);
				gl.uniform1f(uniforms.uTime!, time); gl.uniform1f(uniforms.uPhase!, phase);
				gl.uniform2f(uniforms.uPointer!, pointer[0] ?? 0, pointer[1] ?? 0);
				gl.uniform1f(uniforms.uAspect!, canvas.width / canvas.height);
				for (const [geometry, pass, mode] of [[surface, 0, gl.TRIANGLES], [contours, 1, gl.LINES]] as const) {
					gl.uniform1f(uniforms.uPass!, pass); gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffer); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(mode, 0, geometry.count);
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
	return Array.from({ length: 42 }, (_, row) => {
		const v = row / 41 * 2 - 1;
		return Array.from({ length: 86 }, (_, index) => {
			const [x, y, z] = clarityPoint(index / 85 * 2 - 1, v);
			const rx = x * .887 - z * .462, rz = x * .462 + z * .887;
			const ry = y * .873 - rz * .488;
			const distance = 6.7 - (y * .488 + rz * .873);
			return `${index ? "L" : "M"}${(280 + rx * 640.5 / distance).toFixed(2)},${(210 - (ry - .15) * 640.5 / distance).toFixed(2)}`;
		}).join("");
	});
}
