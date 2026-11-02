/**
 * Black hole portal to the next kingdom (replaces the old stone gate).
 *
 * Light on phones: every part (glow, swirl, core, ground shadow, sign) is painted ONCE into a small
 * offscreen canvas; each frame only draws those images turned and scaled (a few drawImage calls
 * plus a dozen tiny dots for the sparks being pulled in).
 */

const SPRITE = 256;

interface HoleSprites {
  glow: HTMLCanvasElement;
  disk: HTMLCanvasElement;
  core: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  spark: string;
}

interface Palette {
  outer: [number, number, number];
  mid: [number, number, number];
  inner: [number, number, number];
  glow: [number, number, number];
  spark: string;
}

const OPEN: Palette = {
  outer: [124, 58, 237], // violet
  mid: [34, 211, 238], // cyan
  inner: [254, 240, 138], // warm white-gold near the edge of the hole
  glow: [139, 92, 246],
  spark: '#E0F2FE',
};

const LOCKED: Palette = {
  outer: [71, 85, 105],
  mid: [100, 116, 139],
  inner: [203, 213, 225],
  glow: [100, 116, 139],
  spark: '#CBD5E1',
};

const spriteCache = new Map<string, HoleSprites>();
const signCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `${r},${g},${bl}`;
}

function buildSprites(locked: boolean): HoleSprites {
  const pal = locked ? LOCKED : OPEN;
  const half = SPRITE / 2;
  const [gr, gg, gb] = pal.glow;

  // Soft outer glow
  const glow = makeCanvas(SPRITE, SPRITE);
  {
    const c = glow.getContext('2d')!;
    const g = c.createRadialGradient(half, half, half * 0.2, half, half, half);
    g.addColorStop(0, `rgba(${gr},${gg},${gb},0.55)`);
    g.addColorStop(0.45, `rgba(${gr},${gg},${gb},0.32)`);
    g.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE, SPRITE);
  }

  // Swirl: three spiral arms of soft dots, bright towards the middle (drawn additively)
  const disk = makeCanvas(SPRITE, SPRITE);
  {
    const c = disk.getContext('2d')!;
    c.translate(half, half);
    c.globalCompositeOperation = 'lighter';
    const arms = 3;
    const steps = 70;
    for (let arm = 0; arm < arms; arm++) {
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const r = half * (0.98 - 0.6 * t);
        const a = (arm * Math.PI * 2) / arms + t * Math.PI * 2.6;
        const size = 13 - 8 * t;
        const col = t < 0.5 ? mix(pal.outer, pal.mid, t * 2) : mix(pal.mid, pal.inner, (t - 0.5) * 2);
        const alpha = 0.05 + 0.2 * t;
        c.fillStyle = `rgba(${col},${alpha})`;
        c.beginPath();
        c.arc(Math.cos(a) * r, Math.sin(a) * r, size, 0, Math.PI * 2);
        c.fill();
      }
    }
    // faint ring so the swirl reads as a disc
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = `rgba(${mix(pal.mid, pal.inner, 0.5)},0.35)`;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, half * 0.62, 0, Math.PI * 2);
    c.stroke();
  }

  // The hole itself: black middle with a thin bright rim
  const core = makeCanvas(SPRITE, SPRITE);
  {
    const c = core.getContext('2d')!;
    const g = c.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(2,0,10,1)');
    g.addColorStop(0.74, 'rgba(12,4,30,0.95)');
    g.addColorStop(0.82, `rgba(${mix(pal.inner, pal.mid, 0.2)},0.9)`);
    g.addColorStop(0.9, `rgba(${mix(pal.mid, pal.outer, 0.3)},0.35)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE, SPRITE);
  }

  // Dark round patch on the ground under it
  const shadow = makeCanvas(SPRITE, SPRITE);
  {
    const c = shadow.getContext('2d')!;
    const g = c.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(10,4,30,0.55)');
    g.addColorStop(0.55, `rgba(${gr},${gg},${gb},0.22)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE, SPRITE);
  }

  return { glow, disk, core, shadow, spark: pal.spark };
}

function sprites(locked: boolean): HoleSprites {
  const key = locked ? 'L' : 'O';
  let s = spriteCache.get(key);
  if (!s) {
    s = buildSprites(locked);
    spriteCache.set(key, s);
  }
  return s;
}

function fontsReady(): boolean {
  const f = (document as Document & { fonts?: FontFaceSet }).fonts;
  return !f || f.status === 'loaded';
}

