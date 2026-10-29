// A slow aurora and twinkling stars, drawn with one WebGL shader.
// Under reduced motion it drifts at a third of the speed; the pause button holds it still.

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform float lo;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
vec3 curtain(vec2 uv,float x,float tt,float o,vec3 c){
 float y=lo+o*.07+.13*sin(x*1.15+tt*2.2+o*2.3)+.2*(fbm(vec2(x*1.25-tt*1.4+o*7.,tt*.6+o))-.5);
 float d=uv.y-y;
 float body=d<0.?exp(-d*d*260.):exp(-d*7.5);
 float rays=pow(fbm(vec2(x*6.+tt*3.+o*13.,uv.y*1.2-tt*.4)),1.6)*1.9;
 float fade=smoothstep(-.3,.7,sin(x*.85+tt*1.3+o*4.));
 return c*body*rays*fade;}
void main(){
 vec2 uv=gl_FragCoord.xy/r;float x=uv.x*r.x/r.y;float tt=t*.05;
 vec3 col=mix(vec3(.027,.031,.11),vec3(.043,.047,.15),uv.y);
 col+=curtain(uv,x,tt,0.,vec3(.38,.9,.95))*1.05;
 col+=curtain(uv,x+1.7,tt,1.,vec3(.2,.6,.9))*.5;
 col+=curtain(uv,x+3.,tt,2.,vec3(.5,.36,.9))*.32;
 vec2 g=gl_FragCoord.xy/5.;vec2 cell=floor(g);float s=h(cell);
 if(s>.985){vec2 c=cell+.2+.6*vec2(h(cell+3.1),h(cell+7.7));float dd=length(g-c)*5.;
  float tw=.55+.45*sin(t*(.6+s*2.)+s*90.);
  col+=vec3(.92,.97,1.)*smoothstep(1.7,0.,dd)*tw*(s>.997?1.:.55)*smoothstep(.15,.5,uv.y);}
 col=mix(col,vec3(.031,.039,.133),smoothstep(.22,0.,uv.y));
 gl_FragColor=vec4(col,1.);}`;

type Sky = { setStill: (still: boolean) => void };

export function sky(canvas: HTMLCanvasElement, opts: { low?: number; scale?: number } = {}): Sky | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');
  gl.uniform1f(gl.getUniformLocation(prog, 'lo'), opts.low ?? 0.6);

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const scale = opts.scale ?? 0.75;
  let visible = true;
  let still = false;
  let frame = 0;
  let clock = Math.random() * 400; // seconds of sky-time, so every visit starts somewhere new
  let last = performance.now();

  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1) * scale;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uR, canvas.width, canvas.height);
  };
  const draw = () => {
    gl.uniform1f(uT, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt * (calm.matches ? 0.35 : 1);
    draw();
    frame = running() ? requestAnimationFrame(loop) : 0;
  };
  const running = () => visible && !still && !document.hidden;
  const kick = () => {
    if (frame || !running()) return;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };

  size();
  draw();
  kick();
  new ResizeObserver(() => {
    size();
    draw();
  }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    kick();
  }).observe(canvas);
  document.addEventListener('visibilitychange', kick);

  return {
    setStill(v) {
      still = v;
      kick();
    },
  };
}
