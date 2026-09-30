import * as THREE from "three";

// ---------------------------------------------------------------------------
// Graphics presets for the racer. Everything visual that costs GPU/CPU time is
// gated by one of these, so "High FPS" stays lean and "Better Quality" can
// spend the headroom. The menu stores the chosen key in localStorage.
// ---------------------------------------------------------------------------

export const GFX_KEYS = ["fast", "balanced", "quality"];
const STORAGE_KEY = "ninuRacingGfx";

export const GFX_LABELS = {
  fast: { title: "HIGH FPS", desc: "Smoothest" },
  balanced: { title: "BALANCED", desc: "Looks + speed" },
  quality: { title: "BETTER QUALITY", desc: "Best visuals" },
};

// `touch` picks the lighter column on phones/tablets.
const TABLE = {
  fast: {
    pixelRatio: { desktop: 1, touch: 0.8 },
    antialias: false,
    shadows: { desktop: 1024, touch: 0 },
    shadowRadius: 55,
    treeShadows: false,
    decorScale: { desktop: 0.75, touch: 0.4 },
    exposure: 1.0,
    env: 0, envSize: 0, envIntensity: 0,
    hemi: 1.5, sun: 2.0,
    roadTex: 256, roadRough: 0.9, anisotropy: 2,
    stars: 350, moon: true, farMountains: 0,
    lampGlow: true, carGlow: true, underglow: false, headBeams: false, edgeGlow: false,
    smoke: 48, sparks: 40,
    speedStreaks: 0, shake: 0.5, fovBoost: 10, vignette: true,
    windSway: false, treeVariety: 1,
  },
  balanced: {
    pixelRatio: { desktop: 1.5, touch: 1 },
    antialias: true,
    shadows: { desktop: 2048, touch: 0 },
    shadowRadius: 75,
    treeShadows: false,
    decorScale: { desktop: 1, touch: 0.55 },
    exposure: 1.05,
    env: 1, envSize: 128, envIntensity: 0.55,
    hemi: 1.0, sun: 2.0,
    roadTex: 512, roadRough: 0.72, anisotropy: 4,
    stars: 700, moon: true, farMountains: 22,
    lampGlow: true, carGlow: true, underglow: true, headBeams: true, edgeGlow: true,
    smoke: 140, sparks: 90,
    speedStreaks: 44, shake: 1, fovBoost: 14, vignette: true,
    windSway: true, treeVariety: 2,
  },
  quality: {
    pixelRatio: { desktop: 2, touch: 1.5 },
    antialias: true,
    shadows: { desktop: 4096, touch: 1024 },
    shadowRadius: 95,
    treeShadows: true,
    decorScale: { desktop: 1.3, touch: 0.7 },
    exposure: 1.1,
    env: 1, envSize: 256, envIntensity: 0.8,
    hemi: 0.85, sun: 2.0,
    roadTex: 1024, roadRough: 0.58, anisotropy: 8,
    stars: 1400, moon: true, farMountains: 34,
    lampGlow: true, carGlow: true, underglow: true, headBeams: true, edgeGlow: true,
    smoke: 300, sparks: 160,
    speedStreaks: 90, shake: 1.2, fovBoost: 18, vignette: true,
    windSway: true, treeVariety: 3,
  },
};

export function getSavedGfx(touch) {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (GFX_KEYS.includes(v)) return v;
  } catch { /* storage blocked - fall through */ }
  return touch ? "fast" : "balanced";
}
export function saveGfx(key) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
}

// Resolve a preset key into the concrete numbers for this device. The result is
// also used as the `quality` object that Track/WorldBuilder already accept
// (shadows / shadowMapSize / decorScale) plus a `gfx` block with the rest.
export function resolveQuality(key, touch) {
  const p = TABLE[key] || TABLE.balanced;
  const col = touch ? "touch" : "desktop";
  const shadowMapSize = p.shadows[col];
  return {
    key,
    touch,
    shadows: shadowMapSize > 0,
    shadowMapSize: shadowMapSize || 1024,
    decorScale: p.decorScale[col],
    gfx: { ...p, pixelRatioMax: p.pixelRatio[col] },
  };
}

// Colors shared by the sky, fog and env map so the horizon matches the fog.
export const HORIZON = 0x0a1428;
export const FOG_DENSITY = 0.00145;

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

