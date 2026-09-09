/* ==========================================================================
   COSMOS.JS  —  the WebGL layer behind the scorecard.

   A Three.js scene with hand-written GLSL: procedural planet + atmosphere +
   clouds + rings, a baked nebula, twinkling starfield, custom bloom
   post-processing, one satellite per player (driven by hud.js), rockets that
   launch whenever a score changes, and 18 hole beacons on the planet.

   It never touches client.js. hud.js reads game state through client.js'
   own functions and pushes it here through window.COSMOS.
   Falls back to a 2D canvas starfield if WebGL / the CDN are unavailable.
   ========================================================================== */
(function () {
  'use strict';

  const canvas = document.getElementById('cosmos');
  if (!canvas) return;

  /* ----------------------------------------------------------------------
     Public API (filled in by whichever engine boots)
     ---------------------------------------------------------------------- */
  const listeners = {};
  let readyPayload = null;
  const API = {
    mode: 'booting',        // 'webgl' | '2d' | 'off'
    quality: 'high',
    setPlayers() {}, launch() {}, pulse() {}, explode() {},
    setHoles() {}, setActiveHole() {}, setEnabled() {},
    on(evt, fn) {
      if (evt === 'ready' && readyPayload) { try { fn(readyPayload); } catch (e) { console.error(e); } return; }
      (listeners[evt] = listeners[evt] || []).push(fn);
    },
    emit(evt, data) {
      if (evt === 'ready') readyPayload = data;
      (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
    }
  };
  window.COSMOS = API;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowTier = coarse || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  API.quality = lowTier ? 'low' : 'high';

  /* ----------------------------------------------------------------------
     Wait for THREE (loaded async from the CDN), else fall back to 2D
     ---------------------------------------------------------------------- */
  function whenThreeReady(cb, fail) {
    if (window.THREE) return cb();
    const tag = document.querySelector('script[data-three]');
    let done = false;
    const ok = () => { if (!done) { done = true; window.THREE ? cb() : fail(); } };
    const bad = () => { if (!done) { done = true; fail(); } };
    if (tag) { tag.addEventListener('load', ok); tag.addEventListener('error', bad); }
    setTimeout(() => { if (!done) { window.THREE ? ok() : bad(); } }, 12000);
  }

  /* ======================================================================
     GLSL
     ====================================================================== */
  const NOISE = `
    vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    float fbm(vec3 p){
      float f = 0.0; float a = 0.5;
      for (int i = 0; i < OCT; i++) { f += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
      return f;
    }
  `;

  const VERT_WORLD = `
    varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vObj; varying vec3 vNormalV;
    void main(){
      vObj = position;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vPosW = wp.xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vNormalV = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const FRAG_PLANET = `
    uniform float uTime; uniform vec3 uSunDir;
    varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vObj;
    void main(){
      vec3 N = normalize(vNormalW);
      vec3 V = normalize(cameraPosition - vPosW);
      vec3 L = normalize(uSunDir);
      vec3 q = normalize(vObj);

      float e = fbm(q * 2.1 + 3.7);
      float detail = fbm(q * 6.5 + 11.0) * 0.35;
      float h = e + detail;
      float land = smoothstep(0.02, 0.07, h);

      vec3 deep    = vec3(0.03, 0.02, 0.18);
      vec3 shallow = vec3(0.05, 0.42, 0.62);
      vec3 ocean   = mix(deep, shallow, smoothstep(-0.55, 0.03, h));
      vec3 low     = vec3(0.07, 0.48, 0.34);
      vec3 high    = vec3(0.42, 0.30, 0.46);
      vec3 peak    = vec3(0.88, 0.86, 0.96);
      vec3 landc   = mix(low, high, smoothstep(0.08, 0.34, h));
      landc = mix(landc, peak, smoothstep(0.40, 0.58, h));

      float lat = abs(q.y);
      float ice = smoothstep(0.80, 0.91, lat + detail * 0.35);
      vec3 alb = mix(ocean, landc, land);
      alb = mix(alb, vec3(0.90, 0.95, 1.0), ice);

      float ndl = dot(N, L);
      float day = smoothstep(-0.15, 0.35, ndl);
      float diff = max(ndl, 0.0);
      vec3 H = normalize(L + V);
      float spec = pow(max(dot(N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - ice) * 0.8;
      vec3 col = alb * (diff * 1.2 + 0.035) + spec * vec3(1.0, 0.95, 0.8);

      float term = smoothstep(-0.25, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.35, ndl));
      col += term * vec3(0.30, 0.10, 0.03);

      float cityN = snoise(q * 42.0);
      float cities = smoothstep(0.42, 0.85, cityN) * land * (1.0 - ice) * smoothstep(0.36, 0.06, h);
      col += vec3(1.0, 0.72, 0.38) * cities * (1.0 - day) * 1.7;

      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      col += fres * vec3(0.30, 0.55, 1.0) * (0.25 + 0.75 * day);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const FRAG_CLOUDS = `
    uniform float uTime; uniform vec3 uSunDir;
    varying vec3 vNormalW; varying vec3 vObj;
    void main(){
      vec3 q = normalize(vObj);
      float n  = fbm(q * 2.8 + vec3(uTime * 0.015, 0.0, uTime * 0.008));
      float n2 = fbm(q * 7.5 - vec3(0.0, uTime * 0.02, 0.0)) * 0.5;
      float c = smoothstep(0.12, 0.62, n + n2 * 0.6);
      vec3 N = normalize(vNormalW);
      float ndl = dot(N, normalize(uSunDir));
      float day = smoothstep(-0.2, 0.3, ndl);
      float diff = max(ndl, 0.0) * 0.95 + 0.07;
      gl_FragColor = vec4(vec3(0.95, 0.96, 1.0) * diff, c * 0.9 * (0.12 + 0.88 * day));
    }
  `;

  const FRAG_ATMO = `
    uniform vec3 uSunDir; uniform vec3 uColor;
    varying vec3 vNormalV; varying vec3 vNormalW;
    void main(){
      float intensity = pow(0.62 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 3.2);
      float sun = 0.25 + 0.75 * smoothstep(-0.6, 0.6, dot(normalize(vNormalW), normalize(uSunDir)));
      gl_FragColor = vec4(uColor * intensity * sun * 1.4, 1.0);
    }
  `;

  const VERT_RING = `
    varying vec3 vPosW; varying vec2 vLocal; varying vec3 vNormalW;
    void main(){
      vLocal = position.xy;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vPosW = wp.xyz;
      vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  const FRAG_RING = `
    uniform vec3 uSunDir; uniform float uPlanetR; uniform float uInner; uniform float uOuter; uniform float uTime;
    varying vec3 vPosW; varying vec2 vLocal; varying vec3 vNormalW;
    float hash(float n){ return fract(sin(n) * 43758.5453123); }
    void main(){
      float r = length(vLocal);
      float t = (r - uInner) / (uOuter - uInner);
      float b  = 0.5 + 0.5 * sin(r * 41.0);
      float b2 = 0.5 + 0.5 * sin(r * 133.0 + 1.3);
      float b3 = hash(floor(r * 60.0)) ;
      float dens = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.86, t) * (0.28 + 0.36 * b + 0.2 * b2 + 0.16 * b3);
      dens *= 1.0 - 0.85 * (1.0 - smoothstep(0.0, 0.025, abs(t - 0.56) - 0.015));
      dens *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.012, abs(t - 0.31) - 0.006));
      dens *= 1.0 - 0.4  * (1.0 - smoothstep(0.0, 0.01,  abs(t - 0.78) - 0.004));
      vec3 col = mix(vec3(0.62, 0.52, 0.95), vec3(0.35, 0.85, 1.0), b2);
      col = mix(col, vec3(0.95, 0.65, 0.9), b3 * 0.35);
      vec3 L = normalize(uSunDir);
      float s = -dot(vPosW, L);
      vec3 c = vPosW + s * L;
      float sh = s > 0.0 ? (1.0 - smoothstep(uPlanetR - 0.25, uPlanetR + 0.05, length(c))) : 0.0;
      float light = (0.35 + 0.65 * abs(dot(vNormalW, L))) * (1.0 - sh * 0.88);
      gl_FragColor = vec4(col * light * 1.1, dens * 0.9);
    }
  `;

  const FRAG_SUN = `
    uniform float uTime;
    varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vObj;
    void main(){
      vec3 V = normalize(cameraPosition - vPosW);
      float f = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 2.0);
      float n = fbm(normalize(vObj) * 3.0 + uTime * 0.12) * 0.5 + 0.5;
      vec3 col = mix(vec3(1.0, 0.72, 0.28), vec3(1.0, 0.97, 0.85), n) * 1.7;
      col += f * vec3(1.0, 0.45, 0.15) * 1.6;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const VERT_STARS = `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uScale;
    varying vec3 vColor; varying float vTw;
    void main(){
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tw = 0.62 + 0.38 * sin(uTime * (1.2 + aPhase * 2.4) + aPhase * 41.0);
      vTw = tw;
      gl_PointSize = aSize * (0.7 + 0.5 * tw) * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const FRAG_STARS = `
    varying vec3 vColor; varying float vTw;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.08, d);
      a = a * a * (0.6 + 0.4 * vTw);
      float core = smoothstep(0.18, 0.0, d);
      gl_FragColor = vec4(vColor * (0.85 + core * 0.9), a);
    }
  `;

  const VERT_QUAD = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const FRAG_NEBULA_BAKE = `
    uniform float uSeed; varying vec2 vUv;
    void main(){
      float lon = (vUv.x - 0.5) * 6.28318530718;
      float lat = (vUv.y - 0.5) * 3.14159265359;
      vec3 p = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
      float n1 = fbm(p * 2.0 + uSeed) * 0.5 + 0.5;
      float n2 = fbm(p * 4.6 + uSeed * 2.0 + 3.0) * 0.5 + 0.5;
      float n3 = fbm(p * 3.1 - uSeed + 9.0) * 0.5 + 0.5;
      float n4 = fbm(p * 1.3 + 17.0) * 0.5 + 0.5;
      vec3 col = vec3(0.012, 0.006, 0.03);
      float neb = smoothstep(0.42, 0.82, n1);
      col += vec3(0.30, 0.07, 0.58) * neb * 0.9;
      col += vec3(0.04, 0.42, 0.62) * smoothstep(0.55, 0.9, n2) * 0.75;
      col += vec3(0.75, 0.10, 0.45) * smoothstep(0.6, 0.95, n3) * 0.55;
      col += vec3(0.10, 0.20, 0.55) * smoothstep(0.45, 0.8, n4) * 0.5;
      col *= 1.0 - 0.65 * smoothstep(0.58, 0.8, n3) * smoothstep(0.3, 0.6, n1);
      col *= 0.92;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const FRAG_THRESHOLD = `
    uniform sampler2D tDiffuse; uniform float uThreshold; uniform float uSoft; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(uThreshold, uThreshold + uSoft, l);
      gl_FragColor = vec4(c.rgb * k, 1.0);
    }
  `;
  const FRAG_BLUR = `
    uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec4 s = texture2D(tDiffuse, vUv) * 0.227027;
      vec2 o1 = uDir * 1.3846153846; vec2 o2 = uDir * 3.2307692308;
      s += texture2D(tDiffuse, vUv + o1) * 0.3162162162;
      s += texture2D(tDiffuse, vUv - o1) * 0.3162162162;
      s += texture2D(tDiffuse, vUv + o2) * 0.0702702703;
      s += texture2D(tDiffuse, vUv - o2) * 0.0702702703;
      gl_FragColor = s;
    }
  `;
  const FRAG_COMPOSITE = `
    uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uStrength; uniform float uTime; uniform float uAber;
    varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 c;
      c.r = texture2D(tScene, vUv + d * uAber * r2).r;
      c.g = texture2D(tScene, vUv).g;
      c.b = texture2D(tScene, vUv - d * uAber * r2).b;
      c += texture2D(tBloom, vUv).rgb * uStrength;
      float vig = 1.0 - smoothstep(0.3, 1.15, length(d) * 1.25) * 0.6;
      c *= vig;
      float grain = (fract(sin(dot(vUv * vec2(1234.5, 876.3) + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.04;
      c += grain;
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  const VERT_TRAIL = `
    varying vec3 vLocal; varying vec3 vNormalV;
    void main(){ vLocal = position; vNormalV = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  const FRAG_TRAIL = `
    uniform float uAngle; uniform vec3 uColor; uniform float uBase;
    varying vec3 vLocal; varying vec3 vNormalV;
    void main(){
      float a = atan(vLocal.y, vLocal.x);
      float d = mod(uAngle - a + 6.28318530718, 6.28318530718);
      float tail = smoothstep(2.4, 0.0, d);
      float rim = 0.55 + 0.45 * abs(vNormalV.z);
      gl_FragColor = vec4(uColor * (0.5 + tail * 1.6) * rim, uBase + tail * 0.9);
    }
  `;

  const VERT_PARTICLES = `
    attribute float aLife; attribute float aSize; attribute vec3 aColor;
    uniform float uScale;
    varying float vLife; varying vec3 vColor;
    void main(){
      vLife = aLife; vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (0.5 + 0.9 * (1.0 - aLife)) * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const FRAG_PARTICLES = `
    varying float vLife; varying vec3 vColor;
    void main(){
      if (vLife <= 0.0) discard;
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.1, d) * vLife;
      gl_FragColor = vec4(vColor * (0.6 + vLife), a);
    }
  `;

  /* ======================================================================
     Helpers
     ====================================================================== */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function makeGlowTexture(THREE) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function makeLabelTexture(THREE, text, color, sub) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 160);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 46px Orbitron, "Segoe UI", sans-serif';
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillStyle = '#ffffff';
    const t = text.length > 14 ? text.slice(0, 13) + '…' : text;
    g.fillText(t.toUpperCase(), 256, sub ? 60 : 80);
    if (sub) {
      g.shadowBlur = 12; g.font = '600 26px Rajdhani, "Segoe UI", sans-serif'; g.fillStyle = color;
      g.fillText(sub.toUpperCase(), 256, 112);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  /* ======================================================================
     WEBGL ENGINE
     ====================================================================== */
  function bootWebGL() {
    const THREE = window.THREE;
    const OCT = lowTier ? 3 : 5;
    const defines = { OCT };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowTier, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
    const clock = new THREE.Clock();
    const glowTex = makeGlowTexture(THREE);

    const sunPos = new THREE.Vector3(52, 11, -40);   // low elevation so it can cross the camera's field of view
    const sunDir = sunPos.clone().normalize();
    const time = { value: 0 };

    /* --- lights (for satellites / rockets which use standard materials) --- */
    const dirLight = new THREE.DirectionalLight(0xfff2dc, 1.7);
    dirLight.position.copy(sunPos);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x4a3c8a, 0.55));
    const hemi = new THREE.HemisphereLight(0x5aa0ff, 0x2a0a4a, 0.35);
    scene.add(hemi);

    /* --- nebula: bake once into an equirect texture --- */
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    quad.frustumCulled = false;
    quadScene.add(quad);

    function bakeNebula() {
      const w = lowTier ? 1024 : 2048, h = w / 2;
      const rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
      quad.material = new THREE.ShaderMaterial({ defines: { OCT: 4 }, uniforms: { uSeed: { value: Math.random() * 10 } }, vertexShader: VERT_QUAD, fragmentShader: NOISE + FRAG_NEBULA_BAKE, depthTest: false, depthWrite: false });
      renderer.setRenderTarget(rt);
      renderer.render(quadScene, quadCam);
      renderer.setRenderTarget(null);
      quad.material.dispose();
      return rt.texture;
    }
    const nebulaTex = bakeNebula();
    const nebula = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 32), new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.BackSide, depthWrite: false, fog: false }));
    nebula.rotation.z = 0.35;
    scene.add(nebula);
    const nebula2 = new THREE.Mesh(new THREE.SphereGeometry(170, 48, 32), new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending }));
    nebula2.rotation.set(1.1, 2.3, 0.6);
    scene.add(nebula2);

    /* --- starfield --- */
    const STAR_COUNT = lowTier ? 1400 : 4200;
    const pointScale = { value: 800 };
    {
      const pos = new Float32Array(STAR_COUNT * 3), col = new Float32Array(STAR_COUNT * 3);
      const size = new Float32Array(STAR_COUNT), phase = new Float32Array(STAR_COUNT);
      const c = new THREE.Color();
      for (let i = 0; i < STAR_COUNT; i++) {
        const r = rand(70, 150);
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
        const temp = Math.random();
        if (temp < 0.15) c.setHSL(0.58, 0.9, 0.85);       // blue-white
        else if (temp < 0.3) c.setHSL(0.08, 0.8, 0.8);    // warm
        else if (temp < 0.38) c.setHSL(0.83, 0.9, 0.8);   // violet
        else c.setHSL(0.6, 0.15, 0.95);                     // white
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        const big = Math.random() < 0.06;
        size[i] = big ? rand(1.4, 2.6) : rand(0.35, 1.0);
        phase[i] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
      const mat = new THREE.ShaderMaterial({ uniforms: { uTime: time, uScale: pointScale }, vertexShader: VERT_STARS, fragmentShader: FRAG_STARS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const stars = new THREE.Points(geo, mat);
      scene.add(stars);
    }

    /* --- sun --- */
    const sunMat = new THREE.ShaderMaterial({ defines: { OCT: 3 }, uniforms: { uTime: time }, vertexShader: VERT_WORLD, fragmentShader: NOISE + FRAG_SUN });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(4.2, 40, 40), sunMat);
    sun.position.copy(sunPos);
    scene.add(sun);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
    corona.scale.set(34, 34, 1); corona.position.copy(sunPos); scene.add(corona);
    const corona2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    corona2.scale.set(14, 14, 1); corona2.position.copy(sunPos); scene.add(corona2);

    /* --- planet system --- */
    const PLANET_R = 3;
    const planetGroup = new THREE.Group();
    planetGroup.rotation.z = 0.38;
    scene.add(planetGroup);
    const spin = new THREE.Group();
    planetGroup.add(spin);

    const planetMat = new THREE.ShaderMaterial({ defines, uniforms: { uTime: time, uSunDir: { value: sunDir } }, vertexShader: VERT_WORLD, fragmentShader: NOISE + FRAG_PLANET });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R, lowTier ? 64 : 112, lowTier ? 48 : 84), planetMat);
    planet.renderOrder = 0;
    spin.add(planet);

    const cloudMat = new THREE.ShaderMaterial({ defines: { OCT: lowTier ? 2 : 3 }, uniforms: { uTime: time, uSunDir: { value: sunDir } }, vertexShader: VERT_WORLD, fragmentShader: NOISE + FRAG_CLOUDS, transparent: true, depthWrite: false });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R * 1.022, 72, 54), cloudMat);
    clouds.renderOrder = 1;
    spin.add(clouds);

    const atmoMat = new THREE.ShaderMaterial({ uniforms: { uSunDir: { value: sunDir }, uColor: { value: new THREE.Color(0x4aa8ff) } }, vertexShader: VERT_WORLD, fragmentShader: FRAG_ATMO, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R * 1.09, 64, 48), atmoMat);
    atmo.renderOrder = 3;
    planetGroup.add(atmo);

    const RING_IN = PLANET_R * 1.45, RING_OUT = PLANET_R * 2.45;
    const ringMat = new THREE.ShaderMaterial({ uniforms: { uSunDir: { value: sunDir }, uPlanetR: { value: PLANET_R }, uInner: { value: RING_IN }, uOuter: { value: RING_OUT }, uTime: time }, vertexShader: VERT_RING, fragmentShader: FRAG_RING, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(RING_IN, RING_OUT, 180, 4), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 2;
    planetGroup.add(ring);

    /* --- hole beacons (18 golf flags on the planet) --- */
    const beacons = new Map(); // holeId -> {group, light, glow, flag, state, pulse}
    const beaconRoot = new THREE.Group();
    spin.add(beaconRoot);
    const BEACON_COLORS = { idle: 0x3ec9ff, touched: 0xff9a3c, complete: 0x3dffb0, active: 0xff3ec9 };
    function buildBeacons(count) {
      beaconRoot.clear();
      beacons.clear();
      const poleMat = new THREE.MeshBasicMaterial({ color: 0xdde6ff });
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < count; i++) {
        const y = 1 - (i + 0.5) / count * 2;
        const rr = Math.sqrt(1 - y * y);
        const th = golden * i + 0.7;
        const n = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
        const g = new THREE.Group();
        g.position.copy(n).multiplyScalar(PLANET_R * 0.995);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5), poleMat);
        pole.position.y = 0.17;
        const flagMat = new THREE.MeshBasicMaterial({ color: BEACON_COLORS.idle, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.1), flagMat);
        flag.position.set(0.085, 0.29, 0);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: BEACON_COLORS.idle }));
        light.position.y = 0.35;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: BEACON_COLORS.idle, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
        glow.scale.set(0.42, 0.42, 1); glow.position.y = 0.35;
        g.add(pole, flag, light, glow);
        beaconRoot.add(g);
        beacons.set(i + 1, { group: g, light, glow, flag, state: 'idle', pulse: 0 });
      }
    }
    buildBeacons(18);
    let activeHole = null;

    function beaconWorldPos(holeId, out) {
      const b = beacons.get(holeId) || beacons.get(1 + Math.floor(Math.random() * beacons.size));
      if (!b) return out.set(0, PLANET_R, 0);
      return b.light.getWorldPosition(out);
    }

    /* --- particles (rocket exhaust / explosions) --- */
    const P_MAX = lowTier ? 500 : 1200;
    const pPos = new Float32Array(P_MAX * 3), pCol = new Float32Array(P_MAX * 3), pLife = new Float32Array(P_MAX), pSize = new Float32Array(P_MAX);
    const pVel = new Float32Array(P_MAX * 3), pDecay = new Float32Array(P_MAX);
    let pHead = 0;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
    pGeo.setAttribute('aLife', new THREE.BufferAttribute(pLife, 1));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
    const pMat = new THREE.ShaderMaterial({ uniforms: { uScale: pointScale }, vertexShader: VERT_PARTICLES, fragmentShader: FRAG_PARTICLES, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(pGeo, pMat);
    particles.frustumCulled = false;
    particles.renderOrder = 6;
    scene.add(particles);
    const tmpC = new THREE.Color();
    function emit(pos, vel, color, size, decay) {
      const i = pHead; pHead = (pHead + 1) % P_MAX;
      pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
      pVel[i * 3] = vel.x; pVel[i * 3 + 1] = vel.y; pVel[i * 3 + 2] = vel.z;
      tmpC.set(color);
      pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
      pLife[i] = 1; pSize[i] = size; pDecay[i] = decay;
    }
    function burst(pos, color, n, speed, size) {
      const v = new THREE.Vector3();
      for (let k = 0; k < n; k++) {
        v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.3, speed));
        emit(pos, v, k % 3 === 0 ? 0xffffff : color, size * rand(0.6, 1.4), rand(0.8, 1.8));
      }
    }
    function stepParticles(dt) {
      for (let i = 0; i < P_MAX; i++) {
        if (pLife[i] <= 0) continue;
        pLife[i] -= dt * pDecay[i];
        if (pLife[i] <= 0) { pLife[i] = 0; pPos[i * 3 + 1] = -9999; continue; }
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        pVel[i * 3] *= 0.985; pVel[i * 3 + 1] *= 0.985; pVel[i * 3 + 2] *= 0.985;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.aLife.needsUpdate = true;
      pGeo.attributes.aColor.needsUpdate = true;
      pGeo.attributes.aSize.needsUpdate = true;
    }

    /* --- satellites --- */
    const sats = new Map(); // id -> sat record
    const satMetal = new THREE.MeshStandardMaterial({ color: 0xd2d9ea, metalness: 0.85, roughness: 0.32 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x142a7a, metalness: 0.7, roughness: 0.22, emissive: 0x0a1f6e, emissiveIntensity: 0.55 });
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xeef2fb, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });

    function buildSatModel(color) {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcdd5e6, metalness: 0.85, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.52), bodyMat);
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.03, 0.44), panelMat); p1.position.x = 0.8;
      const p2 = p1.clone(); p2.position.x = -0.8;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6), satMetal); arm.rotation.z = Math.PI / 2;
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.05, 0.14, 20, 1, true), dishMat); dish.rotation.x = Math.PI / 2; dish.position.z = 0.38;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5), satMetal); mast.position.y = 0.34;
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color })); beacon.position.y = 0.53;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
      glow.scale.set(1.5, 1.5, 1);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      halo.visible = false;
      g.add(body, p1, p2, arm, dish, mast, beacon, glow, halo);
      return { g, beacon, glow, halo, bodyMat };
    }

    function makeLabel(name, color, sub) {
      const mat = new THREE.SpriteMaterial({ map: makeLabelTexture(THREE, name, color, sub), transparent: true, depthWrite: false, opacity: 0.95 });
      const s = new THREE.Sprite(mat);
      s.scale.set(3.2, 1.0, 1);
      s.renderOrder = 7;
      return s;
    }

    function orbitRadiusFor(rec) {
      if (rec.dim) return PLANET_R * 3.4;
      return PLANET_R * 1.55 + rec.rank * 0.85;
    }

    function addSat(p, animate) {
      const orbit = new THREE.Group();
      const tilt = new THREE.Euler(rand(-0.9, 0.9), rand(0, Math.PI * 2), rand(-0.5, 0.5));
      orbit.rotation.copy(tilt);
      const model = buildSatModel(p.color);
      const trailMat = new THREE.ShaderMaterial({ uniforms: { uAngle: { value: 0 }, uColor: { value: new THREE.Color(p.color) }, uBase: { value: 0.06 } }, vertexShader: VERT_TRAIL, fragmentShader: FRAG_TRAIL, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const rec = {
        id: p.id, name: p.name, color: p.color, rank: p.rank || 0, dim: !!p.dim, isLeader: !!p.isLeader, sub: p.sub || '',
        orbit, model, trail: null, trailMat, label: null,
        theta: rand(0, Math.PI * 2), speed: rand(0.22, 0.34) * (Math.random() < 0.5 ? 1 : -1),
        radius: 0, targetRadius: 0, scale: animate ? 0.001 : 1, born: time.value, pulse: 0, alive: true,
      };
      rec.targetRadius = orbitRadiusFor(rec);
      rec.radius = animate ? rec.targetRadius * 1.6 : rec.targetRadius;
      rec.trailBase = rec.targetRadius;
      rec.trail = new THREE.Mesh(new THREE.TorusGeometry(rec.trailBase, 0.022, 6, 220), trailMat);
      rec.trail.renderOrder = 4;
      rec.label = makeLabel(p.name, p.color, p.sub);
      orbit.add(rec.trail, model.g);
      scene.add(orbit, rec.label);
      model.halo.visible = rec.isLeader;
      sats.set(p.id, rec);
      if (animate) {
        const from = new THREE.Vector3(), tgt = new THREE.Vector3();
        beaconWorldPos(1 + Math.floor(Math.random() * beacons.size), from);
        rec.scale = 0.05; rec.hidden = true;
        rockets.push(makeRocket(from, () => satWorldPos(rec, tgt), p.color, () => { rec.hidden = false; rec.pulse = 1; burst(satWorldPos(rec, tgt), p.color, 50, 2.4, 0.16); }));
      }
      return rec;
    }

    function fitTrail(rec) {
      // scale the baked torus instead of rebuilding geometry every frame
      const s = rec.radius / rec.trailBase;
      rec.trail.scale.set(s, s, 1);
    }

    function satWorldPos(rec, out) { return rec.model.g.getWorldPosition(out); }

    function removeSat(rec, explode) {
      if (explode) burst(satWorldPos(rec, new THREE.Vector3()), rec.color, 90, 3.4, 0.2);
      scene.remove(rec.orbit, rec.label);
      rec.trail.geometry.dispose(); rec.trailMat.dispose();
      rec.label.material.map.dispose(); rec.label.material.dispose();
      sats.delete(rec.id);
    }

    function updateSatMeta(rec, p) {
      const changedLabel = rec.name !== p.name || rec.sub !== (p.sub || '') || rec.color !== p.color;
      rec.name = p.name; rec.rank = p.rank || 0; rec.dim = !!p.dim; rec.isLeader = !!p.isLeader; rec.sub = p.sub || '';
      if (rec.color !== p.color) { rec.color = p.color; rec.trailMat.uniforms.uColor.value.set(p.color); rec.model.glow.material.color.set(p.color); rec.model.beacon.material.color.set(p.color); rec.model.bodyMat.emissive.set(p.color); }
      rec.targetRadius = orbitRadiusFor(rec);
      rec.model.halo.visible = rec.isLeader;
      if (changedLabel) { rec.label.material.map.dispose(); rec.label.material.map = makeLabelTexture(THREE, rec.name, rec.color, rec.sub); rec.label.material.needsUpdate = true; }
    }

    /* --- rockets --- */
    const rockets = [];
    const noseGeo = new THREE.ConeGeometry(0.075, 0.22, 12);
    const bodyGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.36, 12);
    const finGeo = new THREE.BoxGeometry(0.02, 0.14, 0.12);
    const rocketMatWhite = new THREE.MeshStandardMaterial({ color: 0xf4f6fb, metalness: 0.4, roughness: 0.4 });
    function makeRocket(from, getTarget, color, onArrive) {
      const g = new THREE.Group();
      const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35, emissive: color, emissiveIntensity: 0.4 })); nose.position.y = 0.29;
      const body = new THREE.Mesh(bodyGeo, rocketMatWhite);
      const finMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
      for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(finGeo, finMat); f.position.y = -0.14; f.rotation.y = k * Math.PI * 2 / 3; f.position.x = Math.cos(k * Math.PI * 2 / 3) * 0.08; f.position.z = Math.sin(k * Math.PI * 2 / 3) * 0.08; g.add(f); }
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.position.y = -0.3; flame.scale.set(0.5, 0.5, 1);
      g.add(nose, body, flame);
      scene.add(g);
      return { g, flame, mats: [nose.material, finMat, flame.material], from: from.clone(), getTarget, color, t: 0, dur: 1.55, onArrive, ctrl: new THREE.Vector3(), pos: new THREE.Vector3(), prev: from.clone() };
    }
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
    function stepRockets(dt) {
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.t += dt / r.dur;
        const target = r.getTarget();
        const t = easeInOut(clamp(r.t, 0, 1));
        // quadratic bezier with the control point pushed away from the planet
        _c.copy(r.from).add(target).multiplyScalar(0.5);
        const outward = _a.copy(_c).normalize().multiplyScalar(2.6 + r.from.distanceTo(target) * 0.25);
        r.ctrl.copy(_c).add(outward);
        const mt = 1 - t;
        r.prev.copy(r.pos.lengthSq() ? r.pos : r.from);
        r.pos.set(0, 0, 0)
          .addScaledVector(r.from, mt * mt)
          .addScaledVector(r.ctrl, 2 * mt * t)
          .addScaledVector(target, t * t);
        r.g.position.copy(r.pos);
        _b.copy(r.pos).sub(r.prev);
        if (_b.lengthSq() > 1e-6) r.g.quaternion.setFromUnitVectors(_up, _b.normalize());
        const flick = 0.35 + Math.random() * 0.35;
        r.flame.scale.set(flick, flick * 1.6, 1);
        for (let k = 0; k < (lowTier ? 2 : 4); k++) {
          _a.set(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)).addScaledVector(_b, -1.2);
          emit(r.pos, _a, k === 0 ? 0xffffff : (k === 1 ? 0xffb050 : r.color), rand(0.09, 0.2), rand(1.2, 2.4));
        }
        if (r.t >= 1) {
          burst(target, r.color, 34, 2.0, 0.14);
          scene.remove(r.g);
          r.mats.forEach(m => m.dispose());
          rockets.splice(i, 1);
          if (r.onArrive) r.onArrive();
        }
      }
    }

    /* --- shooting stars --- */
    const streaks = [];
    let nextStreak = 2;
    function spawnStreak() {
      const g = new THREE.Group();
      const n = 7;
      for (let k = 0; k < n; k++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: k === 0 ? 0xffffff : 0x9fdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 - k / n }));
        const sz = (1 - k / n) * 1.2 + 0.2;
        s.scale.set(sz, sz, 1);
        g.add(s);
      }
      const u = rand(-0.6, 0.9), th = rand(0, Math.PI * 2), rr = Math.sqrt(1 - u * u), R = rand(60, 95);
      const pos = new THREE.Vector3(R * rr * Math.cos(th), R * u, R * rr * Math.sin(th));
      const vel = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).cross(pos).normalize().multiplyScalar(rand(45, 80));
      scene.add(g);
      streaks.push({ g, pos, vel, life: rand(0.7, 1.2), age: 0 });
    }
    function stepStreaks(dt) {
      nextStreak -= dt;
      if (nextStreak <= 0) { spawnStreak(); nextStreak = rand(2.5, 7); }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.age += dt;
        s.pos.addScaledVector(s.vel, dt);
        const fade = s.age < 0.15 ? s.age / 0.15 : 1 - Math.max(0, (s.age - s.life * 0.6) / (s.life * 0.4));
        const dir = _a.copy(s.vel).normalize();
        s.g.children.forEach((sp, k) => { sp.position.copy(s.pos).addScaledVector(dir, -k * 0.9); sp.material.opacity = (1 - k / s.g.children.length) * fade; });
        if (s.age > s.life) { s.g.children.forEach(sp => sp.material.dispose()); scene.remove(s.g); streaks.splice(i, 1); }
      }
    }

    /* --- bloom / post --- */
    const useBloom = !lowTier;
    let rtScene, rtA, rtB;
    const thresholdMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.78 }, uSoft: { value: 0.55 } }, vertexShader: VERT_QUAD, fragmentShader: FRAG_THRESHOLD, depthTest: false, depthWrite: false });
    const blurMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VERT_QUAD, fragmentShader: FRAG_BLUR, depthTest: false, depthWrite: false });
    const compositeMat = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null }, uStrength: { value: 1.15 }, uTime: time, uAber: { value: 0.012 } }, vertexShader: VERT_QUAD, fragmentShader: FRAG_COMPOSITE, depthTest: false, depthWrite: false });

    function makeRT(w, h, depth) {
      return new THREE.WebGLRenderTarget(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: depth, stencilBuffer: false });
    }

    /* --- sizing --- */
    let W = 1, H = 1, DPR = 1;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      const budget = lowTier ? 1.25e6 : 2.6e6;
      DPR = clamp(Math.min(window.devicePixelRatio || 1, lowTier ? 1.5 : 2, Math.sqrt(budget / (W * H))), 0.6, 2);
      renderer.setPixelRatio(DPR);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      const bw = Math.floor(W * DPR), bh = Math.floor(H * DPR);
      pointScale.value = bh * 0.95;
      if (useBloom) {
        if (rtScene) { rtScene.dispose(); rtA.dispose(); rtB.dispose(); }
        rtScene = makeRT(bw, bh, true);
        rtA = makeRT(bw / 4, bh / 4, false);
        rtB = makeRT(bw / 4, bh / 4, false);
      }
    }
    resize();
    window.addEventListener('resize', resize);

    /* --- camera controller --- */
    const cam = { angle: 3.6, drag: 0, dragTarget: 0, elev: 0.16, px: 0, py: 0, tx: 0, ty: 0, scroll: 0, dist: 14 };
    let dragging = false, lastX = 0;
    window.addEventListener('pointermove', e => {
      cam.tx = (e.clientX / W - 0.5) * 2;
      cam.ty = (e.clientY / H - 0.5) * 2;
      if (dragging) { cam.dragTarget += (e.clientX - lastX) * 0.006; lastX = e.clientX; }
    }, { passive: true });
    window.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target;
      if (t === canvas || t === document.body || t === document.documentElement || (t.tagName === 'MAIN')) {
        dragging = true; lastX = e.clientX;
        e.preventDefault();               // no text selection while orbiting the camera
        if (window.getSelection) { const s = window.getSelection(); if (s && s.rangeCount) s.removeAllRanges(); }
      }
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('scroll', () => { cam.scroll = window.scrollY; }, { passive: true });
    if (coarse && window.DeviceOrientationEvent && !(typeof DeviceOrientationEvent.requestPermission === 'function')) {
      window.addEventListener('deviceorientation', e => {
        if (e.gamma == null) return;
        cam.tx = clamp(e.gamma / 30, -1, 1);
        cam.ty = clamp((e.beta - 45) / 40, -1, 1);
      }, { passive: true });
    }

    const lookAt = new THREE.Vector3();
    function updateCamera(dt, t) {
      cam.px = lerp(cam.px, cam.tx, 1 - Math.pow(0.001, dt));
      cam.py = lerp(cam.py, cam.ty, 1 - Math.pow(0.001, dt));
      cam.drag = lerp(cam.drag, cam.dragTarget, 1 - Math.pow(0.002, dt));
      const aspect = W / H;
      const wide = aspect > 1.15;
      cam.dist = aspect < 1 ? 15 + (1 - aspect) * 14 : 15.5;
      const a = cam.angle + t * 0.022 + cam.drag + cam.px * 0.25;
      const elev = cam.elev + cam.py * 0.12 + Math.sin(t * 0.09) * 0.05;
      camera.position.set(Math.sin(a) * cam.dist * Math.cos(elev), Math.sin(elev) * cam.dist + 1.0, Math.cos(a) * cam.dist * Math.cos(elev));
      const sy = clamp(cam.scroll * 0.0025, 0, 3);
      lookAt.set(wide ? -2.4 : 0, (wide ? 0.2 : -1.4) - sy, 0);
      camera.position.y -= sy * 0.6;
      camera.lookAt(lookAt);
    }

    /* --- lens flare (DOM elements positioned from the projected sun) --- */
    const flareRoot = document.createElement('div');
    flareRoot.className = 'flare';
    flareRoot.setAttribute('aria-hidden', 'true');
    const FLARES = [
      { k: 1.0, cls: 'flare-sun', size: 240 }, { k: 0.62, cls: 'flare-ghost a', size: 70 }, { k: 0.35, cls: 'flare-ghost b', size: 34 },
      { k: -0.18, cls: 'flare-ghost c', size: 90 }, { k: -0.55, cls: 'flare-ghost d', size: 46 }, { k: -0.95, cls: 'flare-ghost e', size: 140 },
    ].map(f => { const d = document.createElement('div'); d.className = f.cls; d.style.width = d.style.height = f.size + 'px'; flareRoot.appendChild(d); return { ...f, el: d }; });
    document.body.appendChild(flareRoot);
    const _proj = new THREE.Vector3(), _toSun = new THREE.Vector3(), _toPlanet = new THREE.Vector3();
    function updateFlare() {
      _proj.copy(sunPos).project(camera);
      let vis = 1;
      if (_proj.z > 1 || Math.abs(_proj.x) > 1.25 || Math.abs(_proj.y) > 1.25) vis = 0;
      else {
        _toSun.copy(sunPos).sub(camera.position).normalize();
        _toPlanet.copy(planetGroup.position).sub(camera.position);
        const dist = _toPlanet.length(); _toPlanet.normalize();
        const angR = Math.asin(Math.min(1, PLANET_R * 1.05 / dist));
        const ang = Math.acos(clamp(_toSun.dot(_toPlanet), -1, 1));
        vis *= clamp((ang - angR) / 0.08, 0, 1);
        vis *= 1 - clamp((Math.max(Math.abs(_proj.x), Math.abs(_proj.y)) - 0.85) / 0.4, 0, 1);
      }
      flareRoot.style.opacity = (vis * 0.9).toFixed(3);
      if (vis <= 0) return;
      const sx = (_proj.x * 0.5 + 0.5) * W, sy = (-_proj.y * 0.5 + 0.5) * H;
      const cx = W / 2, cy = H / 2;
      for (const f of FLARES) {
        const x = cx + (sx - cx) * f.k, y = cy + (sy - cy) * f.k;
        f.el.style.transform = `translate(${(x - f.size / 2).toFixed(1)}px, ${(y - f.size / 2).toFixed(1)}px)`;
      }
    }

    /* --- public API implementation --- */
    const _p = new THREE.Vector3();
    API.setPlayers = function (list, opts) {
      const animate = !(opts && opts.animate === false);
      const seen = new Set();
      list.forEach(p => {
        seen.add(p.id);
        const rec = sats.get(p.id);
        if (rec) updateSatMeta(rec, p); else addSat(p, animate);
      });
      for (const [id, rec] of sats) if (!seen.has(id)) removeSat(rec, animate);
    };
    API.launch = function ({ playerId, holeId, dir }) {
      const rec = sats.get(playerId);
      if (!rec) return;
      const from = new THREE.Vector3();
      if (dir >= 0) {
        beaconWorldPos(holeId, from);
        rockets.push(makeRocket(from, () => satWorldPos(rec, _p), rec.color, () => { rec.pulse = 1; }));
      } else {
        satWorldPos(rec, from);
        rockets.push(makeRocket(from, () => beaconWorldPos(holeId, _p), rec.color, () => { const b = beacons.get(holeId); if (b) b.pulse = 1; }));
        rec.pulse = 0.6;
      }
      const b = beacons.get(holeId); if (b) b.pulse = 1;
    };
    API.pulse = function (playerId) { const rec = sats.get(playerId); if (rec) rec.pulse = 1; };
    API.explode = function (playerId) { const rec = sats.get(playerId); if (rec) burst(satWorldPos(rec, _p), rec.color, 60, 3, 0.18); };
    API.setHoles = function (list) {
      if (list.length && list.length !== beacons.size) buildBeacons(list.length);
      list.forEach(h => {
        const b = beacons.get(h.id); if (!b) return;
        const st = h.state || 'idle';
        if (b.state !== st) {
          b.state = st;
          const c = BEACON_COLORS[st] || BEACON_COLORS.idle;
          b.light.material.color.set(c); b.glow.material.color.set(c); b.flag.material.color.set(c);
        }
      });
    };
    API.setActiveHole = function (id) {
      // beacon colours are pushed by hud.js through setHoles(); here we only track + pulse
      activeHole = id;
      const b = beacons.get(id); if (b) b.pulse = 1.5;
    };
    let enabled = true;
    API.setEnabled = function (on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on;
      canvas.style.display = enabled ? '' : 'none';
      flareRoot.style.display = enabled ? '' : 'none';
      cancelAnimationFrame(raf);
      if (enabled) { clock.getDelta(); if (reduceMotion) frame(0.016); else loop(); }
      API.mode = enabled ? 'webgl' : 'off';
    };

    /* --- main loop --- */
    let raf = 0, firstFrame = true;
    const _sv = new THREE.Vector3();
    function frame(dt) {
      time.value += dt;
      const t = time.value;
      spin.rotation.y += dt * 0.045;
      clouds.rotation.y += dt * 0.012;
      nebula2.rotation.y += dt * 0.0035;
      nebula.rotation.y -= dt * 0.0012;
      sun.rotation.y += dt * 0.05;

      for (const [, rec] of sats) {
        rec.theta += dt * rec.speed;
        const targetR = rec.targetRadius;
        if (Math.abs(rec.radius - targetR) > 0.005) {
          rec.radius = lerp(rec.radius, targetR, 1 - Math.pow(0.15, dt));
          fitTrail(rec);
        }
        const shown = !rec.hidden;
        rec.model.g.visible = shown; rec.label.visible = shown; rec.trail.visible = shown;
        rec.model.g.position.set(Math.cos(rec.theta) * rec.radius, Math.sin(rec.theta) * rec.radius, 0);
        rec.model.g.lookAt(planetGroup.position);
        rec.trailMat.uniforms.uAngle.value = rec.theta;
        rec.trailMat.uniforms.uBase.value = rec.dim ? 0.03 : 0.07;
        rec.pulse = Math.max(0, rec.pulse - dt * 1.4);
        const sc = (rec.dim ? 0.75 : 1) * (rec.scale < 1 ? (rec.scale = Math.min(1, rec.scale + dt * 1.5)) : 1) * (1 + rec.pulse * 0.6);
        rec.model.g.scale.setScalar(sc);
        rec.model.glow.material.opacity = (rec.dim ? 0.35 : 0.8) + rec.pulse * 0.6 + Math.sin(t * 5 + rec.theta) * 0.05;
        rec.model.beacon.material.color.set(Math.sin(t * 6 + rec.theta * 3) > 0.6 ? 0xffffff : rec.color);
        rec.model.halo.rotation.x = t * 1.3; rec.model.halo.rotation.y = t * 0.9;
        satWorldPos(rec, _sv);
        rec.label.position.copy(_sv).add(_a.set(0, 0.95, 0));
        rec.label.material.opacity = rec.dim ? 0.55 : 0.95;
        rec.label.scale.set(3.2 * sc, 1.0 * sc, 1);
      }
      for (const [hid, b] of beacons) {
        b.pulse = Math.max(0, b.pulse - dt * 0.9);
        const base = hid === activeHole ? 0.7 + Math.sin(t * 6) * 0.25 : 0.42;
        const s = base + b.pulse * 0.9;
        b.glow.scale.set(s, s, 1);
        b.glow.material.opacity = (hid === activeHole ? 1 : 0.8) + b.pulse;
      }
      stepRockets(dt);
      stepParticles(dt);
      stepStreaks(dt);
      updateCamera(dt, t);
      updateFlare();

      if (useBloom && rtScene) {
        renderer.setRenderTarget(rtScene);
        renderer.render(scene, camera);
        quad.material = thresholdMat; thresholdMat.uniforms.tDiffuse.value = rtScene.texture;
        renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
        quad.material = blurMat;
        for (let k = 0; k < 2; k++) {
          blurMat.uniforms.tDiffuse.value = rtA.texture; blurMat.uniforms.uDir.value.set(1 / rtA.width, 0);
          renderer.setRenderTarget(rtB); renderer.render(quadScene, quadCam);
          blurMat.uniforms.tDiffuse.value = rtB.texture; blurMat.uniforms.uDir.value.set(0, 1 / rtA.height);
          renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
        }
        quad.material = compositeMat; compositeMat.uniforms.tScene.value = rtScene.texture; compositeMat.uniforms.tBloom.value = rtA.texture;
        renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
      } else {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }

      if (firstFrame) { firstFrame = false; API.mode = 'webgl'; API.emit('ready', { mode: 'webgl', quality: API.quality }); }
    }

    function loop() {
      if (!enabled) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      frame(dt);
      if (reduceMotion) { cancelAnimationFrame(raf); }
    }
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); }, false);
    canvas.addEventListener('webglcontextrestored', () => { loop(); }, false);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { for (const [, rec] of sats) { rec.label.material.map.dispose(); rec.label.material.map = makeLabelTexture(THREE, rec.name, rec.color, rec.sub); rec.label.material.needsUpdate = true; } });
    }
    if (reduceMotion) {
      frame(0.016);
      window.addEventListener('resize', () => frame(0.016));
      ['setPlayers', 'setHoles', 'setActiveHole'].forEach(k => { const f = API[k]; API[k] = (...a) => { f(...a); if (enabled) frame(0.016); }; });
    }
    else loop();
  }

  /* ======================================================================
     2D FALLBACK (no THREE / no WebGL)
     ====================================================================== */
  function boot2D() {
    let canvas2 = canvas;
    let ctx = canvas2.getContext('2d');
    if (!ctx) {
      // a WebGL context may already own the element → swap in a fresh canvas
      canvas2 = canvas.cloneNode(false);
      canvas.replaceWith(canvas2);
      ctx = canvas2.getContext('2d');
    }
    if (!ctx) { API.mode = 'off'; API.emit('ready', { mode: 'off' }); return; }
    let W = 0, H = 0, DPR = 1, t = 0, last = performance.now();
    const stars = Array.from({ length: 420 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), p: Math.random() * 6 }));
    const sats = new Map();
    const rockets = [];
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    function resize() { W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 1.5); canvas2.width = W * DPR; canvas2.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
    resize(); window.addEventListener('resize', resize);
    window.addEventListener('pointermove', e => { pointer.tx = e.clientX / W - 0.5; pointer.ty = e.clientY / H - 0.5; }, { passive: true });
    API.setPlayers = list => {
      const seen = new Set();
      list.forEach((p, i) => { seen.add(p.id); const r = sats.get(p.id) || { theta: Math.random() * 6.28, speed: rand(0.3, 0.5) * (i % 2 ? 1 : -1), pulse: 0 }; Object.assign(r, p); sats.set(p.id, r); });
      for (const id of [...sats.keys()]) if (!seen.has(id)) sats.delete(id);
    };
    API.launch = ({ playerId, dir }) => { const r = sats.get(playerId); if (r) { r.pulse = 1; rockets.push({ id: playerId, t: 0, dir }); } };
    API.pulse = id => { const r = sats.get(id); if (r) r.pulse = 1; };
    API.setEnabled = on => { canvas2.style.display = on ? '' : 'none'; };
    function satPos(r) {
      const cx = W * (W > H * 1.15 ? 0.66 : 0.5), cy = H * (W > H * 1.15 ? 0.5 : 0.36);
      const R = Math.min(W, H) * (0.22 + (r.dim ? 0.3 : (r.rank || 0) * 0.06));
      return { x: cx + Math.cos(r.theta) * R, y: cy + Math.sin(r.theta) * R * 0.45 };
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#07041a'); g.addColorStop(0.5, '#120a2e'); g.addColorStop(1, '#030210');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * (1 + s.z) + s.p);
        const x = (s.x + pointer.x * 0.02 * s.z + 1) % 1 * W, y = (s.y + pointer.y * 0.02 * s.z + 1) % 1 * H;
        ctx.fillStyle = `rgba(220,235,255,${(0.35 + 0.65 * tw) * s.z})`;
        ctx.fillRect(x, y, 1.2 + s.z * 1.5, 1.2 + s.z * 1.5);
      }
      const cx = W * (W > H * 1.15 ? 0.66 : 0.5), cy = H * (W > H * 1.15 ? 0.5 : 0.36), R = Math.min(W, H) * 0.16;
      const pg = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx, cy, R * 1.6);
      pg.addColorStop(0, 'rgba(120,200,255,0.9)'); pg.addColorStop(0.4, 'rgba(60,40,160,0.9)'); pg.addColorStop(0.75, 'rgba(10,6,40,1)'); pg.addColorStop(1, 'rgba(40,120,255,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(180,140,255,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, cy, R * 2.1, R * 0.5, -0.2, 0, 6.283); ctx.stroke();
      for (const [, r] of sats) {
        r.theta += dt * r.speed; r.pulse = Math.max(0, r.pulse - dt);
        const p = satPos(r);
        ctx.strokeStyle = r.color; ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
        const Rr = Math.min(W, H) * (0.22 + (r.dim ? 0.3 : (r.rank || 0) * 0.06));
        ctx.beginPath(); ctx.ellipse(cx, cy, Rr, Rr * 0.45, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.shadowColor = r.color; ctx.shadowBlur = 18 + r.pulse * 30; ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 + r.pulse * 6, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = '700 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(r.name).toUpperCase(), p.x, p.y - 12);
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const rk = rockets[i]; rk.t += dt / 1.2; const r = sats.get(rk.id); if (!r || rk.t > 1) { rockets.splice(i, 1); continue; }
        const p = satPos(r); const k = rk.dir >= 0 ? rk.t : 1 - rk.t;
        const x = cx + (p.x - cx) * k, y = cy + (p.y - cy) * k - Math.sin(k * Math.PI) * 60;
        ctx.fillStyle = '#ffd27a'; ctx.shadowColor = '#ffa040'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      }
      requestAnimationFrame(frame);
    }
    API.mode = '2d';
    requestAnimationFrame(frame);
    API.emit('ready', { mode: '2d', quality: 'fallback' });
  }

  /* ----------------------------------------------------------------------
     Boot (placed last so every const above is initialised even when THREE
     is already present and the callback runs synchronously)
     ---------------------------------------------------------------------- */
  whenThreeReady(
    () => { try { bootWebGL(); } catch (e) { console.error('[cosmos] WebGL boot failed, using 2D fallback', e); boot2D(); } },
    () => { console.warn('[cosmos] THREE unavailable, using 2D fallback'); boot2D(); }
  );
})();