/** The sign above the hole ("ENTER TO THE NEXT KINGDOM"), painted at 2x for sharp text. */
function sign(locked: boolean, title: string, sub: string): HTMLCanvasElement {
  const ready = fontsReady();
  const key = `${locked ? 'L' : 'O'}|${title}|${sub}|${ready ? 1 : 0}`;
  const hit = signCache.get(key);
  if (hit) return hit;

  const k = 2;
  const font1 = `900 ${13 * k}px Inter, system-ui, sans-serif`;
  const font2 = `700 ${10 * k}px Inter, system-ui, sans-serif`;
  const probe = makeCanvas(4, 4).getContext('2d')!;
  probe.font = font1;
  const w1 = probe.measureText(title).width;
  probe.font = font2;
  const w2 = probe.measureText(sub).width;
  const padX = 16 * k;
  const w = Math.ceil(Math.max(w1, w2) + padX * 2);
  const h = 44 * k;
  const c = makeCanvas(w, h + 8 * k);
  const g = c.getContext('2d')!;

  const r = 14 * k;
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(w - r, 0);
  g.quadraticCurveTo(w, 0, w, r);
  g.lineTo(w, h - r);
  g.quadraticCurveTo(w, h, w - r, h);
  g.lineTo(w / 2 + 7 * k, h);
  g.lineTo(w / 2, h + 7 * k); // little pointer down to the hole
  g.lineTo(w / 2 - 7 * k, h);
  g.lineTo(r, h);
  g.quadraticCurveTo(0, h, 0, h - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.closePath();
  g.fillStyle = locked ? 'rgba(30,41,59,0.92)' : 'rgba(23,8,54,0.92)';
  g.fill();
  g.lineWidth = 2.5 * k;
  g.strokeStyle = locked ? '#94A3B8' : '#A78BFA';
  g.stroke();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font1;
  g.fillStyle = locked ? '#E2E8F0' : '#FFFFFF';
  g.fillText(title, w / 2, 16 * k);
  g.font = font2;
  g.fillStyle = locked ? '#CBD5E1' : '#FDE68A';
  g.fillText(sub, w / 2, 32 * k);

  if (ready) signCache.set(key, c);
  return c;
}

export interface BlackHoleDraw {
  /** Screen centre of the hole and its radius in CSS px. */
  cx: number;
  cy: number;
  r: number;
  /** Ground point under it (for the dark patch) and the ground scale (CSS px per map px). */
  gx: number;
  gy: number;
  gs: number;
  locked: boolean;
  /** Turned angle of the swirl (integrated by the caller so speeding up never jumps). */
  spin: number;
  /** 0 = calm, 1 = swallowing the student (bigger, faster sparks). */
  suck: number;
  timeMs: number;
  title: string;
  sub: string;
  /** Sign opacity (hidden while the student is pulled in). */
  signAlpha: number;
}

/** Draws the black hole. The context must have a plain CSS-px transform (dpr only). */
export function drawBlackHole(ctx: CanvasRenderingContext2D, d: BlackHoleDraw): void {
  const sp = sprites(d.locked);
  const t = d.timeMs / 1000;
  const pulse = 1 + 0.035 * Math.sin(t * 2.4);
  const R = d.r * pulse * (1 + 0.28 * d.suck);

  ctx.save();

  // ground patch (flattened)
  const gw = 110 * d.gs * (1 + 0.3 * d.suck);
  ctx.globalAlpha = d.locked ? 0.6 : 0.9;
  ctx.drawImage(sp.shadow, d.gx - gw, d.gy - gw * 0.32, gw * 2, gw * 0.64);

  // glow
  ctx.globalAlpha = (d.locked ? 0.55 : 0.85) + 0.15 * d.suck;
  ctx.drawImage(sp.glow, d.cx - R * 1.7, d.cy - R * 1.7, R * 3.4, R * 3.4);

  // swirl (two layers turning at different speeds)
  ctx.translate(d.cx, d.cy);
  ctx.rotate(d.spin);
  ctx.globalAlpha = d.locked ? 0.7 : 1;
  ctx.drawImage(sp.disk, -R, -R, R * 2, R * 2);
  ctx.rotate(-d.spin * 1.7);
  ctx.globalAlpha = d.locked ? 0.35 : 0.55;
  ctx.drawImage(sp.disk, -R * 0.8, -R * 0.8, R * 1.6, R * 1.6);
  ctx.rotate(d.spin * 0.7);

  // sparks spiralling into the middle
  ctx.globalAlpha = 1;
  ctx.fillStyle = sp.spark;
  const n = d.locked ? 6 : 12;
  const rate = (d.locked ? 0.18 : 0.42) * (1 + d.suck * 3);
  for (let i = 0; i < n; i++) {
    const ph = (t * rate + i / n) % 1;
    const rr = R * (1.35 - 1.05 * ph);
    const a = i * 2.4 + ph * 4.5 + d.spin;
    ctx.globalAlpha = Math.min(1, ph * 3) * (1 - ph) * (d.locked ? 0.6 : 1);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(0.8, R * 0.045 * (1 - ph * 0.6)), 0, Math.PI * 2);
    ctx.fill();
  }

  // the black middle
  ctx.globalAlpha = 1;
  const coreR = R * 0.62 * (1 + 0.12 * d.suck);
  ctx.drawImage(sp.core, -coreR, -coreR, coreR * 2, coreR * 2);
  ctx.restore();

  // sign above it
  if (d.signAlpha > 0.01) {
    const s = sign(d.locked, d.title, d.sub);
    const scale = Math.max(0.55, Math.min(1.25, d.r / 62)) / 2;
    const w = s.width * scale;
    const h = s.height * scale;
    const bob = Math.sin(t * 2) * 3 * scale * 2;
    ctx.save();
    ctx.globalAlpha = d.signAlpha;
    ctx.drawImage(s, d.cx - w / 2, d.cy - R * 1.22 - h + bob, w, h);
    ctx.restore();
  }
}
