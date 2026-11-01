/**
 * World3D – three.js renderer for the kingdom map, in the same look as Tala-Salitaan's world:
 * a grass meadow (Tala's grass texture), flat-shaded low-poly pine trees and bushes, a sandy road
 * with a grassy edge and stepping stones, small streams with wooden bridges, ponds, rocks, bahay
 * kubo huts and one toy-like 3D building per kingdom standing on the ground (school, municipal
 * hall, provincial capitol).
 *
 * ModernWorldMap keeps its 2D camera state (viewX, viewY, zoom) and its DOM layers (level buttons,
 * padlock, YOU badge). This class turns that camera into a tilted perspective camera.
 *
 * Built for phones and tablets:
 *  - the world is drawn only when the camera moves (or something in it changes), never on idle frames;
 *  - all scenery is instanced and split into chunks along the map, so off-screen chunks are culled;
 *  - low-poly shapes (a pine is ~90 triangles), no per-frame texture animation;
 *  - the student is drawn every frame into a SMALL canvas around the character only (camera view
 *    offset), placed above the level buttons;
 *  - automatic quality drop (pixel ratio, then shadows) when frames get slow.
 *
 * Map coordinates are the 2D map's world pixels (x 0..mapW, y 0..mapH, y grows towards the camera).
 * One map pixel = U three.js units.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AVATAR_SCALE, avatarModelUrl } from './shared';
import { SkyLife } from './Sky3D';

export { AVATAR_HEAD_H, avatarModelUrl, hasWebGL, isLowEndDevice } from './shared';

export const U = 0.01;
const PITCH = THREE.MathUtils.degToRad(50);
/** Drag-tilt limits: low enough to read the building fronts, never under the map. */
const PITCH_MIN = THREE.MathUtils.degToRad(16);
const PITCH_MAX = THREE.MathUtils.degToRad(74);
/** Kingdom building scale on the map. */
const LANDMARK_SCALE = 0.86;
const FOV = 38;
const DIST_K = 1.4;
const UP = new THREE.Vector3(0, 1, 0);
/** Scenery chunk height in map px (chunks are frustum-culled one by one). */
const CHUNK = 1000;

export interface World3DTheme {
  skyTop: string;
  skyBot: string;
}

export interface World3DScenery {
  type: string;
  x: number;
  y: number;
  scale: number;
  variant: number;
}

export interface World3DInput {
  kingdom: 1 | 2 | 3;
  theme: World3DTheme;
  nodes: Array<{ x: number; y: number }>;
  scenery: World3DScenery[];
  water: Array<{ x: number; y: number; w: number; h: number }>;
  mapW: number;
  mapH: number;
  /** Ground point at the centre of the kingdom building (below level 1). */
  landmark: { x: number; y: number };
  /** Gate to the next kingdom (absent for the last kingdom). */
  gate?: { x: number; y: number };
}

export interface AvatarState {
  x: number;
  y: number;
  walking: boolean;
  visible: boolean;
}

/* ── Small deterministic helpers ───────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number): number {
  return (vnoise(x, y, seed) * 0.6 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.4) * 2 - 1;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ── Generated textures (drawn once, shared by all kingdoms) ───────── */

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, repeat: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

const texCache = new Map<string, THREE.CanvasTexture>();
function memoTex(key: string, draw: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) {
    t = draw();
    texCache.set(key, t);
  }
  return t;
}

/** Tala-Salitaan's meadow grass (same colours and strokes). */
function grassTexture(): THREE.CanvasTexture {
  return memoTex('grass', () => {
    const [c, g] = canvas2d(256, 256);
    let s = 21 >>> 0;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    g.fillStyle = '#5fae46';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${rand() > 0.5 ? '120,200,90' : '60,130,50'},0.25)`;
      g.beginPath();
      g.arc(rand() * 256, rand() * 256, 10 + rand() * 30, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 2600; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      g.strokeStyle = `hsl(${95 + rand() * 25}, ${45 + rand() * 20}%, ${30 + rand() * 25}%)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 3, y - 3 - rand() * 4);
      g.stroke();
    }
    return finish(c, true);
  });
}

/** Light paving for the school yard / plaza. */
function pavingTexture(): THREE.CanvasTexture {
  return memoTex('paving', () => {
    const [c, g] = canvas2d(256, 256);
    const rnd = mulberry32(5);
    g.fillStyle = '#cdbf9f';
    g.fillRect(0, 0, 256, 256);
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = -1; tx < 5; tx++) {
        const x = tx * 64 + (ty % 2 ? 32 : 0);
        const l = 84 + rnd() * 8;
        g.fillStyle = `hsl(40, 38%, ${l}%)`;
        g.fillRect(x + 3, ty * 64 + 3, 58, 58);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(x + 3, ty * 64 + 3, 58, 5);
      }
    }
    return finish(c, true);
  });
}

/**
 * Brick road tile: canvas x runs across the road (stone curbs at both edges), canvas y along it.
 * The middle is terracotta bricks in a basket-weave (pairs of bricks, turning 90° every cell).
 */
function roadTexture(): THREE.CanvasTexture {
  return memoTex('road', () => {
    const S = 256;
    const [c, g] = canvas2d(S, S);
    const rnd = mulberry32(77);
    const curb = 23;
    // curbs: light stone blocks with joints
    for (const x0 of [0, S - curb]) {
      g.fillStyle = '#d9d2c1';
      g.fillRect(x0, 0, curb, S);
      for (let y = 0; y < S; y += 64) {
        g.fillStyle = `hsl(42, 14%, ${80 + rnd() * 8}%)`;
        g.fillRect(x0 + 2, y + 2, curb - 4, 60);
      }
      g.fillStyle = 'rgba(80,70,55,0.35)';
      g.fillRect(x0 === 0 ? 0 : S - 3, 0, 3, S);
    }
    // mortar
    const x1 = curb;
    const w = S - curb * 2;
    g.fillStyle = '#e3c9a0';
    g.fillRect(x1, 0, w, S);
    const cells = 4;
    const cw = w / cells;
    const ch = S / cells;
    const brick = (x: number, y: number, bw: number, bh: number) => {
      const l = 44 + rnd() * 12;
      g.fillStyle = `hsl(${14 + rnd() * 8}, ${52 + rnd() * 12}%, ${l}%)`;
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      g.fillStyle = 'rgba(255,235,210,0.18)';
      g.fillRect(x + 1.5, y + 1.5, bw - 3, 2.5);
      g.fillStyle = 'rgba(60,20,10,0.16)';
      g.fillRect(x + 1.5, y + bh - 4, bw - 3, 2.5);
    };
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const x = x1 + i * cw;
        const y = j * ch;
        if ((i + j) % 2 === 0) {
          brick(x, y, cw / 2, ch);
          brick(x + cw / 2, y, cw / 2, ch);
        } else {
          brick(x, y, cw, ch / 2);
          brick(x, y + ch / 2, cw, ch / 2);
        }
      }
    }
    return finish(c, true);
  });
}

/** Static ripples for the streams (tinted by the water material). */
function waterTexture(): THREE.CanvasTexture {
  return memoTex('water', () => {
    const [c, g] = canvas2d(128, 256);
    const rnd = mulberry32(8);
    g.fillStyle = '#e6eef2';
    g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * 128;
      const y = rnd() * 256;
      const len = 14 + rnd() * 26;
      g.strokeStyle = `rgba(255,255,255,${0.6 + rnd() * 0.4})`;
      g.lineWidth = 2 + rnd() * 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 4, y + len / 2, x, y + len);
      g.stroke();
    }
    return finish(c, true);
  });
}

function blobTexture(): THREE.CanvasTexture {
  return memoTex('blob', () => {
    const [c, g] = canvas2d(128, 128);
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return finish(c, false);
  });
}

/** Philippine flag. */
function flagTexture(): THREE.CanvasTexture {
  return memoTex('flag', () => {
    const [c, g] = canvas2d(256, 128);
    g.fillStyle = '#0038a8';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#ce1126';
    g.fillRect(0, 64, 256, 64);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(111, 64);
    g.lineTo(0, 128);
    g.closePath();
    g.fill();
    g.fillStyle = '#fcd116';
    g.beginPath();
    g.arc(38, 64, 13, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(38 + Math.cos(a - 0.12) * 14, 64 + Math.sin(a - 0.12) * 14);
      g.lineTo(38 + Math.cos(a) * 24, 64 + Math.sin(a) * 24);
      g.lineTo(38 + Math.cos(a + 0.12) * 14, 64 + Math.sin(a + 0.12) * 14);
      g.fill();
    }
    for (const [x, y] of [[9, 14], [9, 114], [92, 64]]) {
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
    return finish(c, false);
  });
}

function clockTexture(): THREE.CanvasTexture {
  return memoTex('clock', () => {
    const [c, g] = canvas2d(128, 128);
    g.fillStyle = '#e3cfa4';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fffdf5';
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3b2a1a';
    g.lineWidth = 5;
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = '#3b2a1a';
      g.fillRect(64 + Math.cos(a) * 42 - 2, 64 + Math.sin(a) * 42 - 2, 5, 5);
    }
    g.lineCap = 'round';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(64, 64);
    g.lineTo(64, 30);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(64, 64);
    g.lineTo(88, 72);
    g.stroke();
    return finish(c, false);
  });
}

/** Building name board: main line + small second line, auto-fitted. Canvas ratio = plane ratio. */
function signTexture(key: string, w: number, h: number, main: string, sub: string, bg: string, fg: string, subFg: string): THREE.CanvasTexture {
  return memoTex(`sign:${key}`, () => {
    const W = 1024;
    const H = Math.max(64, Math.round((W * h) / w));
    const [c, g] = canvas2d(W, H);
    g.fillStyle = '#f59e0b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = bg;
    g.fillRect(8, 8, W - 16, H - 16);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fit = (text: string, size: number, maxW: number) => {
      let s = size;
      g.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
      const tw = g.measureText(text).width;
      if (tw > maxW) {
        s = Math.floor((s * maxW) / tw);
        g.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
      }
    };
    const mainY = sub ? H * 0.42 : H * 0.53;
    fit(main, Math.round(H * (sub ? 0.46 : 0.62)), W - 60);
    g.fillStyle = fg;
    g.fillText(main, W / 2, mainY);
    if (sub) {
      fit(sub, Math.round(H * 0.22), W - 120);
      g.fillStyle = subFg;
      g.fillText(sub, W / 2, H * 0.78);
    }
    return finish(c, false);
  });
}

/** The old K1 WELCOME marquee: red MABUHAY ribbon, gold WELCOME, school name on a green ribbon. */
function welcomeTexture(): THREE.CanvasTexture {
  return memoTex('welcome', () => {
    const W = 1024;
    const H = 302;
    const [c, g] = canvas2d(W, H);
    g.fillStyle = '#b45309';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fde047';
    g.fillRect(6, 6, W - 12, H - 12);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#064e3b');
    bg.addColorStop(0.5, '#065f46');
    bg.addColorStop(1, '#022c22');
    g.fillStyle = bg;
    g.fillRect(14, 14, W - 28, H - 28);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // MABUHAY ribbon
    g.fillStyle = '#dc2626';
    g.fillRect(W / 2 - 230, 26, 460, 58);
    g.strokeStyle = '#fde047';
    g.lineWidth = 4;
    g.strokeRect(W / 2 - 230, 26, 460, 58);
    g.fillStyle = '#fef08a';
    g.font = '900 40px "Arial Black", Arial, sans-serif';
    g.fillText('★ MABUHAY ★', W / 2, 57);
    // WELCOME
    const gold = g.createLinearGradient(0, 100, 0, 210);
    gold.addColorStop(0, '#fffbeb');
    gold.addColorStop(0.35, '#fde047');
    gold.addColorStop(1, '#d97706');
    g.font = '900 118px "Arial Black", Arial, sans-serif';
    g.fillStyle = 'rgba(69,26,3,0.65)';
    g.fillText('WELCOME', W / 2 + 4, 160);
    g.fillStyle = gold;
    g.fillText('WELCOME', W / 2, 155);
    // school name
    g.fillStyle = '#047857';
    g.fillRect(40, 222, W - 80, 52);
    let s = 34;
    g.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
    const t = 'EAST PROSPERIDAD CENTRAL ELEMENTARY SCHOOL';
    const tw = g.measureText(t).width;
    if (tw > W - 120) {
      s = Math.floor((s * (W - 120)) / tw);
      g.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
    }
    g.fillStyle = '#a7f3d0';
    g.fillText(t, W / 2, 249);
    return finish(c, false);
  });
}