// Soft radial glow sprite texture (white center -> transparent edge).
export function makeGlowTexture(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,.55)");
  grad.addColorStop(0.6, "rgba(255,255,255,.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cheap hash noise for texture generation (much faster than sin-based noise).
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Asphalt: grain + darker tire-wear lanes + cracks + patches. Also returns a
// roughness map (green channel) with smooth "wet" patches that catch the
// environment reflections. One tile covers ~36m x 36m of road.
export function makeRoadTextures(size, anisotropy) {
  const color = document.createElement("canvas");
  color.width = color.height = size;
  const cg = color.getContext("2d");
  const cImg = cg.createImageData(size, size);
  const rough = document.createElement("canvas");
  rough.width = rough.height = size;
  const rg = rough.getContext("2d");
  const rImg = rg.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size; // 0..1 across the road
      const fine = hash(x, y, 7);
      const mid = vnoise(x / 6, y / 6, 3);
      const big = vnoise(x / 40, y / 40, 11);
      let v = 0.5 + (fine - 0.5) * 0.16 + (mid - 0.5) * 0.14 + (big - 0.5) * 0.2;
      // Tire-wear lanes: slightly darker/smoother bands on each side of center.
      const lane = Math.exp(-Math.pow((u - 0.3) / 0.06, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.06, 2));
      v -= lane * 0.07;
      const i = (y * size + x) * 4;
      const base = Math.max(0, Math.min(255, Math.floor(v * 255)));
      cImg.data[i] = base * 0.96;
      cImg.data[i + 1] = base;
      cImg.data[i + 2] = base * 1.06;
      cImg.data[i + 3] = 255;

      // Roughness: mostly rough, smooth patches where "wet"; lanes a bit glossier.
      const wet = vnoise(x / 55, y / 55, 19);
      const patch = Math.max(0, Math.min(1, (wet - 0.42) * 2.4));
      const r = 1 - patch * 0.4 - lane * 0.12 - (fine - 0.5) * 0.12;
      const rv = Math.max(0, Math.min(255, Math.floor(r * 255)));
      rImg.data[i] = rv; rImg.data[i + 1] = rv; rImg.data[i + 2] = rv; rImg.data[i + 3] = 255;
    }
  }
  cg.putImageData(cImg, 0, 0);
  rg.putImageData(rImg, 0, 0);

  // Hairline cracks + a few dark patch rectangles, drawn on top.
  cg.lineCap = "round";
  for (let k = 0; k < 10; k += 1) {
    let x = hash(k, 1, 5) * size, y = hash(k, 2, 5) * size;
    cg.strokeStyle = "rgba(10,12,16,.55)";
    cg.lineWidth = Math.max(1, size / 512);
    cg.beginPath(); cg.moveTo(x, y);
    for (let s = 0; s < 7; s += 1) {
      x += (hash(k, s + 3, 9) - 0.5) * size * 0.12;
      y += hash(k, s + 4, 9) * size * 0.09;
      cg.lineTo(x, y);
    }
    cg.stroke();
  }
  for (let k = 0; k < 4; k += 1) {
    cg.fillStyle = "rgba(0,0,0,.14)";
    cg.fillRect(hash(k, 8, 2) * size * 0.8, hash(k, 9, 2) * size * 0.8, size * (0.08 + hash(k, 3, 2) * 0.1), size * (0.05 + hash(k, 4, 2) * 0.12));
  }

  const colorTex = new THREE.CanvasTexture(color);
  const roughTex = new THREE.CanvasTexture(rough);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  for (const t of [colorTex, roughTex]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
  }
  return { colorTex, roughTex };
}

