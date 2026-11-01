/**
 * Clouds and birds over the 3D map.
 *
 * The world canvas only redraws when the camera moves (render-on-demand), so anything that moves
 * on its own would force a full world redraw every frame. Clouds and birds are therefore drawn by
 * their own small transparent canvas that sits right above the world canvas (below the level
 * buttons and the student). It holds only a few draw calls and is capped at 30 fps.
 *
 * Depth: clouds and birds fly higher than every tree, and the camera looks down on them, so they
 * are always in front of the forest. Only the kingdom building can stand in front of them; it is
 * drawn into the depth buffer (no colour) first so it still hides what is behind it.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Half size (world units) of the square around the camera that clouds and birds repeat in.
 * The camera looks down on the map, so they can only be seen fairly close to it; they fade out
 * before the edge of the square, where they jump to the other side.
 */
const WIN = 9;
/** Birds repeat in a smaller square (between the camera and the student), so a flock is usually in view. */
const BIRD_WIN = 5;
/** Heights above the local ground: the tallest trees reach about 3.2. */
const CLOUD_H = [3.9, 4.8];
const BIRD_H = [3.35, 3.7];

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** World-fixed coordinate shown at its repeat closest to `c` (repeat square half size `win`). */
function wrap(v: number, c: number, win = WIN): number {
  const d = ((((v - c + win) % (2 * win)) + 2 * win) % (2 * win)) - win;
  return c + d;
}

/** One low-poly cloud: a row of puffs, biggest in the middle, with a flat light-blue underside. */
function cloudGeo(seed: number): THREE.BufferGeometry {
  const rnd = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * 1.6 + (rnd() - 0.5) * 0.15;
    const mid = 1 - Math.abs(x) / 0.85;
    const r = 0.3 + mid * 0.24 + rnd() * 0.1;
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(x, mid * 0.16 + rnd() * 0.06, (rnd() - 0.5) * 0.45);
    parts.push(g);
  }
  const geo = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const top = new THREE.Color('#ffffff');
  const bottom = new THREE.Color('#d3e1f1');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i);
    if (y < 0) y *= 0.35; // flat bottom
    pos.setY(i, y);
    c.copy(bottom).lerp(top, smooth(-0.12, 0.42, y));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** A small white bird (forward = +z), wings along x; the vertex shader flaps the wings. */