/** Round gold seal with an emblem and a name along the bottom (town or province). */
function sealTexture(key: string, label: string, kind: 'town' | 'province'): THREE.CanvasTexture {
  return memoTex(`seal:${key}`, () => {
    const S = 256;
    const [c, g] = canvas2d(S, S);
    const r = S / 2;
    const gold = g.createRadialGradient(r - 30, r - 30, 10, r, r, r);
    gold.addColorStop(0, '#fff3b0');
    gold.addColorStop(0.6, '#f5b82e');
    gold.addColorStop(1, '#a16207');
    g.fillStyle = gold;
    g.beginPath();
    g.arc(r, r, r - 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#78350f';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = kind === 'town' ? '#1e3a8a' : '#065f46';
    g.beginPath();
    g.arc(r, r - 8, r - 34, 0, Math.PI * 2);
    g.fill();
    if (kind === 'town') {
      // rice stalks around a star
      g.fillStyle = '#fde047';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? 18 : 42;
        g.lineTo(r + Math.cos(a) * rr, r - 14 + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    } else {
      // mountains over a river
      g.fillStyle = '#86efac';
      g.beginPath();
      g.moveTo(r - 62, r + 14);
      g.lineTo(r - 22, r - 44);
      g.lineTo(r + 4, r - 6);
      g.lineTo(r + 28, r - 34);
      g.lineTo(r + 62, r + 14);
      g.closePath();
      g.fill();
      g.strokeStyle = '#7dd3fc';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(r - 60, r + 30);
      g.quadraticCurveTo(r, r + 6, r + 60, r + 30);
      g.stroke();
    }
    g.fillStyle = '#7c2d12';
    g.fillRect(28, S - 72, S - 56, 40);
    g.fillStyle = '#fef08a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let s = 30;
    g.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
    const tw = g.measureText(label).width;
    if (tw > S - 70) {
      s = Math.floor((s * (S - 70)) / tw);
      g.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
    }
    g.fillText(label, r, S - 52);
    return finish(c, false);
  });
}

/* ── Geometry helpers ──────────────────────────────────────────────── */

/** Non-indexed copy with a solid vertex colour (position, normal, color only, so everything merges). */
function colorize(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  g.clearGroups();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Collects coloured parts and merges them into one geometry (one draw call). */
class Kit {
  readonly parts: THREE.BufferGeometry[] = [];
  push(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, ry = 0): this {
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.parts.push(colorize(g, color));
    return this;
  }
  /** Box standing on y. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, ry = 0): this {
    return this.push(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry);
  }
  /** Cylinder standing on y (r0 bottom, r1 top). */
  cyl(r0: number, r1: number, h: number, seg: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, open = false): this {
    return this.push(new THREE.CylinderGeometry(r1, r0, h, seg, 1, open), color, x, y + h / 2, z);
  }
  /** `open` drops the base cap (saves triangles on trees, where the base is never seen). */
  cone(r: number, h: number, seg: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, ry = 0, open = false): this {
    return this.push(new THREE.ConeGeometry(r, h, seg, 1, open), color, x, y + h / 2, z, ry);
  }
  sphere(r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, ws = 12, hs = 8): this {
    return this.push(new THREE.SphereGeometry(r, ws, hs), color, x, y, z);
  }
  dome(r: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 24): this {
    return this.push(new THREE.SphereGeometry(r, seg, Math.round(seg / 2.4), 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z);
  }
  /** Hip roof standing on y: w along x, d along z, ridge along x. */
  hip(w: number, d: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): this {
    const r = Math.max(0, (w - d) / 2);
    const A = [-w / 2, 0, d / 2];
    const B = [w / 2, 0, d / 2];
    const Bb = [w / 2, 0, -d / 2];
    const Ab = [-w / 2, 0, -d / 2];
    const C = [r, h, 0];
    const D = [-r, h, 0];
    const tris = [A, B, C, A, C, D, Bb, Ab, D, Bb, D, C, Ab, A, D, B, Bb, C];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    return this.push(g, color, x, y, z);
  }
  /** Triangular prism (gable / pediment) standing on y, facing +z, centred on z. */
  gable(w: number, h: number, depth: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): this {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return this.push(g, color, x, y, z);
  }
  /** Arch-topped panel standing on y, facing +z (window / door opening). */
  arch(w: number, h: number, depth: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): this {
    const r = w / 2;
    this.box(w, h - r, depth, x, y, z, color);
    const top = new THREE.CylinderGeometry(r, r, depth, 14, 1, false, -Math.PI / 2, Math.PI);
    top.rotateX(-Math.PI / 2); // upper half, axis along z
    return this.push(top, color, x, y + h - r, z);
  }
  /** Plain window: white frame + glass + mullion, facing +z, centred on (x, yc). */
  window(w: number, h: number, x: number, yc: number, z: number, glass: string, frame = '#ffffff'): this {
    this.box(w + 0.06, h + 0.06, 0.03, x, yc - h / 2 - 0.03, z + 0.015, frame);
    this.box(w, h, 0.03, x, yc - h / 2, z + 0.03, glass);
    this.box(0.025, h, 0.035, x, yc - h / 2, z + 0.035, frame);
    this.box(w + 0.1, 0.04, 0.07, x, yc - h / 2 - 0.07, z + 0.035, frame);
    return this;
  }
  /** Arched window with a white surround, facing +z. */
  archWindow(w: number, h: number, x: number, y: number, z: number, glass: string, frame = '#ffffff'): this {
    this.arch(w + 0.08, h + 0.05, 0.03, x, y - 0.03, z + 0.015, frame);
    this.arch(w, h, 0.03, x, y, z + 0.03, glass);
    return this;
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    if (!g) throw new Error('merge failed');
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/* ── Scenery shapes (Tala-Salitaan style, flat-shaded) ─────────────── */

let SCENERY: ReturnType<typeof makeSceneryGeos> | null = null;
function sceneryGeos() {
  if (!SCENERY) SCENERY = makeSceneryGeos();
  return SCENERY;
}

/*
 * Triangle budget: every shape is instanced thousands of times, so caps that are never seen
 * (cone bases, trunk ends) are left out and round shapes use low-detail polyhedra.
 */
function makeSceneryGeos() {
  // Pine: trunk + three stacked cones (9 sides), open bases.
  const pine = new Kit()
    .cyl(0.12, 0.09, 0.6, 6, 0, 0, 0, '#6b4423', true)
    .cone(0.62, 0.95, 9, 0, 0.75 - 0.475, 0, '#2f7d3a', 0, true)
    .cone(0.5, 0.8, 9, 0, 1.2 - 0.4, 0, '#3a9446', 0.3, true)
    .cone(0.36, 0.62, 9, 0, 1.6 - 0.31, 0, '#48a852', 0.6, true)
    .build();
  // A taller, slimmer pine for variety (same colours).
  const pineTall = new Kit()
    .cyl(0.11, 0.08, 0.62, 6, 0, 0, 0, '#6b4423', true)
    .cone(0.54, 0.9, 9, 0, 0.32, 0, '#2f7d3a', 0, true)
    .cone(0.45, 0.8, 9, 0, 0.78, 0, '#3a9446', 0.25, true)
    .cone(0.35, 0.68, 9, 0, 1.2, 0, '#48a852', 0.5, true)
    .cone(0.22, 0.48, 9, 0, 1.62, 0, '#55b65e', 0.8, true)
    .build();
  // Round leafy tree (mango / acacia style): trunk + faceted canopy blobs.
  const roundTree = new Kit()
    .cyl(0.1, 0.07, 0.62, 6, 0, 0, 0, '#6b4423', true)
    .push(new THREE.IcosahedronGeometry(0.46, 0).scale(1, 0.82, 1), '#3a9440', 0, 0.92, 0)
    .push(new THREE.IcosahedronGeometry(0.32, 0), '#48a84a', 0.32, 0.84, 0.1)
    .push(new THREE.IcosahedronGeometry(0.32, 0), '#2f8a3a', -0.3, 0.86, -0.08)
    .push(new THREE.IcosahedronGeometry(0.28, 0), '#56b955', 0.02, 1.22, 0.06)
    .build();
  // Same tree with ripe mangoes.
  const fruitTree = new Kit()
    .cyl(0.1, 0.07, 0.62, 6, 0, 0, 0, '#6b4423', true)
    .push(new THREE.IcosahedronGeometry(0.46, 0).scale(1, 0.82, 1), '#358f3c', 0, 0.92, 0)
    .push(new THREE.IcosahedronGeometry(0.32, 0), '#43a245', 0.32, 0.84, 0.1)
    .push(new THREE.IcosahedronGeometry(0.32, 0), '#2f8a3a', -0.3, 0.86, -0.08)
    .push(new THREE.IcosahedronGeometry(0.28, 0), '#4fb24f', 0.02, 1.22, 0.06)
    .push(new THREE.OctahedronGeometry(0.06), '#ffb52e', 0.3, 0.64, 0.34)
    .push(new THREE.OctahedronGeometry(0.06), '#ff9a1f', -0.26, 0.7, 0.33)
    .push(new THREE.OctahedronGeometry(0.06), '#ffc23d', 0.05, 0.86, 0.45)
    .push(new THREE.OctahedronGeometry(0.06), '#ffb52e', 0.42, 0.98, -0.1)
    .build();
  const bush = new Kit()
    .push(new THREE.IcosahedronGeometry(0.32, 0), '#3f9a3e', 0, 0.22, 0)
    .push(new THREE.IcosahedronGeometry(0.24, 0), '#4fae4a', 0.28, 0.18, 0.05)
    .push(new THREE.IcosahedronGeometry(0.22, 0), '#4fae4a', -0.25, 0.16, 0.08)
    .build();
  // Gumamela-style flowering bush.
  const flowerBush = new Kit()
    .push(new THREE.IcosahedronGeometry(0.3, 0), '#3a9440', 0, 0.22, 0)
    .push(new THREE.IcosahedronGeometry(0.22, 0), '#47a647', 0.26, 0.17, 0.04)
    .push(new THREE.IcosahedronGeometry(0.2, 0), '#47a647', -0.24, 0.15, 0.07)
    .push(new THREE.OctahedronGeometry(0.05), '#ff4f6d', 0.08, 0.46, 0.14)
    .push(new THREE.OctahedronGeometry(0.05), '#ff4f6d', -0.18, 0.32, 0.2)
    .push(new THREE.OctahedronGeometry(0.05), '#ffd23f', 0.3, 0.3, 0.16)
    .push(new THREE.OctahedronGeometry(0.05), '#ff4f6d', 0.16, 0.36, -0.2)
    .build();
  const rockA = rockGeo(3);
  const rockB = rockGeo(11);
  const boulder = rockGeo(23, 1.9, 0.48);
  const mossy = rockGeo(37, 1.25, 0.7, true);
  const stem = new Kit().cyl(0.012, 0.012, 0.16, 3, 0, 0, 0, '#2f7d3a', true).build();
  const petal = new Kit().push(new THREE.OctahedronGeometry(0.055), '#ffffff', 0, 0.17, 0).build();
  const stone = new Kit().cyl(0.18, 0.16, 0.06, 7, 0, 0, 0, '#f6ead0').build();
  const pad = new Kit().cyl(0.4, 0.37, 0.07, 22, 0, 0, 0, '#f3e6c6').cyl(0.31, 0.31, 0.075, 22, 0, 0, 0, '#e9d9b3').build();
  const lily = new Kit().push(new THREE.CircleGeometry(0.08, 10, 0.3, Math.PI * 1.8).rotateX(-Math.PI / 2), '#4f9a3a').build();
  return {
    pine,
    pineTall,
    roundTree,
    fruitTree,
    palm: palmGeo(0.32),
    palmB: palmGeo(-0.22),
    bush,
    flowerBush,
    fern: fernGeo(),
    tuft: tuftGeo(),
    rockA,
    rockB,
    boulder,
    mossy,
    stem,
    petal,
    stone,
    pad,
    lily,
    kubo: kuboGeo(),
    lamp: lampGeo(),
  };
}

/** A flat leaf strip (two-sided) bending down from its base along +x. */
function leafStrip(len: number, width: number, lift: number, droop: number, segs: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const pt = (t: number, side: number): [number, number, number] => {
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.35);
    return [t * len, lift * t - droop * t * t - Math.abs(side) * w * 0.25, side * w];
  };
  for (let i = 0; i < segs; i++) {
    const a = i / segs;
    const b = (i + 1) / segs;
    for (const s of [-1, 1]) {
      const c0 = pt(a, 0);
      const c1 = pt(b, 0);
      const e0 = pt(a, s);
      const e1 = pt(b, s);
      // both windings so the leaf is visible from above and below
      pos.push(...c0, ...c1, ...e1, ...c0, ...e1, ...e0);
      pos.push(...c0, ...e1, ...c1, ...c0, ...e0, ...e1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Coconut palm (niyog): curved ringed trunk, coconuts and drooping fronds. */
function palmGeo(lean: number): THREE.BufferGeometry {
  const k = new Kit();
  const segs = 5;
  const H = 1.8;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const h = H / segs;
    const x0 = lean * t0 * t0;
    const x1 = lean * t1 * t1;
    const g = new THREE.CylinderGeometry(0.072 - t1 * 0.028, 0.078 - t0 * 0.028, h * 1.06, 6, 1, true);
    g.rotateZ(-Math.atan2(x1 - x0, h));
    k.push(g, i % 2 ? '#8a6a45' : '#a07d55', (x0 + x1) / 2, t0 * H + h / 2, 0);
  }
  const tx = lean;
  const ty = H;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    k.push(new THREE.OctahedronGeometry(0.075), '#6b4a22', tx + Math.cos(a) * 0.08, ty - 0.07, Math.sin(a) * 0.08);
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const leaf = leafStrip(0.82 + (i % 3) * 0.08, 0.15, 0.32, 0.78, 3);
    k.push(leaf, i % 2 ? '#3f9a3e' : '#2f8a3a', tx, ty + 0.02, 0, a);
  }
  return k.build();
}

/** Low leafy plant (halaman) with leaves fanning out from the ground. */
function fernGeo(): THREE.BufferGeometry {
  const k = new Kit();
  for (let i = 0; i < 6; i++) {
    const leaf = leafStrip(0.32 + (i % 2) * 0.06, 0.07, 0.42, 0.34, 2);
    k.push(leaf, i % 2 ? '#3f9a3e' : '#56b44e', 0, 0.01, 0, (i / 6) * Math.PI * 2 + 0.2);
  }
  return k.build();
}

/** Small grass tuft: three thin blades. */
function tuftGeo(): THREE.BufferGeometry {
  const k = new Kit();
  const blades: Array<[number, number, number]> = [
    [0, 0.28, 0.2],
    [2.1, -0.32, 0.16],
    [4.2, 0.18, 0.18],
  ];
  for (const [a, tilt, h] of blades) {
    const g = new THREE.ConeGeometry(0.03, h, 3, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ(tilt);
    k.push(g, '#4f9a3a', Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03, a);
  }
  return k.build();
}

function rockGeo(seed: number, scale = 1, flat = 0.62, moss = false): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(0.22 * scale, 0);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const seen = new Map<string, number>();
  const rnd = mulberry32(seed);
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) {
      k = 0.82 + rnd() * 0.36;
      seen.set(key, k);
    }
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * flat + 0.06 * scale * flat * 1.6, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const out = new Kit().push(g, '#b9b4aa').build();
  if (moss) {
    // green moss on the upward-facing facets
    const pos = out.getAttribute('position') as THREE.BufferAttribute;
    const col = out.getAttribute('color') as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const green = new THREE.Color('#6f9e45');
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1).sub(a);
      c.fromBufferAttribute(pos, i + 2).sub(a);
      const ny = b.cross(c).normalize().y;
      if (Math.abs(ny) > 0.62) for (let j = 0; j < 3; j++) col.setXYZ(i + j, green.r, green.g, green.b);
    }
  }
  return out;
}

function kuboGeo(): THREE.BufferGeometry {
  const k = new Kit();
  const wood = '#7a4a24';
  for (const [x, z] of [[-0.42, -0.32], [0.42, -0.32], [-0.42, 0.32], [0.42, 0.32]]) k.cyl(0.04, 0.04, 0.34, 6, x, 0, z, wood);
  k.box(1.0, 0.06, 0.78, 0, 0.32, 0, '#8a5a2b');
  k.box(0.9, 0.48, 0.68, 0, 0.38, 0, '#e2c27a');
  for (let i = 0; i < 7; i++) k.box(0.03, 0.48, 0.02, -0.39 + i * 0.13, 0.38, 0.345, '#c9a45c');
  k.box(0.24, 0.36, 0.03, 0.14, 0.38, 0.35, '#6b4220');
  k.box(0.2, 0.14, 0.03, -0.24, 0.6, 0.35, '#4a2e14');
  k.hip(1.3, 1.02, 0.6, 0, 0.86, 0, '#c9a25a');
  k.box(0.5, 0.05, 0.05, 0, 1.44, 0, '#a07c3c');
  for (let i = 0; i < 3; i++) k.box(0.22, 0.025, 0.04, 0.14, 0.06 + i * 0.1, 0.5 - i * 0.04, wood);
  return k.build();
}

function lampGeo(): THREE.BufferGeometry {
  return new Kit()
    .cyl(0.05, 0.035, 0.12, 8, 0, 0, 0, '#3a3f45')
    .cyl(0.03, 0.025, 0.85, 6, 0, 0, 0, '#3a3f45')
    .cyl(0.05, 0.07, 0.04, 8, 0, 0.85, 0, '#4b545c')
    .sphere(0.085, 0, 0.97, 0, '#ffe58a', 10, 8)
    .cyl(0.06, 0.02, 0.05, 8, 0, 1.04, 0, '#6b747c')
    .build();
}

/* ── Kingdom buildings (toy-like, merged, vertex coloured) ─────────── */

interface SignSpec {
  tex: THREE.Texture;
  w: number;
  h: number;
  x: number;
  y: number;
  z: number;
  ry?: number;
}

interface BuildingSpec {
  geo: THREE.BufferGeometry;
  signs: SignSpec[];
  flags: Array<{ x: number; y: number; z: number }>;
  /** Box (local units) of the building body, used to fade it when it hides a level or the student. */
  occluder: { x0: number; x1: number; z0: number; z1: number; h: number };
}

/** 5x8 pixel letters (rows top to bottom) for the "I ♥ EPCES" sign of the old map. */
const LETTERS: Record<string, readonly string[]> = {
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  E: ['#####', '##...', '##...', '####.', '##...', '##...', '##...', '#####'],
  P: ['####.', '##.##', '##.##', '##.##', '####.', '##...', '##...', '##...'],
  C: ['.####', '##..#', '##...', '##...', '##...', '##...', '##..#', '.####'],
  S: ['.####', '##..#', '##...', '.###.', '...##', '....#', '#...#', '####.'],
  HEART: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
};

/** Adds a pixel letter as merged row blocks; returns its width. (x0, y0) = bottom-left, facing +z. */
function pixelLetter(k: Kit, key: string, x0: number, y0: number, z: number, px: number, color: string): number {
  const rows = LETTERS[key];
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let x = 0;
    while (x < w) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let e = x;
      while (e < w && row[e] === '#') e++;
      k.box((e - x) * px, px, px * 1.6, x0 + ((x + e) / 2) * px, y0 + (rows.length - 1 - r) * px, z, color);
      x = e;
    }
  }
  return w * px;
}

/**
 * K1 welcome monument from the old map: a marquee board ("★ MABUHAY ★ / WELCOME / school name") on two
 * pillars, with the "I ♥ EPCES" letters on a wooden planter in front. Centre (x, z), facing +z.
 */
function welcomeMonument(k: Kit, signs: SignSpec[], x: number, z: number): void {
  const bw = 1.9;
  for (const s of [-1, 1]) {
    k.box(0.16, 0.5, 0.16, x + s * (bw / 2 - 0.06), 0, z, '#f3e6c4');
    k.box(0.2, 0.05, 0.2, x + s * (bw / 2 - 0.06), 0.5, z, '#e0b44c');
  }
  k.box(bw + 0.08, 0.62, 0.08, x, 0.42, z, '#d39a2c');
  signs.push({ tex: welcomeTexture(), w: bw, h: 0.56, x, y: 0.73, z: z + 0.045 });
  // planter with the letters
  const pz = z + 0.42;
  k.box(2.0, 0.16, 0.3, x, 0, pz, '#5b3a22');
  k.box(2.04, 0.03, 0.34, x, 0.16, pz, '#7a5232');
  const px = 0.036;
  const parts: Array<[string, string]> = [
    ['I', '#2f6fd6'],
    ['HEART', '#e23a3a'],
    ['E', '#f5c518'],
    ['P', '#2fa84f'],
    ['C', '#f08a24'],
    ['E', '#2f6fd6'],
    ['S', '#ef5da8'],
  ];
  const gap = 0.05;
  const total = parts.reduce((a, [key]) => a + LETTERS[key][0].length * px, 0) + gap * (parts.length - 1) + 0.06;
  let cx = x - total / 2;
  parts.forEach(([key, color], i) => {
    cx += pixelLetter(k, key, cx, 0.19, pz, px, color) + gap + (i === 0 ? 0.06 : 0);
  });
}

/** Flagpole with a gold ball; the flag itself is a textured plane added as a sign. */
function flagpole(k: Kit, flags: BuildingSpec['flags'], x: number, z: number, h: number): void {
  k.cyl(0.11, 0.09, 0.12, 10, x, 0, z, '#d6d0c2');
  k.cyl(0.032, 0.026, h, 8, x, 0.12, z, '#f4f1ea');
  k.sphere(0.06, x, h + 0.16, z, '#ffc928');
  flags.push({ x: x + 0.33, y: h - 0.12, z });
}

function plants(k: Kit, pts: Array<[number, number]>): void {
  for (const [x, z] of pts) {
    k.box(0.42, 0.14, 0.26, x, 0, z, '#b5794a');
    k.push(new THREE.IcosahedronGeometry(0.17, 1), '#3f9a3e', x - 0.08, 0.26, z);
    k.push(new THREE.IcosahedronGeometry(0.14, 1), '#4fae4a', x + 0.1, 0.24, z + 0.02);
    k.sphere(0.035, x - 0.02, 0.4, z + 0.12, '#ff6fa5', 6, 4);
    k.sphere(0.035, x + 0.12, 0.34, z + 0.12, '#ffd23f', 6, 4);
  }
}

function steps(k: Kit, w: number, z0: number, n: number, color: string, stepH = 0.05, stepD = 0.14): void {
  for (let i = 0; i < n; i++) k.box(w + (n - i) * 0.06, stepH * (n - i), stepD, 0, 0, z0 + i * stepD + stepD / 2, color);
}

/** Kingdom 1: two-storey DepEd elementary school (EPCES) with corridor, green roof and flag. */
function buildSchool(): BuildingSpec {
  const k = new Kit();
  const flags: BuildingSpec['flags'] = [];
  const W = 5.4;
  const D = 1.4;
  const cream = '#f6e6b4';
  const green = '#1f9a50';
  const glass = '#76c4ef';
  const zf = D / 2;
  const zc = zf + 0.44;
  k.box(W + 0.3, 0.14, D + 0.8, 0, 0, 0.2, '#d4ccbb');
  k.box(W, 0.82, D, 0, 0.14, 0, cream);
  k.box(W + 0.02, 0.12, D + 0.02, 0, 0.14, 0, '#3f8f5a');
  k.box(W + 0.14, 0.08, D + 0.56, 0, 0.96, 0.24, '#ffffff');
  k.box(W, 0.78, D, 0, 1.04, 0, cream);
  k.box(W + 0.22, 0.07, D + 0.68, 0, 1.82, 0.24, '#ffffff');
  k.hip(W + 0.55, D + 1.05, 0.62, 0, 1.89, 0.24, green);
  // corridor columns and green railing panels on the second floor
  const bays = 8;
  for (let i = 0; i <= bays; i++) {
    const x = -W / 2 + 0.06 + (i * (W - 0.12)) / bays;
    k.box(0.09, 0.82, 0.09, x, 0.14, zc, '#ffffff');
    k.box(0.09, 0.78, 0.09, x, 1.04, zc, '#ffffff');
    if (i < bays) {
      const xm = x + (W - 0.12) / bays / 2;
      if (Math.abs(xm) > 0.8) {
        k.box((W - 0.12) / bays - 0.09, 0.28, 0.03, xm, 1.04, zc, '#2f9e5b');
        k.box((W - 0.12) / bays - 0.09, 0.04, 0.06, xm, 1.32, zc, '#ffffff');
      }
    }
  }
  // classroom windows and doors (two floors)
  for (const [y0, yc] of [[0.14, 0.6], [1.04, 1.47]]) {
    for (let i = 0; i < 10; i++) {
      const x = -W / 2 + 0.34 + i * 0.525;
      if (Math.abs(x) < 0.85) continue;
      if (i % 3 === 1) k.box(0.3, 0.62, 0.03, x, y0, zf + 0.015, '#8a5a2b');
      else k.window(0.32, 0.34, x, yc, zf, glass);
    }
  }
  // back windows (seen when the map is scrolled far)
  for (const yc of [0.6, 1.47]) for (let i = 0; i < 9; i++) k.box(0.3, 0.3, 0.03, -W / 2 + 0.5 + i * 0.55, yc - 0.15, -zf - 0.03, glass);
  // central entrance block with green pediment
  const ze = zf + 0.3;
  k.box(1.5, 1.94, 0.62, 0, 0.14, ze, '#f8ecc4');
  for (const s of [-1, 1]) k.box(0.13, 1.94, 0.66, s * 0.72, 0.14, ze, '#ffffff');
  k.box(1.66, 0.1, 0.7, 0, 1.98, ze, '#ffffff');
  k.gable(1.8, 0.56, 0.7, 0, 2.08, ze, green);
  k.gable(1.42, 0.42, 0.02, 0, 2.12, ze + 0.36, '#ffffff');
  k.box(0.62, 0.74, 0.03, 0, 0.14, ze + 0.31, '#7a4a24');
  k.box(0.02, 0.74, 0.035, 0, 0.14, ze + 0.33, '#5a3418');
  k.box(0.5, 0.2, 0.035, 0, 0.6, ze + 0.33, '#9fd8f5');
  k.window(0.56, 0.4, 0, 1.56, ze + 0.31, glass);
  // bell tower on the roof
  k.box(0.38, 0.44, 0.38, 0, 2.3, 0.3, '#ffffff');
  k.box(0.22, 0.24, 0.4, 0, 2.38, 0.3, '#3b2a1a');
  k.sphere(0.07, 0, 2.47, 0.36, '#ffc928');
  k.cone(0.34, 0.32, 4, 0, 2.74, 0.3, green, Math.PI / 4);
  steps(k, 1.2, ze + 0.31, 3, '#e3dccd');
  plants(k, [[-1.25, zc + 0.36], [1.25, zc + 0.36], [-2.3, zc + 0.36], [2.3, zc + 0.36]]);
  flagpole(k, flags, -2.35, zc + 1.25, 2.3);
  const signs: SignSpec[] = [
    {
      tex: signTexture('k1', 1.4, 0.26, 'EAST PROSPERIDAD CENTRAL ELEM. SCHOOL', 'SCHOOL ID: 131815', '#064e3b', '#fef08a', '#6ee7b7'),
      w: 1.4,
      h: 0.26,
      x: 0,
      y: 1.1,
      z: ze + 0.325,
    },
    {
      tex: signTexture('k1d', 1.04, 0.2, 'DEPARTMENT OF EDUCATION', 'CARAGA REGION XIII • DIVISION OF AGUSAN DEL SUR', '#ffffff', '#1e3a8a', '#047857'),
      w: 1.04,
      h: 0.2,
      x: 0,
      y: 2.24,
      z: ze + 0.375,
    },
  ];
  // the WELCOME sign and "I ♥ EPCES" letters of the old map, at the front of the school yard
  welcomeMonument(k, signs, -1.05, 2.92);
  return { geo: k.build(), signs, flags, occluder: { x0: -W / 2 - 0.3, x1: W / 2 + 0.3, z0: -D / 2 - 0.3, z1: ze + 0.34, h: 2.5 } };
}

/** Kingdom 2: Spanish-colonial municipal hall with clock tower, balcony and terracotta roof. */
function buildHall(): BuildingSpec {
  const k = new Kit();
  const flags: BuildingSpec['flags'] = [];
  const W = 4.9;
  const D = 1.6;
  const wall = '#fbf6ea';
  const trim = '#e3cfa4';
  const roof = '#c4563a';
  const glass = '#33507e';
  const zf = D / 2;
  k.box(W + 0.3, 0.16, D + 0.7, 0, 0, 0.22, '#c9bea8');
  k.box(W, 0.86, D, 0, 0.16, 0, wall);
  k.box(W + 0.1, 0.08, D + 0.1, 0, 1.02, 0, trim);
  k.box(W, 0.8, D, 0, 1.1, 0, wall);
  k.box(W + 0.16, 0.1, D + 0.16, 0, 1.9, 0, trim);
  k.hip(W + 0.42, D + 0.42, 0.62, 0, 2.0, 0, roof);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.15, 1.74, 0.15, sx * (W / 2), 0.16, sz * zf, trim);
  for (const x of [-1.95, -1.45, -0.95, 0.95, 1.45, 1.95]) {
    k.archWindow(0.28, 0.5, x, 0.3, zf, glass);
    k.archWindow(0.28, 0.5, x, 1.22, zf, glass);
    for (const s of [-1, 1]) {
      k.box(0.1, 0.46, 0.03, x + s * 0.21, 0.3, zf + 0.02, '#2e7d4f');
      k.box(0.1, 0.46, 0.03, x + s * 0.21, 1.22, zf + 0.02, '#2e7d4f');
    }
  }
  for (let i = 0; i < 7; i++) k.box(0.26, 0.3, 0.03, -W / 2 + 0.6 + i * 0.62, 1.3, -zf - 0.03, glass);
  // portico with three ground-floor arches and a balcony
  const zp = zf + 0.24;
  k.box(1.76, 1.9, 0.48, 0, 0.16, zp, '#f3ead5');
  for (const x of [-0.52, 0, 0.52]) k.arch(0.36, 0.64, 0.03, x, 0.16, zp + 0.24, '#5a3a22');
  k.box(1.96, 0.07, 0.8, 0, 1.06, zf + 0.4, trim);
  k.box(1.96, 0.05, 0.05, 0, 1.38, zf + 0.78, '#ffffff');
  for (let i = 0; i < 13; i++) k.cyl(0.022, 0.022, 0.26, 6, -0.9 + i * 0.15, 1.13, zf + 0.78, '#ffffff');
  k.arch(0.42, 0.4, 0.03, 0, 1.13, zp + 0.24, '#7a4a24');
  k.gable(1.96, 0.42, 0.5, 0, 2.06, zp, trim);
  k.box(1.9, 0.08, 0.52, 0, 1.98, zp, '#ffffff');
  // clock tower
  const zt = -0.05;
  // kept short so it stays clear of the level-1 tile drawn above it
  k.box(1.0, 0.86, 1.0, 0, 2.0, zt, wall);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.12, 0.86, 0.12, sx * 0.5, 2.0, zt + sz * 0.5, trim);
  k.box(1.1, 0.08, 1.1, 0, 2.86, zt, trim);
  k.box(0.86, 0.42, 0.86, 0, 2.94, zt, wall);
  k.arch(0.32, 0.34, 0.03, 0, 2.97, zt + 0.43, '#3b2a1a');
  k.sphere(0.07, 0, 3.12, zt + 0.4, '#ffc928');
  for (const sx of [-1, 1]) k.arch(0.28, 0.32, 0.03, sx * 0.43, 2.97, zt, '#3b2a1a');
  k.box(0.96, 0.06, 0.96, 0, 3.36, zt, trim);
  k.cone(0.78, 0.5, 4, 0, 3.42, zt, roof, Math.PI / 4);
  k.sphere(0.06, 0, 3.98, zt, '#ffc928');
  steps(k, 1.7, zf + 0.64, 3, '#d9cfbb');
  plants(k, [[-1.4, zf + 0.75], [1.4, zf + 0.75], [-2.2, zf + 0.75], [2.2, zf + 0.75]]);
  flagpole(k, flags, -2.3, zf + 1.45, 2.4);
  const signs: SignSpec[] = [
    {
      tex: signTexture('k2', 1.64, 0.22, 'PAMAHALAANG BAYAN NG PROSPERIDAD', 'MUNICIPAL GOVERNMENT CENTER', '#1e293b', '#fef08a', '#6ee7b7'),
      w: 1.64,
      h: 0.22,
      x: 0,
      y: 1.68,
      z: zp + 0.255,
    },
    { tex: clockTexture(), w: 0.5, h: 0.5, x: 0, y: 2.44, z: zt + 0.51 },
    // details of the old map's hall: town seal, province line and the mayor's office plaque
    { tex: signTexture('k2p', 1.3, 0.08, 'LALAWIGAN NG AGUSAN DEL SUR', '', '#fbf6ea', '#1e3a8a', '#1e3a8a'), w: 1.3, h: 0.08, x: 0, y: 2.12, z: zp + 0.256 },
    { tex: sealTexture('k2', 'PROSPERIDAD', 'town'), w: 0.24, h: 0.24, x: 0, y: 2.3, z: zp + 0.257 },
    { tex: signTexture('k2m', 0.52, 0.09, 'TANGGAPAN NG MAYOR', '', '#7c2d12', '#fef08a', '#fef08a'), w: 0.52, h: 0.09, x: 0, y: 0.88, z: zp + 0.256 },
  ];
  return { geo: k.build(), signs, flags, occluder: { x0: -W / 2 - 0.2, x1: W / 2 + 0.2, z0: -D / 2 - 0.2, z1: zp + 0.3, h: 2.6 } };
}