// Dashed center-line texture (alpha cutout, so no blending cost).
export function makeDashTexture() {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 64;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 16, 64);
  g.fillStyle = "#fff";
  g.fillRect(0, 4, 16, 34); // dash ~53% of the period, worn edges below
  g.fillStyle = "rgba(255,255,255,.5)";
  g.fillRect(0, 38, 16, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Gradient across the ribbon (bright center -> transparent edge).
export function makeEdgeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 4;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Sky dome (gradient + horizon glow). Shared by the scene and the env map.
// ---------------------------------------------------------------------------

function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x02040b) },
      mid: { value: new THREE.Color(0x0a1530) },
      horizon: { value: new THREE.Color(HORIZON) },
      glowA: { value: new THREE.Color(0x3a1f6e) }, // purple
      glowB: { value: new THREE.Color(0x0e5a78) }, // teal
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glowA; uniform vec3 glowB;
      varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.35, h));
        col = mix(col, zenith, smoothstep(0.3, 1.0, h));
        // neon horizon glow: purple on one side, teal on the other
        float band = exp(-pow((h - 0.03) / 0.11, 2.0));
        float side = 0.5 + 0.5 * sin(atan(vDir.x, vDir.z) * 1.0 + 0.6);
        col += mix(glowB, glowA, side) * band * 0.9;
        // below the horizon settles back to the fog color
        col = mix(col, horizon, smoothstep(0.0, -0.2, vDir.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------
// Particle pool (smoke = normal blend, sparks = additive) - one draw call each.
// ---------------------------------------------------------------------------

class ParticlePool {
  constructor(max, additive, sizeScaleRef) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); // seconds left
    this.maxLife = new Float32Array(max).fill(1);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.colors = new Float32Array(max * 3);
    this.aSize = new Float32Array(max);
    this.aAlpha = new Float32Array(max);
    this.additive = additive;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: sizeScaleRef },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        uniform float uScale; varying float vA; varying vec3 vC;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          vA = aAlpha; vC = aColor;
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, d) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC, a);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }
  spawn(x, y, z, vx, vy, vz, life, size, grow, r, g, b) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size0[i] = size; this.grow[i] = grow;
    this.colors[i * 3] = r; this.colors[i * 3 + 1] = g; this.colors[i * 3 + 2] = b;
  }
  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.max; i += 1) {
      if (this.life[i] <= 0) {
        if (this.aAlpha[i] !== 0) { this.aAlpha[i] = 0; dirty = true; }
        continue;
      }
      dirty = true;
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i]; // 0 -> 1
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.additive) this.vel[i * 3 + 1] -= 18 * dt; // sparks fall
      this.aSize[i] = this.size0[i] + this.grow[i] * t;
      this.aAlpha[i] = this.additive ? (1 - t) : Math.min(1, t * 6) * (1 - t) * 0.5;
    }
    if (dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Main controller: one per race. Owns sky, env map, shadow follow, glow,
// particles, camera FX. Call update() every frame, dispose() on teardown.
// ---------------------------------------------------------------------------

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

export class GraphicsFX {
  constructor(renderer, scene, camera, quality, hud = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.q = quality;
    this.g = quality.gfx;
    this.hud = hud; // { vignette: HTMLElement }
    this.time = 0;
    this.timeUniform = quality.timeUniform || { value: 0 };
    this.scaleUniform = { value: 300 };
    this.baseFov = camera.fov;
    this.fov = camera.fov;
    this.shake = new THREE.Vector3();
    this.cars = [];
    this.disposables = [];
    this.sunDir = new THREE.Vector3(260, 420, 180).normalize();
    this.sun = null;

    this.applyRenderer();
    this.buildSky();
    if (this.g.env) this.buildEnvironment();
    if (this.g.speedStreaks) this.buildStreaks();
    this.smoke = new ParticlePool(this.g.smoke, false, this.scaleUniform);
    this.sparks = new ParticlePool(this.g.sparks, true, this.scaleUniform);
    scene.add(this.smoke.points, this.sparks.points);
    scene.add(camera); // needed so camera-attached streaks render
    this.resize();
  }

  applyRenderer() {
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.g.exposure;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.FogExp2(HORIZON, FOG_DENSITY);
    this.scene.background = new THREE.Color(HORIZON);
  }

  resize() {
    const h = this.renderer.domElement.height || 600;
    this.scaleUniform.value = h * 0.5;
  }

  buildSky() {
    const g = this.g;
    this.sky = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), makeSkyMaterial());
    dome.frustumCulled = false;
    dome.renderOrder = -1000;
    this.sky.add(dome);
    this.disposables.push(dome.geometry, dome.material);

    // Stars (fog off so they stay crisp at distance).
    const n = g.stars;
    const sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const el = Math.asin(Math.random() * 0.92 + 0.04);
      const r = 860;
      sp[i * 3] = Math.cos(a) * Math.cos(el) * r;
      sp[i * 3 + 1] = Math.sin(el) * r;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({
      color: 0xdfeeff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    stars.frustumCulled = false;
    stars.renderOrder = -999;
    this.sky.add(stars);
    this.disposables.push(sgeo, stars.material);

    if (g.moon) {
      const glowTex = makeGlowTexture(128);
      this.disposables.push(glowTex);
      const dir = this.sunDir.clone().multiplyScalar(820);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x8fb4ff, transparent: true, opacity: 0.55, fog: false, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      halo.scale.set(420, 420, 1); halo.position.copy(dir); halo.renderOrder = -998;
      const disc = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xf2f7ff, transparent: true, opacity: 1, fog: false, depthWrite: false, toneMapped: false,
      }));
      disc.scale.set(70, 70, 1); disc.position.copy(dir); disc.renderOrder = -997;
      this.sky.add(halo, disc);
      this.disposables.push(halo.material, disc.material);
    }
    this.scene.add(this.sky);
  }

  // One-time PMREM environment built from the same sky + a few neon panels, so
  // car paint, tower glass and wet road patches reflect a believable night sky.
  buildEnvironment() {
    const g = this.g;
    const envScene = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), makeSkyMaterial());
    envScene.add(dome);
    const panel = (hex, mult, x, y, z, w, h) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(mult), side: THREE.DoubleSide, toneMapped: false }),
      );
      m.position.set(x, y, z); m.lookAt(0, 0, 0);
      envScene.add(m);
      return m;
    };
    const sd = this.sunDir;
    panel(0xdfe9ff, 9, sd.x * 40, sd.y * 40, sd.z * 40, 9, 9);   // moon
    panel(0x19d3ff, 5, -38, 12, 10, 30, 3);                       // cyan strip
    panel(0xff2e9c, 5, 34, 10, -18, 26, 3);                       // pink strip
    panel(0x7a4dff, 2.5, 4, 8, -42, 40, 5);                       // violet horizon band
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 200, { size: g.envSize });
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = g.envIntensity;
    this.envTarget = rt;
    pmrem.dispose();
    envScene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }

  // Tight, car-following shadow camera (the old one kept the default +-5 unit
  // box at the origin, so shadows were effectively missing in the race).
  setupSun(sun) {
    if (!this.q.shadows) return;
    this.sun = sun;
    const R = this.g.shadowRadius;
    const cam = sun.shadow.camera;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.near = 10; cam.far = 950;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.5;
    this.shadowDist = 450;
    this.texel = (2 * R) / this.q.shadowMapSize;
    // fixed light-space basis so we can snap to whole texels (no shimmering)
    this.lz = this.sunDir.clone();
    this.lx = new THREE.Vector3(0, 1, 0).cross(this.lz).normalize();
    this.ly = new THREE.Vector3().crossVectors(this.lz, this.lx);
    this.scene.add(sun.target);
  }

  buildStreaks() {
    const n = this.g.speedStreaks;
    this.streakN = n;
    this.streakData = [];
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const rad = 5 + Math.random() * 14;
      this.streakData.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.6 - 1, z: -6 - Math.random() * 46 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.streakMat = new THREE.LineBasicMaterial({
      color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, toneMapped: false,
    });
    this.streaks = new THREE.LineSegments(geo, this.streakMat);
    this.streaks.frustumCulled = false;
    this.streaks.renderOrder = 7;
    this.camera.add(this.streaks);
    this.disposables.push(geo, this.streakMat);
  }

  // Register a car mesh so it gets its lights/glow/smoke each frame.
  // `physics` exposes speed / lateralSlip / vel.
  addCar(mesh, physics, isPlayer = false) {
    this.cars.push({ mesh, physics, isPlayer, emit: 0 });
  }

  // Burst of sparks at a world position (collisions).
  burst(x, y, z, strength = 1) {
    const n = Math.min(14, Math.round(8 * strength));
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 9 * strength;
      this.sparks.spawn(x, y + 0.6, z, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s,
        0.35 + Math.random() * 0.35, 0.5, 0.2, 1, 0.75 + Math.random() * 0.2, 0.3);
    }
  }

  update(dt, player, input) {
    this.time += dt;
    this.timeUniform.value = this.time;

    // Sky follows the camera so it never parallaxes.
    this.sky.position.copy(this.camera.position);

    // ---- shadow follow ----
    if (this.sun && player) {
      const t = tmpV.copy(player.mesh.position);
      const tx = Math.round(t.dot(this.lx) / this.texel) * this.texel;
      const ty = Math.round(t.dot(this.ly) / this.texel) * this.texel;
      const tz = t.dot(this.lz);
      t.set(0, 0, 0).addScaledVector(this.lx, tx).addScaledVector(this.ly, ty).addScaledVector(this.lz, tz);
      this.sun.target.position.copy(t);
      this.sun.position.copy(t).addScaledVector(this.lz, this.shadowDist);
      this.sun.target.updateMatrixWorld();
    }

    // ---- car lights / glow / particles ----
    for (const c of this.cars) {
      const fx = c.mesh.userData.fx;
      const ph = c.physics;
      const speed = ph.speed || 0;
      const slip = Math.abs(ph.lateralSlip || 0);
      const braking = !!ph.braking;
      if (fx) {
        const target = braking ? 1 : 0;
        fx.brake += (target - fx.brake) * Math.min(1, dt * 14);
        fx.tailMat.color.setRGB(1, 0.17, 0.17).multiplyScalar(1 + fx.brake * 2.2);
        if (fx.tailGlow) {
          fx.tailGlow.material.opacity = 0.35 + fx.brake * 0.6;
          fx.tailGlow.material.size = 2.4 + fx.brake * 2.6;
        }
      }
      // smoke while sliding / handbrake / hard braking at speed, sparks off-road grind skipped
      const sliding = slip > 4.5 && Math.abs(speed) > 9;
      const handbrake = c.isPlayer && input?.handbrake && Math.abs(speed) > 12;
      if (sliding || handbrake) {
        c.emit += dt * (60 + Math.min(60, slip * 6));
        while (c.emit >= 1) {
          c.emit -= 1;
          const side = Math.random() < 0.5 ? -0.97 : 0.97;
          tmpV2.set(side, 0.3, -1.4);
          c.mesh.localToWorld(tmpV2);
          const vx = (ph.vel?.x || 0) * 0.15 + (Math.random() - 0.5) * 1.5;
          const vz = (ph.vel?.z || 0) * 0.15 + (Math.random() - 0.5) * 1.5;
          this.smoke.spawn(tmpV2.x, tmpV2.y, tmpV2.z, vx, 0.8 + Math.random() * 0.8, vz,
            0.9 + Math.random() * 0.5, 1.6, 4.5, 0.62, 0.66, 0.72);
        }
        if (slip > 9 && Math.random() < dt * 14) {
          tmpV2.set(Math.random() < 0.5 ? -0.97 : 0.97, 0.25, -1.4);
          c.mesh.localToWorld(tmpV2);
          this.sparks.spawn(tmpV2.x, tmpV2.y, tmpV2.z, (Math.random() - 0.5) * 4, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 4,
            0.3, 0.4, 0.1, 1, 0.65, 0.25);
        }
      } else c.emit = 0;
    }
    this.smoke.update(dt);
    this.sparks.update(dt);

    // ---- camera: speed-based FOV, shake, streaks, vignette ----
    const speed = Math.max(0, player?.speed || 0);
    const sf = THREE.MathUtils.clamp((speed - 20) / 55, 0, 1);
    const fovTarget = this.baseFov + this.g.fovBoost * sf;
    this.fov += (fovTarget - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.streaks) {
      const len = 1.5 + sf * 9;
      const arr = this.streaks.geometry.attributes.position.array;
      const mv = speed * dt * 1.15;
      for (let i = 0; i < this.streakN; i += 1) {
        const s = this.streakData[i];
        s.z += mv;
        if (s.z > -3) {
          s.z = -50;
          const a = Math.random() * Math.PI * 2, rad = 5 + Math.random() * 14;
          s.x = Math.cos(a) * rad; s.y = Math.sin(a) * rad * 0.6 - 1;
        }
        arr[i * 6] = s.x; arr[i * 6 + 1] = s.y; arr[i * 6 + 2] = s.z;
        arr[i * 6 + 3] = s.x; arr[i * 6 + 4] = s.y; arr[i * 6 + 5] = s.z - len;
      }
      this.streaks.geometry.attributes.position.needsUpdate = true;
      this.streakMat.opacity = sf * 0.5;
      this.streaks.visible = sf > 0.02;
    }
    if (this.hud.vignette) {
      this._vigT = (this._vigT || 0) + dt;
      if (this._vigT > 0.05) { this._vigT = 0; this.hud.vignette.style.opacity = String(0.15 + sf * 0.75); }
    }
  }

  // Shake is applied around the ChaseCamera's own update so its smoothing
  // never integrates the shake offset (it would drift otherwise).
  beforeCamera() { this.camera.position.sub(this.shake); }
  afterCamera(player) {
    const speed = Math.max(0, player?.speed || 0);
    const sf = THREE.MathUtils.clamp((speed - 35) / 45, 0, 1);
    const amp = 0.06 * sf * this.g.shake;
    this.shake.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    this.camera.position.add(this.shake);
  }

  dispose() {
    for (const d of this.disposables) d?.dispose?.();
    this.smoke.geo.dispose(); this.smoke.mat.dispose();
    this.sparks.geo.dispose(); this.sparks.mat.dispose();
    this.envTarget?.dispose?.();
    if (this.streaks) this.camera.remove(this.streaks);
    this.scene.environment = null;
  }
}