function birdGeo(): THREE.BufferGeometry {
  // prettier-ignore
  const v = [
    // body
    0, 0, 0.1, -0.028, 0, -0.02, 0.028, 0, -0.02,
    0, 0, -0.1, 0.028, 0, -0.02, -0.028, 0, -0.02,
    // tail
    0, 0, -0.08, -0.035, 0, -0.15, 0.035, 0, -0.15,
    // left wing
    -0.024, 0, 0.045, -0.17, 0.01, -0.05, -0.024, 0, -0.05,
    // right wing
    0.024, 0, 0.045, 0.024, 0, -0.05, 0.17, 0.01, -0.05,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const white = new THREE.Color('#f5f7fa');
  const tip = new THREE.Color('#7d8a99');
  const col: number[] = [];
  for (let i = 0; i < v.length; i += 3) {
    const c = white.clone().lerp(tip, smooth(0.06, 0.17, Math.abs(v[i])));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.scale(1.45, 1.45, 1.45);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

interface Cloud {
  ox: number;
  oz: number;
  y: number;
  v: number;
  s: number;
  ry: number;
  mesh: number;
}

interface Flock {
  bx: number;
  bz: number;
  dx: number;
  dz: number;
  speed: number;
  y: number;
  phase: number;
  n: number;
}

export class SkyLife {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly clouds: Cloud[] = [];
  private readonly cloudMeshes: THREE.InstancedMesh[] = [];
  private readonly shadowMesh: THREE.InstancedMesh;
  private readonly flocks: Flock[] = [];
  private readonly birdMesh: THREE.InstancedMesh;
  private readonly uTime = { value: 0 };
  private readonly occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  private occluder: THREE.Mesh | null = null;
  private readonly owned: Array<{ dispose(): void }> = [];
  private t = 0;
  private acc = 1;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(opts: { lite: boolean; mobile: boolean; shadowTex: THREE.Texture }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.lite, alpha: true, stencil: false, premultipliedAlpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lite || opts.mobile ? 1 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'vq-world3d-sky';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';

    // same light as the world
    const sun = new THREE.DirectionalLight('#fff4dc', 1.5);
    sun.position.set(-8, 22, 11);
    this.scene.add(new THREE.HemisphereLight('#e6f4ff', '#7da35f', 1.25), sun);

    const rnd = rng(31);
    const nClouds = opts.lite ? 16 : 26;
    const variants = 3;
    for (let i = 0; i < nClouds; i++) {
      this.clouds.push({
        ox: (rnd() - 0.5) * 2 * WIN,
        oz: (rnd() - 0.5) * 2 * WIN,
        y: CLOUD_H[0] + rnd() * (CLOUD_H[1] - CLOUD_H[0]),
        v: 0.12 + rnd() * 0.1,
        s: 0.38 + rnd() * 0.26,
        ry: (rnd() - 0.5) * 0.6,
        mesh: i % variants,
      });
    }
    // a little self-glow keeps them white (not rock-grey) on the shaded side
    const cloudMat = this.own(
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.88, emissive: '#c9d9ec', emissiveIntensity: 0.55 }),
    );
    for (let k = 0; k < variants; k++) {
      const geo = this.own(cloudGeo(101 + k * 17));
      const count = this.clouds.filter((c) => c.mesh === k).length;
      const mesh = new THREE.InstancedMesh(geo, cloudMat, count);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      this.cloudMeshes.push(mesh);
      this.scene.add(mesh);
    }

    // soft cloud shadows drifting over the meadow
    const shadowGeo = this.own(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    const shadowMat = this.own(
      new THREE.MeshBasicMaterial({ map: opts.shadowTex, color: '#1f3d2a', transparent: true, opacity: 0.2, depthWrite: false }),
    );
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, nClouds);
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.renderOrder = 1;
    this.scene.add(this.shadowMesh);

    // flocks of birds crossing the map in a loose V
    const nFlocks = opts.lite ? 2 : 3;
    let birds = 0;
    for (let i = 0; i < nFlocks; i++) {
      const a = rnd() * Math.PI * 2;
      const n = 4 + Math.floor(rnd() * 3);
      birds += n;
      this.flocks.push({
        bx: (rnd() - 0.5) * 2 * BIRD_WIN,
        bz: (rnd() - 0.5) * 2 * BIRD_WIN,
        dx: Math.sin(a),
        dz: Math.cos(a),
        speed: 0.9 + rnd() * 0.4,
        y: BIRD_H[0] + rnd() * (BIRD_H[1] - BIRD_H[0]),
        phase: rnd() * 6,
        n,
      });
    }
    const birdMat = this.own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
    const uTime = this.uTime;
    birdMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader =
        'uniform float uTime;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float vqPh = instanceMatrix[3].x * 2.7 + instanceMatrix[3].z * 1.3;
          #else
            float vqPh = 0.0;
          #endif
            float vqAmp = 0.6 + 0.4 * sin(uTime * 0.6 + vqPh * 0.3);
            transformed.y += sin(uTime * 12.0 + vqPh) * abs(position.x) * 0.95 * vqAmp;`,
        );
    };
    this.birdMesh = new THREE.InstancedMesh(this.own(birdGeo()), birdMat, birds);
    this.birdMesh.frustumCulled = false;
    this.scene.add(this.birdMesh);
  }

  private own<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(Math.max(1, w), Math.max(1, h), false);
    this.acc = 1;
  }

  /** The kingdom building hides clouds and birds behind it (depth only, it is not drawn). */
  setOccluder(geo: THREE.BufferGeometry | null, matrixWorld?: THREE.Matrix4): void {
    if (this.occluder) {
      this.scene.remove(this.occluder);
      this.occluder = null;
    }
    if (!geo || !matrixWorld) return;
    const m = new THREE.Mesh(geo, this.occMat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(matrixWorld);
    m.renderOrder = -1;
    this.occluder = m;
    this.scene.add(m);
    this.acc = 1;
  }

  /**
   * Moves the clouds and birds and draws them (at most 30 times a second, or right away when the
   * camera moved so they stay in step with the world). `focus` is the camera target (world units).
   */
  render(
    dt: number,
    camera: THREE.PerspectiveCamera,
    fog: THREE.Fog | null,
    focus: { x: number; z: number },
    groundAt: (x: number, z: number) => number,
    cameraMoved: boolean,
  ): void {
    const step = Math.min(0.1, Math.max(0, dt));
    this.t += step;
    this.acc += step;
    if (!cameraMoved && this.acc < 1 / 30) return;
    this.acc = 0;
    this.uTime.value = this.t;
    this.scene.fog = fog;
    const cam = camera.position;
    const aspect = camera.aspect || 1;
    // fades out towards the edge of the repeat square (around the camera)
    const edge = (x: number, z: number) => 1 - smooth(WIN * 0.7, WIN * 0.95, Math.max(Math.abs(x - cam.x), Math.abs(z - cam.z)));
    // the student stands at the view centre: clouds that would cover it on screen melt away
    const fy = groundAt(focus.x, focus.z) + 0.5;
    const clearOfStudent = (x: number, y: number, z: number, r: number) => {
      this.p.set(x, y, z).project(camera);
      if (this.p.z > 1) return 1;
      const sx = this.p.x * aspect;
      const sy = this.p.y;
      this.p.set(focus.x, fy, focus.z).project(camera);
      return smooth(r, r + 0.35, Math.hypot(sx - this.p.x * aspect, sy - this.p.y));
    };

    // clouds (and their shadows drifting over the meadow)
    const fill = this.cloudMeshes.map(() => 0);
    this.clouds.forEach((c, i) => {
      const x = wrap(c.ox + c.v * this.t, cam.x);
      const z = wrap(c.oz, cam.z);
      const y = groundAt(x, z) + c.y;
      const fadeEdge = edge(x, z);
      const k = fadeEdge * smooth(1.2, 2.2, Math.hypot(x - cam.x, y - cam.y, z - cam.z)) * clearOfStudent(x, y, z, 0.35);
      const s = Math.max(1e-4, c.s * k);
      this.e.set(0, c.ry, 0);
      this.q.setFromEuler(this.e);
      this.m4.compose(this.p.set(x, y, z), this.q, this.s.set(s, s, s));
      const mesh = this.cloudMeshes[c.mesh];
      mesh.setMatrixAt(fill[c.mesh]++, this.m4);
      // shadow where the sun's rays (from the north-west, high) put it
      const sx = x + c.y * 0.36;
      const sz = z - c.y * 0.5;
      const ss = Math.max(1e-4, c.s * 2.6 * fadeEdge * edge(sx, sz));
      this.q.identity();
      this.m4.compose(this.p.set(sx, groundAt(sx, sz) + 0.05, sz), this.q, this.s.set(ss, 1, ss * 0.7));
      this.shadowMesh.setMatrixAt(i, this.m4);
    });
    for (const m of this.cloudMeshes) m.instanceMatrix.needsUpdate = true;
    this.shadowMesh.instanceMatrix.needsUpdate = true;

    // birds: each flock flies straight with a slow sideways sway, birds in a V behind the leader.
    // They fly lower than the camera, so they are in view between the camera and the student:
    // their repeat square is centred there.
    const bcx = cam.x + (focus.x - cam.x) * 0.55;
    const bcz = cam.z + (focus.z - cam.z) * 0.55;
    let b = 0;
    for (const f of this.flocks) {
      const along = f.speed * this.t;
      const swayA = Math.sin(this.t * 0.25 + f.phase) * 1.4;
      const swayD = Math.cos(this.t * 0.25 + f.phase) * 0.35;
      const lx = wrap(f.bx + f.dx * along - f.dz * swayA, bcx, BIRD_WIN);
      const lz = wrap(f.bz + f.dz * along + f.dx * swayA, bcz, BIRD_WIN);
      const fh = groundAt(lx, lz) + f.y;
      const h = Math.atan2(f.dx, f.dz) + Math.atan(swayD / f.speed);
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      for (let i = 0; i < f.n; i++) {
        const side = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        const back = Math.abs(side) * 0.45;
        const x = lx + fz * side * 0.42 - fx * back;
        const z = lz - fx * side * 0.42 - fz * back;
        const y = fh + Math.sin(this.t * 1.5 + i * 1.7 + f.phase) * 0.06;
        const fromFocus = Math.max(Math.abs(x - bcx), Math.abs(z - bcz));
        const k = (1 - smooth(BIRD_WIN * 0.72, BIRD_WIN * 0.97, fromFocus)) * smooth(0.8, 2, Math.hypot(x - cam.x, y - cam.y, z - cam.z));
        this.e.set(0, h, -swayD * 0.5);
        this.q.setFromEuler(this.e);
        this.m4.compose(this.p.set(x, y, z), this.q, this.s.set(k, k, k));
        this.birdMesh.setMatrixAt(b++, this.m4);
      }
    }
    this.birdMesh.instanceMatrix.needsUpdate = true;

    this.renderer.render(this.scene, camera);
  }

  dispose(): void {
    this.setOccluder(null);
    for (const m of this.cloudMeshes) m.dispose();
    this.shadowMesh.dispose();
    this.birdMesh.dispose();
    for (const o of this.owned) o.dispose();
    this.occMat.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