/** Kingdom 3: neoclassical provincial capitol with columns, pediment and a copper-green dome. */
function buildCapitol(): BuildingSpec {
  const k = new Kit();
  const flags: BuildingSpec['flags'] = [];
  const W = 5.6;
  const D = 1.7;
  const wall = '#f3f1ec';
  const glass = '#2f4a6e';
  const copper = '#4fa58b';
  const zf = D / 2;
  k.box(W + 0.5, 0.22, D + 1.1, 0, 0, 0.32, '#dcd8cf');
  k.box(W, 1.5, D, 0, 0.22, 0, wall);
  k.box(W + 0.04, 0.16, D + 0.04, 0, 0.22, 0, '#d9d4c8');
  k.box(W + 0.14, 0.12, D + 0.14, 0, 1.72, 0, '#ffffff');
  k.box(W + 0.06, 0.16, D + 0.06, 0, 1.84, 0, '#ece9e2');
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.55);
    k.box(1.1, 1.62, D + 0.3, x, 0.22, 0.15, '#f7f5f0');
    k.box(1.2, 0.1, D + 0.36, x, 1.84, 0.15, '#ffffff');
    k.gable(1.2, 0.32, 0.2, x, 1.94, zf + 0.2, '#ffffff');
    k.window(0.3, 0.42, x - 0.22, 0.72, zf + 0.3, glass);
    k.window(0.3, 0.42, x + 0.22, 0.72, zf + 0.3, glass);
    k.window(0.3, 0.38, x - 0.22, 1.36, zf + 0.3, glass);
    k.window(0.3, 0.38, x + 0.22, 1.36, zf + 0.3, glass);
  }
  for (const x of [-1.62, -1.25, 1.25, 1.62]) {
    k.window(0.24, 0.42, x, 0.72, zf, glass);
    k.window(0.24, 0.36, x, 1.36, zf, glass);
  }
  for (let i = 0; i < 9; i++) k.box(0.26, 0.36, 0.03, -W / 2 + 0.5 + i * 0.58, 0.9, -zf - 0.03, glass);
  // portico
  const zp = zf + 0.42;
  k.box(2.5, 0.08, 0.86, 0, 0.22, zp, '#e8e4dc');
  k.box(0.62, 0.86, 0.03, 0, 0.3, zf + 0.015, '#6b4220');
  k.box(0.02, 0.86, 0.035, 0, 0.3, zf + 0.03, '#4a2e14');
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + i * 0.4;
    k.box(0.2, 0.06, 0.2, x, 0.3, zp + 0.24, '#ffffff');
    k.cyl(0.085, 0.072, 1.3, 12, x, 0.36, zp + 0.24, '#ffffff');
    k.box(0.21, 0.06, 0.21, x, 1.66, zp + 0.24, '#ffffff');
  }
  k.box(2.56, 0.2, 0.9, 0, 1.72, zp, '#ffffff');
  k.gable(2.66, 0.56, 0.9, 0, 1.92, zp, '#f7f5f0');

  // dome
  // low drum + slightly flattened dome so it stays clear of the level-1 tile drawn above it
  k.cyl(0.8, 0.8, 0.3, 28, 0, 2.0, -0.1, wall);
  k.cyl(0.86, 0.86, 0.06, 28, 0, 2.28, -0.1, '#ffffff');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.box(0.1, 0.16, 0.02, Math.sin(a) * 0.805, 2.06, -0.1 + Math.cos(a) * 0.805, glass, a);
  }
  k.push(new THREE.SphereGeometry(0.82, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1), copper, 0, 2.34, -0.1);
  k.cyl(0.16, 0.16, 0.2, 12, 0, 2.93, -0.1, '#ffffff');
  k.dome(0.18, 0, 3.13, -0.1, copper, 14);
  k.sphere(0.055, 0, 3.36, -0.1, '#ffc928');
  // grand steps
  steps(k, 2.3, zp + 0.43, 4, '#e3dfd6', 0.055, 0.15);
  plants(k, [[-1.65, zp + 0.75], [1.65, zp + 0.75]]);
  flagpole(k, flags, -2.4, zp + 1.3, 2.3);
  flagpole(k, flags, 2.1, zp + 1.3, 2.3);
  const signs: SignSpec[] = [
    {
      tex: signTexture('k3', 2.36, 0.19, 'KAPITOLYO PROBINSYAL NG AGUSAN DEL SUR', 'PROVINCIAL GOVERNMENT CENTER • PATIN-AY', '#0f172a', '#fef08a', '#6ee7b7'),
      w: 2.36,
      h: 0.19,
      x: 0,
      y: 1.82,
      z: zp + 0.455,
    },
    // province seal and line on the pediment, as on the old map
    { tex: signTexture('k3p', 1.5, 0.075, 'LALAWIGAN NG AGUSAN DEL SUR', '', '#f7f5f0', '#1e3a8a', '#1e3a8a'), w: 1.5, h: 0.075, x: 0, y: 2.0, z: zp + 0.456 },
    { tex: sealTexture('k3', 'AGUSAN DEL SUR', 'province'), w: 0.3, h: 0.3, x: 0, y: 2.21, z: zp + 0.457 },
  ];
  return { geo: k.build(), signs, flags, occluder: { x0: -W / 2 - 0.2, x1: W / 2 + 0.2, z0: -D / 2 - 0.2, z1: zp + 0.5, h: 2.8 } };
}

/* ── Materials ─────────────────────────────────────────────────────── */

let MATS: ReturnType<typeof makeMaterials> | null = null;
function materials() {
  if (!MATS) MATS = makeMaterials();
  return MATS;
}

function makeMaterials() {
  return {
    flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    smooth: new THREE.MeshLambertMaterial({ vertexColors: true }),
    ground: new THREE.MeshLambertMaterial({ map: grassTexture(), vertexColors: true }),
    track: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    water: new THREE.MeshLambertMaterial({ map: waterTexture(), color: '#5cc8f2', emissive: '#1f7fb0', emissiveIntensity: 0.28, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    // paving draws above the road, so the road stops at the plaza edge instead of running over it
    paving: new THREE.MeshLambertMaterial({ map: pavingTexture(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    road: new THREE.MeshLambertMaterial({ map: roadTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    flag: new THREE.MeshLambertMaterial({ map: flagTexture(), side: THREE.DoubleSide }),
  };
}

/* ── Character GLB cache ───────────────────────────────────────────── */

let loader: GLTFLoader | null = null;
const glbCache = new Map<string, Promise<GLTF>>();
function loadGlb(url: string): Promise<GLTF> {
  let p = glbCache.get(url);
  if (!p) {
    if (!loader) {
      const draco = new DRACOLoader();
      draco.setDecoderPath('/draco/');
      loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
    }
    p = loader.loadAsync(url);
    p.catch(() => glbCache.delete(url));
    glbCache.set(url, p);
  }
  return p;
}

/** Starts downloading a student model early (e.g. while the pupil picks a character). */
export function preloadStudentModel(imageUrl: string): void {
  const url = avatarModelUrl(imageUrl);
  if (url) void loadGlb(url).catch(() => undefined);
}

/* ── Road / stream polylines with fast distance queries ────────────── */

class Polyline {
  readonly pts: Array<{ x: number; y: number }>;
  private readonly minY: number[] = [];
  private readonly maxY: number[] = [];
  constructor(pts: Array<{ x: number; y: number }>) {
    this.pts = pts;
    for (let i = 0; i < pts.length - 1; i++) {
      this.minY.push(Math.min(pts[i].y, pts[i + 1].y));
      this.maxY.push(Math.max(pts[i].y, pts[i + 1].y));
    }
  }
  /** Distance in map px; segments whose y range is farther than `cut` are skipped. */
  dist(x: number, y: number, cut = 400): number {
    let best = cut * cut * 4;
    const p = this.pts;
    for (let i = 0; i < p.length - 1; i++) {
      if (y < this.minY[i] - cut || y > this.maxY[i] + cut) continue;
      const ax = p[i].x;
      const ay = p[i].y;
      const vx = p[i + 1].x - ax;
      const vy = p[i + 1].y - ay;
      const l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
      const dx = x - (ax + vx * t);
      const dy = y - (ay + vy * t);
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

/* ── The world ─────────────────────────────────────────────────────── */

interface Placed {
  x: number;
  y: number;
  s: number;
  rot: number;
  tint?: THREE.Color;
}

/** One tree instance that may turn see-through (position in world units). */
interface SeeThroughTree {
  mesh: THREE.InstancedMesh;
  index: number;
  matrix: THREE.Matrix4;
  geo: THREE.BufferGeometry;
  x: number;
  z: number;
  /** Ground under the tree and the top of its crown. */
  y0: number;
  top: number;
  /** Crown radius. */
  r: number;
}

/** Faded trees: how see-through, and how often the sight line is checked (like Tala-Salitaan). */
const TREE_GHOST_OPACITY = 0.28;
const TREE_CHECK_S = 0.12;
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface Bridge {
  x: number;
  y: number;
  /** unit direction along the road */
  dx: number;
  dy: number;
  len: number;
}

/** Half width of the brick road (map px) and the road length covered by one texture tile. */
const ROAD_HALF = 50;
const ROAD_TILE = 82;
const BRIDGE_LEN = 170;
const STREAM_HALF = 33;
const SAND_HALF = 47;

export class World3D {
  readonly canvas: HTMLCanvasElement;
  readonly charCanvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private charRenderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private charScene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  private charCam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  private sun: THREE.DirectionalLight;
  private charSun: THREE.DirectionalLight;
  private world = new THREE.Group();
  private disposables: Array<{ dispose(): void }> = [];

  /* see-through trees (Tala-Salitaan): a tree between the camera and the student is drawn faded */
  private trees: SeeThroughTree[] = [];
  private readonly ghosts = new Map<number, THREE.Mesh>();
  private ghostMat: THREE.MeshLambertMaterial | null = null;
  private treeTick = 0;
  private treeKey = '';
  private road: Polyline | null = null;
  private streams: Polyline[] = [];
  private ponds: Ellipse[] = [];
  private plazas: Ellipse[] = [];
  private blocks: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  private bridges: Bridge[] = [];
  private input: World3DInput | null = null;
  private vw = 1;
  private vh = 1;
  private readonly lite: boolean;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  /* 360° orbit around the focus point (yaw 0 = looking north, like the 2D map) */
  private yaw = 0;
  private pitch = PITCH;
  private shadowCenter = new THREE.Vector3(1e9, 0, 1e9);
  private shadowHalf = 0;

  /* see-through building when it covers a level or the student */
  private fade = 1;
  private fadeTarget = 1;
  private occluderBox: THREE.Box3 | null = null;
  private occKey = '';
  private readonly ray = new THREE.Ray();
  private flagMat: THREE.MeshLambertMaterial | null = null;

  /* render-on-demand */
  private viewKey = '';
  private readonly lastView = { x: NaN, y: NaN, zoom: NaN, yaw: NaN, pitch: NaN };
  private renderedKey = '';
  private dirty = true;

  /* clouds and birds (own canvas above the world, see Sky3D.ts) */
  private readonly sky: SkyLife;
  readonly skyCanvas: HTMLCanvasElement;
  private skyKey = '';
  private readonly focus = { x: 0, z: 0 };

  /* kingdom building */
  private mute = { value: 1 };
  private muteTarget = 1;
  private buildingMat: THREE.MeshPhongMaterial;
  private signMats: THREE.MeshBasicMaterial[] = [];
  private landmarkBox: THREE.Box3 | null = null;

  /* quality */
  private pixelRatio: number;
  private perf = { t: 0, n: 0, level: 0 };

  /* avatar */
  private avatarUrl: string | null = null;
  private avatarRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private currentClip = '';
  private avatarShadow: THREE.Mesh;
  private lastAvatar = { x: NaN, y: NaN };
  private heading = 0;
  private speed = 0;
  private wasWalking = false;
  private avatarLoadToken = 0;
  private charBoxW = 200;
  private charBoxH = 260;
  avatarReady = false;

  constructor(opts: { lite: boolean; mobile?: boolean }) {
    this.lite = opts.lite;
    // phones and tablets: lower resolution and a smaller shadow map (their screens are dense anyway)
    const mobile = opts.mobile ?? false;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.lite ? 1 : mobile ? 1.25 : 1.5);
    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.lite, alpha: false, stencil: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // the world is static: the shadow map is redrawn only when the shadow box moves (updateShadowBox)
    this.renderer.shadowMap.autoUpdate = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'vq-world3d-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';

    this.charRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: false, premultipliedAlpha: true });
    this.charRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.charRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.charRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.charRenderer.setClearColor(0x000000, 0);
    this.charCanvas = this.charRenderer.domElement;
    this.charCanvas.className = 'vq-world3d-char';
    this.charCanvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;visibility:hidden;will-change:transform;';

    this.sky = new SkyLife({ lite: opts.lite, mobile, shadowTex: blobTexture() });
    this.skyCanvas = this.sky.canvas;

    // Same light as Tala-Salitaan's map.
    const hemi = new THREE.HemisphereLight('#d9f0ff', '#4f7d35', 0.95);
    this.sun = new THREE.DirectionalLight('#fff4dc', 1.9);
    this.sun.castShadow = true;
    const shadowSize = opts.lite || mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 60;
    this.scene.add(hemi, this.sun, this.sun.target, this.world);

    this.charScene.add(new THREE.HemisphereLight('#d9f0ff', '#4f7d35', 1.15));
    this.charSun = new THREE.DirectionalLight('#fff4dc', 1.9);
    this.charScene.add(this.charSun, this.charSun.target);

    const shadowMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.avatarShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), shadowMat);
    this.avatarShadow.rotation.x = -Math.PI / 2;
    this.avatarShadow.visible = false;
    this.charScene.add(this.avatarShadow);

    // transparent so it can fade when it hides a level button or the student (opacity 1 otherwise)
    this.buildingMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 26, specular: new THREE.Color('#2a2a2a'), transparent: true });
    const mute = this.mute;
    this.buildingMat.onBeforeCompile = (sh) => {
      sh.uniforms.uMute = mute;
      sh.vertexShader =
        'uniform float uMute;\n' +
        sh.vertexShader.replace(
          '#include <color_vertex>',
          `#include <color_vertex>
          #ifdef USE_COLOR
            float vqGrey = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
            vColor.rgb = mix(vColor.rgb, vec3(vqGrey * 0.5 + 0.3), uMute * 0.8);
          #endif`,
        );
    };
  }

  /** Vertical ground foreshortening at the screen centre (used to convert drag pixels to map pixels). */
  get groundScaleY(): number {
    return Math.sin(PITCH);
  }

  /* ── coordinates and ground ── */

  private X(x: number): number {
    return (x - (this.input?.mapW ?? 1200) / 2) * U;
  }
  private Z(y: number): number {
    return y * U;
  }

  /** Ground height without the stream/pond dips (hills on the far sides only; the map itself is flat). */
  private baseHeight(x: number, y: number): number {
    const inp = this.input;
    if (!inp) return 0;
    const side = Math.abs(x - inp.mapW / 2) - 680;
    if (side <= 0) return 0;
    const k = smoothstep(0, 1300, side);
    return Math.pow(k, 1.5) * (0.5 + (fbm(x * 0.0016, y * 0.0016, inp.kingdom * 5 + 3) + 1) * 0.95);
  }

  heightAt(x: number, y: number): number {
    let h = this.baseHeight(x, y);
    let dip = 0;
    for (const s of this.streams) {
      const d = s.dist(x, y, 140);
      if (d < 100) dip = Math.max(dip, 1 - smoothstep(55, 100, d));
    }
    for (const p of this.ponds) {
      const q = Math.hypot((x - p.x) / (p.rx + 18), (y - p.y) / (p.ry + 18));
      if (q < 1.45) dip = Math.max(dip, 1 - smoothstep(1.0, 1.45, q));
    }
    h -= dip * 0.2;
    return h;
  }

  /** Where the student's feet are: the ground, or the deck of a bridge. */
  private feetHeight(x: number, y: number): number {
    for (const b of this.bridges) {
      const rx = x - b.x;
      const ry = y - b.y;
      const along = rx * b.dx + ry * b.dy;
      const across = -rx * b.dy + ry * b.dx;
      if (Math.abs(along) < b.len / 2 && Math.abs(across) < 70) {
        const s = along / b.len;
        return 0.1 + Math.cos(s * Math.PI) * 0.1;
      }
    }
    return Math.max(this.heightAt(x, y), this.baseHeight(x, y) - 0.02);
  }

  private nearWater(x: number, y: number, margin: number): boolean {
    for (const s of this.streams) if (s.dist(x, y, 200) < SAND_HALF + margin) return true;
    for (const p of this.ponds) if (Math.hypot((x - p.x) / (p.rx + 14 + margin), (y - p.y) / (p.ry + 14 + margin)) < 1) return true;
    return false;
  }

  private onPlaza(x: number, y: number, margin = 0): boolean {
    if (this.plazas.some((p) => Math.hypot((x - p.x) / (p.rx + margin), (y - p.y) / (p.ry + margin)) < 1)) return true;
    return this.blocks.some((b) => x > b.x0 - margin && x < b.x1 + margin && y > b.y0 - margin && y < b.y1 + margin);
  }

  /**
   * The drawn road ends just inside the school yard and the gate yard (the paving covers the last
   * bit), so the bricks never run over the building's ground.
   */
  private trimToPlazas(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const inside = (p: { x: number; y: number }) =>
      this.plazas.some((e) => Math.hypot((p.x - e.x) / e.rx, (p.y - e.y) / e.ry) < 0.9);
    let a = 0;
    let b = pts.length - 1;
    while (a < b && inside(pts[a])) a++;
    while (b > a && inside(pts[b])) b--;
    return pts.slice(Math.max(0, a - 1), Math.min(pts.length, b + 2));
  }

  /* ── kingdom build ── */

  setKingdom(inp: World3DInput): void {
    this.clearWorld();
    this.input = inp;
    const t = inp.theme;
    const rnd = mulberry32(inp.kingdom * 7717 + 13);

    // Tala's sky-blue fog, warmed a little towards each kingdom's sky.
    const fogCol = new THREE.Color('#bfe6fb').lerp(new THREE.Color(t.skyBot), 0.22);
    this.scene.background = fogCol;
    this.scene.fog = new THREE.Fog(fogCol, 14, 34);

    const nodes = inp.nodes;
    const L = inp.landmark;
    const n0 = nodes[0] ?? { x: L.x, y: L.y - 300 };

    // Building footprint (map px) and the school yard in front of it.
    this.blocks = [{ x0: L.x - 300, x1: L.x + 300, y0: L.y - 130, y1: L.y + 200 }];
    this.plazas = [{ x: L.x, y: L.y + 175, rx: 345, ry: 128 }];
    if (inp.gate) this.plazas.push({ x: inp.gate.x, y: inp.gate.y, rx: 150, ry: 105 });

    // Road: from the school yard, around the right side of the building, then through every level to the gate.
    const ctrl = [
      { x: L.x + 150, y: L.y + 205 },
      { x: L.x + 405, y: L.y + 130 },
      { x: L.x + 430, y: L.y - 90 },
      { x: n0.x + 240, y: n0.y + 70 },
      ...nodes.map((n) => ({ x: n.x, y: n.y })),
    ];
    if (inp.gate) ctrl.push({ x: inp.gate.x, y: inp.gate.y + 30 });
    const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(p.x, 0, p.y)), false, 'centripetal');
    const roadPts = curve.getSpacedPoints(Math.max(200, Math.round(curve.getLength() / 20))).map((v) => ({ x: v.x, y: v.z }));
    this.road = new Polyline(roadPts);

    // Streams: three per kingdom, each crossing the road halfway between two levels.
    this.streams = [];
    for (const cr of [0.2, 0.48, 0.77]) {
      const i = Math.max(1, Math.min(nodes.length - 2, Math.round(cr * (nodes.length - 1))));
      const a = nodes[i];
      const b = nodes[i + 1];
      const yMid = (a.y + b.y) / 2;
      const xc = (a.x + b.x) / 2;
      const pts: Array<{ x: number; y: number }> = [];
      const ph = rnd() * 6;
      for (let x = -1500; x <= inp.mapW + 1500; x += 40) {
        const damp = smoothstep(120, 520, Math.abs(x - xc));
        const wob = Math.sin(x * 0.0042 + ph) * 85 + Math.sin(x * 0.011 + ph * 2) * 28;
        pts.push({ x, y: yMid + wob * damp + (x - xc) * 0.04 * damp });
      }
      this.streams.push(new Polyline(pts));
    }

    // Ponds from the 2D water bodies (they already avoid the road).
    this.ponds = inp.water
      .map((w) => ({ x: w.x + w.w / 2, y: w.y + w.h / 2, rx: w.w / 2, ry: w.h / 2 }))
      .filter((p) => !this.streams.some((s) => s.dist(p.x, p.y, 300) < p.rx + 110) && !this.onPlaza(p.x, p.y, p.rx));

    this.findBridges(roadPts);
    this.buildTerrain();
    this.buildRoad(this.trimToPlazas(roadPts));
    this.buildWater();
    this.buildPlazas();
    this.buildNodePads(nodes);
    this.buildLandmark(inp.kingdom, L);
    this.buildScenery(rnd);
    this.dirty = true;
    this.shadowHalf = 0;
    this.viewKey = '';
    this.occKey = '';
    this.renderer.shadowMap.needsUpdate = true;
  }

  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  private add(mesh: THREE.Object3D): void {
    this.world.add(mesh);
  }

  private findBridges(roadPts: Array<{ x: number; y: number }>): void {
    this.bridges = [];
    for (const s of this.streams) {
      let best = { d: Infinity, i: 0 };
      for (let i = 0; i < roadPts.length; i++) {
        const d = s.dist(roadPts[i].x, roadPts[i].y, 120);
        if (d < best.d) best = { d, i };
      }
      if (best.d > 40) continue;
      const a = roadPts[Math.max(0, best.i - 2)];
      const b = roadPts[Math.min(roadPts.length - 1, best.i + 2)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      this.bridges.push({ x: roadPts[best.i].x, y: roadPts[best.i].y, dx: (b.x - a.x) / l, dy: (b.y - a.y) / l, len: BRIDGE_LEN });
    }
  }

  private buildTerrain(): void {
    const inp = this.input!;
    const x0 = -1500;
    const x1 = inp.mapW + 1500;
    const y0 = -1500;
    const y1 = inp.mapH + 1600;
    const step = this.lite ? 50 : 40;
    const nx = Math.round((x1 - x0) / step);
    const ny = Math.round((y1 - y0) / step);
    const sx = (x1 - x0) / nx;
    const sy = (y1 - y0) / ny;
    const W = nx + 1;
    // One height grid for the whole ground, so tile edges match exactly.
    const H = new Float32Array(W * (ny + 1));
    const B = new Float32Array(W * (ny + 1));
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = x0 + i * sx;
        const y = y0 + j * sy;
        H[j * W + i] = this.heightAt(x, y);
        B[j * W + i] = this.baseHeight(x, y);
      }
    }
    const c = new THREE.Color();
    const nrm = new THREE.Vector3();
    const hillTint = new THREE.Color('#e6dfae');
    const bankTint = new THREE.Color('#d9c48e');
    // Ground tiles about one chunk wide: tiles outside the view are skipped by the GPU.
    const tile = Math.max(4, Math.round(CHUNK / step));
    for (let tj = 0; tj < ny; tj += tile) {
      for (let ti = 0; ti < nx; ti += tile) {
        const cw = Math.min(tile, nx - ti);
        const ch = Math.min(tile, ny - tj);
        const n = (cw + 1) * (ch + 1);
        const pos = new Float32Array(n * 3);
        const nor = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const uvs = new Float32Array(n * 2);
        let v = 0;
        for (let j = 0; j <= ch; j++) {
          for (let i = 0; i <= cw; i++, v++) {
            const gi = ti + i;
            const gj = tj + j;
            const x = x0 + gi * sx;
            const y = y0 + gj * sy;
            const h = H[gj * W + gi];
            const X = this.X(x);
            const Z = this.Z(y);
            pos[v * 3] = X;
            pos[v * 3 + 1] = h;
            pos[v * 3 + 2] = Z;
            const iL = Math.max(0, gi - 1);
            const iR = Math.min(nx, gi + 1);
            const jU = Math.max(0, gj - 1);
            const jD = Math.min(ny, gj + 1);
            const dhx = (H[gj * W + iR] - H[gj * W + iL]) / ((iR - iL) * sx * U);
            const dhz = (H[jD * W + gi] - H[jU * W + gi]) / ((jD - jU) * sy * U);
            nrm.set(-dhx, 1, -dhz).normalize();
            nor[v * 3] = nrm.x;
            nor[v * 3 + 1] = nrm.y;
            nor[v * 3 + 2] = nrm.z;
            uvs[v * 2] = X / 2.6;
            uvs[v * 2 + 1] = -Z / 2.6;
            const nz = vnoise(x * 0.003, y * 0.003, 31);
            c.setScalar(0.92 + nz * 0.12);
            const base = B[gj * W + gi];
            if (base > 0.3) c.lerp(hillTint, smoothstep(0.3, 2.4, base) * 0.3);
            if (h < base - 0.02) c.lerp(bankTint, Math.min(1, (base - h) * 6));
            col[v * 3] = c.r;
            col[v * 3 + 1] = c.g;
            col[v * 3 + 2] = c.b;
          }
        }
        const idx: number[] = [];
        for (let j = 0; j < ch; j++) {
          for (let i = 0; i < cw; i++) {
            const a = j * (cw + 1) + i;
            const b = a + 1;
            const cc = a + cw + 1;
            const d = cc + 1;
            idx.push(a, cc, b, b, cc, d);
          }
        }
        const geo = this.track(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.setIndex(idx);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, materials().ground);
        mesh.receiveShadow = true;
        this.add(mesh);
      }
    }
  }

  /** A flat strip along a polyline (faces up). */
  private ribbon(
    pts: Array<{ x: number; y: number }>,
    half: (i: number) => number,
    yAt: (x: number, y: number) => number,
    color: THREE.Color | null,
    vScale = 0,
  ): THREE.BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / tl;
      const ny = (b.x - a.x) / tl;
      if (i > 0) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const w = half(i);
      for (const side of [-1, 1]) {
        const x = pts[i].x + nx * side * w;
        const y = pts[i].y + ny * side * w;
        pos.push(this.X(x), yAt(x, y), this.Z(y));
        if (color) col.push(color.r, color.g, color.b);
        if (vScale) uv.push(side < 0 ? 0 : 1, len / vScale);
      }
      if (i > 0) {
        const k = i * 2;
        idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (vScale) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    if (nrm.count && nrm.getY(0) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    g.computeBoundingSphere();
    return this.track(g);
  }

  private overWater(x: number, y: number): boolean {
    for (const s of this.streams) if (s.dist(x, y, 120) < SAND_HALF + 4) return true;
    return false;
  }

  /**
   * Vocab Quest's own road (not Tala-Salitaan's sandy track): terracotta "laryo" bricks in a
   * basket-weave pattern between light stone curbs, with a dark grass line along the edges.
   */
  private buildRoad(pts: Array<{ x: number; y: number }>): void {
    const m = materials();
    const yAt = (lift: number) => (x: number, y: number) => (this.overWater(x, y) ? this.baseHeight(x, y) - 0.3 : this.baseHeight(x, y) + lift);
    const edge = this.ribbon(pts, () => ROAD_HALF + 9, yAt(0.012), new THREE.Color('#4c8f37'));
    const em = new THREE.Mesh(edge, m.track);
    em.receiveShadow = true;
    this.add(em);
    const road = this.ribbon(pts, () => ROAD_HALF, yAt(0.02), null, ROAD_TILE);
    const rm = new THREE.Mesh(road, m.road);
    rm.receiveShadow = true;
    this.add(rm);
  }

  private buildWater(): void {
    const m = materials();
    const rnd = mulberry32(4242);
    const rocks: Placed[] = [];
    for (const s of this.streams) {
      const pts = s.pts;
      const sand = this.ribbon(pts, (i) => SAND_HALF + Math.sin(i * 0.37) * 4, (x, y) => this.baseHeight(x, y) - 0.03, new THREE.Color('#e7d39d'));
      const sm = new THREE.Mesh(sand, m.track);
      sm.receiveShadow = true;
      this.add(sm);
      const water = this.ribbon(pts, (i) => STREAM_HALF + Math.sin(i * 0.37) * 4, (x, y) => this.baseHeight(x, y) - 0.022, null, 150);
      const wm = new THREE.Mesh(water, m.water);
      wm.receiveShadow = true;
      this.add(wm);
      for (let i = 0; i < pts.length; i += 2) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.6) continue;
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(pts.length - 1, i + 1)];
          const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const off = SAND_HALF - 4 + rnd() * 10;
          const rx = pts[i].x - ((b.y - a.y) / tl) * side * off;
          const ry = pts[i].y + ((b.x - a.x) / tl) * side * off;
          if (this.road!.dist(rx, ry, 200) < 110) continue;
          rocks.push({ x: rx, y: ry, s: 0.4 + rnd() * 0.5, rot: rnd() * 6.28 });
        }
      }
    }
    for (const b of this.bridges) this.buildBridge(b);

    const lilies: Placed[] = [];
    for (const p of this.ponds) {
      const sandG = this.track(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2));
      const c = new THREE.Color('#e7d39d');
      const n = sandG.getAttribute('position').count;
      sandG.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [c.r, c.g, c.b]), 3));
      sandG.scale((p.rx + 14) * U, 1, (p.ry + 14) * U);
      sandG.translate(this.X(p.x), this.baseHeight(p.x, p.y) - 0.03, this.Z(p.y));
      this.add(new THREE.Mesh(sandG, m.track));
      const wg = this.track(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2));
      wg.scale(p.rx * U, 1, p.ry * U);
      wg.translate(this.X(p.x), this.baseHeight(p.x, p.y) - 0.022, this.Z(p.y));
      const wm = new THREE.Mesh(wg, m.water);
      wm.receiveShadow = true;
      this.add(wm);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + rnd() * 0.4;
        rocks.push({ x: p.x + Math.cos(a) * (p.rx + 12), y: p.y + Math.sin(a) * (p.ry + 10), s: 0.4 + rnd() * 0.4, rot: rnd() * 6.28 });
      }
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * 0.65;
        lilies.push({ x: p.x + Math.cos(a) * p.rx * r, y: p.y + Math.sin(a) * p.ry * r, s: 0.8 + rnd() * 0.5, rot: rnd() * 6.28 });
      }
    }
    const g = sceneryGeos();
    this.inst(g.lily, m.flat, lilies, { lift: -0.015, cast: false, receive: false, ground: 'base' });
    this.inst(g.rockA, m.flat, rocks.filter((_, i) => i % 2 === 0), { cast: true, receive: false, tint: 'rock' });
    this.inst(g.rockB, m.flat, rocks.filter((_, i) => i % 2 === 1), { cast: true, receive: false, tint: 'rock' });
  }

  private buildBridge(b: Bridge): void {
    const k = new Kit();
    const len = b.len * U;
    const planks = 12;
    for (let i = 0; i < planks; i++) {
      const s = i / (planks - 1) - 0.5;
      k.box(1.3, 0.05, len / planks - 0.015, 0, 0.05 + Math.cos(s * Math.PI) * 0.1, s * len, i % 2 ? '#a8743f' : '#9a6a3a');
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const s = i / 3 - 0.5;
        k.cyl(0.035, 0.035, 0.42, 6, side * 0.64, -0.02 + Math.cos(s * Math.PI) * 0.1, s * len * 0.94, '#6b4524');
      }
      k.box(0.05, 0.05, len * 0.96, side * 0.64, 0.34 + 0.06, 0, '#7a4f2a');
    }
    const g = this.track(k.build());
    const mesh = new THREE.Mesh(g, materials().flat);
    mesh.position.set(this.X(b.x), this.baseHeight(b.x, b.y), this.Z(b.y));
    mesh.rotation.y = Math.atan2(b.dx, b.dy);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.add(mesh);
  }

  private buildPlazas(): void {
    const m = materials();
    const tex = m.paving.map!;
    tex.repeat.set(1, 1);
    for (const p of this.plazas) {
      const g = this.track(new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2));
      // world-scaled UVs: one tile = 0.6 units
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) * p.rx * U) / 2.4, (pos.getZ(i) * p.ry * U) / 2.4);
      g.scale(p.rx * U, 1, p.ry * U);
      g.translate(this.X(p.x), 0.024, this.Z(p.y));
      const mesh = new THREE.Mesh(g, m.paving);
      mesh.receiveShadow = true;
      this.add(mesh);
    }
    // border stones around the plazas
    const stones: Placed[] = [];
    for (const p of this.plazas) {
      const n = Math.round((p.rx + p.ry) / 14);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = p.x + Math.cos(a) * (p.rx + 4);
        const y = p.y + Math.sin(a) * (p.ry + 4);
        if (this.road!.dist(x, y, 100) < 64) continue;
        stones.push({ x, y, s: 0.75, rot: a });
      }
    }
    this.inst(sceneryGeos().stone, m.flat, stones, { lift: 0.012, cast: false, receive: true });
  }

  private buildNodePads(nodes: Array<{ x: number; y: number }>): void {
    const items: Placed[] = nodes.map((n) => ({ x: n.x, y: n.y, s: 1, rot: 0 }));
    this.inst(sceneryGeos().pad, materials().flat, items, { cast: false, receive: true, lift: 0.022, ground: 'base' });
  }

  private buildLandmark(kingdom: 1 | 2 | 3, at: { x: number; y: number }): void {
    const spec = kingdom === 1 ? buildSchool() : kingdom === 2 ? buildHall() : buildCapitol();
    const group = new THREE.Group();
    group.position.set(this.X(at.x), 0, this.Z(at.y));
    group.scale.setScalar(LANDMARK_SCALE);
    const body = new THREE.Mesh(this.track(spec.geo), this.buildingMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    this.signMats = [];
    for (const s of spec.signs) {
      const mat = this.track(new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false, transparent: true }));
      this.signMats.push(mat);
      const mesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(s.w, s.h)), mat);
      mesh.position.set(s.x, s.y, s.z);
      if (s.ry) mesh.rotation.y = s.ry;
      group.add(mesh);
    }
    this.flagMat = this.track(materials().flag.clone());
    this.flagMat.transparent = true;
    for (const f of spec.flags) {
      const mesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.62, 0.36, 6, 1)), this.flagMat);
      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 0.31) * 7) * 0.035 * (p.getX(i) + 0.31));
      mesh.geometry.computeVertexNormals();
      mesh.position.set(f.x, f.y, f.z);
      mesh.castShadow = true;
      group.add(mesh);
    }
    this.add(group);
    group.updateMatrixWorld(true);
    this.sky.setOccluder(spec.geo, body.matrixWorld);
    this.landmarkBox = new THREE.Box3().setFromObject(group);
    // occluder = the building itself (not the yard, flagpoles or the welcome sign in front)
    const occ = spec.occluder;
    this.occluderBox = new THREE.Box3(new THREE.Vector3(occ.x0, 0, occ.z0), new THREE.Vector3(occ.x1, occ.h, occ.z1)).applyMatrix4(group.matrixWorld);
    this.fade = 1;
    this.fadeTarget = 1;
    this.applyMute();
  }

  /**
   * True while the student stands in front of the kingdom building to look at it: the building
   * then stays solid even if level buttons are behind it (ModernWorldMap hides those buttons).
   */
  viewingBuilding = false;

  /** Is the map point (x, y) at height h hidden from the camera by the kingdom building? */
  blockedByBuilding(x: number, y: number, h = 0.25, whole = false): boolean {
    // whole: the full landmark (tower, dome, flags and signs too), not just the main walls
    const box = whole ? this.landmarkBox : this.occluderBox;
    if (!box) return false;
    const cam = this.camera.position;
    const p = this.tmp.set(this.X(x), h, this.Z(y));
    const d = cam.distanceTo(p);
    this.ray.origin.copy(cam);
    this.ray.direction.copy(p).sub(cam).normalize();
    return !!this.ray.intersectBox(box, this.tmp2) && cam.distanceTo(this.tmp2) < d - 0.05;
  }

  /**
   * See-through trees, like Tala-Salitaan: a few times a second, trees standing on the sight line
   * from the camera to the student (and tall enough to cover it) are hidden in their instanced mesh
   * and drawn as a faded copy instead. Only the student counts (not level buttons).
   */
  private updateTrees(avatar: AvatarState | null, dt: number): void {
    this.treeTick += dt;
    if (this.treeTick < TREE_CHECK_S) return;
    this.treeTick = 0;
    const visible = !!avatar?.visible && !!this.avatarRoot;
    const key = visible ? `${this.viewKey}|${avatar!.x.toFixed(0)},${avatar!.y.toFixed(0)}` : '';
    if (key === this.treeKey) return;
    this.treeKey = key;

    const hits = new Set<number>();
    if (visible && this.trees.length) {
      const cam = this.camera.position;
      const tx = this.X(avatar!.x);
      const tz = this.Z(avatar!.y);
      const ty = this.feetHeight(avatar!.x, avatar!.y) + 0.65 * AVATAR_SCALE; // the student's chest
      const dx = tx - cam.x;
      const dz = tz - cam.z;
      const len2 = dx * dx + dz * dz;
      if (len2 > 1e-4) {
        for (let i = 0; i < this.trees.length; i++) {
          const tr = this.trees[i];
          // where the tree is along the camera -> student line (0 = camera, 1 = student)
          const t = ((tr.x - cam.x) * dx + (tr.z - cam.z) * dz) / len2;
          if (t <= 0 || t >= 0.97) continue;
          const ox = cam.x + dx * t - tr.x;
          const oz = cam.z + dz * t - tr.z;
          const reach = tr.r + 0.3 * AVATAR_SCALE; // crown + half the student
          if (ox * ox + oz * oz > reach * reach) continue;
          // the sight line, at the tree, runs below the crown top: the tree hides the student
          const lineY = cam.y + (ty - cam.y) * t;
          if (lineY < tr.top + 0.1) hits.add(i);
        }
      }
    }

    let changed = false;
    const touched = new Set<THREE.InstancedMesh>();
    for (const [i, ghost] of this.ghosts) {
      if (hits.has(i)) continue;
      const tr = this.trees[i];
      tr.mesh.setMatrixAt(tr.index, tr.matrix);
      touched.add(tr.mesh);
      this.world.remove(ghost);
      this.ghosts.delete(i);
      changed = true;
    }
    for (const i of hits) {
      if (this.ghosts.has(i)) continue;
      const tr = this.trees[i];
      tr.mesh.setMatrixAt(tr.index, ZERO_MATRIX);
      touched.add(tr.mesh);
      if (!this.ghostMat) {
        this.ghostMat = (materials().flat as THREE.MeshLambertMaterial).clone();
        this.ghostMat.transparent = true;
        this.ghostMat.opacity = TREE_GHOST_OPACITY;
        this.ghostMat.depthWrite = false;
      }
      const ghost = new THREE.Mesh(tr.geo, this.ghostMat);
      ghost.matrixAutoUpdate = false;
      ghost.matrix.copy(tr.matrix);
      ghost.renderOrder = 2;
      this.world.add(ghost);
      ghost.updateMatrixWorld(true);
      this.ghosts.set(i, ghost);
      changed = true;
    }
    if (!changed) return;
    for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true;
    this.renderer.shadowMap.needsUpdate = true; // the faded tree casts no shadow
    this.dirty = true;
  }

  /** Fades the building when it stands between the camera and a level button or the student. */
  private updateOcclusion(avatar: AvatarState | null): void {
    const box = this.occluderBox;
    const inp = this.input;
    if (!box || !inp) return;
    const key = `${this.viewKey}|${this.muteTarget}|${this.viewingBuilding}|${avatar ? `${avatar.x.toFixed(0)},${avatar.y.toFixed(0)},${avatar.visible}` : ''}`;
    if (key === this.occKey) return;
    this.occKey = key;
    // A locked kingdom is the thing to look at (its levels are all locked): keep it solid.
    if (this.muteTarget > 0) {
      this.fadeTarget = 1;
      return;
    }
    const blocked = (x: number, y: number, h: number) => this.blockedByBuilding(x, y, h);
    let covered = false;
    // only nodes near the building can be hidden by it
    const cx = (box.min.x + box.max.x) / 2 / U + inp.mapW / 2;
    const cy = (box.min.z + box.max.z) / 2 / U;
    // the student went to look at the building: the levels behind it may stay hidden
    if (!this.viewingBuilding) for (const n of inp.nodes) {
      if (Math.hypot(n.x - cx, n.y - cy) > 1400) continue;
      if (blocked(n.x, n.y, 0.25) || blocked(n.x, n.y, 0.75)) {
        covered = true;
        break;
      }
    }
    if (!covered && avatar?.visible && (blocked(avatar.x, avatar.y, 0.3) || blocked(avatar.x, avatar.y, 1.0))) covered = true;
    this.fadeTarget = covered ? 0.35 : 1;
  }

  private applyFade(): void {
    const o = this.fade;
    this.buildingMat.opacity = o;
    // the name boards stay readable while the walls are see-through
    for (const m of this.signMats) m.opacity = Math.max(o, 0.85);
    if (this.flagMat) this.flagMat.opacity = o;
  }

  /** Grey toy look while the kingdom is still locked; animates back to colour when it unlocks. */
  setLandmarkLocked(locked: boolean, animate = false): void {
    this.muteTarget = locked ? 1 : 0;
    if (!animate) {
      this.mute.value = this.muteTarget;
      this.applyMute();
    }
    this.dirty = true;
  }

  private applyMute(): void {
    const grey = new THREE.Color('#9da3ab');
    const white = new THREE.Color('#ffffff');
    for (const m of this.signMats) m.color.copy(white).lerp(grey, this.mute.value * 0.9);
  }

  /** Road centre line in map px, from the school yard (index 0) through every level to the gate. */
  roadPath(): ReadonlyArray<{ x: number; y: number }> {
    return this.road?.pts ?? [];
  }

  /** Screen rectangle (CSS px) covering the kingdom building, for the DOM tap area. */
  landmarkRect(): { x: number; y: number; w: number; h: number } | null {
    const b = this.landmarkBox;
    if (!b) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = this.tmp2.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
      if (v.z > 1) return null;
      const sx = ((v.x + 1) / 2) * this.vw;
      const sy = ((1 - v.y) / 2) * this.vh;
      x0 = Math.min(x0, sx);
      y0 = Math.min(y0, sy);
      x1 = Math.max(x1, sx);
      y1 = Math.max(y1, sy);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * Instanced scenery, split into chunks along the map so the GPU skips chunks that are off-screen.
   * ground: 'full' = follow the ground incl. stream dips, 'base' = ignore dips (road, pads).
   */
  private inst(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    items: Placed[],
    o: { cast: boolean; receive: boolean; lift?: number; tint?: 'leaf' | 'rock'; ground?: 'full' | 'base'; chunk?: number; seeThrough?: boolean },
  ): void {
    if (!items.length) return;
    if (o.seeThrough && !geo.boundingBox) geo.computeBoundingBox();
    const bb = o.seeThrough ? geo.boundingBox! : null;
    const crownR = bb ? Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z) : 0;
    // tiny shapes use big chunks: fewer draw calls matter more than skipping a few triangles
    const size = o.chunk ?? CHUNK;
    const groups = new Map<number, Placed[]>();
    for (const it of items) {
      const k = Math.floor((it.y + 2000) / size) * 100 + Math.floor((it.x + 2000) / size);
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(it);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    for (const list of groups.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        const gy = o.ground === 'base' ? this.baseHeight(it.x, it.y) : this.heightAt(it.x, it.y);
        p.set(this.X(it.x), gy + (o.lift ?? 0), this.Z(it.y));
        q.setFromAxisAngle(UP, it.rot);
        s.setScalar(it.s);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        if (o.tint) mesh.setColorAt(i, it.tint ?? c.setScalar(1));
        if (bb) {
          this.trees.push({ mesh, index: i, matrix: m.clone(), geo, x: p.x, z: p.z, y0: p.y, top: p.y + bb.max.y * it.s, r: crownR * it.s });
        }
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = o.cast;
      mesh.receiveShadow = o.receive;
      mesh.computeBoundingSphere();
      this.disposables.push({ dispose: () => mesh.dispose() });
      this.add(mesh);
    }
  }

  private buildScenery(rnd: () => number): void {
    const inp = this.input!;
    const g = sceneryGeos();
    const m = materials();
    const pines: Placed[] = [];
    const tall: Placed[] = [];
    const rounds: Placed[] = [];
    const fruits: Placed[] = [];
    const palms: Placed[] = [];
    const palmsB: Placed[] = [];
    const bushes: Placed[] = [];
    const flowerBushes: Placed[] = [];
    const ferns: Placed[] = [];
    const tufts: Placed[] = [];
    const rocks: Placed[] = [];
    const boulders: Placed[] = [];
    const mossy: Placed[] = [];
    const flowers: Placed[] = [];
    const kubos: Placed[] = [];
    const lamps: Placed[] = [];
    // Tree mix per kingdom: [pine, tall pine, round, fruit, palm]; the town (K2) has more palms.
    const mix = inp.kingdom === 2 ? [0.24, 0.1, 0.26, 0.1, 0.3] : inp.kingdom === 3 ? [0.32, 0.18, 0.26, 0.06, 0.18] : [0.36, 0.14, 0.26, 0.08, 0.16];
    const pickKind = (x: number, y: number, variant?: number): number => {
      if (variant !== undefined) return [0, 2, 4, 1][variant % 4];
      if (this.nearWater(x, y, 140) && rnd() < 0.55) return 4; // palms like the river banks
      let r = rnd();
      for (let k = 0; k < mix.length; k++) {
        r -= mix[k];
        if (r <= 0) return k;
      }
      return 0;
    };
    const lists = [pines, tall, rounds, fruits, palms];
    const leaf = () => new THREE.Color().setScalar(0.9 + rnd() * 0.2);
    const rockTint = () => new THREE.Color().setHSL(0.09, 0.05 + rnd() * 0.06, 0.62 + rnd() * 0.22);
    const ok = (x: number, y: number, road: number, water = 10, plaza = 30) =>
      this.road!.dist(x, y, 500) > road && !this.nearWater(x, y, water) && !this.onPlaza(x, y, plaza);
    const nearHut = (x: number, y: number, r: number) => kubos.some((k) => Math.hypot(x - k.x, y - k.y) < r);

    // Spacing grid for trees (keeps the forest even, like Tala's).
    const cell = 100;
    const grid = new Map<number, Array<{ x: number; y: number; r: number }>>();
    const key = (cx: number, cy: number) => cx * 100003 + cy;
    const free = (x: number, y: number, r: number) => {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const t of grid.get(key(cx + i, cy + j)) ?? []) if (Math.hypot(t.x - x, t.y - y) < t.r + r) return false;
      return true;
    };
    // Open meadow in front of the kingdom building, so its front and name stay in view (no trees there).
    const L = inp.landmark;
    const frontView = (x: number, y: number) => y > L.y + 280 && y < L.y + 820 && Math.abs(x - L.x) < 360 + (y - L.y - 280) * 0.35;
    const plant = (x: number, y: number, s: number, variant?: number) => {
      if (frontView(x, y)) return false;
      const kind = pickKind(x, y, variant);
      const r = (kind === 2 || kind === 3 ? 52 : kind === 4 ? 40 : 46) * s;
      if (!free(x, y, r)) return false;
      const k = key(Math.floor(x / cell), Math.floor(y / cell));
      let list = grid.get(k);
      if (!list) grid.set(k, (list = []));
      list.push({ x, y, r });
      const item = { x, y, s: kind === 4 ? s * 1.08 : s, rot: rnd() * 6.28, tint: leaf() };
      if (kind === 4 && rnd() < 0.45) palmsB.push(item);
      else lists[kind].push(item);
      return true;
    };

    for (const it of inp.scenery) {
      if (it.type === 'kubo' && ok(it.x, it.y, 175, 120)) kubos.push({ x: it.x, y: it.y, s: 1.05 * it.scale, rot: (rnd() - 0.5) * 0.8 });
    }
    for (const it of inp.scenery) {
      switch (it.type) {
        case 'tree':
          if (ok(it.x, it.y, 125, 30) && !nearHut(it.x, it.y, 120)) plant(it.x, it.y, 0.66 + Math.min(1.4, it.scale) * 0.28, it.variant);
          break;
        case 'bush':
          if (ok(it.x, it.y, 80, 10) && !nearHut(it.x, it.y, 90)) {
            const b = { x: it.x, y: it.y, s: 0.6 + it.scale * 0.35, rot: rnd() * 6.28, tint: leaf() };
            (it.variant === 1 ? flowerBushes : it.variant === 2 ? ferns : bushes).push(b);
          }
          break;
        case 'mushroom':
          if (ok(it.x, it.y, 70, 5)) ferns.push({ x: it.x, y: it.y, s: 0.9 + it.scale * 0.3, rot: rnd() * 6.28, tint: leaf() });
          break;
        case 'rock':
          if (ok(it.x, it.y, 75)) (it.variant % 3 === 1 ? mossy : rocks).push({ x: it.x, y: it.y, s: 0.6 + it.scale * 0.6, rot: rnd() * 6.28, tint: rockTint() });
          break;
        case 'flower':
          if (ok(it.x, it.y, 56, 0, 0)) flowers.push({ x: it.x, y: it.y, s: 1, rot: 0, tint: new THREE.Color(['#ffffff', '#ffd23f', '#ff8fb8', '#b48cff', '#ff8a5c'][it.variant % 5]) });
          break;
        case 'lamp': {
          // push the lamp out to the grass beside the road
          const dir = this.road!.dist(it.x + 10, it.y, 300) > this.road!.dist(it.x - 10, it.y, 300) ? 1 : -1;
          for (let k = 0; k < 6; k++) {
            const x = it.x + dir * k * 12;
            if (ok(x, it.y, 72, 0, 0)) {
              lamps.push({ x, y: it.y, s: 1, rot: 0 });
              break;
            }
          }
          break;
        }
        case 'mountain':
          // a rocky outcrop with a couple of pines instead of the flat 2D mountain sprite
          if (ok(it.x, it.y, 140)) {
            boulders.push({ x: it.x, y: it.y, s: 0.9 + rnd() * 0.5, rot: rnd() * 6.28, tint: rockTint() });
            for (let r = 0; r < 3; r++) (r === 1 ? mossy : rocks).push({ x: it.x + (rnd() - 0.5) * 110, y: it.y + (rnd() - 0.5) * 70, s: 0.7 + rnd() * 0.9, rot: rnd() * 6.28, tint: rockTint() });
            ferns.push({ x: it.x - 50, y: it.y + 30, s: 1.1, rot: rnd() * 6.28, tint: leaf() });
            plant(it.x + 55, it.y - 40, 0.9 + rnd() * 0.15);
          }
          break;
      }
    }

    // Fill the whole world with forest (denser outside the play area, like the ring around Tala's maps).
    const tries = this.lite ? 4200 : 9000;
    const cx = inp.mapW / 2;
    for (let i = 0; i < tries; i++) {
      const x = -1400 + rnd() * (inp.mapW + 2800);
      const y = -1300 + rnd() * (inp.mapH + 2800);
      const inside = Math.abs(x - cx) < 620 && y > 250 && y < inp.mapH - 150;
      if (inside && rnd() < 0.5) continue;
      if (!ok(x, y, 140, 30) || nearHut(x, y, 120)) continue;
      const s = 0.68 + rnd() * 0.36;
      if (this.lite && !inside && rnd() < 0.25) continue;
      if (plant(x, y, s) && rnd() < 0.14 && ok(x + 60, y + 35, 90)) {
        const b = { x: x + 60, y: y + 35, s: 0.6 + rnd() * 0.3, rot: rnd() * 6.28, tint: leaf() };
        const r = rnd();
        (r < 0.25 ? flowerBushes : r < 0.5 ? ferns : bushes).push(b);
      }
    }
    for (let i = 0; i < (this.lite ? 90 : 200); i++) {
      const x = -900 + rnd() * (inp.mapW + 1800);
      const y = rnd() * inp.mapH;
      if (!ok(x, y, 90, 5)) continue;
      const r = rnd();
      const it = { x, y, s: 0.4 + rnd() * 0.6, rot: rnd() * 6.28, tint: rockTint() };
      (r < 0.2 ? mossy : r < 0.3 ? boulders : rocks).push(it);
    }
    for (let i = 0; i < (this.lite ? 160 : 320); i++) {
      const x = rnd() * inp.mapW;
      const y = rnd() * inp.mapH;
      if (!ok(x, y, 58, 0, 0)) continue;
      flowers.push({ x, y, s: 1, rot: 0, tint: new THREE.Color(['#ffffff', '#ffd23f', '#ff8fb8', '#b48cff'][i % 4]) });
    }
    // Low plants and grass tufts in the meadow beside the road (cheap, no shadows).
    for (let i = 0; i < (this.lite ? 110 : 220); i++) {
      const x = -200 + rnd() * (inp.mapW + 400);
      const y = rnd() * inp.mapH;
      if (ok(x, y, 70, 5, 10) && !nearHut(x, y, 70)) ferns.push({ x, y, s: 0.7 + rnd() * 0.5, rot: rnd() * 6.28, tint: leaf() });
    }
    for (let i = 0; i < (this.lite ? 500 : 1100); i++) {
      const x = -300 + rnd() * (inp.mapW + 600);
      const y = rnd() * inp.mapH;
      if (ok(x, y, 60, 0, 0)) tufts.push({ x, y, s: 0.8 + rnd() * 0.7, rot: rnd() * 6.28, tint: leaf() });
    }

    const tree = { cast: true, receive: false, tint: 'leaf' as const };
    // Real trees turn see-through when they hide the student (Tala-Salitaan); bushes are low and stay solid.
    const tall3 = { ...tree, seeThrough: true };
    this.inst(g.pine, m.flat, pines, tall3);
    this.inst(g.pineTall, m.flat, tall, tall3);
    this.inst(g.roundTree, m.flat, rounds, tall3);
    this.inst(g.fruitTree, m.flat, fruits, tall3);
    this.inst(g.palm, m.flat, palms, tall3);
    this.inst(g.palmB, m.flat, palmsB, tall3);
    this.inst(g.bush, m.flat, bushes, tree);
    this.inst(g.flowerBush, m.flat, flowerBushes, tree);
    // Small things cast no shadow (keeps the shadow pass short).
    const big = 1500;
    this.inst(g.fern, m.flat, ferns, { cast: false, receive: false, tint: 'leaf', chunk: big });
    this.inst(g.tuft, m.flat, tufts, { cast: false, receive: false, tint: 'leaf', chunk: big });
    this.inst(g.rockA, m.flat, rocks.filter((_, i) => i % 2 === 0), { cast: false, receive: false, tint: 'rock', chunk: big });
    this.inst(g.rockB, m.flat, rocks.filter((_, i) => i % 2 === 1), { cast: false, receive: false, tint: 'rock', chunk: big });
    this.inst(g.boulder, m.flat, boulders, { cast: true, receive: false, tint: 'rock', chunk: big });
    this.inst(g.mossy, m.flat, mossy, { cast: false, receive: false, tint: 'rock', chunk: big });
    this.inst(g.stem, m.flat, flowers, { cast: false, receive: false, chunk: big });
    this.inst(g.petal, m.flat, flowers, { cast: false, receive: false, tint: 'leaf', chunk: big });
    this.inst(g.kubo, m.flat, kubos, { cast: true, receive: true });
    this.inst(g.lamp, m.flat, lamps, { cast: true, receive: false });
  }

  private clearWorld(): void {
    this.world.clear();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.trees = [];
    this.ghosts.clear(); // they were children of the world group (shared geometry and material)
    this.treeKey = '';
    this.signMats = [];
    this.landmarkBox = null;
    this.sky.setOccluder(null);
    this.dirty = true;
  }

  /* ── camera ── */

  resize(vw: number, vh: number): void {
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    this.renderer.setSize(this.vw, this.vh, false);
    this.sky.resize(this.vw, this.vh);
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
    this.charBoxH = Math.round(Math.max(200, Math.min(520, this.vh * 0.5)));
    this.charBoxW = Math.round(this.charBoxH * 0.8);
    this.charRenderer.setSize(this.charBoxW, this.charBoxH, true);
    this.viewKey = '';
    this.dirty = true;
  }

  /** Turns (yaw) and tilts (pitch) the camera around the focus point. Pitch is clamped so the map is never seen from below. */
  orbitBy(dYaw: number, dPitch: number): void {
    this.setOrbit(this.yaw + dYaw, this.pitch + dPitch);
  }

  setOrbit(yaw: number, pitch: number): void {
    const y = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const p = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
    if (Math.abs(y - this.yaw) < 1e-5 && Math.abs(p - this.pitch) < 1e-5) return;
    this.yaw = y;
    this.pitch = p;
    this.viewKey = '';
  }

  get orbit(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /** Same camera state as the 2D map: (viewX, viewY) is the top-left map pixel, zoom = screen px per map px. The view centre is the orbit focus. */
  setView(viewX: number, viewY: number, zoom: number): void {
    // toScreen() calls this for every level button and particle each frame: compare numbers first,
    // build the key string only when the view really changed.
    const lv = this.lastView;
    if (
      this.viewKey !== '' &&
      Math.abs(viewX - lv.x) < 0.005 &&
      Math.abs(viewY - lv.y) < 0.005 &&
      Math.abs(zoom - lv.zoom) < 0.00005 &&
      lv.yaw === this.yaw &&
      lv.pitch === this.pitch
    ) {
      return;
    }
    const key = `${viewX.toFixed(2)},${viewY.toFixed(2)},${zoom.toFixed(4)},${this.vw},${this.vh},${this.yaw.toFixed(4)},${this.pitch.toFixed(4)}`;
    lv.x = viewX;
    lv.y = viewY;
    lv.zoom = zoom;
    lv.yaw = this.yaw;
    lv.pitch = this.pitch;
    if (key === this.viewKey) return;
    this.viewKey = key;
    const cx = viewX + this.vw / (2 * zoom);
    const cy = viewY + this.vh / (2 * zoom);
    const tx = this.X(cx);
    const tz = this.Z(cy);
    this.focus.x = tx;
    this.focus.z = tz;
    const dist = (DIST_K * this.vh * U) / (2 * zoom * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    const flat = dist * Math.cos(this.pitch);
    const cam = this.camera;
    cam.position.set(tx + flat * Math.sin(this.yaw), dist * Math.sin(this.pitch), tz + flat * Math.cos(this.yaw));
    // never below the ground (hills on the sides)
    const gx = cam.position.x / U + (this.input?.mapW ?? 1200) / 2;
    const gy = cam.position.z / U;
    cam.position.y = Math.max(cam.position.y, this.baseHeight(gx, gy) + 1.2);
    cam.lookAt(tx, 0, tz);
    const fog = this.scene.fog as THREE.Fog | null;
    const far = dist * 3.3;
    if (fog) {
      fog.near = dist * 1.3;
      fog.far = far;
    }
    // Nothing past the fog is drawn: far chunks are skipped.
    if (Math.abs(cam.far - far * 1.06) > 0.05) {
      cam.far = far * 1.06;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
    this.updateShadowBox(tx, tz, dist);
  }

  /**
   * The world does not move, so the shadow map is only redrawn when the view leaves the shadow box
   * (or the world changes) instead of every frame. The box is wide enough for any camera turn.
   */
  private updateShadowBox(tx: number, tz: number, dist: number): void {
    const half = 0.75 * dist * Math.max(1, this.camera.aspect) + 2.5;
    const moved = Math.hypot(tx - this.shadowCenter.x, tz - this.shadowCenter.z);
    if (moved < this.shadowHalf * 0.3 && Math.abs(half - this.shadowHalf) < this.shadowHalf * 0.2) return;
    this.shadowHalf = half;
    const sc = this.sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.updateProjectionMatrix();
    // snap to shadow texels so shadow edges stay put
    const texel = (2 * half) / this.sun.shadow.mapSize.x;
    const sx = Math.round(tx / texel) * texel;
    const sz = Math.round(tz / texel) * texel;
    this.shadowCenter.set(sx, 0, sz);
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx - 8, 22, sz + 11);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Screen position (CSS px) of a map point at height h (units) plus the local scale in screen px per map px. */
  project(x: number, y: number, h = 0): { x: number; y: number; s: number; visible: boolean } {
    const v = this.tmp.set(this.X(x), h, this.Z(y)).project(this.camera);
    const sx = ((v.x + 1) / 2) * this.vw;
    const sy = ((1 - v.y) / 2) * this.vh;
    const visible = v.z < 1;
    // scale measured along the screen's horizontal ground direction (works for any camera turn)
    const rx = Math.cos(this.yaw) * 100;
    const rz = -Math.sin(this.yaw) * 100;
    const v2 = this.tmp.set(this.X(x + rx), h, this.Z(y + rz)).project(this.camera);
    const sx2 = ((v2.x + 1) / 2) * this.vw;
    const sy2 = ((1 - v2.y) / 2) * this.vh;
    return { x: sx, y: sy, s: Math.hypot(sx2 - sx, sy2 - sy) / 100, visible };
  }

  /* ── avatar ── */

  /** Returns false when there is no 3D model for this picture (the caller keeps the 2D sprite). */
  setAvatar(imageUrl: string): boolean {
    const url = avatarModelUrl(imageUrl);
    if (url === this.avatarUrl) return !!url;
    this.avatarUrl = url;
    const token = ++this.avatarLoadToken;
    if (this.avatarRoot) {
      this.charScene.remove(this.avatarRoot);
      this.avatarRoot = null;
    }
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions = {};
    this.currentClip = '';
    this.avatarReady = false;
    if (!url) return false;
    loadGlb(url)
      .then((gltf) => {
        if (token !== this.avatarLoadToken) return;
        const root = SkeletonUtils.clone(gltf.scene);
        root.scale.setScalar(AVATAR_SCALE);
        root.rotation.order = 'YXZ'; // heading first, then the small forward lean while running
        root.rotation.y = this.yaw;
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.frustumCulled = false;
        });
        this.avatarRoot = root;
        this.charScene.add(root);
        this.mixer = new THREE.AnimationMixer(root);
        for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
        this.mixer.addEventListener('finished', () => this.play(this.wasWalking ? 'Walk' : 'Idle'));
        this.play('Idle');
        this.avatarReady = true;
      })
      .catch((err) => console.warn('Student model failed to load', err));
    return true;
  }

  private play(name: string, once = false, fade = 0.25): void {
    const next = this.actions[name];
    if (!next || this.currentClip === name) return;
    const prev = this.actions[this.currentClip];
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (name !== 'Walk') next.timeScale = 1;
    next.play();
    if (prev) next.crossFadeFrom(prev, fade, false);
    this.currentClip = name;
  }

  private updateAvatar(a: AvatarState, dt: number): boolean {
    const root = this.avatarRoot;
    if (!root || !a.visible) {
      this.avatarShadow.visible = false;
      return false;
    }
    const h = this.feetHeight(a.x, a.y);
    root.position.set(this.X(a.x), h + 0.03, this.Z(a.y));
    this.avatarShadow.visible = true;
    this.avatarShadow.position.set(root.position.x, h + 0.035, root.position.z);
    const dx = a.x - this.lastAvatar.x;
    const dy = a.y - this.lastAvatar.y;
    const moved = Number.isFinite(dx) ? Math.hypot(dx, dy) : 0;
    // smoothed ground speed (map px / s) drives the step rate, so feet match the movement
    if (dt > 0) this.speed += (Math.min(900, moved / dt) - this.speed) * Math.min(1, dt * 6);
    if (a.walking && moved > 0.3) this.heading = Math.atan2(dx, dy);
    if (!a.walking) this.heading = this.yaw; // stand facing the camera, whichever way it is turned
    let diff = this.heading - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    root.rotation.y += diff * Math.min(1, dt * (a.walking ? 9 : 6));
    this.lastAvatar = { x: a.x, y: a.y };

    if (a.walking) {
      this.play('Walk', false, 0.18);
      const walk = this.actions['Walk'];
      // 160 px/s = normal walk; long walks go faster and become a run (like Tala-Salitaan: Walk sped up)
      if (walk) walk.timeScale = Math.max(1.2, Math.min(3.6, (1.7 * Math.max(this.speed, 60)) / 160));
      // lean forward a little when running
      const run = smoothstep(220, 380, this.speed);
      root.rotation.x += (run * 0.12 - root.rotation.x) * Math.min(1, dt * 8);
    } else if (this.wasWalking) {
      this.play('Wave', true);
    } else if (!this.currentClip || this.currentClip === 'Walk') {
      this.play('Idle');
    }
    if (!a.walking) root.rotation.x += (0 - root.rotation.x) * Math.min(1, dt * 8);
    this.wasWalking = a.walking;
    this.mixer?.update(dt);

    // Small canvas around the character: same camera, cropped with a view offset.
    const feet = this.project(a.x, a.y, h);
    if (!feet.visible) return false;
    const W = this.charBoxW;
    const H = this.charBoxH;
    const left = Math.round(feet.x - W / 2);
    const top = Math.round(feet.y - H * 0.8);
    this.charCam.copy(this.camera);
    this.charCam.setViewOffset(this.vw, this.vh, left, top, W, H);
    this.charCam.updateProjectionMatrix();
    this.charCanvas.style.transform = `translate3d(${left}px,${top}px,0)`;
    this.charSun.position.copy(root.position).add(this.tmp2.set(-8, 22, 11));
    this.charSun.target.position.copy(root.position);
    this.charSun.target.updateMatrixWorld();
    return true;
  }

  /* ── frame ── */

  render(_timeMs: number, dt: number, avatar: AvatarState | null): void {
    if (Math.abs(this.mute.value - this.muteTarget) > 0.001) {
      this.mute.value += (this.muteTarget - this.mute.value) * Math.min(1, dt * 3.2);
      if (Math.abs(this.mute.value - this.muteTarget) <= 0.002) this.mute.value = this.muteTarget;
      this.applyMute();
      this.dirty = true;
    }
    this.updateOcclusion(avatar);
    this.updateTrees(avatar, dt);
    if (this.fade !== this.fadeTarget) {
      this.fade += (this.fadeTarget - this.fade) * Math.min(1, dt * 7);
      if (Math.abs(this.fade - this.fadeTarget) < 0.01) this.fade = this.fadeTarget;
      this.applyFade();
      this.dirty = true;
    }
    // The world only redraws when the camera moved or something in it changed.
    if (this.dirty || this.viewKey !== this.renderedKey) {
      this.renderer.render(this.scene, this.camera);
      this.renderedKey = this.viewKey;
      this.dirty = false;
      this.trackPerf(dt);
    }
    if (this.input) {
      const mapW = this.input.mapW;
      const moved = this.skyKey !== this.viewKey;
      this.skyKey = this.viewKey;
      this.sky.render(dt, this.camera, this.scene.fog as THREE.Fog | null, this.focus, (x, z) => this.baseHeight(x / U + mapW / 2, z / U), moved);
    }
    const showChar = avatar ? this.updateAvatar(avatar, dt) : false;
    if (showChar) {
      this.charRenderer.render(this.charScene, this.charCam);
      this.charCanvas.style.visibility = 'visible';
    } else {
      this.charCanvas.style.visibility = 'hidden';
    }
  }

  /** Lowers the resolution, then turns shadows off, when frames that redraw the world are slow. */
  private trackPerf(dt: number): void {
    if ((window as unknown as { __vqNoAutoQuality?: boolean }).__vqNoAutoQuality) return;
    if (!(dt > 0) || dt > 0.25) return;
    const p = this.perf;
    p.t += dt;
    p.n++;
    if (p.t < 1.5) return;
    const avg = p.t / p.n;
    p.t = 0;
    p.n = 0;
    if (avg < 1 / 40 || p.level >= 2) return;
    p.level++;
    if (p.level === 1 && this.pixelRatio > 1) {
      this.pixelRatio = 1;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.vw, this.vh, false);
    } else {
      p.level = 2;
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
      this.scene.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => (x.needsUpdate = true));
        else if (mat) mat.needsUpdate = true;
      });
    }
    this.dirty = true;
  }

  /** Draw-call and triangle counts of the last world frame (for the demo / perf checks). */
  stats(): { calls: number; triangles: number; pixelRatio: number; shadows: boolean } {
    const i = this.renderer.info.render;
    return { calls: i.calls, triangles: i.triangles, pixelRatio: this.pixelRatio, shadows: this.renderer.shadowMap.enabled };
  }

  dispose(): void {
    this.clearWorld();
    this.mixer?.stopAllAction();
    this.ghostMat?.dispose();
    this.buildingMat.dispose();
    this.renderer.dispose();
    this.charRenderer.dispose();
    this.sky.dispose();
    this.canvas.remove();
    this.charCanvas.remove();
  }
}
