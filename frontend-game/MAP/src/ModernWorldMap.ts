/**
 * ModernWorldMap – Isometric 2.5D RPG-style map renderer
 *
 * Renders a single kingdom at a time (45 levels each) with:
 * - Canvas-rendered isometric terrain, path, trees, water, clouds
 * - DOM-positioned level nodes with animations
 * - Smooth scrolling / follow camera
 * - Kingdom gate transitions
 * - Avatar walking along the path
 *
 * Implements the MapRenderer interface so it can be used as a drop-in
 * replacement for Game2DMapRenderer (the PNG fallback map).
 */

import type {
  KingdomId,
  MapEvents,
  MapFlowOptions,
  MapRenderer,
  MapSoundHooks,
  NodeState,
  StarHistoryItem,
} from './api/types';
import { AVATAR_HEAD_H, hasWebGL, isLowEndDevice, isMobileDevice } from './three/shared';
import { levelStatus } from './core/status';
import type { World3D } from './three/World3D';

/* ── Constants ───────────────────────────────────────────────────────── */

const LEVELS_PER_KINGDOM = 40;

/** Map viewport in "world" pixels (the canvas draws at this logical size). */
const MAP_W = 1200;
/** Total scrollable height for one kingdom. */
const MAP_H = 8800;
const NODES_PER_ROW = 5;

/** 3D camera tilt (radians, about 34°) used when the student looks at the kingdom building's front. */
const THREE_FRONT_PITCH = 0.6;

/** After this long without movement the map draws at half rate to save battery. */
const IDLE_HALF_RATE_MS = 1500;
/** Camera tilt (radians, about 43°) for every walk: lower than the 50° default for a closer POV,
 *  high enough that the next level buttons stay visible. */
const WALK_VIEW_PITCH = 0.75;

const PATH_TOP_Y = 400;
const PATH_BOT_Y = 8000;

/** Kingdom theme palettes. */
const KINGDOM_THEMES: Record<KingdomId, KingdomTheme> = {
  1: {
    name: 'EPCES',
    subtitle: 'East Prosperidad Central Elementary School',
    skyTop: '#87CEEB',
    skyBot: '#E0F4FF',
    grassLight: '#5DB85D',
    grassDark: '#4A9E4A',
    pathColor: '#B07E4C',
    pathBorder: '#5E381A',
    pathHighlight: '#D4A570',
    waterColor: '#4AA8D8',
    waterShine: '#7DD4F0',
    treeTrunk: '#8B6914',
    treeLeaf: '#3CA03C',
    treeLeafLight: '#6BD86B',
    accentColor: '#2196F3',
    buildingColor: '#E8C44A',
    mountainNear: '#6B8E6B',
    mountainFar: '#8FB8A0',
    cloudColor: 'rgba(255,255,255,0.85)',
    particleColor: '#FFD700',
  },
  2: {
    name: 'Bayan ng Prosperidad',
    subtitle: 'The Town of Prosperity',
    skyTop: '#FF9E5E',
    skyBot: '#FFECD2',
    grassLight: '#7BBF6A',
    grassDark: '#5DA84E',
    pathColor: '#A46B3E',
    pathBorder: '#563014',
    pathHighlight: '#CA9060',
    waterColor: '#3D98C4',
    waterShine: '#68C0E8',
    treeTrunk: '#7A5A10',
    treeLeaf: '#2E8B2E',
    treeLeafLight: '#58C858',
    accentColor: '#FF9800',
    buildingColor: '#D4A44C',
    mountainNear: '#8B7355',
    mountainFar: '#BFA882',
    cloudColor: 'rgba(255,240,220,0.85)',
    particleColor: '#FF6B35',
  },
  3: {
    name: 'Provincial Capitol',
    subtitle: 'The Seat of Government',
    skyTop: '#6B5B95',
    skyBot: '#D4C5E2',
    grassLight: '#4E9B6B',
    grassDark: '#3A7D55',
    pathColor: '#A0764D',
    pathBorder: '#543216',
    pathHighlight: '#C59A6E',
    waterColor: '#3B7D9E',
    waterShine: '#5AAAC8',
    treeTrunk: '#6B5030',
    treeLeaf: '#2E7045',
    treeLeafLight: '#50A868',
    accentColor: '#9C27B0',
    buildingColor: '#B8B8C8',
    mountainNear: '#6B6B8B',
    mountainFar: '#9090AA',
    cloudColor: 'rgba(230,220,240,0.85)',
    particleColor: '#CE93D8',
  },
};

interface KingdomTheme {
  name: string;
  subtitle: string;
  skyTop: string;
  skyBot: string;
  grassLight: string;
  grassDark: string;
  pathColor: string;
  pathBorder: string;
  pathHighlight: string;
  waterColor: string;
  waterShine: string;
  treeTrunk: string;
  treeLeaf: string;
  treeLeafLight: string;
  accentColor: string;
  buildingColor: string;
  mountainNear: string;
  mountainFar: string;
  cloudColor: string;
  particleColor: string;
}

/* ── Seeded RNG (deterministic scatter) ──────────────────────────────── */

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Path geometry ───────────────────────────────────────────────────── */

interface PathNode {
  level: number;
  x: number;
  y: number;
  row: number;
  col: number;
}

function generatePathNodes(_kingdom: KingdomId): PathNode[] {
  const nodes: PathNode[] = [];
  const centerX = MAP_W / 2;

  for (let i = 0; i < LEVELS_PER_KINGDOM; i++) {
    const t = i / (LEVELS_PER_KINGDOM - 1);
    const y = PATH_BOT_Y - t * (PATH_BOT_Y - PATH_TOP_Y);
    // Smooth centered serpentine curve, starts at 600, ends at 600
    const x = centerX + Math.sin(t * Math.PI * 6) * 260;

    const row = Math.floor(i / NODES_PER_ROW);
    const col = i % NODES_PER_ROW;
    nodes.push({ level: i + 1, x, y, row, col });
  }
  return nodes;
}

/* ── Scenery generation (deterministic) ──────────────────────────────── */

interface SceneryItem {
  type: 'tree' | 'bush' | 'flower' | 'rock' | 'mushroom' | 'lamp' | 'mountain' | 'kubo';
  x: number;
  y: number;
  scale: number;
  variant: number;
}

function distToPath(px: number, py: number, pathNodes: PathNode[]): number {
  let minDist = Infinity;
  for (let i = 0; i < pathNodes.length; i++) {
    const n = pathNodes[i];
    const dNode = Math.hypot(px - n.x, py - n.y);
    if (dNode < minDist) minDist = dNode;

    if (i < pathNodes.length - 1) {
      const next = pathNodes[i + 1];
      const vx = next.x - n.x;
      const vy = next.y - n.y;
      const lenSq = vx * vx + vy * vy;
      if (lenSq > 0) {
        const u = Math.max(0, Math.min(1, ((px - n.x) * vx + (py - n.y) * vy) / lenSq));
        const projX = n.x + u * vx;
        const projY = n.y + u * vy;
        const dSeg = Math.hypot(px - projX, py - projY);
        if (dSeg < minDist) minDist = dSeg;
      }
    }
  }
  return minDist;
}

interface WaterBody {
  x: number;
  y: number;
  w: number;
  h: number;
  hasWaterfall: boolean;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
}

function generateScenery(kingdom: KingdomId, pathNodes: PathNode[]): SceneryItem[] {
  const rng = mulberry32(kingdom * 7919 + 31337);
  const items: SceneryItem[] = [];

  // Traditional Filipino Bahay Kubo (Nipa Huts) placed on the side of the road
  // Naturally spaced out across the 40 levels (~1,200px - 1,500px apart) so they feel like
  // charming, organic countryside hamlets rather than a repetitive programmatic grid.
  // Alternates Left, then Right, then Left, then Right with natural offsets.
  const placedKubos: Array<{ x: number; y: number }> = [];
  const targetLevels = [5, 12, 19, 26, 33, 38];

  for (let z = 0; z < targetLevels.length; z++) {
    const baseLvl = targetLevels[z];
    const isLeft = z % 2 === 0;

    let bestSpot: { x: number; y: number; scale: number; variant: number } | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const lvlOffset = Math.floor((rng() - 0.5) * 3);
      const lvlIdx = Math.max(2, Math.min(pathNodes.length - 3, baseLvl - 1 + lvlOffset));
      const pn = pathNodes[lvlIdx];
      if (!pn) continue;

      const lateralDist = 115 + rng() * 40;
      const sideOffset = isLeft ? -lateralDist : lateralDist;
      const kx = pn.x + sideOffset;
      const ky = pn.y + (rng() - 0.5) * 60;

      if (kx < 75 || kx > MAP_W - 75 || ky < 380 || ky > MAP_H - 380) continue;

      const dPath = distToPath(kx, ky, pathNodes);
      if (dPath < 100 || dPath > 165) continue;

      let tooClose = false;
      for (const pk of placedKubos) {
        if (Math.abs(ky - pk.y) < 850 || Math.hypot(kx - pk.x, ky - pk.y) < 850) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      bestSpot = {
        x: kx,
        y: ky,
        scale: 0.88 + rng() * 0.22,
        variant: z % 3,
      };
      break;
    }

    if (bestSpot) {
      placedKubos.push({ x: bestSpot.x, y: bestSpot.y });
      items.push({
        type: 'kubo',
        x: bestSpot.x,
        y: bestSpot.y,
        scale: bestSpot.scale,
        variant: bestSpot.variant,
      });
    }
  }

  // Small 2.5D Voxel Mountains placed on the flanks (strictly avoiding road & kubos)
  for (let i = 0; i < 24; i++) {
    // Alternate left meadow (60..280) and right meadow (920..1140)
    const isLeft = i % 2 === 0;
    const x = isLeft ? 50 + rng() * 220 : 930 + rng() * 220;
    const y = 350 + rng() * (MAP_H - 700);

    // Strict clearance from road (min 150px)
    if (distToPath(x, y, pathNodes) < 150) continue;

    // Don't overlap placed kubos
    let nearKubo = false;
    for (const pk of placedKubos) {
      if (Math.hypot(x - pk.x, y - pk.y) < 80) { nearKubo = true; break; }
    }
    if (nearKubo) continue;

    items.push({
      type: 'mountain',
      x,
      y,
      scale: 0.75 + rng() * 0.5,
      variant: Math.floor(rng() * 3),
    });
  }

  // Trees scattered around the map (avoiding path by 90px & avoiding kubos)
  for (let i = 0; i < 160; i++) {
    const x = rng() * MAP_W;
    const y = 200 + rng() * (MAP_H - 400);
    if (distToPath(x, y, pathNodes) < 90) continue;

    let nearKubo = false;
    for (const pk of placedKubos) {
      if (Math.hypot(x - pk.x, y - pk.y) < 55) { nearKubo = true; break; }
    }
    if (nearKubo) continue;

    items.push({
      type: 'tree',
      x,
      y,
      scale: 0.6 + rng() * 0.8,
      variant: Math.floor(rng() * 4),
    });
  }

  // Bushes
  for (let i = 0; i < 110; i++) {
    const x = rng() * MAP_W;
    const y = 200 + rng() * (MAP_H - 400);
    if (distToPath(x, y, pathNodes) < 70) continue;

    let nearKubo = false;
    for (const pk of placedKubos) {
      if (Math.hypot(x - pk.x, y - pk.y) < 45) { nearKubo = true; break; }
    }
    if (nearKubo) continue;

    items.push({ type: 'bush', x, y, scale: 0.5 + rng() * 0.6, variant: Math.floor(rng() * 3) });
  }

  // Flowers along the path edges
  for (const n of pathNodes) {
    const count = 2 + Math.floor(rng() * 3);
    for (let j = 0; j < count; j++) {
      const angle = rng() * Math.PI * 2;
      const dist = 52 + rng() * 36;
      items.push({
        type: 'flower',
        x: n.x + Math.cos(angle) * dist,
        y: n.y + Math.sin(angle) * dist,
        scale: 0.8 + rng() * 0.4,
        variant: Math.floor(rng() * 5),
      });
    }
  }

  // Street lamps
  for (let i = 2; i < pathNodes.length; i += 5) {
    const n = pathNodes[i];
    items.push({
      type: 'lamp',
      x: n.x + (i % 2 === 0 ? 55 : -55),
      y: n.y - 10,
      scale: 0.9,
      variant: 0,
    });
  }

  // Sort by Y for pseudo-depth
  items.sort((a, b) => a.y - b.y);
  return items;
}

function generateWater(kingdom: KingdomId, pathNodes: PathNode[]): WaterBody[] {
  const rng = mulberry32(kingdom * 4201 + 9999);
  const bodies: WaterBody[] = [];
  const candidateCount = 14;

  for (let i = 0; i < candidateCount; i++) {
    // Place in side meadows (left or right)
    const isLeft = i % 2 === 0;
    const w = 110 + rng() * 140;
    const h = 50 + rng() * 70;
    const x = isLeft ? 40 + rng() * 160 : 960 + rng() * 150;
    const y = 700 + rng() * (MAP_H - 1400);

    // Verify all 4 corners and center are well clear of the road (min 160px)
    const testPoints = [
      { x: x + w / 2, y: y + h / 2 },
      { x, y },
      { x: x + w, y },
      { x, y: y + h },
      { x: x + w, y: y + h },
    ];

    let overlapsRoad = false;
    for (const pt of testPoints) {
      if (distToPath(pt.x, pt.y, pathNodes) < 160) {
        overlapsRoad = true;
        break;
      }
    }

    if (!overlapsRoad) {
      bodies.push({
        x,
        y,
        w,
        h,
        hasWaterfall: rng() > 0.45,
      });
      if (bodies.length >= 5) break;
    }
  }

  return bodies;
}

function generateClouds(kingdom: KingdomId): Cloud[] {
  const rng = mulberry32(kingdom * 1031 + 5555);
  const clouds: Cloud[] = [];
  for (let i = 0; i < 8; i++) {
    clouds.push({
      x: rng() * (MAP_W + 400) - 200,
      y: 40 + rng() * 200,
      scale: 0.6 + rng() * 1.0,
      speed: 8 + rng() * 20,
      opacity: 0.4 + rng() * 0.5,
    });
  }
  return clouds;
}

/* ── Isometric drawing helpers ───────────────────────────────────────── */

function drawIsometricTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number, theme: KingdomTheme, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Sway animation
  const sway = Math.sin(time * 0.001 + x * 0.01) * 2;

  // Trunk
  ctx.fillStyle = theme.treeTrunk;
  ctx.fillRect(-4, -20, 8, 24);

  // Shadow on trunk
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, -20, 4, 24);

  // Canopy (different shapes per variant)
  ctx.save();
  ctx.translate(sway, 0);

  if (variant === 0) {
    // Round tree
    const grad = ctx.createRadialGradient(0, -35, 5, 0, -35, 22);
    grad.addColorStop(0, theme.treeLeafLight);
    grad.addColorStop(1, theme.treeLeaf);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -35, 22, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(-6, -42, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 1) {
    // Pine/triangle tree
    ctx.fillStyle = theme.treeLeaf;
    ctx.beginPath();
    ctx.moveTo(0, -55);
    ctx.lineTo(-18, -20);
    ctx.lineTo(18, -20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.treeLeafLight;
    ctx.beginPath();
    ctx.moveTo(0, -55);
    ctx.lineTo(-12, -30);
    ctx.lineTo(12, -30);
    ctx.closePath();
    ctx.fill();
  } else if (variant === 2) {
    // Bushy double
    const grad = ctx.createRadialGradient(-8, -30, 4, -8, -30, 18);
    grad.addColorStop(0, theme.treeLeafLight);
    grad.addColorStop(1, theme.treeLeaf);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(-8, -30, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -38, 16, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Palm-like (for K2)
    ctx.fillStyle = theme.treeLeaf;
    for (let a = 0; a < 5; a++) {
      const angle = (a / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(0, -40);
      ctx.rotate(angle + sway * 0.02);
      ctx.beginPath();
      ctx.ellipse(0, -12, 6, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number, theme: KingdomTheme) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const colors = [theme.treeLeaf, theme.treeLeafLight, '#5BC95B'];
  const baseColor = colors[variant % 3];

  const grad = ctx.createRadialGradient(0, -8, 3, 0, -8, 16);
  grad.addColorStop(0, theme.treeLeafLight);
  grad.addColorStop(1, baseColor);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, -8, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number, time: number) {
  const colors = ['#FF6B8A', '#FFD93D', '#FF8C42', '#C084FC', '#FF4757'];
  const color = colors[variant % 5];

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const bob = Math.sin(time * 0.002 + x * 0.05) * 1.5;

  // Stem
  ctx.strokeStyle = '#4A8B4A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -10 + bob);
  ctx.stroke();

  // Petals
  ctx.fillStyle = color;
  for (let p = 0; p < 5; p++) {
    const angle = (p / 5) * Math.PI * 2;
    const px = Math.cos(angle) * 4;
    const py = -12 + bob + Math.sin(angle) * 4;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center
  ctx.fillStyle = '#FFE066';
  ctx.beginPath();
  ctx.arc(0, -12 + bob, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const grey = 120 + variant * 20;
  ctx.fillStyle = `rgb(${grey},${grey + 5},${grey - 5})`;
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-2, -12);
  ctx.lineTo(8, -10);
  ctx.lineTo(14, -4);
  ctx.lineTo(12, 4);
  ctx.closePath();
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-2, -10);
  ctx.lineTo(4, -8);
  ctx.lineTo(0, -4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, time: number, _theme: KingdomTheme) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Post
  ctx.fillStyle = '#5A5A5A';
  ctx.fillRect(-2, -40, 4, 44);

  // Top decoration
  ctx.fillStyle = '#707070';
  ctx.fillRect(-5, -44, 10, 6);

  // Glow
  const pulse = 0.6 + Math.sin(time * 0.003) * 0.2;
  const glow = ctx.createRadialGradient(0, -46, 2, 0, -46, 18);
  glow.addColorStop(0, `rgba(255,220,100,${pulse})`);
  glow.addColorStop(1, 'rgba(255,220,100,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -46, 18, 0, Math.PI * 2);
  ctx.fill();

  // Lamp glass
  ctx.fillStyle = `rgba(255,240,180,${0.8 + Math.sin(time * 0.003) * 0.15})`;
  ctx.beginPath();
  ctx.arc(0, -44, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawIsometricMountain(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number, theme: KingdomTheme, _time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Ground shadow under mountain
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 68, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  const rockFront = theme.mountainNear || '#7A5A10';
  const rockSide = theme.mountainFar || '#563810';
  const grassTop = theme.grassLight;
  const grassMid = theme.grassDark;

  // Tier 1: Base Tier (Stepped isometric voxel rock mound)
  ctx.fillStyle = rockSide;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(60, -12);
  ctx.lineTo(60, -32);
  ctx.lineTo(0, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rockFront;
  ctx.beginPath();
  ctx.moveTo(-60, -12);
  ctx.lineTo(0, 16);
  ctx.lineTo(0, -6);
  ctx.lineTo(-60, -32);
  ctx.closePath();
  ctx.fill();

  // Tier 1 Top Plateau
  ctx.fillStyle = grassMid;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(60, -32);
  ctx.lineTo(0, -58);
  ctx.lineTo(-60, -32);
  ctx.closePath();
  ctx.fill();

  // Tier 2: Upper Peak
  const peakH = variant === 1 ? 38 : 30;
  ctx.fillStyle = rockSide;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(36, -38);
  ctx.lineTo(36, -38 - peakH);
  ctx.lineTo(0, -22 - peakH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rockFront;
  ctx.beginPath();
  ctx.moveTo(-36, -38);
  ctx.lineTo(0, -22);
  ctx.lineTo(0, -22 - peakH);
  ctx.lineTo(-36, -38 - peakH);
  ctx.closePath();
  ctx.fill();

  // Tier 2 Peak Plateau
  ctx.fillStyle = grassTop;
  ctx.beginPath();
  ctx.moveTo(0, -22 - peakH);
  ctx.lineTo(36, -38 - peakH);
  ctx.lineTo(0, -54 - peakH);
  ctx.lineTo(-36, -38 - peakH);
  ctx.closePath();
  ctx.fill();

  // Highlight ridge line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(0, -22 - peakH);
  ctx.stroke();

  // Optional miniature pine or wildflower on peak
  if (variant === 0) {
    ctx.fillStyle = theme.treeLeaf;
    ctx.beginPath();
    ctx.moveTo(0, -54 - peakH - 18);
    ctx.lineTo(-8, -54 - peakH);
    ctx.lineTo(8, -54 - peakH);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/* ── Traditional Filipino Bahay Kubo (Nipa Hut) ─────────────────────── */

function drawBahayKubo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  variant: number,
  _theme: KingdomTheme,
  time: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 1. Soft contact shadow on the ground beneath stilts
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 52, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Deeper core shadow under living quarters
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 38, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Bamboo Stilts (Haligi) & Foundation
  // Rear stilts (darker tone)
  ctx.fillStyle = '#78350F';
  ctx.fillRect(-27, -26, 4, 30);
  ctx.fillRect(23, -26, 4, 30);

  // Diagonal bamboo braces (Tukod sa silong)
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-28, 4);
  ctx.lineTo(0, -20);
  ctx.lineTo(28, 4);
  ctx.stroke();

  // Front & center stilts (warm bamboo with joint rings)
  const drawBambooPole = (px: number, py1: number, py2: number, w = 4.5) => {
    const bGrad = ctx.createLinearGradient(px - w / 2, 0, px + w / 2, 0);
    bGrad.addColorStop(0, '#B45309');
    bGrad.addColorStop(0.5, '#F59E0B');
    bGrad.addColorStop(1, '#78350F');
    ctx.fillStyle = bGrad;
    ctx.fillRect(px - w / 2, py1, w, py2 - py1);

    // Bamboo rings/joints every 8px
    ctx.fillStyle = '#78350F';
    for (let j = py1 + 6; j < py2; j += 8) {
      ctx.fillRect(px - w / 2 - 0.5, j, w + 1, 1.5);
    }
  };

  drawBambooPole(-30, -22, 10);
  drawBambooPole(30, -22, 10);
  drawBambooPole(0, -22, 8);

  // 3. Elevated bamboo floor beams (Soleras)
  ctx.fillStyle = '#92400E';
  ctx.fillRect(-34, -25, 68, 5);
  ctx.fillStyle = '#D97706';
  ctx.fillRect(-34, -25, 68, 1.8);

  // 4. Woven Bamboo (Sawali / Amakan) Walls
  const wallGrad = ctx.createLinearGradient(0, -52, 0, -25);
  wallGrad.addColorStop(0, '#D97706');
  wallGrad.addColorStop(0.5, '#B45309');
  wallGrad.addColorStop(1, '#92400E');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(-29, -52, 58, 27);

  // Sawali woven texture (horizontal bamboo slats & cross diagonals)
  ctx.save();
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.24)';
  ctx.lineWidth = 1;
  for (let ly = -49; ly < -25; ly += 4) {
    ctx.beginPath();
    ctx.moveTo(-28, ly);
    ctx.lineTo(28, ly);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.22)';
  for (let lx = -26; lx < 28; lx += 8) {
    ctx.beginPath();
    ctx.moveTo(lx, -52);
    ctx.lineTo(lx + 10, -25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx + 10, -52);
    ctx.lineTo(lx, -25);
    ctx.stroke();
  }
  ctx.restore();

  // Corner bamboo wall studs
  ctx.fillStyle = '#78350F';
  ctx.fillRect(-30, -52, 3, 27);
  ctx.fillRect(27, -52, 3, 27);

  // 5. Doorway & Bamboo Ladder (Hagdan)
  ctx.fillStyle = '#451A03';
  ctx.fillRect(-24, -48, 13, 23);
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-24, -48, 13, 23);

  // Bamboo Ladder leaning down from doorway to ground
  ctx.save();
  ctx.strokeStyle = '#D4A373';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-21, -25);
  ctx.lineTo(-24, 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-13, -25);
  ctx.lineTo(-16, 9);
  ctx.stroke();

  // Rungs
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 2;
  for (let r = 0; r < 4; r++) {
    const t = (r + 1) / 5;
    const rx1 = -21 + (-24 - -21) * t;
    const ry1 = -25 + (9 - -25) * t;
    const rx2 = -13 + (-16 - -13) * t;
    const ry2 = -25 + (9 - -25) * t;
    ctx.beginPath();
    ctx.moveTo(rx1, ry1);
    ctx.lineTo(rx2, ry2);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Iconic Awning Window propped open with Bamboo Stick (Bintana na may Tukod)
  ctx.fillStyle = '#451A03';
  ctx.fillRect(0, -48, 22, 16);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.fillRect(2, -46, 18, 12);

  // Propped awning window panel (flaps open upward)
  ctx.save();
  const awGrad = ctx.createLinearGradient(0, -56, 0, -48);
  awGrad.addColorStop(0, '#D97706');
  awGrad.addColorStop(1, '#92400E');
  ctx.fillStyle = awGrad;
  ctx.beginPath();
  ctx.moveTo(-1, -49);
  ctx.lineTo(23, -49);
  ctx.lineTo(25, -57);
  ctx.lineTo(-3, -57);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bamboo prop stick (Tukod) supporting the window
  ctx.strokeStyle = '#D4A373';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(11, -33);
  ctx.lineTo(13, -55);
  ctx.stroke();
  ctx.restore();

  // 7. Steep Thatched Nipa / Cogon Hip Roof (Bubong na Nipa)
  // Under-eaves dark shadow
  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.moveTo(-45, -50);
  ctx.lineTo(45, -50);
  ctx.lineTo(32, -54);
  ctx.lineTo(-32, -54);
  ctx.closePath();
  ctx.fill();

  // Main Thatched Hip Roof
  const roofGrad = ctx.createLinearGradient(0, -88, 0, -50);
  roofGrad.addColorStop(0, '#78350F');
  roofGrad.addColorStop(0.35, '#92400E');
  roofGrad.addColorStop(0.7, '#B45309');
  roofGrad.addColorStop(1, '#78350F');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(-12, -86);
  ctx.lineTo(12, -86);
  ctx.lineTo(45, -50);
  ctx.lineTo(-45, -50);
  ctx.closePath();
  ctx.fill();

  // Thatched straw layers (overlapping scalloped dried palm fronds)
  const drawThatchFringe = (yLvl: number, wHalf: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-wHalf, yLvl);
    for (let fx = -wHalf; fx <= wHalf; fx += 5) {
      ctx.lineTo(fx + 2.5, yLvl + 2.5);
      ctx.lineTo(fx + 5, yLvl);
    }
    ctx.lineTo(wHalf, yLvl - 4);
    ctx.lineTo(-wHalf, yLvl - 4);
    ctx.closePath();
    ctx.fill();
  };

  drawThatchFringe(-50, 46, '#B45309');
  drawThatchFringe(-58, 38, '#D97706');
  drawThatchFringe(-68, 29, '#F59E0B');
  drawThatchFringe(-78, 20, '#D97706');

  // Straw texture lines along the slope
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.28)';
  ctx.lineWidth = 1;
  for (let s = -35; s <= 35; s += 7) {
    const topX = (s / 35) * 10;
    ctx.beginPath();
    ctx.moveTo(topX, -86);
    ctx.lineTo(s, -50);
    ctx.stroke();
  }

  // Bamboo ridge cap along the peak (Kilo / Bubong ridge beam)
  ctx.fillStyle = '#D97706';
  drawRoundedRect(ctx, -16, -90, 32, 5, 2);
  ctx.fill();
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 1;
  for (let k = -12; k <= 12; k += 6) {
    ctx.beginPath();
    ctx.moveTo(k, -90);
    ctx.lineTo(k, -85);
    ctx.stroke();
  }

  // 8. Local Accents based on variant
  if (variant === 0) {
    // Terracotta clay water jar (Banga) sitting by the ladder
    ctx.fillStyle = '#9A3412';
    ctx.beginPath();
    ctx.arc(-28, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EA580C';
    drawRoundedRect(ctx, -30, 2, 4, 2, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(-29, 6, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 1) {
    // Lush Banana Plant (Puno ng Saging) beside the right side of the hut
    const sway = Math.sin(time * 0.003 + x * 0.02) * 2;
    ctx.fillStyle = '#15803D';
    ctx.fillRect(36, -14, 4, 22);

    const drawBananaLeaf = (lx: number, ly: number, angle: number, w: number, h: number) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);
      const leafGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      leafGrad.addColorStop(0, '#15803D');
      leafGrad.addColorStop(0.5, '#22C55E');
      leafGrad.addColorStop(1, '#166534');
      ctx.fillStyle = leafGrad;
      ctx.beginPath();
      ctx.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#86EFAC';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -h);
      ctx.stroke();
      ctx.restore();
    };

    drawBananaLeaf(38, -12, 0.4 + sway * 0.02, 11, 24);
    drawBananaLeaf(38, -14, -0.45 - sway * 0.02, 11, 22);
    drawBananaLeaf(38, -15, 0.05 + sway * 0.01, 10, 25);
    drawBananaLeaf(38, -10, 0.8 + sway * 0.02, 10, 20);
  } else {
    // Bougainvillea flower pot with vibrant magenta blooms hanging on front
    ctx.fillStyle = '#EA580C';
    drawRoundedRect(ctx, 16, -26, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#F43F5E';
    for (let f = 0; f < 6; f++) {
      const fx = 16 + (f % 3) * 3 + Math.sin(f) * 1.5;
      const fy = -28 - Math.floor(f / 3) * 3 + Math.cos(f) * 1.2;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, body: WaterBody, time: number, theme: KingdomTheme) {
  ctx.save();

  // Subtle ground shore sand/pebble border
  ctx.fillStyle = 'rgba(164, 107, 62, 0.35)';
  ctx.beginPath();
  ctx.ellipse(body.x + body.w / 2, body.y + body.h / 2 + 2, body.w / 2 + 8, body.h / 2 + 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Smooth Water Body Gradient
  const wGrad = ctx.createLinearGradient(body.x, body.y, body.x, body.y + body.h);
  wGrad.addColorStop(0, theme.waterColor);
  wGrad.addColorStop(0.7, theme.waterShine);
  wGrad.addColorStop(1, theme.waterColor);
  ctx.fillStyle = wGrad;

  // Smooth organic pond outline
  const rx = body.w / 2;
  const ry = body.h / 2;
  const cx = body.x + rx;
  const cy = body.y + ry;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Water edge stroke
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // BUTTERY SMOOTH CONTINUOUS WATER RIPPLES (NO wrapping modulo hitch)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 1.5;
  const waveTime = time * 0.002;

  for (let i = -1; i <= 1; i++) {
    const waveY = cy + i * (ry * 0.45) + Math.sin(waveTime * 1.8 + i * 1.5) * 2;
    const waveW = rx * (0.65 - Math.abs(i) * 0.2);
    const offsetX = Math.cos(waveTime + i) * 6;

    ctx.beginPath();
    ctx.moveTo(cx - waveW + offsetX, waveY);
    ctx.quadraticCurveTo(cx + offsetX, waveY - 2.5 + Math.sin(waveTime * 2.5 + i) * 2, cx + waveW + offsetX, waveY);
    ctx.stroke();
  }

  // Waterfall with continuous mist spray
  if (body.hasWaterfall) {
    const fx = body.x + body.w * 0.28;
    const fy = body.y - 32;
    const fh = 36;

    // Waterfall stream
    const fGrad = ctx.createLinearGradient(fx, fy, fx, fy + fh);
    fGrad.addColorStop(0, 'rgba(240, 248, 255, 0.95)');
    fGrad.addColorStop(0.5, theme.waterShine);
    fGrad.addColorStop(1, 'rgba(255, 255, 255, 0.85)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(fx - 7, fy, 14, fh);

    // Continuous smooth water spray
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let m = 0; m < 5; m++) {
      const mx = fx + Math.sin(time * 0.003 + m * 1.7) * 9;
      const my = fy + fh + Math.cos(time * 0.004 + m * 2.1) * 3;
      const mr = 2.5 + Math.sin(time * 0.005 + m) * 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud, time: number, theme: KingdomTheme) {
  const x = ((cloud.x + time * cloud.speed * 0.001) % (MAP_W + 400)) - 200;
  ctx.save();
  ctx.globalAlpha = cloud.opacity;
  ctx.fillStyle = theme.cloudColor;

  const s = cloud.scale;
  ctx.beginPath();
  ctx.arc(x, cloud.y, 20 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, cloud.y - 6 * s, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 35 * s, cloud.y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 15 * s, cloud.y + 4 * s, 14 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ── Mountains / background scenery ──────────────────────────────────── */

function drawMountains(ctx: CanvasRenderingContext2D, viewY: number, theme: KingdomTheme) {
  const parallax = viewY * 0.08;

  // Far mountains
  ctx.fillStyle = theme.mountainFar;
  ctx.beginPath();
  ctx.moveTo(-1000, 320 - parallax);
  for (let mx = -1000; mx <= MAP_W + 1000; mx += 140) {
    const peak = 140 + Math.sin(mx * 0.015) * 60 + Math.cos(mx * 0.007) * 40;
    ctx.lineTo(mx, peak - parallax);
  }
  ctx.lineTo(MAP_W + 1000, 360 - parallax);
  ctx.lineTo(-1000, 360 - parallax);
  ctx.closePath();
  ctx.fill();

  // Near mountains
  ctx.fillStyle = theme.mountainNear;
  ctx.beginPath();
  ctx.moveTo(-1000, 360 - parallax * 0.5);
  for (let mx = -1000; mx <= MAP_W + 1000; mx += 120) {
    const peak = 220 + Math.cos(mx * 0.012) * 50 + Math.sin(mx * 0.006) * 30;
    ctx.lineTo(mx, peak - parallax * 0.5);
  }
  ctx.lineTo(MAP_W + 1000, 400 - parallax * 0.5);
  ctx.lineTo(-1000, 400 - parallax * 0.5);
  ctx.closePath();
  ctx.fill();
}

/* ── The Rough Dirt Road (Unpaved countryside path with gravel & soil ruts) ── */

function drawPath(ctx: CanvasRenderingContext2D, nodes: PathNode[], theme: KingdomTheme, _time: number) {
  if (nodes.length < 2) return;

  ctx.save();

  // 1. Soft organic dirt ditch & ambient road shadow
  ctx.strokeStyle = 'rgba(25, 15, 5, 0.24)';
  ctx.lineWidth = 92;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawPathLine(ctx, nodes, 3, 6);
  ctx.stroke();

  // 2. Earthy trench / outer clay base (uneven soil shoulder)
  ctx.strokeStyle = theme.pathBorder;
  ctx.lineWidth = 84;
  drawPathLine(ctx, nodes, 0, 0);
  ctx.stroke();

  // 3. Packed countryside dirt & sand road bed
  ctx.strokeStyle = theme.pathColor;
  ctx.lineWidth = 72;
  drawPathLine(ctx, nodes, 0, 0);
  ctx.stroke();

  // 4. Subtle sunny dry dirt / gravel bevel on upper slope
  ctx.strokeStyle = theme.pathHighlight;
  ctx.lineWidth = 24;
  ctx.globalAlpha = 0.35;
  drawPathLine(ctx, nodes, -3, -2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 5. Twin worn vehicle/cart wheel ruts (darker compressed damp dirt tracks)
  drawRoughRoadRuts(ctx, nodes);

  // 6. Dry gravel center crest between the tracks
  ctx.strokeStyle = theme.pathHighlight;
  ctx.lineWidth = 14;
  ctx.globalAlpha = 0.28;
  drawPathLine(ctx, nodes, 0, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 7. Organic dirt ripples and washboard surface markings
  drawRoughRoadRipples(ctx, nodes, theme);

  // 8. Scattered pebbles, coarse gravel, and little stones
  drawRoughRoadPebbles(ctx, nodes);

  ctx.restore();
}

function drawPathLine(ctx: CanvasRenderingContext2D, nodes: PathNode[], ox: number, oy: number) {
  ctx.beginPath();
  ctx.moveTo(nodes[0].x + ox, nodes[0].y + oy);
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x + ox, prev.y + oy, midX + ox, midY + oy);
  }
  const last = nodes[nodes.length - 1];
  ctx.lineTo(last.x + ox, last.y + oy);
}

function drawRoughRoadRuts(ctx: CanvasRenderingContext2D, nodes: PathNode[]) {
  // Left and right worn dirt wheel tracks
  for (const offset of [-18, 18]) {
    ctx.save();
    // Wider damp compressed dirt track
    ctx.strokeStyle = 'rgba(45, 25, 8, 0.32)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawOffsetPath(ctx, nodes, offset);
    ctx.stroke();

    // Inner deep rut groove
    ctx.strokeStyle = 'rgba(30, 15, 5, 0.18)';
    ctx.lineWidth = 4;
    drawOffsetPath(ctx, nodes, offset);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOffsetPath(ctx: CanvasRenderingContext2D, nodes: PathNode[], offsetDist: number) {
  if (nodes.length < 2) return;

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    let nx = 0;
    let ny = 0;

    if (i < nodes.length - 1) {
      const next = nodes[i + 1];
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const len = Math.hypot(dx, dy) || 1;
      nx += -dy / len;
      ny += dx / len;
    }
    if (i > 0) {
      const prev = nodes[i - 1];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      nx += -dy / len;
      ny += dx / len;
    }

    const nlen = Math.hypot(nx, ny) || 1;
    points.push({
      x: curr.x + (nx / nlen) * offsetDist,
      y: curr.y + (ny / nlen) * offsetDist,
    });
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawRoughRoadRipples(ctx: CanvasRenderingContext2D, nodes: PathNode[], theme: KingdomTheme) {
  ctx.save();
  ctx.strokeStyle = theme.pathBorder;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.16;

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const steps = Math.max(3, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 36));

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Curved washboard soil groove
      const rLen = 22 + ((s * 7) % 12);
      ctx.beginPath();
      ctx.moveTo(x + nx * rLen, y + ny * rLen);
      ctx.quadraticCurveTo(x + dx * 0.05, y + dy * 0.05, x - nx * rLen, y - ny * rLen);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRoughRoadPebbles(ctx: CanvasRenderingContext2D, nodes: PathNode[]) {
  ctx.save();
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.floor(dist / 18);

    for (let s = 0; s < steps; s++) {
      // Deterministic pseudo-randomness based on coordinate
      const seed = Math.sin((a.x + s * 17.3 + i * 31) * 0.05) * 10000;
      const rand1 = seed - Math.floor(seed);
      const rand2 = Math.sin(seed * 3.1) - Math.floor(Math.sin(seed * 3.1));
      const rand3 = Math.cos(seed * 2.7) - Math.floor(Math.cos(seed * 2.7));

      const t = (s + rand1 * 0.6) / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Scatter laterally across road width (-30 to +30)
      const lateral = (rand2 - 0.5) * 60;
      const px = x + nx * lateral;
      const py = y + ny * lateral;

      const radius = 1.2 + rand3 * 2.2;
      const isDarkStone = rand1 > 0.45;

      // Small stone
      ctx.fillStyle = isDarkStone ? 'rgba(60, 35, 15, 0.45)' : 'rgba(235, 215, 180, 0.6)';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      // Shadow under stone
      if (radius > 2.0) {
        ctx.fillStyle = 'rgba(20, 10, 5, 0.25)';
        ctx.beginPath();
        ctx.arc(px + 0.6, py + 0.8, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* ── Isometric terrain tiles ─────────────────────────────────────────── */

function drawGrassTerrain(ctx: CanvasRenderingContext2D, theme: KingdomTheme, _time: number) {
  // Gradient base across wide area
  const grad = ctx.createLinearGradient(0, -200, 0, MAP_H + 200);
  grad.addColorStop(0, theme.grassLight);
  grad.addColorStop(0.5, theme.grassDark);
  grad.addColorStop(1, theme.grassLight);
  ctx.fillStyle = grad;
  ctx.fillRect(-2000, -500, MAP_W + 4000, MAP_H + 1000);

  // Subtle isometric diamond pattern
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.5;
  const tileW = 60;
  const tileH = 30;
  for (let row = -10; row < MAP_H / tileH + 10; row++) {
    for (let col = -20; col < (MAP_W + 1200) / tileW + 20; col++) {
      const x = col * tileW + (row % 2 ? tileW / 2 : 0) - 600;
      const y = row * tileH;
      ctx.beginPath();
      ctx.moveTo(x, y - tileH / 2);
      ctx.lineTo(x + tileW / 2, y);
      ctx.lineTo(x, y + tileH / 2);
      ctx.lineTo(x - tileW / 2, y);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // Grass texture patches
  const rng = mulberry32(42);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = theme.treeLeafLight;
  for (let i = 0; i < 200; i++) {
    const x = rng() * MAP_W;
    const y = rng() * MAP_H;
    const r = 20 + rng() * 40;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ── Sky ──────────────────────────────────────────────────────────────── */

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, theme: KingdomTheme) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(-2000, -500, w + 4000, h + 1000);
}

/* ── Particles ────────────────────────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}
/* ── Realistic 3D Padlock ─────────────────────────────────────────────── */

interface PadlockAnimParams {
  shackleLift?: number;
  shackleAngle?: number;
  lockWobbleX?: number;
  alpha?: number;
  hideBadge?: boolean;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawRealisticPadlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number = 44, anim?: PadlockAnimParams) {
  ctx.save();
  if (anim?.alpha !== undefined) {
    ctx.globalAlpha = Math.max(0, Math.min(1, anim.alpha));
  }
  const wobbleX = anim?.lockWobbleX || 0;
  x += wobbleX;

  const shackleLift = anim?.shackleLift || 0;
  const shackleAngle = anim?.shackleAngle || 0;

  // 1. Soft Ambient Golden Glow Halo
  const glow = ctx.createRadialGradient(x, y, size * 0.2, x, y, size * 1.4);
  glow.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
  glow.addColorStop(0.55, 'rgba(217, 119, 6, 0.22)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // 2. Heavy Drop Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.68, size * 0.55, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Shackle (Chrome Steel Arch with specular highlight)
  const shackleR = size * 0.34;
  const shackleThick = size * 0.16;
  const shackleY = y - size * 0.16;

  ctx.save();
  const pivotX = x - shackleR + shackleThick * 0.5;
  const pivotY = y + size * 0.08;
  ctx.translate(pivotX, pivotY);
  if (shackleAngle !== 0) ctx.rotate(shackleAngle);
  ctx.translate(-pivotX, -pivotY - shackleLift);

  ctx.beginPath();
  ctx.arc(x, shackleY, shackleR, Math.PI, 0, false);
  ctx.lineTo(x + shackleR, y + size * 0.12);
  ctx.lineTo(x + shackleR - shackleThick, y + size * 0.12);
  ctx.lineTo(x + shackleR - shackleThick, shackleY);
  ctx.arc(x, shackleY, shackleR - shackleThick, 0, Math.PI, true);
  ctx.lineTo(x - shackleR + shackleThick, y + size * 0.12 + shackleLift);
  ctx.lineTo(x - shackleR, y + size * 0.12 + shackleLift);
  ctx.closePath();

  const shackleGrad = ctx.createLinearGradient(x - shackleR, shackleY, x + shackleR, shackleY);
  shackleGrad.addColorStop(0, '#475569');
  shackleGrad.addColorStop(0.25, '#CBD5E1');
  shackleGrad.addColorStop(0.5, '#FFFFFF');
  shackleGrad.addColorStop(0.75, '#94A3B8');
  shackleGrad.addColorStop(1, '#334155');

  ctx.fillStyle = shackleGrad;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Padlock Metallic Body (Glossy Gold / Amber Brass)
  const bodyW = size * 1.0;
  const bodyH = size * 0.82;
  const bodyX = x - bodyW / 2;
  const bodyY = y - size * 0.06;
  const cornerR = 10;

  const bodyGrad = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  bodyGrad.addColorStop(0, '#FDE047');
  bodyGrad.addColorStop(0.25, '#F59E0B');
  bodyGrad.addColorStop(0.65, '#D97706');
  bodyGrad.addColorStop(1, '#92400E');

  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, bodyX, bodyY, bodyW, bodyH, cornerR);
  ctx.fill();
  ctx.stroke();

  // Specular top highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  drawRoundedRect(ctx, bodyX + 5, bodyY + 3, bodyW - 10, 3.5, 2);
  ctx.fill();

  // 5. Inset Keyhole
  const keyY = bodyY + bodyH * 0.44;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(x, keyY, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.06, keyY + size * 0.06);
  ctx.lineTo(x + size * 0.06, keyY + size * 0.06);
  ctx.lineTo(x + size * 0.09, keyY + size * 0.24);
  ctx.lineTo(x - size * 0.09, keyY + size * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/* ── Grand Kingdom Gate Portal Drawing ──────────────────────────────── */

function drawKingdomGatePortal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isLocked: boolean,
  nextKingdomName: string,
  _theme: KingdomTheme,
  time: number
) {
  ctx.save();
  ctx.translate(x, y);

  // 1. Grand Stone Courtyard / Threshold Step Foundation
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.ellipse(0, 18, 125, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  const stepGrad = ctx.createLinearGradient(0, -10, 0, 24);
  stepGrad.addColorStop(0, '#E2E8F0');
  stepGrad.addColorStop(0.5, '#CBD5E1');
  stepGrad.addColorStop(1, '#94A3B8');
  ctx.fillStyle = stepGrad;
  ctx.beginPath();
  ctx.ellipse(0, 14, 115, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Flagstone paving lines on the threshold
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-70, 12); ctx.lineTo(70, 12);
  ctx.moveTo(-45, 4); ctx.lineTo(-45, 22);
  ctx.moveTo(0, 4); ctx.lineTo(0, 22);
  ctx.moveTo(45, 4); ctx.lineTo(45, 22);
  ctx.stroke();

  // 2. Ground Light Pool (Radiant spill from the portal interior onto the ground)
  const poolGrad = ctx.createRadialGradient(0, 10, 8, 0, 10, 105);
  poolGrad.addColorStop(0, isLocked ? 'rgba(99, 102, 241, 0.45)' : 'rgba(56, 189, 248, 0.60)');
  poolGrad.addColorStop(0.6, isLocked ? 'rgba(59, 130, 246, 0.22)' : 'rgba(14, 165, 233, 0.28)');
  poolGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = poolGrad;
  ctx.beginPath();
  ctx.ellipse(0, 10, 105, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. ARCH INTERIOR PORTAL DOORWAY (Framed by the stone arch)
  // Arch opening dimensions: Width 110px (-55 to +55), Height 180px (-180 to 0)
  ctx.save();
  ctx.beginPath();
  // Semi-circular arch top + rectangular lower doorway
  ctx.arc(0, -95, 54, Math.PI, 0, false);
  ctx.lineTo(54, 10);
  ctx.lineTo(-54, 10);
  ctx.closePath();
  ctx.clip();

  // Deep starry void background
  const voidGrad = ctx.createLinearGradient(0, -160, 0, 10);
  if (isLocked) {
    voidGrad.addColorStop(0, '#0F172A');
    voidGrad.addColorStop(0.5, '#1E1B4B');
    voidGrad.addColorStop(1, '#312E81');
  } else {
    voidGrad.addColorStop(0, '#082F49');
    voidGrad.addColorStop(0.4, '#0369A1');
    voidGrad.addColorStop(0.8, '#0284C7');
    voidGrad.addColorStop(1, '#38BDF8');
  }
  ctx.fillStyle = voidGrad;
  ctx.fill();

  // Swirling Gateway Vortex
  const vortexGrad = ctx.createRadialGradient(0, -85, 4, 0, -85, 60);
  if (isLocked) {
    vortexGrad.addColorStop(0, '#FFFFFF');
    vortexGrad.addColorStop(0.25, '#A78BFA');
    vortexGrad.addColorStop(0.65, '#6366F1');
    vortexGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  } else {
    vortexGrad.addColorStop(0, '#FFFFFF');
    vortexGrad.addColorStop(0.2, '#BAE6FD');
    vortexGrad.addColorStop(0.55, '#38BDF8');
    vortexGrad.addColorStop(0.85, '#0284C7');
    vortexGrad.addColorStop(1, 'rgba(3, 105, 161, 0)');
  }
  ctx.fillStyle = vortexGrad;
  ctx.beginPath();
  ctx.arc(0, -85, 58, 0, Math.PI * 2);
  ctx.fill();

  // Rotating Celestial Gateway Runes & Sparkle Rings
  ctx.save();
  ctx.translate(0, -85);
  ctx.rotate(time * 0.001);
  ctx.strokeStyle = isLocked ? 'rgba(196, 181, 253, 0.7)' : 'rgba(254, 240, 138, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 14, 4, 14]);
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(0, -85);
  ctx.rotate(-time * 0.0016);
  ctx.strokeStyle = isLocked ? 'rgba(167, 139, 250, 0.6)' : 'rgba(125, 211, 252, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ascending vertical light rays streaming upwards through gateway
  const numRays = 5;
  for (let r = 0; r < numRays; r++) {
    const rx = -38 + r * 19 + Math.sin(time * 0.003 + r) * 4;
    const rayA = 0.25 + Math.sin(time * 0.004 + r * 1.5) * 0.18;
    ctx.strokeStyle = isLocked ? `rgba(167, 139, 250, ${rayA})` : `rgba(255, 255, 255, ${rayA})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rx, 10);
    ctx.lineTo(rx + Math.sin(time * 0.002 + r) * 6, -170);
    ctx.stroke();
  }

  // If Locked: Heavy Ornamental Portcullis Iron Lattice sealed across the opening
  if (isLocked) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3.5;
    for (let barX = -44; barX <= 44; barX += 14) {
      ctx.beginPath();
      ctx.moveTo(barX, -160);
      ctx.lineTo(barX, 10);
      ctx.stroke();
    }
    for (let barY = -150; barY <= 0; barY += 26) {
      ctx.beginPath();
      ctx.moveTo(-54, barY);
      ctx.lineTo(54, barY);
      ctx.stroke();
    }
  }

  ctx.restore(); // end clipped arch interior

  // 4. ARCHITECTURAL GRAND GATE STRUCTURE (Left & Right Pillars + Arch + Pediment)
  const pillarGrad = ctx.createLinearGradient(-80, 0, 0, 0);
  pillarGrad.addColorStop(0, '#94A3B8');
  pillarGrad.addColorStop(0.3, '#E2E8F0');
  pillarGrad.addColorStop(0.7, '#CBD5E1');
  pillarGrad.addColorStop(1, '#64748B');

  // Left Stone Pillar
  ctx.fillStyle = pillarGrad;
  ctx.fillRect(-82, -18, 30, 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(-82, -18, 30, 28);
  ctx.fillRect(-78, -150, 22, 132);
  ctx.strokeRect(-78, -150, 22, 132);
  ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
  ctx.fillRect(-74, -145, 4, 122);
  ctx.fillRect(-66, -145, 4, 122);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(-84, -164, 34, 14);
  ctx.strokeRect(-84, -164, 34, 14);

  // Right Stone Pillar
  const rightPillarGrad = ctx.createLinearGradient(0, 0, 80, 0);
  rightPillarGrad.addColorStop(0, '#64748B');
  rightPillarGrad.addColorStop(0.3, '#CBD5E1');
  rightPillarGrad.addColorStop(0.7, '#E2E8F0');
  rightPillarGrad.addColorStop(1, '#94A3B8');
  ctx.fillStyle = rightPillarGrad;
  ctx.fillRect(52, -18, 30, 28);
  ctx.strokeRect(52, -18, 30, 28);
  ctx.fillRect(56, -150, 22, 132);
  ctx.strokeRect(56, -150, 22, 132);
  ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
  ctx.fillRect(60, -145, 4, 122);
  ctx.fillRect(68, -145, 4, 122);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(50, -164, 34, 14);
  ctx.strokeRect(50, -164, 34, 14);

  // 5. Grand Stone Archway Molding (Curved Arch spanning across top)
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(0, -95, 62, Math.PI, 0, false);
  ctx.stroke();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -95, 69, Math.PI, 0, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -95, 55, Math.PI, 0, false);
  ctx.stroke();

  // Carved Keystone at Apex
  ctx.fillStyle = '#F59E0B';
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -166);
  ctx.lineTo(12, -166);
  ctx.lineTo(16, -144);
  ctx.lineTo(-16, -144);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Star on Keystone
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⭐', 0, -155);

  // 6. Classical Pediment / Roof Entablature above Arch
  const roofGrad = ctx.createLinearGradient(0, -210, 0, -170);
  roofGrad.addColorStop(0, '#B45309');
  roofGrad.addColorStop(0.5, '#D97706');
  roofGrad.addColorStop(1, '#92400E');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(-96, -170);
  ctx.lineTo(0, -215);
  ctx.lineTo(96, -170);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Golden Apex Finial
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(0, -220, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 7. Brass Lantern Torches mounted on Pillars
  const drawLantern = (lx: number, ly: number) => {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx > 0 ? lx + 12 : lx - 12, ly - 8);
    ctx.lineTo(lx > 0 ? lx + 12 : lx - 12, ly + 6);
    ctx.stroke();

    const torchX = lx > 0 ? lx + 12 : lx - 12;
    const flameGlow = ctx.createRadialGradient(torchX, ly, 2, torchX, ly, 24);
    flameGlow.addColorStop(0, 'rgba(251, 191, 36, 0.95)');
    flameGlow.addColorStop(0.4, 'rgba(245, 158, 11, 0.6)');
    flameGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = flameGlow;
    ctx.beginPath();
    ctx.arc(torchX, ly, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(torchX - 5, ly - 7, 10, 14);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(torchX - 5, ly - 7, 10, 14);
  };
  drawLantern(-78, -80);
  drawLantern(78, -80);

  // 8. Gate Portal Floating Banner Sign Plaque
  ctx.fillStyle = '#0F172A';
  drawRoundedRect(ctx, -95, -192, 190, 26, 13);
  ctx.fill();
  ctx.strokeStyle = isLocked ? '#A855F7' : '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = isLocked ? '#F3E8FF' : '#E0F2FE';
  ctx.font = '900 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isLocked ? `\uD83D\uDD12 GATEWAY TO ${nextKingdomName.toUpperCase()}` : `\u2728 GATEWAY TO ${nextKingdomName.toUpperCase()}`,
    0,
    -179
  );

  ctx.restore();
}

/* ====================================================================== *
 *  ModernWorldMap Class
 * ====================================================================== */

type EventName = keyof MapEvents;
type Listener = (...args: never[]) => void;

export class ModernWorldMap implements MapRenderer {
  /* -- DOM structure --------------------------------------------------- */
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodeLayer: HTMLDivElement;
  private hudLayer: HTMLDivElement;
  private container: HTMLElement;
  private dpr: number;

  /* -- State ----------------------------------------------------------- */
  private currentKingdom: KingdomId = 1;
  private currentLevel = 1;
  private starsHistory: StarHistoryItem[] = [];
  private flowOpts: MapFlowOptions | null = null;
  private inputLocked = false;
  private destroyed = false;
  private animFrameId: number | null = null;

  /* -- Padlock Unlock Animation State ----------------------------------- */
  private unlockingPadlock: {
    kingdomId: number;
    progress: number;
    shackleLift: number;
    shackleAngle: number;
    lockWobbleX: number;
    alpha: number;
    mistAlpha: number;
    dropY: number;
  } | null = null;

  /* -- 70% Dark Overlay for Padlock Unlock ------------------------------ */
  private unlockOverlay: HTMLDivElement;
  private padlockLayer: HTMLDivElement;
  private padlockEl: HTMLDivElement | null = null;
  private hasMoved = false;

  /* -- Portal Transition & 50% Dark Overlay ---------------------------- */
  private portalOverlay: HTMLDivElement | null = null;
  private activePortalPos: { x: number; y: number } | null = null;

  /* -- Camera ---------------------------------------------------------- */
  private viewX = 0;
  private viewY = 0;
  private targetViewY = 0;
  private viewportW = 0;
  private viewportH = 0;
  private zoom = 1.45;

  /* -- Interaction ----------------------------------------------------- */
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPointerTime = 0;
  private instantVY = 0;
  private dragViewX = 0;
  private dragViewY = 0;
  private touchDist = 0;
  private touchZoom = 1;
  private inertiaVY = 0;
  /* 3D orbit drag, Tala-style (OrbitControls enableDamping): pointer moves only collect the turn,
     the frame loop applies it once per frame and lets it glide out after release. */
  private orbitPendingYaw = 0;
  private orbitPendingPitch = 0;
  private orbitVelYaw = 0; // rad per second
  private orbitVelPitch = 0;
  /** 3D pinch/wheel zoom changed the view: move the level buttons once in the next frame. */
  private layoutDirty = false;
  private isPostWalkZoomEasing = false;
  private pointerDownTarget: HTMLElement | null = null;
  private pointerCaptured = false;
  private lastKingdomClickTime = 0;

  /* -- Avatar DOM Layer ------------------------------------------------ */
  private avatarLayer: HTMLDivElement;
  private avatarEl: HTMLDivElement | null = null;
  private avatarImgEl: HTMLImageElement | null = null;
  private avatarBubbleEl: HTMLDivElement | null = null;
  private avatarUrl = '';
  private avatarStandOffsetY = -28; // Stands proudly on top of level button when idle
  private avatarImg: HTMLImageElement | null = null;
  private avatarX = 0;
  private avatarY = 0;
  private avatarFacingRight = true;
  private avatarWalking = false;
  private walkPath: Array<{ x: number; y: number }> = [];
  private walkIndex = 0;
  private walkSpeed = 160; // px/sec
  private walkDistanceTraveled = 0;
  private lastStepSoundDist = 0;
  private walkCallback: (() => void) | null = null;
  private walkBubbleText = '';
  /** 3D: the student went to the front of the kingdom building (tapped the building) and is away from its level. */
  private avatarAtFront = false;
  /** Zoom and focus offset (map px, + = down) the camera eases to after a walk. */
  private postWalkZoom = 1.45;
  private postWalkFocusDY = 0;
  /** Camera turn the 3D view eases to (cancelled by a drag). */
  private orbitGoal: { yaw: number; pitch: number } | null = null;

  /* -- Generated data per kingdom ------------------------------------- */
  private pathNodes: PathNode[] = [];
  private scenery: SceneryItem[] = [];
  private waterBodies: WaterBody[] = [];
  private clouds: Cloud[] = [];

  /* -- Level nodes (DOM) ---------------------------------------------- */
  private nodeEls: Map<number, HTMLElement> = new Map();
  private nodeStates: Map<number, NodeState> = new Map();

  /* -- Particles ------------------------------------------------------ */
  private particles: Particle[] = [];

  /* -- Events --------------------------------------------------------- */
  private listeners: Map<EventName, Listener[]> = new Map();
  private onStepClickCb: ((mapId: number, questionIndex: number) => void) | null = null;
  private onKingdomClickCb: ((kingdomId: number) => void) | null = null;
  private onLockedKingdomClickCb: (() => void) | null = null;

  /* -- Landmark Artwork ----------------------------------------------- */
  private landmarkImages: Record<KingdomId, HTMLImageElement> = {
    1: new Image(),
    2: new Image(),
    3: new Image(),
  };

  /* -- Sound hooks ---------------------------------------------------- */
  private hooks: MapSoundHooks;

  /* -- Timing --------------------------------------------------------- */
  private lastFrame = 0;
  private time = 0;
  private lastDt = 16;

  /* -- 3D world (three.js); null = classic 2D canvas ------------------- */
  private world3d: World3D | null = null;
  /** True while the 3D code is still downloading. */
  private pending3D = false;
  private use3DAvatar = false;
  /** True when the 2D overlay canvas has something drawn on it (3D mode). */
  private overlayDrawn = true;

  constructor(
    container: HTMLElement,
    avatarImgUrl: string,
    activeMapId: number,
    qIndex: number,
    _customMaps: unknown,
    _initialPos: unknown,
    history?: StarHistoryItem[],
    flowOptions?: MapFlowOptions,
    hooks?: MapSoundHooks,
  ) {
    this.container = container;
    this.hooks = hooks ?? {};
    this.starsHistory = history ?? [];
    this.flowOpts = flowOptions ?? null;

    this.currentKingdom = (Math.min(3, Math.max(1, activeMapId)) as KingdomId);
    this.currentLevel = Math.max(1, Math.min(LEVELS_PER_KINGDOM, qIndex));

    // Preload landmark artwork
    this.landmarkImages[1].src = '/assets/landmarks/kingdom1_epces.png';
    this.landmarkImages[2].src = '/assets/landmarks/kingdom2_bayan.png';
    this.landmarkImages[3].src = '/assets/landmarks/kingdom3_capitol.png';

    // DPR
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Create root
    this.root = document.createElement('div');
    this.root.className = 'vq-modern-map-root';
    this.root.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#000;';

    // Canvas for terrain/scenery
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vq-modern-map-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.root.appendChild(this.canvas);

    // 3D world under the 2D canvas (the 2D canvas then only draws the gate portal and sparkles).
    // ?map3d=0 forces the classic 2D look.
    let want3D = hasWebGL();
    try {
      if (new URLSearchParams(window.location.search).get('map3d') === '0') want3D = false;
    } catch {
      /* no location */
    }
    // The 3D code is a separate download (dynamic import); until it arrives the map shows a plain sky.
    if (want3D) {
      this.pending3D = true;
      this.root.classList.add('vq-3d');
      import('./three/World3D')
        .then((mod) => this.attach3D(mod.World3D))
        .catch((err) => {
          console.warn('3D map unavailable, using the 2D map', err);
          this.pending3D = false;
          this.root.classList.remove('vq-3d');
          this.updateNodeStates();
          this.updateNodePositions();
        });
    }

    const rawCtx = this.canvas.getContext('2d', { alpha: want3D });
    if (!rawCtx) throw new Error('Canvas 2D context unavailable');
    this.ctx = rawCtx;

    // Node layer (DOM level buttons)
    this.nodeLayer = document.createElement('div');
    this.nodeLayer.className = 'vq-modern-map-nodes';
    this.nodeLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.root.appendChild(this.nodeLayer);

    // Avatar layer (DOM avatar layered strictly ON TOP of level buttons with z-index: 20)
    this.avatarLayer = document.createElement('div');
    this.avatarLayer.className = 'vq-modern-map-avatar-layer';
    this.avatarLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;';
    this.root.appendChild(this.avatarLayer);

    // HUD overlay layer
    this.hudLayer = document.createElement('div');
    this.hudLayer.className = 'vq-modern-map-hud';
    this.hudLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.root.appendChild(this.hudLayer);

    // Scoped Dark Overlay element (display:none placeholder; dark shroud is scoped strictly to kingdom building & courtyard)
    this.unlockOverlay = document.createElement('div');
    this.unlockOverlay.className = 'vq-unlock-dark-overlay';
    this.unlockOverlay.style.cssText = 'display:none;pointer-events:none;';
    this.root.appendChild(this.unlockOverlay);

    // 50% Dark Overlay for Kingdom Portal Transition (Layered at z-index: 45)
    this.portalOverlay = document.createElement('div');
    this.portalOverlay.className = 'vq-portal-dark-overlay';
    this.portalOverlay.style.cssText =
      'position:absolute;inset:0;background:rgba(0,0,0,0.5);opacity:0;pointer-events:none;z-index:45;transition:opacity 0.85s ease-in-out;';
    this.root.appendChild(this.portalOverlay);

    // Padlock layer: DOM padlock strictly in FRONT of the 70% dark overlay at z-index: 50
    this.padlockLayer = document.createElement('div');
    this.padlockLayer.className = 'vq-padlock-layer';
    this.padlockLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;';
    this.root.appendChild(this.padlockLayer);

    // Insert into container
    container.appendChild(this.root);

    // Load avatar
    this.avatarUrl = avatarImgUrl || '/assets/explorer_boy.png';
    this.avatarImg = new Image();
    this.avatarImg.crossOrigin = 'anonymous';
    this.avatarImg.src = this.avatarUrl;

    // Initialize DOM Avatar on top of level
    this.initAvatarDOM(this.avatarUrl);
    this.use3DAvatar = this.world3d?.setAvatar(this.avatarUrl) ?? false;

    // Inject CSS
    this.injectStyles();

    // Setup event listeners
    this.setupInput();

    // Generate world for initial kingdom
    this.generateKingdom(this.currentKingdom);

    // Position avatar at current level
    const startNode = this.pathNodes[this.currentLevel - 1];
    if (startNode) {
      this.avatarX = startNode.x;
      this.avatarY = startNode.y;
    }

    // Create level node DOM elements, standalone padlock, and initial avatar state
    this.createNodeElements();
    this.updateNodeStates();
    this.updateKingdomLockVisuals();

    // Initial camera: if kingdom not entered yet, focus on entrance gate & padlock with zoom 1.25!
    this.resizeCanvas();
    if (!this.isKingdomEntered(this.currentKingdom)) {
      this.zoom = 1.25;
      const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
      const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 310 + this.lmShift();
      this.centerOnLocation(bx, by);
    } else {
      this.zoom = 1.45;
      this.centerOnLevel(this.currentLevel, false);
    }

    // Setup resize observer
    const ro = new ResizeObserver(() => this.resizeCanvas());
    ro.observe(container);

    // Start render loop
    this.animFrameId = requestAnimationFrame((t) => this.frame(t));
  }

  private injectStyles(): void {
    if (document.getElementById('vq-modern-map-styles')) return;
    const style = document.createElement('style');
    style.id = 'vq-modern-map-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;900&display=swap');

      .vq-modern-map-root {
        font-family: 'Inter', system-ui, sans-serif;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      .vq-node-btn {
        position: absolute;
        pointer-events: auto;
        width: 58px;
        height: 58px;
        border-radius: 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', system-ui, sans-serif;
        font-weight: 900;
        font-size: 18px;
        color: #fff;
        cursor: pointer;
        transform: translate(-50%, -50%) scale(1);
        transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), filter 0.2s ease, box-shadow 0.2s ease;
        z-index: 5;
        box-shadow: 0 10px 0 rgba(0,0,0,0.32), 0 16px 26px rgba(0,0,0,0.42), inset 0 3px 0 rgba(255,255,255,0.7), inset 0 -3px 0 rgba(0,0,0,0.25);
        text-shadow: 0 1px 3px rgba(0,0,0,0.6);
        border: 2.8px solid rgba(255,255,255,0.9);
      }
      .vq-node-btn:hover {
        transform: translate(-50%, -50%) scale(1.15) translateY(-5px);
        filter: brightness(1.15);
        box-shadow: 0 15px 0 rgba(0,0,0,0.28), 0 22px 32px rgba(0,0,0,0.48), inset 0 3px 0 rgba(255,255,255,0.9);
      }
      .vq-node-btn:active {
        transform: translate(-50%, -50%) scale(0.96) translateY(3px);
        box-shadow: 0 5px 0 rgba(0,0,0,0.38), 0 10px 16px rgba(0,0,0,0.35);
      }

      .vq-node-btn.node-completed {
        background: linear-gradient(180deg, #34D399 0%, #059669 55%, #047857 100%);
        border-color: #A7F3D0;
      }
      .vq-node-btn.node-current {
        background: linear-gradient(180deg, #FB7185 0%, #E11D48 55%, #9F1239 100%);
        border-color: #FECDD3;
        animation: vq-candy-pulse 1.8s ease-in-out infinite;
      }
      .vq-node-btn.node-unlocked {
        background: linear-gradient(180deg, #38BDF8 0%, #0284C7 55%, #0369A1 100%);
        border-color: #BAE6FD;
      }
      .vq-node-btn.node-locked {
        background: linear-gradient(180deg, #64748B 0%, #334155 55%, #1E293B 100%);
        border-color: #94A3B8;
        cursor: default;
        opacity: 0.88;
      }
      .vq-node-btn.node-locked:hover {
        transform: translate(-50%, -50%) scale(1);
        filter: none;
      }

      @keyframes vq-candy-pulse {
        0%, 100% {
          box-shadow: 0 10px 0 rgba(0,0,0,0.32), 0 0 0 0 rgba(225, 29, 72, 0.65);
          transform: translate(-50%, -50%) scale(1.05);
        }
        50% {
          box-shadow: 0 12px 0 rgba(0,0,0,0.28), 0 0 0 14px rgba(225, 29, 72, 0);
          transform: translate(-50%, -50%) scale(1.12) translateY(-3px);
        }
      }

      .vq-node-stars {
        position: absolute;
        bottom: -18px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 1px;
        font-size: 13px;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.7));
      }

      .vq-node-arrow {
        display: none;
      }

      /* ── Avatar DOM Layer (z-index: 20 guarantees it is strictly ON TOP of level buttons) ── */
      .vq-modern-map-avatar-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 20;
      }

      .vq-avatar-container {
        position: absolute;
        left: 0;
        top: 0;
        width: 68px;
        height: 80px;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        will-change: left, top, transform;
        transform-origin: bottom center;
      }

      .vq-avatar-sprite-wrapper {
        position: relative;
        width: 60px;
        height: 72px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        transform-origin: bottom center;
        transition: transform 0.16s ease-out;
      }

      .vq-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));
      }

      .vq-avatar-shadow {
        position: absolute;
        bottom: -2px;
        left: 50%;
        width: 44px;
        height: 12px;
        transform: translateX(-50%);
        background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0) 72%);
        border-radius: 50%;
        z-index: -1;
      }

      .vq-avatar-container.is-3d .vq-avatar-sprite-wrapper,
      .vq-avatar-container.is-3d .vq-avatar-shadow {
        visibility: hidden;
      }

      /* 3D map: the kingdom building is drawn by three.js; the DOM landmark is only a tap area. */
      .vq-3d .vq-landmark-container,
      .vq-3d .vq-landmark-container:hover {
        transform: none !important;
        filter: none !important;
        transition: none !important;
        background: transparent;
      }
      .vq-landmark-hit {
        width: 100%;
        height: 100%;
      }

      .vq-avatar-badge {
        position: absolute;
        top: -16px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
        color: #FFFFFF;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.6px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1.5px solid #FEF3C7;
        box-shadow: 0 3px 8px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.7);
        animation: vq-avatar-badge-bounce 1.6s ease-in-out infinite;
        white-space: nowrap;
        z-index: 5;
      }

      @keyframes vq-avatar-badge-bounce {
        0%, 100% {
          transform: translateX(-50%) translateY(0);
        }
        50% {
          transform: translateX(-50%) translateY(-4px);
        }
      }

      .vq-avatar-bubble {
        position: absolute;
        bottom: 88px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.92);
        color: #FDE047;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.4px;
        padding: 5px 12px;
        border-radius: 14px;
        border: 1.8px solid #FACC15;
        box-shadow: 0 6px 16px rgba(0,0,0,0.45);
        white-space: nowrap;
        display: none;
        z-index: 10;
        animation: vq-bubble-in 0.3s ease-out;
      }

      .vq-avatar-bubble::after {
        content: '';
        position: absolute;
        bottom: -7px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 7px 6px 0;
        border-style: solid;
        border-color: #FACC15 transparent transparent;
      }

      @keyframes vq-bubble-in {
        0% { opacity: 0; transform: translate(-50%, -80%) scale(0.8); }
        100% { opacity: 1; transform: translate(-50%, -100%) scale(1); }
      }

      .vq-gate-btn {
        position: absolute;
        pointer-events: auto;
        width: 180px;
        height: 120px;
        transform: translate(-50%, -50%);
        cursor: pointer;
        z-index: 4;
        background: none;
        border: none;
        padding: 0;
      }

      /* ── High-Fidelity 2.5D Isometric HTML / SVG Kingdom Landmarks ── */
      .vq-landmark-container {
        position: absolute;
        pointer-events: auto;
        transform: translate(-50%, 0);
        transform-origin: top center;
        cursor: pointer;
        z-index: 5;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), filter 0.25s ease-out;
        filter: drop-shadow(0 14px 28px rgba(0,0,0,0.45));
      }
      .vq-landmark-container:hover {
        transform: translate(-50%, -4px) scale(1.02);
        filter: drop-shadow(0 22px 36px rgba(0,0,0,0.58));
      }
      .vq-landmark-container-inner {
        position: relative;
        display: inline-block;
      }
      .vq-landmark-container.is-locked .vq-landmark-svg {
        filter: brightness(0.88) contrast(1.02) saturate(0.92) drop-shadow(0 14px 28px rgba(0, 0, 0, 0.52));
        transition: filter 0.65s ease;
      }
      .vq-landmark-svg {
        display: block;
        width: 580px;
        height: 420px;
        overflow: visible;
        transition: filter 0.65s ease;
      }

      /* Animated SVG Elements */
      @keyframes vq-flag-wave {
        0% { transform: skewY(0deg) scaleY(1); }
        50% { transform: skewY(5deg) scaleY(0.96) translateY(-2px); }
        100% { transform: skewY(-5deg) scaleY(1.04) translateY(2px); }
      }
      .vq-flag-wave {
        transform-box: fill-box;
        transform-origin: left center;
        animation: vq-flag-wave 2.2s ease-in-out infinite alternate;
      }
      .vq-flag-wave.delay-1 {
        animation-delay: -0.7s;
      }
      .vq-flag-wave.delay-2 {
        animation-delay: -1.4s;
      }

      @keyframes vq-lantern-glow {
        0% { opacity: 0.55; transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1.15); }
      }
      .vq-lantern-glow {
        transform-box: fill-box;
        transform-origin: center;
        animation: vq-lantern-glow 2s ease-in-out infinite alternate;
      }

      @keyframes vq-heart-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
      .vq-heart-pulse {
        transform-box: fill-box;
        transform-origin: center;
        animation: vq-heart-pulse 1.8s ease-in-out infinite;
      }

      @keyframes vq-bell-ring {
        0%, 80%, 100% { transform: rotate(0deg); }
        85% { transform: rotate(14deg); }
        90% { transform: rotate(-14deg); }
        95% { transform: rotate(8deg); }
      }
      .vq-bell {
        transform-box: fill-box;
        transform-origin: top center;
        animation: vq-bell-ring 2.6s ease-in-out infinite;
      }

      /* ── Gate Lock Standalone Overlay (Layered strictly above dark vignette overlay at z-index: 50) ── */
      .vq-padlock-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 50;
      }
      .vq-unlock-dark-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 35;
        opacity: 0;
        will-change: opacity, background;
      }
      .vq-landmark-container.is-unlocking .vq-landmark-svg {
        filter: drop-shadow(0 0 28px rgba(251, 191, 36, 0.65)) brightness(1.08);
        transition: filter 0.5s ease;
      }
      .vq-gate-lock-standalone {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        cursor: pointer;
        z-index: 50;
        user-select: none;
        touch-action: manipulation;
        filter: drop-shadow(0 0 24px rgba(245, 158, 11, 0.75));
        transition: filter 0.25s ease, transform 0.15s ease;
      }
      .vq-gate-lock-standalone:hover {
        filter: drop-shadow(0 0 32px rgba(251, 191, 36, 0.95)) scale(1.05);
      }
      .vq-gate-lock-overlay {
        display: none !important;
      }
      .vq-padlock-mesh {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        filter: drop-shadow(0 8px 20px rgba(0,0,0,0.7));
      }
      .p-shackle {
        width: 32px;
        height: 24px;
        border: 6px solid #CBD5E1;
        border-bottom: none;
        border-radius: 20px 20px 0 0;
        background: transparent;
        margin-bottom: -4px;
        transform-origin: 6px bottom;
      }
      .p-body {
        width: 50px;
        height: 42px;
        background: linear-gradient(135deg, #F59E0B 0%, #D97706 60%, #B45309 100%);
        border: 2.5px solid #FDE68A;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.6);
      }
      .p-keyhole {
        width: 8px;
        height: 12px;
        background: #451A03;
        border-radius: 4px;
      }

      .vq-building-badge {
        position: absolute;
        top: -24px;
        background: transparent;
        color: #94A3B8;
        font-family: 'Inter', sans-serif;
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0.8px;
        padding: 0;
        border-radius: 0;
        white-space: nowrap;
        box-shadow: none;
        border: none;
        animation: vq-bounce-arrow 0.8s ease-in-out infinite alternate;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
        transition: color 0.2s ease;
      }
      .vq-gate-lock-standalone:hover .vq-building-badge {
        color: #CBD5E1;
      }

      .vq-kingdom-banner {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 100;
        background: rgba(0,0,0,0.6);
        opacity: 0;
        transition: opacity 0.5s ease;
      }
      .vq-kingdom-banner.show {
        opacity: 1;
      }
      .vq-kingdom-banner h2 {
        color: #FFD700;
        font-size: 36px;
        font-weight: 900;
        text-shadow: 0 2px 12px rgba(0,0,0,0.6);
        margin: 0;
        animation: vq-banner-text 0.6s ease-out;
      }
      .vq-kingdom-banner p {
        color: rgba(255,255,255,0.9);
        font-size: 16px;
        margin: 8px 0 0;
        animation: vq-banner-text 0.6s ease-out 0.2s both;
      }

      @keyframes vq-banner-text {
        0% { opacity: 0; transform: translateY(20px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      .vq-kingdom-indicator {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        pointer-events: auto;
        z-index: 5;
      }
      .vq-kingdom-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.7);
        background: rgba(255,255,255,0.2);
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .vq-kingdom-dot.active {
        background: #FFD700;
        border-color: #FFD700;
        width: 24px;
        border-radius: 5px;
      }
      .vq-kingdom-dot.locked {
        opacity: 0.3;
        cursor: default;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Kingdom generation ─────────────────────────────────────────── */

  private generateKingdom(kingdom: KingdomId): void {
    this.pathNodes = generatePathNodes(kingdom);
    this.scenery = generateScenery(kingdom, this.pathNodes);
    this.waterBodies = generateWater(kingdom, this.pathNodes);
    this.clouds = generateClouds(kingdom);
    this.build3D(kingdom);
  }

  private build3D(kingdom: KingdomId): void {
    if (!this.world3d) return;
    const p0 = this.pathNodes[0];
    try {
      this.world3d.setKingdom({
        kingdom,
        theme: KINGDOM_THEMES[kingdom],
        nodes: this.pathNodes,
        scenery: this.scenery,
        water: this.waterBodies,
        mapW: MAP_W,
        mapH: MAP_H,
        // the kingdom building stands on the ground below level 1 (where the 2D picture used to be)
        landmark: { x: p0?.x ?? MAP_W / 2, y: (p0?.y ?? PATH_BOT_Y) + 590 },
        gate: kingdom < 3 ? { x: MAP_W / 2, y: PATH_TOP_Y - 100 } : undefined,
      });
      this.world3d.setLandmarkLocked(!this.isKingdomEntered(kingdom), false);
    } catch (err) {
      console.error('3D map build failed, using the 2D map', err);
      this.disable3D();
    }
  }

  /** Called when the 3D code has downloaded: builds the 3D world under the DOM layers. */
  private attach3D(Ctor: typeof World3D): void {
    if (this.destroyed || !this.pending3D) return;
    this.pending3D = false;
    try {
      const w = new Ctor({ lite: isLowEndDevice(), mobile: isMobileDevice() });
      this.world3d = w;
      this.root.insertBefore(w.canvas, this.canvas);
      // clouds and birds: their own canvas right above the world
      this.root.insertBefore(w.skyCanvas, this.canvas);
      // The 3D student canvas lives in the avatar layer so it is drawn above the level buttons.
      this.avatarLayer.prepend(w.charCanvas);
      this.use3DAvatar = w.setAvatar(this.avatarUrl);
      this.resizeCanvas();
      this.build3D(this.currentKingdom);
      if (!this.world3d) return;
      this.updateNodeStates();
      this.updateKingdomLockVisuals();
      this.updateNodePositions();
    } catch (err) {
      console.warn('3D map unavailable, using the 2D map', err);
      this.disable3D();
    }
  }

  /** Drops the 3D world and goes back to the classic 2D canvas (e.g. after a WebGL failure). */
  private disable3D(): void {
    if (!this.world3d) return;
    try {
      this.world3d.dispose();
    } catch {
      /* ignore */
    }
    this.world3d = null;
    this.pending3D = false;
    this.use3DAvatar = false;
    this.avatarEl?.classList.remove('is-3d');
    this.root.classList.remove('vq-3d');
    const ctx = this.canvas.getContext('2d');
    if (ctx) this.ctx = ctx;
    // bring back the 2D landmark picture
    this.updateNodeStates();
    this.updateNodePositions();
  }

  /** In 3D the kingdom building stands lower on the map (clear of level 1), so its camera focus moves down too. */
  private lmShift(): number {
    return this.world3d || this.pending3D ? 270 : 0;
  }

  /** The DOM landmark: the full picture in 2D; in 3D only an invisible tap area over the 3D building. */
  private landmarkContent(kingdom: KingdomId): string {
    if (this.world3d || this.pending3D) return '<div class="vq-landmark-hit"></div>';
    return this.renderLandmarkHTML(kingdom);
  }

  /** Map point -> screen px (CSS) plus local scale (screen px per map px). Works for 2D and 3D. */
  private toScreen(x: number, y: number, h = 0): { x: number; y: number; s: number } {
    if (this.world3d) {
      this.world3d.setView(this.viewX, this.viewY, this.zoom);
      const p = this.world3d.project(x, y, h);
      return p.visible ? p : { x: -99999, y: -99999, s: p.s };
    }
    return { x: (x - this.viewX) * this.zoom, y: (y - this.viewY) * this.zoom, s: this.zoom };
  }

  /* ── Canvas sizing ──────────────────────────────────────────────── */

  private resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    this.viewportW = rect.width;
    this.viewportH = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.world3d?.resize(rect.width, rect.height);
    this.updateNodePositions();
  }

  /* ── Input ──────────────────────────────────────────────────────── */

  private setupInput(): void {
    // Mouse / touch drag to scroll
    this.root.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.root.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.root.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.root.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.root.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Touch zoom
    this.root.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchDist = Math.hypot(dx, dy);
        this.touchZoom = this.zoom;
      }
    }, { passive: true });

    this.root.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (this.touchDist > 0) {
          this.setZoom(Math.max(0.95, Math.min(2.5, this.touchZoom * (dist / this.touchDist))));
          // 3D: buttons are moved once per frame in update(), not on every touch event
          if (this.world3d) this.layoutDirty = true;
          else this.updateNodePositions();
        }
      }
    }, { passive: true });

    const endPinch = (e: TouchEvent) => {
      if (e.touches.length < 2) this.touchDist = 0;
    };
    this.root.addEventListener('touchend', endPinch, { passive: true });
    this.root.addEventListener('touchcancel', endPinch, { passive: true });
  }

  /** Changes the zoom; in 3D the view centre (the orbit focus, e.g. the student) stays put. */
  private setZoom(z: number): void {
    if (this.world3d) {
      const cx = this.viewX + this.viewportW / (2 * this.zoom);
      const cy = this.viewY + this.viewportH / (2 * this.zoom);
      this.zoom = z;
      this.viewX = cx - this.viewportW / (2 * z);
      this.viewY = cy - this.viewportH / (2 * z);
      this.targetViewY = this.viewY;
    } else {
      this.zoom = z;
    }
  }

  private triggerKingdomClick(kingdomId: KingdomId): void {
    const now = performance.now();
    if (now - this.lastKingdomClickTime < 400) return;
    this.lastKingdomClickTime = now;
    if (this.inputLocked) return;
    this.hooks.click?.();
    this.onKingdomClickCb?.(kingdomId);
    this.emit('kingdomClick', kingdomId);
  }

  private onPointerDown(e: PointerEvent): void {
    // Ignore interactive UI controls that shouldn't initiate camera drag
    const t = e.target as HTMLElement;
    if (t.closest('.vq-node-btn, .vq-gate-btn, .vq-gate-lock-standalone, .vq-kingdom-indicator, button, select, input, label')) {
      return;
    }
    // 2D: the landmark picture is a button; 3D: dragging over the building turns the camera
    if (!this.world3d && t.closest('.vq-landmark-container')) return;
    this.pointerDownTarget = e.target as HTMLElement;
    this.pointerCaptured = false;
    this.isDragging = true;
    this.hasMoved = false;
    this.isPostWalkZoomEasing = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.lastPointerTime = performance.now();
    this.instantVY = 0;
    this.dragViewX = this.viewX;
    this.dragViewY = this.viewY;
    this.targetViewY = this.viewY;
    this.inertiaVY = 0;
    // a new touch catches the gliding camera (like Tala's OrbitControls)
    this.orbitVelYaw = 0;
    this.orbitVelPitch = 0;
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (!this.hasMoved && Math.hypot(dx, dy) > 8) {
      this.hasMoved = true;
      if (!this.pointerCaptured) {
        try {
          this.root.setPointerCapture(e.pointerId);
          this.pointerCaptured = true;
        } catch {}
      }
    }
    if (this.hasMoved && this.world3d) {
      // 3D: dragging turns the camera 360° around the student (or the kingdom building) and tilts it;
      // the focus stays on the student, like Tala-Salitaan's map.
      const mx = e.clientX - this.lastPointerX;
      const my = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (e.pointerType === 'touch' && this.touchDist > 0) return; // pinch in progress
      this.orbitGoal = null;
      // Applied once per frame in update() (a fast mouse sends 2-4 moves per frame).
      this.orbitPendingYaw += -mx * 0.0075;
      this.orbitPendingPitch += my * 0.0045;
      this.inertiaVY = 0;
      this.instantVY = 0;
      this.lastPointerTime = performance.now();
      return;
    }
    if (this.hasMoved) {
      // In 3D the ground is tilted, so one finger pixel covers more map vertically.
      const gy = this.world3d ? this.world3d.groundScaleY : 1;
      this.viewX = this.dragViewX - dx / this.zoom;
      this.viewY = this.dragViewY - dy / (this.zoom * gy);
      this.targetViewY = this.viewY;
      this.clampView();

      const now = performance.now();
      const moveDY = e.clientY - this.lastPointerY;
      this.instantVY = -moveDY / this.zoom;
      this.lastPointerY = e.clientY;
      this.lastPointerTime = now;

      this.updateNodePositions();
      this.updatePadlockPosition();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.pointerCaptured) {
        try {
          this.root.releasePointerCapture(e.pointerId);
        } catch {}
        this.pointerCaptured = false;
      }

      // Measure time since last movement: if pointer was held still before release, no fling
      const timeSinceLastMove = performance.now() - this.lastPointerTime;
      // held still before letting go: the 3D turn stops instead of gliding
      if (timeSinceLastMove > 75) {
        this.orbitVelYaw = 0;
        this.orbitVelPitch = 0;
      }
      if (timeSinceLastMove > 75 || !this.hasMoved) {
        this.inertiaVY = 0;
      } else {
        // Soft, controlled momentum capped to max ±12px/frame
        this.inertiaVY = Math.max(-12, Math.min(12, this.instantVY * 0.45));
      }
      this.targetViewY = this.viewY;

      // If user tapped without dragging, check if they tapped the landmark building or padlock!
      if (!this.hasMoved && !this.inputLocked) {
        const hitTarget = this.pointerDownTarget || (e.target as HTMLElement);
        if (hitTarget && hitTarget.closest('.vq-landmark-container') && this.world3d && this.isKingdomEntered(this.currentKingdom)) {
          // 3D, kingdom already open: the student walks to the building's front (or back to its level)
          this.onBuildingTap3D();
        } else if (hitTarget && hitTarget.closest('.vq-landmark-container, .vq-gate-lock-standalone')) {
          this.triggerKingdomClick(this.currentKingdom);
        }
      }
      this.pointerDownTarget = null;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.world3d) {
      // 3D: the wheel zooms towards / away from the student
      this.setZoom(Math.max(0.95, Math.min(2.5, this.zoom * Math.exp(-e.deltaY * 0.0012))));
      this.layoutDirty = true; // buttons follow once per frame (a trackpad sends many wheel events)
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = -e.deltaY * 0.002;
      this.zoom = Math.max(0.95, Math.min(2.5, this.zoom + delta));
      this.updateNodePositions();
    } else {
      // Buttery smooth target-based wheel scroll
      const visH = this.viewportH / this.zoom;
      const scrollStep = (e.deltaY / this.zoom) * 1.2;
      this.targetViewY = Math.max(0, Math.min(MAP_H - visH, this.targetViewY + scrollStep));
    }
  }

  private clampView(): void {
    const visW = this.viewportW / this.zoom;
    const visH = this.viewportH / this.zoom;
    if (this.world3d) {
      // 3D: the ground goes on past the map edges, so only the focus point is kept on the map
      // (the student stays in the middle of the screen even at the first and last levels).
      const cx = Math.max(0, Math.min(MAP_W, this.viewX + visW / 2));
      const cy = Math.max(0, Math.min(MAP_H + 200, this.viewY + visH / 2));
      this.viewX = cx - visW / 2;
      this.viewY = cy - visH / 2;
      return;
    }
    if (visW >= MAP_W) {
      this.viewX = -(visW - MAP_W) / 2;
    } else {
      this.viewX = Math.max(0, Math.min(MAP_W - visW, this.viewX));
    }
    // 3D: the kingdom building stands lower (clear of level 1), so allow a little more scroll at the bottom
    const maxH = MAP_H + (this.world3d || this.pending3D ? 200 : 0);
    this.viewY = Math.max(0, Math.min(maxH - visH, this.viewY));
  }

  /* ── Level node DOM ─────────────────────────────────────────────── */

  private createNodeElements(): void {
    // Clear old
    this.nodeLayer.innerHTML = '';
    this.nodeEls.clear();

    for (const pn of this.pathNodes) {
      const el = document.createElement('button');
      el.className = 'vq-node-btn node-locked';
      el.textContent = String(pn.level);
      el.dataset['level'] = String(pn.level);
      el.style.position = 'absolute';

      el.addEventListener('click', () => {
        if (this.inputLocked) return;
        if (!this.isKingdomEntered(this.currentKingdom)) {
          this.hooks.click?.();
          this.onKingdomClickCb?.(this.currentKingdom);
          this.emit('kingdomClick', this.currentKingdom);
          return;
        }
        const state = this.nodeStates.get(pn.level);
        if (!state || state.status === 'locked') {
          this.hooks.wrong?.();
          return;
        }
        this.hooks.click?.();
        const open = () => {
          if (this.onStepClickCb) {
            this.onStepClickCb(this.currentKingdom, pn.level);
          }
          this.emit('levelClick', this.currentKingdom, pn.level);
        };
        // 3D: the student is at the kingdom building, so it first walks back along the road to this level
        if (this.world3d && this.avatarAtFront) {
          this.walkAlongRoad({ x: pn.x, y: pn.y }, () => {
            this.avatarAtFront = false;
            open();
          });
          return;
        }
        open();
      });

      el.addEventListener('pointerenter', () => {
        this.hooks.hover?.();
      });

      this.nodeLayer.appendChild(el);
      this.nodeEls.set(pn.level, el);
    }

    // 3D HTML Landmark Building at the bottom
    const landmarkEl = document.createElement('div');
    landmarkEl.className = 'vq-landmark-container';
    landmarkEl.dataset['kingdom'] = String(this.currentKingdom);
    landmarkEl.title = KINGDOM_THEMES[this.currentKingdom].name;
    landmarkEl.innerHTML = this.landmarkContent(this.currentKingdom);

    const onGateClick = (e: Event) => {
      // 3D: the map root handles the building (tap = open the kingdom, drag = turn the camera)
      if (this.world3d) return;
      e.stopPropagation();
      this.triggerKingdomClick(this.currentKingdom);
    };

    // In 3D the building can also be dragged to turn the camera around it.
    landmarkEl.addEventListener('pointerdown', (e) => {
      if (!this.world3d) e.stopPropagation();
    });
    landmarkEl.addEventListener('click', onGateClick);
    landmarkEl.addEventListener('pointerup', onGateClick);
    this.nodeLayer.appendChild(landmarkEl);

    // Gate button at the top (to next kingdom)
    if (this.currentKingdom < 3) {
      const gateBtn = document.createElement('button');
      gateBtn.className = 'vq-gate-btn';
      gateBtn.dataset['gate'] = 'next';
      gateBtn.addEventListener('click', () => {
        if (this.inputLocked) return;
        const nextK = (this.currentKingdom + 1) as KingdomId;
        const isUnlocked = this.isKingdomUnlocked(nextK);
        if (isUnlocked) {
          this.hooks.click?.();
          this.onKingdomClickCb?.(nextK);
          this.emit('kingdomClick', nextK);
        } else {
          this.hooks.wrong?.();
          this.onLockedKingdomClickCb?.();
          this.emit('lockedKingdomClick');
        }
      });
      this.nodeLayer.appendChild(gateBtn);
    }

    // Kingdom indicator dots
    this.createKingdomIndicator();

    this.updateNodePositions();
  }

  private createKingdomIndicator(): void {
    this.hudLayer.querySelectorAll('.vq-kingdom-indicator').forEach((el) => el.remove());
    const indicator = document.createElement('div');
    indicator.className = 'vq-kingdom-indicator';

    for (let k = 1; k <= 3; k++) {
      const dot = document.createElement('div');
      dot.className = 'vq-kingdom-dot';
      if (k === this.currentKingdom) dot.classList.add('active');
      if (!this.isKingdomUnlocked(k as KingdomId)) dot.classList.add('locked');

      dot.addEventListener('click', () => {
        if (k === this.currentKingdom) {
          this.hooks.click?.();
          this.centerOnActiveLocation();
          return;
        }
        if (!this.isKingdomUnlocked(k as KingdomId)) {
          this.hooks.wrong?.();
          this.onLockedKingdomClickCb?.();
          return;
        }
        this.hooks.click?.();
        this.switchKingdom(k as KingdomId);
      });

      indicator.appendChild(dot);
    }

    this.hudLayer.appendChild(indicator);
  }


  private createPadlockElement(): void {
    if (this.padlockEl) {
      this.padlockEl.remove();
      this.padlockEl = null;
    }

    if (this.isKingdomEntered(this.currentKingdom)) {
      return;
    }

    const el = document.createElement('div');
    el.className = 'vq-gate-lock-standalone';
    el.innerHTML = `
      <div class="vq-padlock-mesh">
        <div class="p-shackle"></div>
        <div class="p-body">
          <div class="p-keyhole"></div>
        </div>
      </div>
      <div class="vq-building-badge">TAP TO UNLOCK</div>
    `;

    const onPadlockTap = (e: Event) => {
      e.stopPropagation();
      if (this.inputLocked) return;
      this.triggerKingdomClick(this.currentKingdom);
    };

    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', onPadlockTap);

    this.padlockLayer.appendChild(el);
    this.padlockEl = el;
    this.updatePadlockPosition();
  }

  private updatePadlockPosition(): void {
    if (!this.padlockEl) return;
    if (this.isKingdomEntered(this.currentKingdom)) {
      this.padlockEl.style.display = 'none';
      return;
    }
    this.padlockEl.style.display = 'flex';

    const p0 = this.pathNodes[0];
    const bx = p0?.x ?? MAP_W / 2;
    const by = (p0?.y ?? PATH_BOT_Y) + 310 + this.lmShift();

    // 3D: in front of the building's facade, at door height
    const sp = this.world3d ? this.toScreen(bx, by + 30, 0.42) : this.toScreen(bx, by);
    const sx = sp.x;
    const sy = sp.y;

    if (sx < -200 || sx > this.viewportW + 200 || sy < -200 || sy > this.viewportH + 200) {
      this.padlockEl.style.display = 'none';
      return;
    }

    this.padlockEl.style.left = `${sx}px`;
    this.padlockEl.style.top = `${sy}px`;
    this.padlockEl.style.transform = `translate(-50%, -50%) scale(${Math.max(0.75, Math.min(1.8, sp.s))})`;
  }

  private updateKingdomLockVisuals(): void {
    const isEntered = this.isKingdomEntered(this.currentKingdom);
    const landmarkEl = this.nodeLayer.querySelector('.vq-landmark-container') as HTMLElement | null;
    if (landmarkEl) {
      landmarkEl.classList.toggle('is-locked', !isEntered);
    }
    // While the unlock animation runs it colours the building itself.
    if (!this.unlockingPadlock) this.world3d?.setLandmarkLocked(!isEntered, false);
    if (!isEntered) {
      this.createPadlockElement();
    } else {
      if (this.padlockEl) {
        this.padlockEl.remove();
        this.padlockEl = null;
      }
    }
    this.updateAvatarDOM();
  }

  private isKingdomEntered(k: KingdomId): boolean {
    if (!this.flowOpts) return false;
    return this.flowOpts.enteredKingdomIds.includes(k);
  }

  private isKingdomUnlocked(k: KingdomId): boolean {
    if (k === 1) return true;
    if (this.flowOpts?.activeMapId && this.flowOpts.activeMapId >= k) return true;
    if (this.flowOpts?.enteredKingdomIds?.includes(k)) return true;
    // Unlocked if previous kingdom has all 45 levels completed
    const prevKingdom = (k - 1) as KingdomId;
    let completedInPrev = 0;
    for (const h of this.starsHistory) {
      const mapId = h.mapId ?? h.orderIndex;
      if (mapId === prevKingdom && h.questionIndex) {
        completedInPrev = Math.max(completedInPrev, h.questionIndex);
      }
    }
    return completedInPrev >= LEVELS_PER_KINGDOM;
  }

  private renderLandmarkHTML(kingdom: KingdomId): string {
    // Standalone single 3D padlock is rendered in padlockLayer at z-index 50 (unaffected by 70% dark overlay)

    if (kingdom === 1) {
      // === KINGDOM 1: TWO-STORY PHILIPPINE DepEd ELEMENTARY SCHOOL (EPCES) ===
      return `
        <div class="vq-landmark-container-inner">
        <svg class="vq-landmark-svg k1-svg" viewBox="0 0 600 440" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="k1-rf-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#22C55E" />
              <stop offset="50%" stop-color="#16A34A" />
              <stop offset="100%" stop-color="#15803D" />
            </linearGradient>
            <linearGradient id="k1-rf-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#16A34A" />
              <stop offset="100%" stop-color="#14532D" />
            </linearGradient>
            <linearGradient id="k1-rf-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#15803D" />
              <stop offset="100%" stop-color="#052E16" />
            </linearGradient>
            <linearGradient id="k1-wall-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFDF0" />
              <stop offset="60%" stop-color="#FEF3C7" />
              <stop offset="100%" stop-color="#FDE68A" />
            </linearGradient>
            <linearGradient id="k1-wall-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#F59E0B" />
              <stop offset="100%" stop-color="#B45309" />
            </linearGradient>
            <linearGradient id="k1-wainscot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#16A34A" />
              <stop offset="100%" stop-color="#14532D" />
            </linearGradient>
            <linearGradient id="k1-win-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#E0F2FE" />
              <stop offset="35%" stop-color="#7DD3FC" />
              <stop offset="85%" stop-color="#0284C7" />
              <stop offset="100%" stop-color="#0369A1" />
            </linearGradient>
            <linearGradient id="k1-stone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F8FAFC" />
              <stop offset="60%" stop-color="#E2E8F0" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </linearGradient>
            <linearGradient id="k1-stone-step" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#E2E8F0" />
              <stop offset="100%" stop-color="#94A3B8" />
            </linearGradient>
            <linearGradient id="k1-door" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#92400E" />
              <stop offset="50%" stop-color="#78350F" />
              <stop offset="100%" stop-color="#451A03" />
            </linearGradient>
            <linearGradient id="k1-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FEF08A" />
              <stop offset="45%" stop-color="#FBBF24" />
              <stop offset="100%" stop-color="#D97706" />
            </linearGradient>
            <linearGradient id="k1-flame" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#DC2626" />
              <stop offset="50%" stop-color="#EA580C" />
              <stop offset="100%" stop-color="#FACC15" />
            </linearGradient>
            <linearGradient id="k1-welcome-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#064E3B" />
              <stop offset="50%" stop-color="#065F46" />
              <stop offset="100%" stop-color="#022C22" />
            </linearGradient>
            <linearGradient id="k1-welcome-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFBEB" />
              <stop offset="30%" stop-color="#FDE047" />
              <stop offset="70%" stop-color="#F59E0B" />
              <stop offset="100%" stop-color="#B45309" />
            </linearGradient>
            <linearGradient id="k1-heart-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#F87171" />
              <stop offset="35%" stop-color="#EF4444" />
              <stop offset="75%" stop-color="#DC2626" />
              <stop offset="100%" stop-color="#991B1B" />
            </linearGradient>
          </defs>

          <!-- Ground Lawn Terrace & Paved Courtyard -->
          <polygon points="60,412 540,412 470,165 130,165" fill="#4ADE80" opacity="0.45" />
          <polygon points="80,406 520,406 460,170 140,170" fill="#15803D" opacity="0.3" />
          <polygon points="140,405 460,405 385,236 215,236" fill="#D4A570" opacity="0.9" stroke="#5E381A" stroke-width="2" />

          <!-- Left Garden: Philippine Coconut Palm, Bush & Flowers -->
          <path d="M 62,260 Q 56,220 72,175" fill="none" stroke="#78350F" stroke-width="8" stroke-linecap="round" />
          <path d="M 72,175 Q 40,165 24,185" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round" />
          <path d="M 72,175 Q 60,145 42,150" fill="none" stroke="#16A34A" stroke-width="5" stroke-linecap="round" />
          <path d="M 72,175 Q 85,140 100,152" fill="none" stroke="#22C55E" stroke-width="5" stroke-linecap="round" />
          <path d="M 72,175 Q 100,170 106,190" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round" />
          <circle cx="68" cy="256" r="14" fill="#15803D" />
          <circle cx="82" cy="252" r="16" fill="#16A34A" />
          <circle cx="95" cy="258" r="12" fill="#22C55E" />
          <circle cx="72" cy="254" r="3.5" fill="#EF4444" />
          <circle cx="86" cy="250" r="3.5" fill="#F59E0B" />
          <circle cx="96" cy="256" r="3.5" fill="#EC4899" />

          <!-- Right Garden: Ornamental Palm & Bougainvillea Shrub -->
          <path d="M 538,260 Q 544,220 528,175" fill="none" stroke="#78350F" stroke-width="8" stroke-linecap="round" />
          <path d="M 528,175 Q 560,165 576,185" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round" />
          <path d="M 528,175 Q 540,145 558,150" fill="none" stroke="#16A34A" stroke-width="5" stroke-linecap="round" />
          <path d="M 528,175 Q 515,140 500,152" fill="none" stroke="#22C55E" stroke-width="5" stroke-linecap="round" />
          <path d="M 528,175 Q 500,170 494,190" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round" />
          <circle cx="532" cy="256" r="14" fill="#15803D" />
          <circle cx="518" cy="252" r="16" fill="#16A34A" />
          <circle cx="505" cy="258" r="12" fill="#22C55E" />
          <circle cx="528" cy="254" r="3.5" fill="#EC4899" />
          <circle cx="514" cy="250" r="3.5" fill="#F59E0B" />
          <circle cx="504" cy="256" r="3.5" fill="#EF4444" />

          <!-- Left Philippine Flagpole & Waving National Flag -->
          <polygon points="44,262 60,262 63,268 41,268" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1" />
          <line x1="52" y1="262" x2="52" y2="114" stroke="#94A3B8" stroke-width="3" />
          <line x1="53" y1="262" x2="53" y2="114" stroke="#FFFFFF" stroke-width="1.5" />
          <circle cx="52.5" cy="113" r="3.5" fill="#FBBF24" stroke="#B45309" stroke-width="0.8" />
          <g transform="translate(54, 115)">
            <g class="vq-flag-wave">
              <rect x="0" y="0" width="34" height="11" fill="#0038A8" />
              <rect x="0" y="11" width="34" height="11" fill="#CE1126" />
              <polygon points="0,0 18,11 0,22" fill="#FFFFFF" />
              <circle cx="7" cy="11" r="2.8" fill="#FCD116" />
              <circle cx="3.5" cy="4.5" r="1" fill="#FCD116" />
              <circle cx="3.5" cy="17.5" r="1" fill="#FCD116" />
              <circle cx="13.5" cy="11" r="1" fill="#FCD116" />
            </g>
          </g>

          <!-- Ground Building Shadow -->
          <ellipse cx="300" cy="258" rx="250" ry="24" fill="#0F172A" opacity="0.36" />

          <!-- ======================================================== -->
          <!-- TWO-STORY DepEd SCHOOL BUILDING ARCHITECTURE -->
          <!-- ======================================================== -->

          <!-- ── STORY 1 (GROUND FLOOR): Left Wing Wall (x: 100 to 205) ── -->
          <polygon points="100,168 205,168 205,250 100,250" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="82,176 100,168 100,250 82,258" fill="url(#k1-wall-side)" stroke="#A16207" stroke-width="1.5" />
          <rect x="100" y="236" width="105" height="14" fill="url(#k1-wainscot)" stroke="#14532D" stroke-width="1" />
          <line x1="100" y1="236" x2="205" y2="236" stroke="#FFFFFF" stroke-width="1.5" />

          <!-- Left Wing Ground Floor Windows (Authentic Philippine Jalousie Grid Windows) -->
          <!-- Bay 1 (x: 110) -->
          <rect x="110" y="180" width="38" height="46" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="129" y1="180" x2="129" y2="226" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="110" y1="191" x2="148" y2="191" stroke="#334155" stroke-width="1.2" />
          <line x1="110" y1="203" x2="148" y2="203" stroke="#334155" stroke-width="1.2" />
          <line x1="110" y1="215" x2="148" y2="215" stroke="#334155" stroke-width="1.2" />
          <rect x="108" y="226" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />
          <!-- Bay 2 (x: 156) -->
          <rect x="156" y="180" width="38" height="46" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="175" y1="180" x2="175" y2="226" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="156" y1="191" x2="194" y2="191" stroke="#334155" stroke-width="1.2" />
          <line x1="156" y1="203" x2="194" y2="203" stroke="#334155" stroke-width="1.2" />
          <line x1="156" y1="215" x2="194" y2="215" stroke="#334155" stroke-width="1.2" />
          <rect x="154" y="226" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />

          <!-- ── STORY 1 (GROUND FLOOR): Right Wing Wall (x: 395 to 500) ── -->
          <polygon points="395,168 500,168 500,250 395,250" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="500,168 518,176 518,258 500,250" fill="url(#k1-wall-side)" stroke="#A16207" stroke-width="1.5" />
          <rect x="395" y="236" width="105" height="14" fill="url(#k1-wainscot)" stroke="#14532D" stroke-width="1" />
          <line x1="395" y1="236" x2="500" y2="236" stroke="#FFFFFF" stroke-width="1.5" />

          <!-- Right Wing Ground Floor Windows -->
          <!-- Bay 3 (x: 406) -->
          <rect x="406" y="180" width="38" height="46" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="425" y1="180" x2="425" y2="226" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="406" y1="191" x2="444" y2="191" stroke="#334155" stroke-width="1.2" />
          <line x1="406" y1="203" x2="444" y2="203" stroke="#334155" stroke-width="1.2" />
          <line x1="406" y1="215" x2="444" y2="215" stroke="#334155" stroke-width="1.2" />
          <rect x="404" y="226" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />
          <!-- Bay 4 (x: 452) -->
          <rect x="452" y="180" width="38" height="46" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="471" y1="180" x2="471" y2="226" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="452" y1="191" x2="490" y2="191" stroke="#334155" stroke-width="1.2" />
          <line x1="452" y1="203" x2="490" y2="203" stroke="#334155" stroke-width="1.2" />
          <line x1="452" y1="215" x2="490" y2="215" stroke="#334155" stroke-width="1.2" />
          <rect x="450" y="226" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />

          <!-- ── STORY 1 (GROUND FLOOR): Central Entrance Portico (x: 205 to 395) ── -->
          <polygon points="205,168 395,168 395,250 205,250" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="2" />
          <polygon points="190,176 205,168 205,250 190,258" fill="url(#k1-wall-side)" stroke="#A16207" />
          <polygon points="395,168 410,176 410,258 395,250" fill="url(#k1-wall-side)" stroke="#A16207" />
          <rect x="205" y="236" width="190" height="14" fill="url(#k1-wainscot)" stroke="#14532D" stroke-width="1" />
          <line x1="205" y1="236" x2="395" y2="236" stroke="#FFFFFF" stroke-width="1.5" />

          <!-- Grand Classical White Columns (Ground Floor Portico) -->
          <!-- Left outer column (x: 222) -->
          <rect x="222" y="168" width="12" height="82" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="220" y="167" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="220" y="246" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <!-- Left inner column (x: 250) -->
          <rect x="250" y="168" width="12" height="82" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="248" y="167" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="248" y="246" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <!-- Right inner column (x: 338) -->
          <rect x="338" y="168" width="12" height="82" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="336" y="167" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="336" y="246" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <!-- Right outer column (x: 366) -->
          <rect x="366" y="168" width="12" height="82" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="364" y="167" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="364" y="246" width="16" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Grand Recessed Entrance Archway & Double Doors -->
          <path d="M 270,250 L 270,185 C 270,172 330,172 330,185 L 330,250 Z" fill="#181512" stroke="#78350F" stroke-width="3" />
          <!-- Arched Fanlight Transom Window -->
          <path d="M 272,185 C 272,174 328,174 328,185 Z" fill="url(#k1-win-glass)" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="300" y1="185" x2="300" y2="174" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="300" y1="185" x2="284" y2="178" stroke="#FFFFFF" stroke-width="1.2" />
          <line x1="300" y1="185" x2="316" y2="178" stroke="#FFFFFF" stroke-width="1.2" />
          <!-- Left Mahogany Door -->
          <rect x="273" y="186" width="26" height="64" fill="url(#k1-door)" stroke="#5A280B" stroke-width="1.5" />
          <rect x="276" y="190" width="20" height="15" fill="#5A280B" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="276" y="209" width="20" height="18" fill="#5A280B" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="276" y="231" width="20" height="15" fill="#5A280B" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="273" y="246" width="26" height="4" fill="#F59E0B" />
          <circle cx="295" cy="221" r="2.2" fill="#FDE047" stroke="#78350F" stroke-width="0.8" />
          <!-- Right Mahogany Door -->
          <rect x="301" y="186" width="26" height="64" fill="url(#k1-door)" stroke="#5A280B" stroke-width="1.5" />
          <rect x="304" y="190" width="20" height="15" fill="#5A280B" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="304" y="209" width="20" height="18" fill="#5A280B" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="304" y="231" width="20" height="15" fill="#5A280B" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="301" y="246" width="26" height="4" fill="#F59E0B" />
          <circle cx="305" cy="221" r="2.2" fill="#FDE047" stroke="#78350F" stroke-width="0.8" />

          <!-- Cascading Grand Stone Stairs (4 Tiers) -->
          <polygon points="252,250 348,250 356,258 244,258" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="242,258 358,258 368,266 232,266" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="230,266 370,266 382,274 218,274" fill="url(#k1-stone-step)" stroke="#64748B" stroke-width="1.5" />
          <polygon points="216,274 384,274 396,282 204,282" fill="url(#k1-stone-step)" stroke="#64748B" stroke-width="1.5" />

          <!-- ── INTERMEDIATE FLOOR SLAB & SECOND-STORY BALCONY VERANDA ── -->
          <!-- Heavy concrete floor dividing slab spanning the full building width -->
          <polygon points="80,172 520,172 520,162 80,162" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="76,174 80,172 80,162 76,164" fill="url(#k1-stone-step)" />
          <polygon points="520,172 524,174 524,164 520,162" fill="url(#k1-stone-step)" />
          <line x1="80" y1="172" x2="520" y2="172" stroke="#64748B" stroke-width="1.2" opacity="0.6" />

          <!-- Second-Floor Balcony Railings (Iconic Philippine School Corridor Veranda) -->
          <!-- Left Wing Balustrade (x: 95 to 205) -->
          <rect x="95" y="152" width="110" height="3" fill="#15803D" stroke="#14532D" stroke-width="0.8" />
          <rect x="97" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="109" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="121" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="133" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="145" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="157" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="169" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="181" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="193" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <!-- Balcony Hanging Bougainvillea Planter Boxes -->
          <rect x="105" y="159" width="30" height="4" rx="1" fill="#78350F" />
          <circle cx="112" cy="162" r="2.5" fill="#EC4899" />
          <circle cx="120" cy="161" r="2.5" fill="#EF4444" />
          <circle cx="128" cy="163" r="2.5" fill="#F59E0B" />
          <rect x="160" y="159" width="30" height="4" rx="1" fill="#78350F" />
          <circle cx="167" cy="162" r="2.5" fill="#EF4444" />
          <circle cx="175" cy="161" r="2.5" fill="#EC4899" />
          <circle cx="183" cy="163" r="2.5" fill="#F59E0B" />

          <!-- Right Wing Balustrade (x: 395 to 505) -->
          <rect x="395" y="152" width="110" height="3" fill="#15803D" stroke="#14532D" stroke-width="0.8" />
          <rect x="403" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="415" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="427" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="439" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="451" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="463" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="475" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="487" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="499" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <!-- Balcony Hanging Planters -->
          <rect x="410" y="159" width="30" height="4" rx="1" fill="#78350F" />
          <circle cx="417" cy="162" r="2.5" fill="#EC4899" />
          <circle cx="425" cy="161" r="2.5" fill="#EF4444" />
          <circle cx="433" cy="163" r="2.5" fill="#F59E0B" />
          <rect x="465" y="159" width="30" height="4" rx="1" fill="#78350F" />
          <circle cx="472" cy="162" r="2.5" fill="#EF4444" />
          <circle cx="480" cy="161" r="2.5" fill="#EC4899" />
          <circle cx="488" cy="163" r="2.5" fill="#F59E0B" />

          <!-- Central Balcony Railing (x: 215 to 385) -->
          <rect x="215" y="152" width="170" height="3" fill="#15803D" stroke="#14532D" stroke-width="0.8" />
          <rect x="225" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="245" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="265" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="285" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="311" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="331" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="351" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="371" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />

          <!-- ── STORY 2 (SECOND FLOOR): Left Wing Upper Classrooms (x: 100 to 205) ── -->
          <polygon points="100,88 205,88 205,164 100,164" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="82,96 100,88 100,164 82,172" fill="url(#k1-wall-side)" stroke="#A16207" stroke-width="1.5" />

          <!-- Upper Windows with Transom Ventilation Louvers ('Kawani' vents) -->
          <!-- Upper Bay 1 (x: 110) -->
          <rect x="110" y="93" width="38" height="7" rx="1" fill="#FEF08A" stroke="#CA8A04" stroke-width="1" />
          <line x1="110" y1="96.5" x2="148" y2="96.5" stroke="#78350F" stroke-width="0.8" />
          <rect x="110" y="103" width="38" height="45" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="129" y1="103" x2="129" y2="148" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="110" y1="114" x2="148" y2="114" stroke="#334155" stroke-width="1.2" />
          <line x1="110" y1="125" x2="148" y2="125" stroke="#334155" stroke-width="1.2" />
          <line x1="110" y1="136" x2="148" y2="136" stroke="#334155" stroke-width="1.2" />
          <rect x="108" y="148" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />
          <!-- Upper Bay 2 (x: 156) -->
          <rect x="156" y="93" width="38" height="7" rx="1" fill="#FEF08A" stroke="#CA8A04" stroke-width="1" />
          <line x1="156" y1="96.5" x2="194" y2="96.5" stroke="#78350F" stroke-width="0.8" />
          <rect x="156" y="103" width="38" height="45" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="175" y1="103" x2="175" y2="148" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="156" y1="114" x2="194" y2="114" stroke="#334155" stroke-width="1.2" />
          <line x1="156" y1="125" x2="194" y2="125" stroke="#334155" stroke-width="1.2" />
          <line x1="156" y1="136" x2="194" y2="136" stroke="#334155" stroke-width="1.2" />
          <rect x="154" y="148" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />

          <!-- ── STORY 2 (SECOND FLOOR): Right Wing Upper Classrooms (x: 395 to 500) ── -->
          <polygon points="395,88 500,88 500,164 395,164" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="500,88 518,96 518,172 500,164" fill="url(#k1-wall-side)" stroke="#A16207" stroke-width="1.5" />

          <!-- Upper Windows with Transom Louvers -->
          <!-- Upper Bay 3 (x: 406) -->
          <rect x="406" y="93" width="38" height="7" rx="1" fill="#FEF08A" stroke="#CA8A04" stroke-width="1" />
          <line x1="406" y1="96.5" x2="444" y2="96.5" stroke="#78350F" stroke-width="0.8" />
          <rect x="406" y="103" width="38" height="45" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="425" y1="103" x2="425" y2="148" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="406" y1="114" x2="444" y2="114" stroke="#334155" stroke-width="1.2" />
          <line x1="406" y1="125" x2="444" y2="125" stroke="#334155" stroke-width="1.2" />
          <line x1="406" y1="136" x2="444" y2="136" stroke="#334155" stroke-width="1.2" />
          <rect x="404" y="148" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />
          <!-- Upper Bay 4 (x: 452) -->
          <rect x="452" y="93" width="38" height="7" rx="1" fill="#FEF08A" stroke="#CA8A04" stroke-width="1" />
          <line x1="452" y1="96.5" x2="490" y2="96.5" stroke="#78350F" stroke-width="0.8" />
          <rect x="452" y="103" width="38" height="45" rx="2" fill="url(#k1-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="471" y1="103" x2="471" y2="148" stroke="#FFFFFF" stroke-width="1.8" />
          <line x1="452" y1="114" x2="490" y2="114" stroke="#334155" stroke-width="1.2" />
          <line x1="452" y1="125" x2="490" y2="125" stroke="#334155" stroke-width="1.2" />
          <line x1="452" y1="136" x2="490" y2="136" stroke="#334155" stroke-width="1.2" />
          <rect x="450" y="148" width="42" height="3.5" rx="1" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1" />

          <!-- ── STORY 2 (SECOND FLOOR): Central Pavilion Upper Veranda ── -->
          <polygon points="205,88 395,88 395,164 205,164" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="2" />
          <polygon points="190,96 205,88 205,164 190,172" fill="url(#k1-wall-side)" stroke="#A16207" />
          <polygon points="395,88 410,96 410,172 395,164" fill="url(#k1-wall-side)" stroke="#A16207" />

          <!-- Upper Classical Pilasters / Columns -->
          <rect x="222" y="88" width="12" height="74" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="250" y="88" width="12" height="74" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="338" y="88" width="12" height="74" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="366" y="88" width="12" height="74" fill="url(#k1-stone)" stroke="#CBD5E1" stroke-width="1" />

          <!-- Second-Floor Grand Balcony Double French Doors -->
          <path d="M 276,162 L 276,108 C 276,96 324,96 324,108 L 324,162 Z" fill="#181512" stroke="#78350F" stroke-width="2.5" />
          <path d="M 278,108 C 278,98 322,98 322,108 Z" fill="url(#k1-win-glass)" stroke="#FFFFFF" stroke-width="1.5" />
          <rect x="279" y="110" width="20" height="50" fill="url(#k1-win-glass)" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="279" y1="125" x2="299" y2="125" stroke="#FFFFFF" stroke-width="1.2" />
          <line x1="279" y1="140" x2="299" y2="140" stroke="#FFFFFF" stroke-width="1.2" />
          <rect x="301" y="110" width="20" height="50" fill="url(#k1-win-glass)" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="301" y1="125" x2="321" y2="125" stroke="#FFFFFF" stroke-width="1.2" />
          <line x1="301" y1="140" x2="321" y2="140" stroke="#FFFFFF" stroke-width="1.2" />

          <!-- ── ROOF STRUCTURE, PEDIMENT & CORNICES ── -->
          <!-- Left Wing DepEd Green Hip Roof -->
          <polygon points="72,94 105,58 205,66 215,94" fill="url(#k1-rf-front)" stroke="#14532D" stroke-width="2" />
          <polygon points="68,98 72,94 105,58 100,64" fill="url(#k1-rf-side)" stroke="#14532D" stroke-width="1.5" />
          <line x1="105" y1="58" x2="205" y2="66" stroke="#4ADE80" stroke-width="2" />
          <polygon points="105,58 205,66 205,62 105,54" fill="url(#k1-rf-top)" />

          <!-- Right Wing DepEd Green Hip Roof -->
          <polygon points="385,94 395,66 495,58 528,94" fill="url(#k1-rf-front)" stroke="#14532D" stroke-width="2" />
          <polygon points="495,58 528,94 532,98 500,64" fill="url(#k1-rf-side)" stroke="#14532D" stroke-width="1.5" />
          <line x1="395" y1="66" x2="495" y2="58" stroke="#4ADE80" stroke-width="2" />
          <polygon points="395,66 495,58 495,54 395,62" fill="url(#k1-rf-top)" />

          <!-- Central Grand Neoclassical Pediment & Architectural Frieze (DepEd Signature Facade) -->
          <!-- Main Hip Roof Behind Pediment -->
          <polygon points="170,82 300,16 430,82" fill="url(#k1-rf-front)" stroke="#14532D" stroke-width="2.5" />
          <polygon points="165,86 170,82 300,16 295,12" fill="url(#k1-rf-top)" stroke="#14532D" stroke-width="1.5" />
          <polygon points="300,16 430,82 435,86 305,12" fill="url(#k1-rf-side)" stroke="#14532D" stroke-width="1.5" />

          <!-- Triangular Pediment Tympanum -->
          <polygon points="186,76 300,22 414,76" fill="url(#k1-wall-front)" stroke="#CA8A04" stroke-width="2" />
          <!-- Crisp White Cornice Molding along Rakes -->
          <polygon points="180,76 300,18 420,76 412,80 300,26 188,80" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Official DepEd Flaming Torch of Knowledge & Logo Emblem -->
          <g transform="translate(300, 37)">
            <!-- Torch Flame -->
            <path d="M 0,-12 C -5,-7 -5,-2 0,0 C 5,-2 5,-7 0,-12 Z" fill="url(#k1-flame)" />
            <path d="M 0,-9 C -2.5,-5 -2.5,-1 0,0 C 2.5,-1 2.5,-5 0,-9 Z" fill="#FDE047" />
            <!-- DepEd Text -->
            <text x="0" y="13" font-family="'Inter', sans-serif" font-weight="900" font-size="12" text-anchor="middle" fill="#1D4ED8">Dep<tspan fill="#DC2626">ED</tspan></text>
          </g>

          <!-- Department Subtitle inside Pediment -->
          <text x="300" y="62" font-family="'Inter', sans-serif" font-weight="800" font-size="6" text-anchor="middle" fill="#1E3A8A" letter-spacing="1">DEPARTMENT OF EDUCATION</text>
          <text x="300" y="71" font-family="'Inter', sans-serif" font-weight="700" font-size="4.8" text-anchor="middle" fill="#047857" letter-spacing="0.6">CARAGA REGION XIII • DIVISION OF AGUSAN DEL SUR</text>

          <!-- Horizontal Architrave & Official Frieze Signboard (No Overlapping!) -->
          <rect x="178" y="75" width="244" height="23" rx="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="182" y="77" width="236" height="19" rx="2" fill="#064E3B" stroke="#F59E0B" stroke-width="1.5" />
          <rect x="184" y="79" width="232" height="15" rx="1.5" fill="none" stroke="#FDE047" stroke-width="0.8" opacity="0.6" />
          <text x="300" y="87.5" font-family="'Inter', sans-serif" font-weight="900" font-size="7.5" text-anchor="middle" fill="#FEF08A" letter-spacing="0.5">EAST PROSPERIDAD CENTRAL ELEM. SCHOOL</text>
          <text x="300" y="94" font-family="'Inter', sans-serif" font-weight="800" font-size="5" text-anchor="middle" fill="#6EE7B7" letter-spacing="1">SCHOOL ID: 131815</text>

          <!-- Apex Bell Tower with Golden Bell -->
          <rect x="286" y="2" width="28" height="20" fill="#FEF3C7" stroke="#CA8A04" stroke-width="2" rx="3" />
          <polygon points="278,2 300,-12 322,2" fill="url(#k1-rf-front)" stroke="#14532D" stroke-width="2" />
          <circle cx="300" cy="-12" r="3" fill="#FBBF24" stroke="#B45309" stroke-width="1" />
          <path d="M 292,20 L 292,10 C 292,6 308,6 308,10 L 308,20 Z" fill="#1E293B" />
          <g class="vq-bell">
            <ellipse cx="300" cy="14" rx="5" ry="4" fill="#F59E0B" stroke="#B45309" stroke-width="1" />
            <circle cx="300" cy="18" r="1.5" fill="#78350F" />
          </g>

          <!-- ======================================================== -->
          <!-- ENHANCED 3D SCULPTED LANDMARK MONUMENT "I ❤️ EPCES" -->
          <!-- ======================================================== -->
          <!-- Curved Stone Garden Curb & Pedestal -->
          <ellipse cx="300" cy="328" rx="200" ry="14" fill="#0F172A" opacity="0.32" />
          <polygon points="105,324 495,324 485,336 115,336" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.8" />
          <polygon points="115,336 485,336 475,342 125,342" fill="url(#k1-stone-step)" stroke="#64748B" stroke-width="1.5" />
          <!-- Neat Green Grass Curb along base -->
          <path d="M 100,332 Q 300,344 500,332" fill="none" stroke="#16A34A" stroke-width="4" stroke-linecap="round" />

          <!-- 3D Letter: I -->
          <g transform="translate(120, 286)">
            <polygon points="14,0 36,0 28,-9 6,-9" fill="#93C5FD" stroke="#1D4ED8" stroke-width="1.5" />
            <rect x="14" y="0" width="22" height="32" rx="2" fill="#2563EB" stroke="#1D4ED8" stroke-width="1.5" />
            <polygon points="36,0 44,-9 44,23 36,32" fill="#1D4ED8" stroke="#172554" stroke-width="1.5" />
            <text x="25" y="23" font-family="'Inter', sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" text-anchor="middle">I</text>
          </g>

          <!-- 3D Heart: ❤️ with Animated Pulse & Specular Highlights -->
          <g transform="translate(168, 276)">
            <g class="vq-heart-pulse">
              <!-- 3D Top Bevel -->
              <polygon points="26,10 42,0 58,10 42,30" fill="#FCA5A5" stroke="#991B1B" stroke-width="1.5" />
              <!-- Front Heart Body -->
              <path d="M 16,16 C 6,0 24,-10 42,6 C 60,-10 78,0 68,16 L 42,42 Z" fill="url(#k1-heart-grad)" stroke="#991B1B" stroke-width="2.5" />
              <!-- 3D Side Shadow Facet -->
              <path d="M 42,42 L 68,16 C 76,24 70,36 52,48 Z" fill="#7F1D1D" />
              <!-- Gloss Highlight -->
              <path d="M 24,12 C 28,6 36,6 40,12" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />
              <circle cx="28" cy="16" r="2" fill="#FFFFFF" opacity="0.75" />
            </g>
          </g>

          <!-- 3D Letter: E -->
          <g transform="translate(236, 286)">
            <polygon points="14,0 36,0 28,-9 6,-9" fill="#FEF08A" stroke="#CA8A04" stroke-width="1.5" />
            <rect x="14" y="0" width="22" height="32" rx="2" fill="#EAB308" stroke="#CA8A04" stroke-width="1.5" />
            <polygon points="36,0 44,-9 44,23 36,32" fill="#CA8A04" stroke="#854D0E" stroke-width="1.5" />
            <text x="25" y="23" font-family="'Inter', sans-serif" font-weight="900" font-size="20" fill="#78350F" text-anchor="middle">E</text>
          </g>

          <!-- 3D Letter: P -->
          <g transform="translate(284, 286)">
            <polygon points="14,0 36,0 28,-9 6,-9" fill="#86EFAC" stroke="#15803D" stroke-width="1.5" />
            <rect x="14" y="0" width="22" height="32" rx="2" fill="#16A34A" stroke="#15803D" stroke-width="1.5" />
            <polygon points="36,0 44,-9 44,23 36,32" fill="#15803D" stroke="#052E16" stroke-width="1.5" />
            <text x="25" y="23" font-family="'Inter', sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" text-anchor="middle">P</text>
          </g>

          <!-- 3D Letter: C -->
          <g transform="translate(332, 286)">
            <polygon points="14,0 36,0 28,-9 6,-9" fill="#FDBA74" stroke="#C2410C" stroke-width="1.5" />
            <rect x="14" y="0" width="22" height="32" rx="2" fill="#EA580C" stroke="#C2410C" stroke-width="1.5" />
            <polygon points="36,0 44,-9 44,23 36,32" fill="#C2410C" stroke="#7C2D12" stroke-width="1.5" />
            <text x="25" y="23" font-family="'Inter', sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" text-anchor="middle">C</text>
          </g>

          <!-- 3D Letter: E -->
          <g transform="translate(380, 286)">
            <polygon points="14,0 36,0 28,-9 6,-9" fill="#7DD3FC" stroke="#0369A1" stroke-width="1.5" />
            <rect x="14" y="0" width="22" height="32" rx="2" fill="#0284C7" stroke="#0369A1" stroke-width="1.5" />
            <polygon points="36,0 44,-9 44,23 36,32" fill="#0369A1" stroke="#082F49" stroke-width="1.5" />
            <text x="25" y="23" font-family="'Inter', sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" text-anchor="middle">E</text>
          </g>

          <!-- 3D Letter: S -->
          <g transform="translate(428, 286)">
            <polygon points="14,0 36,0 28,-9 6,-9" fill="#F472B6" stroke="#BE185D" stroke-width="1.5" />
            <rect x="14" y="0" width="22" height="32" rx="2" fill="#DB2777" stroke="#BE185D" stroke-width="1.5" />
            <polygon points="36,0 44,-9 44,23 36,32" fill="#BE185D" stroke="#701A75" stroke-width="1.5" />
            <text x="25" y="23" font-family="'Inter', sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" text-anchor="middle">S</text>
          </g>

          <!-- ======================================================== -->
          <!-- ENHANCED GRAND ARCHITECTURAL ENTRANCE MONUMENT "WELCOME" -->
          <!-- ======================================================== -->
          <g transform="translate(0, 5)">
            <!-- Monument Base Ground Shadow -->
            <ellipse cx="300" cy="396" rx="180" ry="12" fill="#0F172A" opacity="0.35" />

            <!-- Tiered Stone Plinth (Marble/Granite Base) -->
            <polygon points="125,392 475,392 460,382 140,382" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.8" />
            <polygon points="135,382 465,382 455,348 145,348" fill="#0F172A" opacity="0.4" />

            <!-- Main Grand Marquee Board (DepEd Forest Green & Embossed Gold) -->
            <rect x="140" y="346" width="320" height="46" rx="8" fill="url(#k1-gold)" stroke="#B45309" stroke-width="2.2" />
            <rect x="144" y="350" width="312" height="38" rx="6" fill="url(#k1-welcome-bg)" stroke="#FDE047" stroke-width="1.8" />
            <rect x="147" y="353" width="306" height="32" rx="4" fill="none" stroke="#FBBF24" stroke-width="0.8" opacity="0.65" />

            <!-- Corner Brass Rosettes / Studs -->
            <circle cx="150" cy="356" r="2.5" fill="#FEF08A" stroke="#78350F" stroke-width="0.8" />
            <circle cx="450" cy="356" r="2.5" fill="#FEF08A" stroke="#78350F" stroke-width="0.8" />
            <circle cx="150" cy="382" r="2.5" fill="#FEF08A" stroke="#78350F" stroke-width="0.8" />
            <circle cx="450" cy="382" r="2.5" fill="#FEF08A" stroke="#78350F" stroke-width="0.8" />

            <!-- Top Header Ribbon: MABUHAY -->
            <rect x="235" y="347" width="130" height="10" rx="3" fill="#DC2626" stroke="#FDE047" stroke-width="1" />
            <text x="300" y="354.5" font-family="'Inter', sans-serif" font-weight="900" font-size="6.5" fill="#FEF08A" text-anchor="middle" letter-spacing="2">★ MABUHAY ★</text>

            <!-- Main 3D Embossed Golden "WELCOME" Letters -->
            <text x="300" y="375" font-family="'Inter', sans-serif" font-weight="900" font-size="18" fill="#451A03" text-anchor="middle" letter-spacing="6" opacity="0.6">WELCOME</text>
            <text x="300" y="374" font-family="'Inter', sans-serif" font-weight="900" font-size="18" fill="url(#k1-welcome-gold)" text-anchor="middle" letter-spacing="6">WELCOME</text>

            <!-- Bottom Subtitle Ribbon -->
            <text x="300" y="384.5" font-family="'Inter', sans-serif" font-weight="800" font-size="5.5" fill="#A7F3D0" text-anchor="middle" letter-spacing="0.8">EAST PROSPERIDAD CENTRAL ELEMENTARY SCHOOL</text>

            <!-- Flanking Classical Planter Urns with Bougainvillea -->
            <!-- Left Urn (x: 122) -->
            <ellipse cx="124" cy="382" rx="10" ry="3" fill="#0F172A" opacity="0.3" />
            <path d="M 116,380 L 132,380 L 128,368 C 132,364 132,360 124,360 C 116,360 116,364 120,368 Z" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.2" />
            <circle cx="124" cy="358" r="7" fill="#15803D" />
            <circle cx="120" cy="356" r="3" fill="#EC4899" />
            <circle cx="128" cy="357" r="3" fill="#EF4444" />
            <circle cx="124" cy="354" r="3" fill="#F59E0B" />

            <!-- Right Urn (x: 476) -->
            <ellipse cx="476" cy="382" rx="10" ry="3" fill="#0F172A" opacity="0.3" />
            <path d="M 468,380 L 484,380 L 480,368 C 484,364 484,360 476,360 C 468,360 468,364 472,368 Z" fill="url(#k1-stone)" stroke="#94A3B8" stroke-width="1.2" />
            <circle cx="476" cy="358" r="7" fill="#15803D" />
            <circle cx="472" cy="356" r="3" fill="#EF4444" />
            <circle cx="480" cy="357" r="3" fill="#EC4899" />
            <circle cx="476" cy="354" r="3" fill="#F59E0B" />
          </g>
        </svg>
        </div>
      `;
    } else if (kingdom === 2) {
      // === KINGDOM 2: BAYAN NG PROSPERIDAD (2-STOREY SPANISH-COLONIAL MUNICIPAL HALL) ===
      return `
        <div class="vq-landmark-container-inner">
        <svg class="vq-landmark-svg k2-svg" viewBox="0 0 620 440" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="k2-rf-tile" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#EA580C" />
              <stop offset="35%" stop-color="#C2410C" />
              <stop offset="70%" stop-color="#9A3412" />
              <stop offset="100%" stop-color="#7C2D12" />
            </linearGradient>
            <linearGradient id="k2-rf-ridge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#FDBA74" />
              <stop offset="50%" stop-color="#EA580C" />
              <stop offset="100%" stop-color="#9A3412" />
            </linearGradient>
            <linearGradient id="k2-wall-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFDF5" />
              <stop offset="45%" stop-color="#FEF3C7" />
              <stop offset="85%" stop-color="#FDE68A" />
              <stop offset="100%" stop-color="#F59E0B" />
            </linearGradient>
            <linearGradient id="k2-wall-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#D97706" />
              <stop offset="100%" stop-color="#92400E" />
            </linearGradient>
            <linearGradient id="k2-arch-recess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#451A03" />
              <stop offset="50%" stop-color="#271002" />
              <stop offset="100%" stop-color="#180A01" />
            </linearGradient>
            <linearGradient id="k2-col-stone" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="40%" stop-color="#F8FAFC" />
              <stop offset="80%" stop-color="#E2E8F0" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </linearGradient>
            <linearGradient id="k2-stone-steps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F8FAFC" />
              <stop offset="60%" stop-color="#E2E8F0" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </linearGradient>
            <linearGradient id="k2-door-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#78350F" />
              <stop offset="50%" stop-color="#5A280B" />
              <stop offset="100%" stop-color="#361504" />
            </linearGradient>
            <linearGradient id="k2-win-tint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#E0F2FE" />
              <stop offset="35%" stop-color="#7DD3FC" />
              <stop offset="80%" stop-color="#0284C7" />
              <stop offset="100%" stop-color="#0369A1" />
            </linearGradient>
            <linearGradient id="k2-shutter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#16A34A" />
              <stop offset="60%" stop-color="#15803D" />
              <stop offset="100%" stop-color="#14532D" />
            </linearGradient>
            <linearGradient id="k2-gold-seal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FEF08A" />
              <stop offset="45%" stop-color="#FBBF24" />
              <stop offset="100%" stop-color="#D97706" />
            </linearGradient>
            <linearGradient id="k2-fountain-basin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F1F5F9" />
              <stop offset="50%" stop-color="#CBD5E1" />
              <stop offset="100%" stop-color="#94A3B8" />
            </linearGradient>
            <linearGradient id="k2-water-shimmer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#BAE6FD" />
              <stop offset="50%" stop-color="#38BDF8" />
              <stop offset="100%" stop-color="#0284C7" />
            </linearGradient>
            <linearGradient id="k2-van-white" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </linearGradient>
          </defs>

          <!-- Plaza Lawn Terraces & Cobblestone Esplanade -->
          <polygon points="60,412 560,412 480,165 140,165" fill="#4ADE80" opacity="0.4" />
          <polygon points="80,406 540,406 470,170 150,170" fill="#15803D" opacity="0.25" />
          <polygon points="140,404 480,404 405,236 215,236" fill="#D4A570" opacity="0.9" stroke="#5E381A" stroke-width="2" />
          
          <!-- Ground Shadow under building -->
          <ellipse cx="310" cy="264" rx="265" ry="26" fill="#0F172A" opacity="0.38" />

          <!-- Left Plaza Grounds: Royal Palm, Flowering Shrub & MDRRMO Emergency Vehicle -->
          <path d="M 68,260 Q 60,220 76,170" fill="none" stroke="#78350F" stroke-width="8" stroke-linecap="round" />
          <path d="M 76,170 Q 42,160 26,180" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round" />
          <path d="M 76,170 Q 65,138 46,145" fill="none" stroke="#16A34A" stroke-width="5" stroke-linecap="round" />
          <path d="M 76,170 Q 90,135 106,148" fill="none" stroke="#22C55E" stroke-width="5" stroke-linecap="round" />
          <circle cx="72" cy="256" r="14" fill="#15803D" />
          <circle cx="86" cy="252" r="16" fill="#16A34A" />

          <!-- Parked 3D Municipal Service Patrol / Rescue Vehicle -->
          <g transform="translate(68, 256)">
            <ellipse cx="38" cy="44" rx="38" ry="9" fill="#0F172A" opacity="0.4" />
            <polygon points="24,10 72,0 72,30 24,40" fill="url(#k2-van-white)" stroke="#64748B" stroke-width="1.5" />
            <polygon points="4,20 24,10 24,40 4,46" fill="#F8FAFC" stroke="#64748B" stroke-width="1.5" />
            <polygon points="4,20 24,10 72,0 52,10" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
            <!-- Windshield & Side Windows -->
            <polygon points="7,24 21,17 21,29 7,33" fill="#38BDF8" stroke="#0284C7" stroke-width="1" />
            <polygon points="27,15 46,11 46,23 27,26" fill="#38BDF8" stroke="#0284C7" stroke-width="1" />
            <!-- Municipal Stripe & MDRRMO Decal -->
            <line x1="24" y1="30" x2="72" y2="20" stroke="#0284C7" stroke-width="3.5" />
            <rect x="2" y="42" width="16" height="5" fill="#334155" rx="1" />
            <!-- Emergency Rooftop Lightbar -->
            <polygon points="12,14 18,11 32,8 26,11" fill="#DC2626" stroke="#991B1B" stroke-width="1" />
            <ellipse cx="17" cy="46" rx="7" ry="9" fill="#0F172A" stroke="#475569" stroke-width="2" />
            <ellipse cx="60" cy="38" rx="7" ry="9" fill="#0F172A" stroke="#475569" stroke-width="2" />
            <circle cx="17" cy="46" r="3" fill="#94A3B8" />
            <circle cx="60" cy="38" r="3" fill="#94A3B8" />
          </g>

          <!-- Right Plaza Grounds: Victorian Double-Lantern Streetlamp & Topiary -->
          <g transform="translate(534, 220)">
            <ellipse cx="10" cy="82" rx="14" ry="5" fill="#0F172A" opacity="0.35" />
            <rect x="8" y="24" width="4" height="58" fill="#1E293B" />
            <line x1="-8" y1="28" x2="28" y2="28" stroke="#1E293B" stroke-width="3" stroke-linecap="round" />
            <!-- Left Lantern -->
            <path d="M -12,28 L -4,28 L -6,18 L -10,18 Z" fill="#1E293B" />
            <polygon points="-11,18 -5,18 -4,8 -12,8" fill="#FEF08A" stroke="#1E293B" stroke-width="1" />
            <polygon points="-13,8 -3,8 -8,2" fill="#1E293B" />
            <circle class="vq-lantern-glow" cx="-8" cy="14" r="16" fill="#FEF08A" opacity="0.45" />
            <!-- Right Lantern -->
            <path d="M 24,28 L 32,28 L 30,18 L 26,18 Z" fill="#1E293B" />
            <polygon points="25,18 31,18 32,8 24,8" fill="#FEF08A" stroke="#1E293B" stroke-width="1" />
            <polygon points="23,8 33,8 28,2" fill="#1E293B" />
            <circle class="vq-lantern-glow" cx="28" cy="14" r="16" fill="#FEF08A" opacity="0.45" />
          </g>

          <!-- ======================================================== -->
          <!-- TWO-STORY SPANISH-COLONIAL PHILIPPINE MUNICIPAL HALL -->
          <!-- ======================================================== -->

          <!-- ── STORY 1 (GROUND FLOOR): Left Wing (x: 96 to 215) ── -->
          <polygon points="96,168 215,168 215,250 96,250" fill="url(#k2-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="78,176 96,168 96,250 78,258" fill="url(#k2-wall-side)" stroke="#A16207" stroke-width="1.5" />
          <!-- Plinth Base / Wainscot -->
          <rect x="96" y="238" width="119" height="12" fill="#B45309" opacity="0.9" />
          <!-- Rusticated Corner Quoins -->
          <rect x="96" y="172" width="10" height="9" fill="#FDE68A" stroke="#CA8A04" stroke-width="0.8" />
          <rect x="96" y="193" width="10" height="9" fill="#FDE68A" stroke="#CA8A04" stroke-width="0.8" />
          <rect x="96" y="214" width="10" height="9" fill="#FDE68A" stroke="#CA8A04" stroke-width="0.8" />

          <!-- Left Wing Ground Arched Windows with Spanish Green Shutters -->
          <!-- Window 1 (x: 112) -->
          <path d="M 112,226 L 112,192 C 112,180 148,180 148,192 L 148,226 Z" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="130" y1="184" x2="130" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="112" y1="202" x2="148" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="112" y1="214" x2="148" y2="214" stroke="#334155" stroke-width="1.2" />
          <!-- Arched Keystones -->
          <polygon points="127,181 133,181 131,175 129,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <!-- Flanking Wooden Shutters (Ventanillas) -->
          <rect x="104" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />
          <rect x="149" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />

          <!-- Window 2 (x: 168) -->
          <path d="M 168,226 L 168,192 C 168,180 204,180 204,192 L 204,226 Z" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="186" y1="184" x2="186" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="168" y1="202" x2="204" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="168" y1="214" x2="204" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="183,181 189,181 187,175 185,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="160" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />
          <rect x="205" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />

          <!-- ── STORY 1 (GROUND FLOOR): Right Wing (x: 405 to 524) ── -->
          <polygon points="405,168 524,168 524,250 405,250" fill="url(#k2-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="524,168 542,176 542,258 524,250" fill="url(#k2-wall-side)" stroke="#A16207" stroke-width="1.5" />
          <rect x="405" y="238" width="119" height="12" fill="#B45309" opacity="0.9" />
          <!-- Right Quoins -->
          <rect x="514" y="172" width="10" height="9" fill="#FDE68A" stroke="#CA8A04" stroke-width="0.8" />
          <rect x="514" y="193" width="10" height="9" fill="#FDE68A" stroke="#CA8A04" stroke-width="0.8" />
          <rect x="514" y="214" width="10" height="9" fill="#FDE68A" stroke="#CA8A04" stroke-width="0.8" />

          <!-- Right Wing Ground Windows -->
          <!-- Window 3 (x: 416) -->
          <path d="M 416,226 L 416,192 C 416,180 452,180 452,192 L 452,226 Z" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="434" y1="184" x2="434" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="416" y1="202" x2="452" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="416" y1="214" x2="452" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="431,181 437,181 435,175 433,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="408" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />
          <rect x="453" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />

          <!-- Window 4 (x: 472) -->
          <path d="M 472,226 L 472,192 C 472,180 508,180 508,192 L 508,226 Z" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="490" y1="184" x2="490" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="472" y1="202" x2="508" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="472" y1="214" x2="508" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="487,181 493,181 491,175 489,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="464" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />
          <rect x="509" y="186" width="7" height="38" rx="1" fill="url(#k2-shutter)" stroke="#14532D" stroke-width="0.8" />

          <!-- ── STORY 1 (GROUND FLOOR): Central Classical Triple-Arched Arcade ── -->
          <polygon points="215,168 405,168 405,250 215,250" fill="url(#k2-arch-recess)" stroke="#CA8A04" stroke-width="2" />
          <polygon points="200,176 215,168 215,250 200,258" fill="url(#k2-wall-side)" stroke="#A16207" />
          <polygon points="405,168 420,176 420,258 405,250" fill="url(#k2-wall-side)" stroke="#A16207" />

          <!-- Ground Floor Arched Arcade Openings -->
          <!-- Left Arch (x: 220 to 270) -->
          <path d="M 224,250 L 224,198 C 224,184 270,184 270,198 L 270,250 Z" fill="none" stroke="url(#k2-col-stone)" stroke-width="8" />
          <polygon points="245,182 251,182 249,176 247,176" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          
          <!-- Right Arch (x: 350 to 396) -->
          <path d="M 350,250 L 350,198 C 350,184 396,184 396,198 L 396,250 Z" fill="none" stroke="url(#k2-col-stone)" stroke-width="8" />
          <polygon points="371,182 377,182 375,176 373,176" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Central Grand Arch & Mahogany Double Portal -->
          <path d="M 280,250 L 280,188 C 280,172 340,172 340,188 L 340,250 Z" fill="none" stroke="url(#k2-col-stone)" stroke-width="10" />
          <polygon points="307,170 313,170 311,163 309,163" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />

          <!-- Arched Fanlight Transom -->
          <path d="M 285,188 C 285,176 335,176 335,188 Z" fill="url(#k2-win-tint)" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="310" y1="178" x2="310" y2="188" stroke="#FFFFFF" stroke-width="1.2" />
          <line x1="298" y1="181" x2="310" y2="188" stroke="#FFFFFF" stroke-width="1.2" />
          <line x1="322" y1="181" x2="310" y2="188" stroke="#FFFFFF" stroke-width="1.2" />
          <text x="310" y="186.5" font-family="'Inter', sans-serif" font-weight="900" font-size="4.2" fill="#FEF08A" text-anchor="middle" letter-spacing="0.5">TANGGAPAN NG MAYOR</text>

          <!-- Left Carved Mahogany Door -->
          <rect x="286" y="189" width="23" height="61" fill="url(#k2-door-wood)" stroke="#451A03" stroke-width="1.5" />
          <rect x="289" y="193" width="17" height="14" fill="#451A03" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="289" y="211" width="17" height="17" fill="#451A03" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="289" y="232" width="17" height="14" fill="#451A03" stroke="#B45309" stroke-width="1" rx="1" />
          <circle cx="304" cy="221" r="2.2" fill="#FDE047" stroke="#78350F" stroke-width="0.8" />

          <!-- Right Carved Mahogany Door -->
          <rect x="311" y="189" width="23" height="61" fill="url(#k2-door-wood)" stroke="#451A03" stroke-width="1.5" />
          <rect x="314" y="193" width="17" height="14" fill="#451A03" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="314" y="211" width="17" height="17" fill="#451A03" stroke="#B45309" stroke-width="1" rx="1" />
          <rect x="314" y="232" width="17" height="14" fill="#451A03" stroke="#B45309" stroke-width="1" rx="1" />
          <circle cx="316" cy="221" r="2.2" fill="#FDE047" stroke="#78350F" stroke-width="0.8" />

          <!-- Cascading Stone Stairs (4 Tiers) -->
          <polygon points="262,250 358,250 366,258 254,258" fill="url(#k2-stone-steps)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="252,258 368,258 378,266 242,266" fill="url(#k2-stone-steps)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="240,266 380,266 392,274 228,274" fill="#CBD5E1" stroke="#64748B" stroke-width="1.5" />
          <polygon points="226,274 394,274 406,282 214,282" fill="#94A3B8" stroke="#64748B" stroke-width="1.5" />

          <!-- ── INTERMEDIATE FLOOR SLAB & BALUSTRADE VERANDA ── -->
          <polygon points="76,172 544,172 544,162 76,162" fill="url(#k2-stone-steps)" stroke="#94A3B8" stroke-width="1.5" />
          
          <!-- Balustrade Railings Along Wings -->
          <!-- Left Wing Railing -->
          <rect x="94" y="152" width="121" height="3" fill="#D97706" stroke="#B45309" stroke-width="0.8" />
          <rect x="98" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="114" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="130" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="146" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="162" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="178" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="194" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="210" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />

          <!-- Right Wing Railing -->
          <rect x="405" y="152" width="121" height="3" fill="#D97706" stroke="#B45309" stroke-width="0.8" />
          <rect x="410" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="426" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="442" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="458" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="474" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="490" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="506" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="520" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />

          <!-- Cantilevered Mayor's Executive Balcony (x: 215 to 405) -->
          <polygon points="210,166 410,166 418,174 202,174" fill="url(#k2-stone-steps)" stroke="#94A3B8" stroke-width="1.5" />
          <rect x="204" y="150" width="212" height="4" fill="#D97706" stroke="#B45309" stroke-width="1" />
          <!-- Turned Marble Balusters -->
          <rect x="212" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="228" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="244" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="260" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="276" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="292" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="324" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="340" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="356" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="372" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="388" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="404" y="154" width="4" height="11" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />

          <!-- Balcony Planters with Colorful Blooms -->
          <rect x="236" y="158" width="34" height="6" rx="2" fill="#78350F" stroke="#451A03" stroke-width="0.8" />
          <circle cx="242" cy="160" r="2.8" fill="#EF4444" />
          <circle cx="253" cy="160" r="2.8" fill="#F59E0B" />
          <circle cx="264" cy="160" r="2.8" fill="#EC4899" />
          <rect x="350" y="158" width="34" height="6" rx="2" fill="#78350F" stroke="#451A03" stroke-width="0.8" />
          <circle cx="356" cy="160" r="2.8" fill="#EC4899" />
          <circle cx="367" cy="160" r="2.8" fill="#EF4444" />
          <circle cx="378" cy="160" r="2.8" fill="#F59E0B" />

          <!-- ── STORY 2 (SECOND FLOOR): Left Wing (x: 96 to 215) ── -->
          <polygon points="96,88 215,88 215,164 96,164" fill="url(#k2-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="78,96 96,88 96,164 78,172" fill="url(#k2-wall-side)" stroke="#A16207" stroke-width="1.5" />
          <!-- Upper Left Windows with Pediment Headers -->
          <polygon points="112,101 132,92 152,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="114" y="103" width="36" height="44" rx="2" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="132" y1="103" x2="132" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="114" y1="117" x2="150" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="114" y1="131" x2="150" y2="131" stroke="#334155" stroke-width="1.2" />
          <!-- Wrought Iron Window Guard (Rejas) -->
          <rect x="113" y="137" width="38" height="8" fill="none" stroke="#0F172A" stroke-width="1" />
          <line x1="122" y1="137" x2="122" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="132" y1="137" x2="132" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="142" y1="137" x2="142" y2="145" stroke="#0F172A" stroke-width="1" />

          <polygon points="166,101 186,92 206,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="168" y="103" width="36" height="44" rx="2" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="186" y1="103" x2="186" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="168" y1="117" x2="204" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="168" y1="131" x2="204" y2="131" stroke="#334155" stroke-width="1.2" />
          <rect x="167" y="137" width="38" height="8" fill="none" stroke="#0F172A" stroke-width="1" />
          <line x1="176" y1="137" x2="176" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="186" y1="137" x2="186" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="196" y1="137" x2="196" y2="145" stroke="#0F172A" stroke-width="1" />

          <!-- ── STORY 2 (SECOND FLOOR): Right Wing (x: 405 to 524) ── -->
          <polygon points="405,88 524,88 524,164 405,164" fill="url(#k2-wall-front)" stroke="#CA8A04" stroke-width="1.5" />
          <polygon points="524,88 542,96 542,172 524,164" fill="url(#k2-wall-side)" stroke="#A16207" stroke-width="1.5" />
          <!-- Upper Right Windows -->
          <polygon points="414,101 434,92 454,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="416" y="103" width="36" height="44" rx="2" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="434" y1="103" x2="434" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="416" y1="117" x2="452" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="416" y1="131" x2="452" y2="131" stroke="#334155" stroke-width="1.2" />
          <rect x="415" y="137" width="38" height="8" fill="none" stroke="#0F172A" stroke-width="1" />
          <line x1="424" y1="137" x2="424" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="434" y1="137" x2="434" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="444" y1="137" x2="444" y2="145" stroke="#0F172A" stroke-width="1" />

          <polygon points="470,101 490,92 510,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="472" y="103" width="36" height="44" rx="2" fill="url(#k2-win-tint)" stroke="#1E293B" stroke-width="2" />
          <line x1="490" y1="103" x2="490" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="472" y1="117" x2="508" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="472" y1="131" x2="508" y2="131" stroke="#334155" stroke-width="1.2" />
          <rect x="471" y="137" width="38" height="8" fill="none" stroke="#0F172A" stroke-width="1" />
          <line x1="480" y1="137" x2="480" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="490" y1="137" x2="490" y2="145" stroke="#0F172A" stroke-width="1" />
          <line x1="500" y1="137" x2="500" y2="145" stroke="#0F172A" stroke-width="1" />

          <!-- ── STORY 2 (SECOND FLOOR): Central Executive Pavilion ── -->
          <polygon points="215,88 405,88 405,164 215,164" fill="url(#k2-wall-front)" stroke="#CA8A04" stroke-width="2" />
          <polygon points="200,96 215,88 215,164 200,172" fill="url(#k2-wall-side)" stroke="#A16207" />
          <polygon points="405,88 420,96 420,172 405,164" fill="url(#k2-wall-side)" stroke="#A16207" />

          <!-- Upper Classical Columns -->
          <rect x="228" y="88" width="14" height="74" fill="url(#k2-col-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="258" y="88" width="14" height="74" fill="url(#k2-col-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="348" y="88" width="14" height="74" fill="url(#k2-col-stone)" stroke="#CBD5E1" stroke-width="1" />
          <rect x="378" y="88" width="14" height="74" fill="url(#k2-col-stone)" stroke="#CBD5E1" stroke-width="1" />

          <!-- Mayor's Balcony French Double Doors -->
          <path d="M 284,162 L 284,106 C 284,94 336,94 336,106 L 336,162 Z" fill="#181512" stroke="#78350F" stroke-width="2.5" />
          <path d="M 286,106 C 286,96 334,96 334,106 Z" fill="url(#k2-win-tint)" stroke="#FFFFFF" stroke-width="1.5" />
          <rect x="287" y="108" width="22" height="52" fill="url(#k2-win-tint)" stroke="#FFFFFF" stroke-width="1.5" />
          <rect x="311" y="108" width="22" height="52" fill="url(#k2-win-tint)" stroke="#FFFFFF" stroke-width="1.5" />

          <!-- ── ROOF STRUCTURE, CLOCK TOWER & PEDIMENT ── -->
          <!-- Left Hip Roof (Terracotta Spanish Barrel Tile) -->
          <polygon points="68,94 104,56 215,64 225,94" fill="url(#k2-rf-tile)" stroke="#78350F" stroke-width="2" />
          <!-- Roof tile ridges -->
          <line x1="86" y1="75" x2="160" y2="78" stroke="#FDBA74" stroke-width="1.5" opacity="0.6" />
          <line x1="78" y1="84" x2="185" y2="86" stroke="#FDBA74" stroke-width="1.5" opacity="0.6" />

          <!-- Right Hip Roof -->
          <polygon points="395,94 405,64 516,56 552,94" fill="url(#k2-rf-tile)" stroke="#78350F" stroke-width="2" />
          <line x1="460" y1="78" x2="534" y2="75" stroke="#FDBA74" stroke-width="1.5" opacity="0.6" />
          <line x1="435" y1="86" x2="542" y2="84" stroke="#FDBA74" stroke-width="1.5" opacity="0.6" />

          <!-- Central Grand Civic Pediment -->
          <polygon points="180,82 310,16 440,82" fill="url(#k2-rf-tile)" stroke="#78350F" stroke-width="2.5" />
          <polygon points="196,76 310,22 424,76" fill="url(#k2-wall-front)" stroke="#CA8A04" stroke-width="2" />
          <polygon points="190,76 310,18 430,76 422,80 310,26 198,80" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Official Municipal Seal of Prosperidad (Vector Heraldic Medallion) -->
          <g transform="translate(310, 48)">
            <!-- Outer Gold Medal -->
            <circle cx="0" cy="0" r="16" fill="url(#k2-gold-seal)" stroke="#78350F" stroke-width="1.5" />
            <circle cx="0" cy="0" r="13" fill="#1E3A8A" stroke="#FDE047" stroke-width="1" />
            <!-- Sunburst Rays -->
            <path d="M 0,-10 L 0,10 M -10,0 L 10,0 M -7,-7 L 7,7 M -7,7 L 7,-7" stroke="#FDE047" stroke-width="1.2" opacity="0.75" />
            <!-- Municipal Torch & Golden Rice Stalks -->
            <circle cx="0" cy="0" r="5" fill="#F59E0B" stroke="#FEF08A" stroke-width="0.8" />
            <path d="M 0,-4 L 0,4" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" />
            <text x="0" y="8.5" font-family="'Inter', sans-serif" font-weight="900" font-size="3.5" fill="#FEF08A" text-anchor="middle" letter-spacing="0.5">PROSPERIDAD</text>
          </g>

          <!-- Municipal Inscription under Seal -->
          <text x="310" y="69" font-family="'Inter', sans-serif" font-weight="800" font-size="5" text-anchor="middle" fill="#1E3A8A" letter-spacing="0.8">LALAWIGAN NG AGUSAN DEL SUR</text>

          <!-- Horizontal Architrave & Official Municipal Signboard (No Overlapping!) -->
          <rect x="188" y="75" width="244" height="23" rx="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="192" y="77" width="236" height="19" rx="2" fill="#1E293B" stroke="#F59E0B" stroke-width="1.5" />
          <rect x="194" y="79" width="232" height="15" rx="1.5" fill="none" stroke="#FDE047" stroke-width="0.8" opacity="0.6" />
          <text x="310" y="87.5" font-family="'Inter', sans-serif" font-weight="900" font-size="7.5" text-anchor="middle" fill="#FEF08A" letter-spacing="0.6">PAMAHALAANG BAYAN NG PROSPERIDAD</text>
          <text x="310" y="94" font-family="'Inter', sans-serif" font-weight="800" font-size="5" text-anchor="middle" fill="#6EE7B7" letter-spacing="1">MUNICIPAL GOVERNMENT CENTER</text>

          <!-- Stately Spanish Belfry / Clock Tower with Bell -->
          <rect x="294" y="2" width="32" height="20" fill="#FEF3C7" stroke="#CA8A04" stroke-width="2" rx="3" />
          <polygon points="286,2 310,-14 334,2" fill="url(#k2-rf-tile)" stroke="#78350F" stroke-width="2" />
          <circle cx="310" cy="-14" r="3" fill="#FBBF24" stroke="#B45309" stroke-width="1" />
          <!-- Arched Bell Opening & Bronze Bell -->
          <path d="M 304,18 L 304,10 C 304,7 316,7 316,10 L 316,18 Z" fill="#451A03" />
          <path d="M 307,16 L 313,16 L 311,11 L 309,11 Z" fill="#FBBF24" stroke="#78350F" stroke-width="0.8" />
          <!-- Clock Face (8:00 AM) -->
          <circle cx="310" cy="5" r="5" fill="#FFFFFF" stroke="#78350F" stroke-width="1" />
          <line x1="310" y1="5" x2="310" y2="2" stroke="#1E293B" stroke-width="0.8" stroke-linecap="round" />
          <line x1="310" y1="5" x2="308" y2="5" stroke="#1E293B" stroke-width="0.8" stroke-linecap="round" />

          <!-- Rooftop Flagpole with Waving Philippine Flag (Stationary Anchor Group!) -->
          <g transform="translate(310, -14)">
            <line x1="0" y1="0" x2="0" y2="-28" stroke="#E2E8F0" stroke-width="2.5" />
            <circle cx="0" cy="-29" r="2.5" fill="#FBBF24" stroke="#B45309" stroke-width="0.8" />
            <g transform="translate(1, -28)">
              <g class="vq-flag-wave">
                <rect x="0" y="0" width="30" height="9" fill="#0038A8" />
                <rect x="0" y="9" width="30" height="9" fill="#CE1126" />
                <polygon points="0,0 15,9 0,18" fill="#FFFFFF" />
                <circle cx="5.5" cy="9" r="2.2" fill="#FCD116" />
                <circle cx="2.5" cy="3.5" r="0.8" fill="#FCD116" />
                <circle cx="2.5" cy="14.5" r="0.8" fill="#FCD116" />
                <circle cx="11" cy="9" r="0.8" fill="#FCD116" />
              </g>
            </g>
          </g>

          <!-- ======================================================== -->
          <!-- CENTRAL CIVIC PLAZA TIERED WATER FOUNTAIN -->
          <!-- ======================================================== -->
          <g transform="translate(310, 310)">
            <!-- Outer Fountain Plinth & Water Surface -->
            <ellipse cx="0" cy="8" rx="44" ry="14" fill="#0F172A" opacity="0.35" />
            <ellipse cx="0" cy="6" rx="42" ry="12" fill="url(#k2-fountain-basin)" stroke="#64748B" stroke-width="1.5" />
            <ellipse cx="0" cy="5" rx="38" ry="10" fill="url(#k2-water-shimmer)" stroke="#38BDF8" stroke-width="1" />
            
            <!-- Tier 2 Basin Pedestal & Bowl -->
            <rect x="-4" y="-3" width="8" height="9" fill="#CBD5E1" stroke="#64748B" stroke-width="1" />
            <ellipse cx="0" cy="-3" rx="22" ry="7" fill="url(#k2-fountain-basin)" stroke="#64748B" stroke-width="1.2" />
            <ellipse cx="0" cy="-4" rx="20" ry="6" fill="url(#k2-water-shimmer)" stroke="#38BDF8" stroke-width="0.8" />

            <!-- Tier 3 Upper Basin -->
            <rect x="-3" y="-10" width="6" height="8" fill="#CBD5E1" stroke="#64748B" stroke-width="1" />
            <ellipse cx="0" cy="-10" rx="12" ry="4" fill="url(#k2-fountain-basin)" stroke="#64748B" stroke-width="1" />
            <ellipse cx="0" cy="-11" rx="10" ry="3" fill="url(#k2-water-shimmer)" />

            <!-- Splashing Water Jet Spout -->
            <path d="M 0,-11 Q -3,-22 0,-24 Q 3,-22 0,-11" fill="#E0F2FE" stroke="#38BDF8" stroke-width="1" opacity="0.85" />
            <!-- Water Droplets / Spray -->
            <circle cx="-4" cy="-18" r="1.2" fill="#BAE6FD" />
            <circle cx="4" cy="-18" r="1.2" fill="#BAE6FD" />
            <circle cx="-2" cy="-21" r="1" fill="#BAE6FD" />
            <circle cx="2" cy="-21" r="1" fill="#BAE6FD" />
            <!-- Water Cascades -->
            <path d="M -11,-10 Q -15,-3 -13,4" fill="none" stroke="#BAE6FD" stroke-width="1" opacity="0.75" />
            <path d="M 11,-10 Q 15,-3 13,4" fill="none" stroke="#BAE6FD" stroke-width="1" opacity="0.75" />
          </g>
        </svg>
        </div>
      `;
    } else {
      // === KINGDOM 3: PROVINCIAL CAPITOL (2-STOREY COLOSSAL NEOCLASSICAL CAPITOL) ===
      return `
        <div class="vq-landmark-container-inner">
        <svg class="vq-landmark-svg k3-svg" viewBox="0 0 640 440" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="k3-clay-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#DC2626" />
              <stop offset="60%" stop-color="#B91C1C" />
              <stop offset="100%" stop-color="#991B1B" />
            </linearGradient>
            <linearGradient id="k3-marble-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="45%" stop-color="#F8FAFC" />
              <stop offset="85%" stop-color="#F1F5F9" />
              <stop offset="100%" stop-color="#E2E8F0" />
            </linearGradient>
            <linearGradient id="k3-wall-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#CBD5E1" />
              <stop offset="100%" stop-color="#94A3B8" />
            </linearGradient>
            <linearGradient id="k3-marble-col" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="35%" stop-color="#F8FAFC" />
              <stop offset="70%" stop-color="#E2E8F0" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </linearGradient>
            <linearGradient id="k3-stone-steps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="50%" stop-color="#F1F5F9" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </linearGradient>
            <linearGradient id="k3-portal-recess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1E293B" />
              <stop offset="50%" stop-color="#0F172A" />
              <stop offset="100%" stop-color="#020617" />
            </linearGradient>
            <linearGradient id="k3-bronze-door" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#92400E" />
              <stop offset="40%" stop-color="#78350F" />
              <stop offset="100%" stop-color="#451A03" />
            </linearGradient>
            <linearGradient id="k3-gold-badge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FEF08A" />
              <stop offset="45%" stop-color="#FBBF24" />
              <stop offset="100%" stop-color="#D97706" />
            </linearGradient>
            <linearGradient id="k3-win-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#E0F2FE" />
              <stop offset="40%" stop-color="#7DD3FC" />
              <stop offset="85%" stop-color="#0284C7" />
              <stop offset="100%" stop-color="#0369A1" />
            </linearGradient>
            <linearGradient id="k3-dome-copper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#6EE7B7" />
              <stop offset="25%" stop-color="#34D399" />
              <stop offset="60%" stop-color="#059669" />
              <stop offset="100%" stop-color="#047857" />
            </linearGradient>
            <linearGradient id="k3-fountain-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#E0F2FE" />
              <stop offset="40%" stop-color="#38BDF8" />
              <stop offset="100%" stop-color="#0284C7" />
            </linearGradient>
            <linearGradient id="k3-granite-rim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F8FAFC" />
              <stop offset="50%" stop-color="#CBD5E1" />
              <stop offset="100%" stop-color="#64748B" />
            </linearGradient>
          </defs>

          <!-- Grand Paved Plaza Grounds & Green Terraces -->
          <polygon points="50,412 590,412 510,165 130,165" fill="#4ADE80" opacity="0.4" />
          <polygon points="70,406 570,406 500,170 140,170" fill="#15803D" opacity="0.25" />
          <polygon points="130,404 510,404 435,236 205,236" fill="#D4A570" opacity="0.9" stroke="#5E381A" stroke-width="2" />

          <!-- Ground Shadow under capitol -->
          <ellipse cx="320" cy="265" rx="275" ry="26" fill="#0F172A" opacity="0.38" />

          <!-- Left Plaza Grounds: Soaring Royal Palms & Official VIP SUV -->
          <path d="M 66,260 Q 56,220 72,168" fill="none" stroke="#64748B" stroke-width="8" stroke-linecap="round" />
          <path d="M 72,168 Q 38,158 22,178" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round" />
          <path d="M 72,168 Q 60,135 42,142" fill="none" stroke="#16A34A" stroke-width="5" stroke-linecap="round" />
          <path d="M 72,168 Q 86,132 102,145" fill="none" stroke="#22C55E" stroke-width="5" stroke-linecap="round" />
          <circle cx="68" cy="256" r="14" fill="#15803D" />

          <!-- Parked Black Official VIP SUV -->
          <g transform="translate(70, 256)">
            <ellipse cx="36" cy="44" rx="36" ry="9" fill="#0F172A" opacity="0.4" />
            <polygon points="22,10 68,2 68,30 22,38" fill="#1E293B" stroke="#0F172A" stroke-width="1.5" />
            <polygon points="4,18 22,10 22,38 4,44" fill="#0F172A" stroke="#020617" stroke-width="1.5" />
            <polygon points="4,18 22,10 68,2 50,10" fill="#334155" stroke="#1E293B" stroke-width="1" />
            <polygon points="7,22 19,16 19,28 7,32" fill="#38BDF8" opacity="0.8" />
            <polygon points="25,14 44,10 44,22 25,25" fill="#38BDF8" opacity="0.8" />
            <ellipse cx="16" cy="44" rx="6" ry="8" fill="#020617" stroke="#334155" stroke-width="1.5" />
            <ellipse cx="56" cy="37" rx="6" ry="8" fill="#020617" stroke="#334155" stroke-width="1.5" />
            <circle cx="16" cy="44" r="2.5" fill="#CBD5E1" />
            <circle cx="56" cy="37" r="2.5" fill="#CBD5E1" />
          </g>

          <!-- Right Plaza Grounds: Red Emergency Command Vehicle & Royal Palm -->
          <g transform="translate(504, 256)">
            <ellipse cx="36" cy="44" rx="36" ry="9" fill="#0F172A" opacity="0.4" />
            <polygon points="22,10 68,2 68,30 22,38" fill="#DC2626" stroke="#991B1B" stroke-width="1.5" />
            <polygon points="4,18 22,10 22,38 4,44" fill="#EF4444" stroke="#991B1B" stroke-width="1.5" />
            <polygon points="4,18 22,10 68,2 50,10" fill="#F87171" stroke="#DC2626" stroke-width="1" />
            <polygon points="7,22 19,16 19,28 7,32" fill="#7DD3FC" />
            <polygon points="25,14 44,10 44,22 25,25" fill="#7DD3FC" />
            <line x1="28" y1="8" x2="58" y2="4" stroke="#FEF08A" stroke-width="2.5" />
            <ellipse cx="16" cy="44" rx="6" ry="8" fill="#020617" stroke="#475569" stroke-width="1.5" />
            <ellipse cx="56" cy="37" rx="6" ry="8" fill="#020617" stroke="#475569" stroke-width="1.5" />
            <circle cx="16" cy="44" r="2.5" fill="#E2E8F0" />
            <circle cx="56" cy="37" r="2.5" fill="#E2E8F0" />
          </g>

          <!-- ======================================================== -->
          <!-- TWO-STORY COLOSSAL NEOCLASSICAL CAPITOL ARCHITECTURE -->
          <!-- ======================================================== -->

          <!-- ── STORY 1 (GROUND FLOOR): Left Wing (x: 94 to 220) ── -->
          <polygon points="94,168 220,168 220,250 94,250" fill="url(#k3-marble-wall)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="76,176 94,168 94,250 76,258" fill="url(#k3-wall-side)" stroke="#64748B" stroke-width="1.5" />
          <rect x="94" y="238" width="126" height="12" fill="#64748B" opacity="0.65" />
          <!-- Rustication Quoins -->
          <rect x="94" y="172" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="94" y="193" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="94" y="214" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />

          <!-- Left Wing Ground Arched Windows with Acanthus Keystones -->
          <!-- Window 1 (x: 114) -->
          <path d="M 114,226 L 114,192 C 114,180 150,180 150,192 L 150,226 Z" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="132" y1="184" x2="132" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="114" y1="202" x2="150" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="114" y1="214" x2="150" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="129,181 135,181 133,175 131,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Window 2 (x: 168) -->
          <path d="M 168,226 L 168,192 C 168,180 204,180 204,192 L 204,226 Z" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="186" y1="184" x2="186" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="168" y1="202" x2="204" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="168" y1="214" x2="204" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="183,181 189,181 187,175 185,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- ── STORY 1 (GROUND FLOOR): Right Wing (x: 420 to 546) ── -->
          <polygon points="420,168 546,168 546,250 420,250" fill="url(#k3-marble-wall)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="546,168 564,176 564,258 546,250" fill="url(#k3-wall-side)" stroke="#64748B" stroke-width="1.5" />
          <rect x="420" y="238" width="126" height="12" fill="#64748B" opacity="0.65" />
          <!-- Right Quoins -->
          <rect x="534" y="172" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="534" y="193" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />
          <rect x="534" y="214" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />

          <!-- Right Wing Ground Windows -->
          <!-- Window 3 (x: 436) -->
          <path d="M 436,226 L 436,192 C 436,180 472,180 472,192 L 472,226 Z" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="454" y1="184" x2="454" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="436" y1="202" x2="472" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="436" y1="214" x2="472" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="451,181 457,181 455,175 453,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Window 4 (x: 490) -->
          <path d="M 490,226 L 490,192 C 490,180 526,180 526,192 L 526,226 Z" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="508" y1="184" x2="508" y2="226" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="490" y1="202" x2="526" y2="202" stroke="#334155" stroke-width="1.2" />
          <line x1="490" y1="214" x2="526" y2="214" stroke="#334155" stroke-width="1.2" />
          <polygon points="505,181 511,181 509,175 507,175" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- ── STORY 1 (GROUND FLOOR): Central Portico Portal (x: 220 to 420) ── -->
          <polygon points="220,168 420,168 420,250 220,250" fill="url(#k3-portal-recess)" stroke="#94A3B8" stroke-width="2" />
          <polygon points="204,176 220,168 220,250 204,258" fill="url(#k3-wall-side)" stroke="#64748B" />
          <polygon points="420,168 436,176 436,258 420,250" fill="url(#k3-wall-side)" stroke="#64748B" />

          <!-- Grand Arched Capitol Double Portal -->
          <path d="M 290,250 L 290,180 C 290,166 350,166 350,180 L 350,250 Z" fill="none" stroke="url(#k3-marble-col)" stroke-width="6" />
          <path d="M 293,180 C 293,168 347,168 347,180 Z" fill="url(#k3-win-glass)" stroke="#FFFFFF" stroke-width="1.5" />
          
          <!-- Left Bronze Executive Door -->
          <rect x="294" y="182" width="25" height="68" fill="url(#k3-bronze-door)" stroke="#1E1B4B" stroke-width="1.5" />
          <rect x="297" y="186" width="19" height="16" fill="#451A03" stroke="#FDE047" stroke-width="1" rx="1" />
          <rect x="297" y="206" width="19" height="19" fill="#451A03" stroke="#FDE047" stroke-width="1" rx="1" />
          <rect x="297" y="229" width="19" height="17" fill="#451A03" stroke="#FDE047" stroke-width="1" rx="1" />
          <circle cx="314" cy="221" r="2.2" fill="#FDE047" stroke="#78350F" stroke-width="0.8" />
          
          <!-- Right Bronze Executive Door -->
          <rect x="321" y="182" width="25" height="68" fill="url(#k3-bronze-door)" stroke="#1E1B4B" stroke-width="1.5" />
          <rect x="324" y="186" width="19" height="16" fill="#451A03" stroke="#FDE047" stroke-width="1" rx="1" />
          <rect x="324" y="206" width="19" height="19" fill="#451A03" stroke="#FDE047" stroke-width="1" rx="1" />
          <rect x="324" y="229" width="19" height="17" fill="#451A03" stroke="#FDE047" stroke-width="1" rx="1" />
          <circle cx="326" cy="221" r="2.2" fill="#FDE047" stroke="#78350F" stroke-width="0.8" />

          <!-- Flanking Imperial Brass Carriage Lanterns -->
          <circle cx="282" cy="214" r="4.5" fill="#FBBF24" stroke="#78350F" stroke-width="1" />
          <circle class="vq-lantern-glow" cx="282" cy="214" r="9" fill="#FEF08A" opacity="0.45" />
          <circle cx="358" cy="214" r="4.5" fill="#FBBF24" stroke="#78350F" stroke-width="1" />
          <circle class="vq-lantern-glow" cx="358" cy="214" r="9" fill="#FEF08A" opacity="0.45" />

          <!-- Cascading Grand Imperial Marble Stairs (5 Tiers) -->
          <polygon points="270,250 370,250 378,258 262,258" fill="url(#k3-stone-steps)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="260,258 380,258 390,266 250,266" fill="url(#k3-stone-steps)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="248,266 392,266 404,274 236,274" fill="#CBD5E1" stroke="#64748B" stroke-width="1.5" />
          <polygon points="234,274 406,274 418,282 222,282" fill="#CBD5E1" stroke="#64748B" stroke-width="1.5" />
          <polygon points="220,282 420,282 432,290 208,290" fill="#94A3B8" stroke="#64748B" stroke-width="1.5" />

          <!-- ── STORY 2 (SECOND FLOOR): Wings (x: 94 to 220 & 420 to 546) ── -->
          <polygon points="94,88 220,88 220,164 94,164" fill="url(#k3-marble-wall)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="76,96 94,88 94,164 76,172" fill="url(#k3-wall-side)" stroke="#64748B" stroke-width="1.5" />

          <!-- Upper Left Windows with Classical Triangular Pediment Hoods -->
          <polygon points="112,101 132,92 152,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="114" y="103" width="36" height="44" rx="2" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="132" y1="103" x2="132" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="114" y1="117" x2="150" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="114" y1="131" x2="150" y2="131" stroke="#334155" stroke-width="1.2" />

          <polygon points="166,101 186,92 206,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="168" y="103" width="36" height="44" rx="2" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="186" y1="103" x2="186" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="168" y1="117" x2="204" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="168" y1="131" x2="204" y2="131" stroke="#334155" stroke-width="1.2" />

          <polygon points="420,88 546,88 546,164 420,164" fill="url(#k3-marble-wall)" stroke="#94A3B8" stroke-width="1.5" />
          <polygon points="546,88 564,96 564,172 546,164" fill="url(#k3-wall-side)" stroke="#64748B" stroke-width="1.5" />

          <polygon points="434,101 454,92 474,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="436" y="103" width="36" height="44" rx="2" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="454" y1="103" x2="454" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="436" y1="117" x2="472" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="436" y1="131" x2="472" y2="131" stroke="#334155" stroke-width="1.2" />

          <polygon points="488,101 508,92 528,101" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="490" y="103" width="36" height="44" rx="2" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="2" />
          <line x1="508" y1="103" x2="508" y2="147" stroke="#FFFFFF" stroke-width="1.5" />
          <line x1="490" y1="117" x2="526" y2="117" stroke="#334155" stroke-width="1.2" />
          <line x1="490" y1="131" x2="526" y2="131" stroke="#334155" stroke-width="1.2" />

          <!-- Intermediate Classical Balustrade Stringcourse on Wings -->
          <polygon points="76,168 220,168 220,160 76,160" fill="url(#k3-stone-steps)" stroke="#94A3B8" stroke-width="1.2" />
          <polygon points="420,168 564,168 564,160 420,160" fill="url(#k3-stone-steps)" stroke="#94A3B8" stroke-width="1.2" />

          <!-- ── CONTINUOUS ROOFLINE BALUSTRADE PARAPET WITH URNS ── -->
          <!-- Left Wing Parapet -->
          <rect x="88" y="80" width="134" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="94" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="110" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="126" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="142" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="158" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="174" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="190" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="206" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <!-- Corner Finial Urn -->
          <circle cx="90" cy="77" r="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />

          <!-- Right Wing Parapet -->
          <rect x="418" y="80" width="134" height="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="426" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="442" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="458" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="474" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="490" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="506" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="522" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="538" y="84" width="4" height="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <circle cx="550" cy="77" r="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.8" />

          <!-- ── CENTRAL COLOSSAL COLONNADE (Spanning 2 Full Storeys) ── -->
          <polygon points="215,88 425,88 425,164 215,164" fill="url(#k3-portal-recess)" opacity="0.9" />

          <!-- 6 Towering Colossal Fluted Marble Columns (Colossal Order) -->
          <!-- Col 1 -->
          <rect x="226" y="88" width="13" height="162" fill="url(#k3-marble-col)" stroke="#94A3B8" stroke-width="1.2" rx="1.5" />
          <rect x="223" y="84" width="19" height="6" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="223" y="246" width="19" height="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1" />
          <!-- Fluting lines -->
          <line x1="230" y1="90" x2="230" y2="246" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" />
          <line x1="235" y1="90" x2="235" y2="246" stroke="#94A3B8" stroke-width="0.8" opacity="0.5" />

          <!-- Col 2 -->
          <rect x="258" y="88" width="13" height="162" fill="url(#k3-marble-col)" stroke="#94A3B8" stroke-width="1.2" rx="1.5" />
          <rect x="255" y="84" width="19" height="6" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="255" y="246" width="19" height="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1" />
          <line x1="262" y1="90" x2="262" y2="246" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" />
          <line x1="267" y1="90" x2="267" y2="246" stroke="#94A3B8" stroke-width="0.8" opacity="0.5" />

          <!-- Col 3 -->
          <rect x="290" y="88" width="13" height="162" fill="url(#k3-marble-col)" stroke="#94A3B8" stroke-width="1.2" rx="1.5" />
          <rect x="287" y="84" width="19" height="6" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="287" y="246" width="19" height="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1" />
          <line x1="294" y1="90" x2="294" y2="246" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" />
          <line x1="299" y1="90" x2="299" y2="246" stroke="#94A3B8" stroke-width="0.8" opacity="0.5" />

          <!-- Col 4 -->
          <rect x="337" y="88" width="13" height="162" fill="url(#k3-marble-col)" stroke="#94A3B8" stroke-width="1.2" rx="1.5" />
          <rect x="334" y="84" width="19" height="6" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="334" y="246" width="19" height="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1" />
          <line x1="341" y1="90" x2="341" y2="246" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" />
          <line x1="346" y1="90" x2="346" y2="246" stroke="#94A3B8" stroke-width="0.8" opacity="0.5" />

          <!-- Col 5 -->
          <rect x="369" y="88" width="13" height="162" fill="url(#k3-marble-col)" stroke="#94A3B8" stroke-width="1.2" rx="1.5" />
          <rect x="366" y="84" width="19" height="6" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="366" y="246" width="19" height="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1" />
          <line x1="373" y1="90" x2="373" y2="246" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" />
          <line x1="378" y1="90" x2="378" y2="246" stroke="#94A3B8" stroke-width="0.8" opacity="0.5" />

          <!-- Col 6 -->
          <rect x="401" y="88" width="13" height="162" fill="url(#k3-marble-col)" stroke="#94A3B8" stroke-width="1.2" rx="1.5" />
          <rect x="398" y="84" width="19" height="6" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
          <rect x="398" y="246" width="19" height="6" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1" />
          <line x1="405" y1="90" x2="405" y2="246" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" />
          <line x1="410" y1="90" x2="410" y2="246" stroke="#94A3B8" stroke-width="0.8" opacity="0.5" />

          <!-- Second-Floor Ceremonial Balcony behind colonnade -->
          <rect x="238" y="152" width="164" height="3" fill="#DC2626" stroke="#991B1B" stroke-width="0.8" />
          <rect x="246" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="278" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="310" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="326" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="358" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />
          <rect x="390" y="155" width="4" height="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.6" />

          <!-- ── ROOF, GRAND DOME & MONUMENTAL PEDIMENT ── -->
          <!-- Terracotta Wing Roofs Behind Balustrade -->
          <polygon points="68,88 104,54 220,62 225,88" fill="url(#k3-clay-front)" stroke="#7F1D1D" stroke-width="1.5" />
          <polygon points="415,88 420,62 536,54 572,88" fill="url(#k3-clay-front)" stroke="#7F1D1D" stroke-width="1.5" />

          <!-- Central Grand Neoclassical Pediment -->
          <polygon points="180,82 320,16 460,82" fill="url(#k3-clay-front)" stroke="#7F1D1D" stroke-width="2.5" />
          <polygon points="196,76 320,22 444,76" fill="url(#k3-marble-wall)" stroke="#94A3B8" stroke-width="2" />
          <polygon points="190,76 320,18 450,76 442,80 320,26 198,80" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

          <!-- Official Seal of the Province of Agusan del Sur (Vector Heraldic Medallion) -->
          <g transform="translate(320, 48)">
            <circle cx="0" cy="0" r="16" fill="url(#k3-gold-badge)" stroke="#78350F" stroke-width="1.5" />
            <circle cx="0" cy="0" r="13" fill="#1D4ED8" stroke="#FDE047" stroke-width="1" />
            <!-- Sun of Mindanao & Golden Eagle Wings -->
            <path d="M 0,-10 L 0,10 M -10,0 L 10,0 M -7,-7 L 7,7 M -7,7 L 7,-7" stroke="#FDE047" stroke-width="1.2" opacity="0.8" />
            <polygon points="0,-4 3,-1 2,4 -2,4 -3,-1" fill="#FEF08A" stroke="#B45309" stroke-width="0.6" />
            <path d="M -8,2 Q 0,-3 8,2" fill="none" stroke="#FDE047" stroke-width="1.5" stroke-linecap="round" />
            <text x="0" y="8.5" font-family="'Inter', sans-serif" font-weight="900" font-size="3.5" fill="#FEF08A" text-anchor="middle" letter-spacing="0.5">AGUSAN DEL SUR</text>
          </g>

          <!-- Provincial Inscription under Seal -->
          <text x="320" y="69" font-family="'Inter', sans-serif" font-weight="800" font-size="5" text-anchor="middle" fill="#1E3A8A" letter-spacing="0.8">LALAWIGAN NG AGUSAN DEL SUR</text>

          <!-- Horizontal Architrave & Official Frieze Signboard -->
          <rect x="198" y="75" width="244" height="23" rx="3" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.2" />
          <rect x="202" y="77" width="236" height="19" rx="2" fill="#0F172A" stroke="#F59E0B" stroke-width="1.5" />
          <rect x="204" y="79" width="232" height="15" rx="1.5" fill="none" stroke="#FDE047" stroke-width="0.8" opacity="0.6" />
          <text x="320" y="87.5" font-family="'Inter', sans-serif" font-weight="900" font-size="7.5" text-anchor="middle" fill="#FEF08A" letter-spacing="0.6">KAPITOLYO PROBINSYAL NG AGUSAN DEL SUR</text>
          <text x="320" y="94" font-family="'Inter', sans-serif" font-weight="800" font-size="5" text-anchor="middle" fill="#6EE7B7" letter-spacing="1">PROVINCIAL GOVERNMENT CENTER • PATIN-AY</text>

          <!-- TALL, MAJESTIC PATINATED COPPER DOME / CUPOLA -->
          <!-- Octagonal Drum (Tholobate) with Classical Pilasters & Arched Windows -->
          <rect x="296" y="2" width="48" height="18" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.5" />
          <!-- Arched Clerestory Windows -->
          <rect x="300" y="6" width="6" height="10" rx="1.5" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="0.8" />
          <rect x="310" y="6" width="6" height="10" rx="1.5" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="0.8" />
          <rect x="324" y="6" width="6" height="10" rx="1.5" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="0.8" />
          <rect x="334" y="6" width="6" height="10" rx="1.5" fill="url(#k3-win-glass)" stroke="#1E293B" stroke-width="0.8" />
          <!-- Classical Drum Pilasters -->
          <rect x="297" y="2" width="3" height="18" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.5" />
          <rect x="307" y="2" width="3" height="18" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.5" />
          <rect x="317" y="2" width="6" height="18" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.5" />
          <rect x="331" y="2" width="3" height="18" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.5" />
          <rect x="341" y="2" width="3" height="18" fill="#FFFFFF" stroke="#94A3B8" stroke-width="0.5" />

          <!-- Grand Ribbed Patinated Copper Dome -->
          <path d="M 292,2 C 292,-20 348,-20 348,2 Z" fill="url(#k3-dome-copper)" stroke="#047857" stroke-width="2" />
          <!-- Polished Gold Curved Ribs -->
          <path d="M 320,-20 L 320,2" stroke="#FDE047" stroke-width="1.5" opacity="0.8" />
          <path d="M 320,-20 Q 306,-8 304,2" fill="none" stroke="#FDE047" stroke-width="1.2" opacity="0.8" />
          <path d="M 320,-20 Q 334,-8 336,2" fill="none" stroke="#FDE047" stroke-width="1.2" opacity="0.8" />

          <!-- Lantern Belvedere & Gold Finial -->
          <rect x="314" y="-28" width="12" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" rx="1" />
          <polygon points="312,-28 320,-34 328,-28" fill="url(#k3-dome-copper)" stroke="#047857" stroke-width="1" />
          <circle cx="320" cy="-35" r="2.5" fill="#FBBF24" stroke="#B45309" stroke-width="0.8" />

          <!-- Towering Philippine Flagpole (Stationary Anchor Group!) -->
          <g transform="translate(320, -35)">
            <line x1="0" y1="0" x2="0" y2="-28" stroke="#E2E8F0" stroke-width="2.5" />
            <circle cx="0" cy="-29" r="2.5" fill="#FBBF24" stroke="#B45309" stroke-width="0.8" />
            <g transform="translate(1, -28)">
              <g class="vq-flag-wave">
                <rect x="0" y="0" width="32" height="10" fill="#0038A8" />
                <rect x="0" y="10" width="32" height="10" fill="#CE1126" />
                <polygon points="0,0 16,10 0,20" fill="#FFFFFF" />
                <circle cx="6" cy="10" r="2.4" fill="#FCD116" />
                <circle cx="3" cy="4" r="0.8" fill="#FCD116" />
                <circle cx="3" cy="16" r="0.8" fill="#FCD116" />
                <circle cx="12" cy="10" r="0.8" fill="#FCD116" />
              </g>
            </g>
          </g>

          <!-- Left & Right Provincial Banners (Stationary Anchor Groups!) -->
          <g transform="translate(245, 12)">
            <rect x="0" y="0" width="3" height="54" fill="#CBD5E1" stroke="#94A3B8" stroke-width="0.5" />
            <circle cx="1.5" cy="0" r="2.5" fill="#F59E0B" />
            <g transform="translate(3, 4)">
              <g class="vq-flag-wave delay-1">
                <polygon points="0,0 30,3 30,19 0,16" fill="#FACC15" stroke="#CA8A04" stroke-width="1" />
                <circle cx="15" cy="10" r="4" fill="#EAB308" />
              </g>
            </g>
          </g>

          <g transform="translate(395, 12)">
            <rect x="0" y="0" width="3" height="54" fill="#CBD5E1" stroke="#94A3B8" stroke-width="0.5" />
            <circle cx="1.5" cy="0" r="2.5" fill="#F59E0B" />
            <g transform="translate(3, 4)">
              <g class="vq-flag-wave delay-2">
                <polygon points="0,0 30,3 30,19 0,16" fill="#FACC15" stroke="#CA8A04" stroke-width="1" />
                <circle cx="15" cy="10" r="4" fill="#EAB308" />
              </g>
            </g>
          </g>

          <!-- ======================================================== -->
          <!-- GRAND CEREMONIAL PROVINCIAL WATER FOUNTAIN -->
          <!-- ======================================================== -->
          <g transform="translate(320, 312)">
            <!-- Outer Granite Reflection Rim & Pool -->
            <ellipse cx="0" cy="8" rx="52" ry="15" fill="#0F172A" opacity="0.38" />
            <ellipse cx="0" cy="6" rx="50" ry="13" fill="url(#k3-granite-rim)" stroke="#64748B" stroke-width="1.8" />
            <ellipse cx="0" cy="5" rx="45" ry="11" fill="url(#k3-fountain-water)" stroke="#38BDF8" stroke-width="1" />

            <!-- Tier 2 Elevated Marble Pedestal & Bowl -->
            <rect x="-6" y="-3" width="12" height="10" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
            <ellipse cx="0" cy="-3" rx="26" ry="8" fill="url(#k3-granite-rim)" stroke="#64748B" stroke-width="1.2" />
            <ellipse cx="0" cy="-4" rx="23" ry="7" fill="url(#k3-fountain-water)" stroke="#38BDF8" stroke-width="0.8" />

            <!-- Tier 3 Upper Urn Basin -->
            <rect x="-4" y="-12" width="8" height="9" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
            <ellipse cx="0" cy="-12" rx="14" ry="5" fill="url(#k3-granite-rim)" stroke="#64748B" stroke-width="1" />
            <ellipse cx="0" cy="-13" rx="12" ry="4" fill="url(#k3-fountain-water)" />

            <!-- Grand Central Fountain Geyser Spouting High -->
            <path d="M 0,-13 Q -4,-28 0,-30 Q 4,-28 0,-13" fill="#E0F2FE" stroke="#38BDF8" stroke-width="1.2" opacity="0.9" />
            <!-- Sparkling Droplets -->
            <circle cx="-5" cy="-22" r="1.5" fill="#BAE6FD" />
            <circle cx="5" cy="-22" r="1.5" fill="#BAE6FD" />
            <circle cx="-2" cy="-27" r="1.2" fill="#FFFFFF" />
            <circle cx="2" cy="-27" r="1.2" fill="#FFFFFF" />
            <!-- Cascading Water Overflows -->
            <path d="M -14,-12 Q -18,-4 -15,4" fill="none" stroke="#BAE6FD" stroke-width="1.2" opacity="0.8" />
            <path d="M 14,-12 Q 18,-4 15,4" fill="none" stroke="#BAE6FD" stroke-width="1.2" opacity="0.8" />
          </g>
        </svg>
        </div>
      `;
    }
  }

  private updateNodeStates(): void {
    this.nodeStates.clear();

    const isEntered = this.isKingdomEntered(this.currentKingdom);

    for (const pn of this.pathNodes) {
      const globalIdx = (this.currentKingdom - 1) * LEVELS_PER_KINGDOM + pn.level;
      let status: NodeState['status'] = 'locked';
      let stars: 0 | 1 | 2 | 3 = 0;

      // levels after the current one stay locked until the current one is finished
      status = levelStatus(pn.level, this.currentLevel, isEntered);
      if (status === 'completed') {
        // Look up stars from history
        const hist = this.starsHistory.find(
          (h) => (h.mapId === this.currentKingdom || h.orderIndex === this.currentKingdom) && h.questionIndex === pn.level,
        );
        stars = (hist?.stars ?? 3) as 0 | 1 | 2 | 3;
      }

      this.nodeStates.set(pn.level, {
        kingdom: this.currentKingdom,
        level: pn.level,
        globalIndex: globalIdx,
        x: pn.x,
        y: pn.y,
        blockH: 54,
        segment: 0,
        status,
        available: isEntered && pn.level <= this.currentLevel,
        stars,
      });
    }

    // Update DOM classes
    for (const [level, el] of this.nodeEls) {
      const state = this.nodeStates.get(level);
      if (!state) continue;

      el.className = 'vq-node-btn';
      el.classList.add(`node-${state.status}`);

      // Stars display
      let starsHtml = '';
      if (state.status === 'completed') {
        starsHtml = '<span class="vq-node-stars">';
        for (let s = 0; s < 3; s++) {
          starsHtml += s < state.stars ? '⭐' : '☆';
        }
        starsHtml += '</span>';
      }

      // Current level indicator: character stands right on top of this node
      const arrowHtml = '';

      // Lock icon for locked
      let content = `${level}`;
      if (state.status === 'locked') {
        content = '<span style="font-size:14px">🔒</span>';
      }

      el.innerHTML = `${arrowHtml}${content}${starsHtml}`;
    }

    // Update building landmark state & badge
    const landmarkEl = this.nodeLayer.querySelector('.vq-landmark-container') as HTMLElement | null;
    if (landmarkEl) {
      landmarkEl.dataset['kingdom'] = String(this.currentKingdom);
      landmarkEl.title = KINGDOM_THEMES[this.currentKingdom].name;
      const html = this.landmarkContent(this.currentKingdom);
      // the SVG picture is big: only rebuild it when it really changes
      if (landmarkEl.dataset['html'] !== `${this.currentKingdom}:${html.length}`) {
        landmarkEl.innerHTML = html;
        landmarkEl.dataset['html'] = `${this.currentKingdom}:${html.length}`;
      }
    }
  }

  private updateNodePositions(): void {
    // 3D: buttons shrink with distance (perspective) and far ones are hidden, so a low camera
    // does not pile the far levels up at the horizon.
    let focusS = 0;
    if (this.world3d) {
      const cx = this.viewX + this.viewportW / (2 * this.zoom);
      const cy = this.viewY + this.viewportH / (2 * this.zoom);
      focusS = this.toScreen(cx, cy, 0.09).s || 0;
    }
    for (const pn of this.pathNodes) {
      const el = this.nodeEls.get(pn.level);
      if (!el) continue;

      const sp = this.toScreen(pn.x, pn.y, 0.09);
      const screenX = sp.x;
      const screenY = sp.y;
      const depth = focusS > 0 ? sp.s / focusS : 1;

      // looking at the kingdom building: level buttons behind it are hidden (the building stays solid)
      const behind = !!this.world3d?.viewingBuilding && this.world3d.blockedByBuilding(pn.x, pn.y, 0.5, true);
      // Only show if on screen (and, in 3D, not far away)
      if (behind || screenX < -50 || screenX > this.viewportW + 50 || screenY < -50 || screenY > this.viewportH + 50 || depth < 0.55) {
        if (el.style.display !== 'none') el.style.display = 'none';
      } else {
        if (el.style.display !== 'flex') el.style.display = 'flex';
        if (focusS > 0) {
          // 3D moves every frame: the CSS translate property avoids a layout pass per button
          if (el.style.left !== '0px') {
            el.style.left = '0px';
            el.style.top = '0px';
          }
          el.style.translate = `${screenX.toFixed(1)}px ${screenY.toFixed(1)}px`;
        } else {
          el.style.translate = '';
          el.style.left = `${screenX}px`;
          el.style.top = `${screenY}px`;
        }
        el.style.scale = focusS > 0 ? String(Math.min(1.25, depth).toFixed(3)) : '';
        el.style.opacity = focusS > 0 && depth < 0.7 ? ((depth - 0.55) / 0.15).toFixed(2) : '';
      }
    }

    // Gate button
    const gateBtn = this.nodeLayer.querySelector('[data-gate="next"]') as HTMLElement | null;
    if (gateBtn && this.currentKingdom < 3) {
      const gx = MAP_W / 2;
      const gy = PATH_TOP_Y - 100;
      const sp = this.toScreen(gx, gy);
      gateBtn.style.left = `${sp.x}px`;
      gateBtn.style.top = `${sp.y}px`;
    }

    // 3D HTML Landmark Building (centered at entrance, strictly below Node 1)
    const landmarkEl = this.nodeLayer.querySelector('.vq-landmark-container') as HTMLElement | null;
    this.world3d?.setView(this.viewX, this.viewY, this.zoom);
    const rect = this.world3d?.landmarkRect();
    if (landmarkEl && this.world3d) {
      // 3D: invisible tap area over the 3D building
      if (rect && rect.x < this.viewportW && rect.y < this.viewportH && rect.x + rect.w > 0 && rect.y + rect.h > 0) {
        landmarkEl.style.display = 'block';
        landmarkEl.style.left = `${rect.x}px`;
        landmarkEl.style.top = `${rect.y}px`;
        landmarkEl.style.width = `${rect.w}px`;
        landmarkEl.style.height = `${rect.h}px`;
      } else {
        landmarkEl.style.display = 'none';
      }
    } else if (landmarkEl && this.pending3D) {
      landmarkEl.style.display = 'none';
    } else if (landmarkEl && this.pathNodes.length > 0) {
      landmarkEl.style.display = '';
      landmarkEl.style.width = '';
      landmarkEl.style.height = '';
      const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
      const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 110;
      const sp = this.toScreen(bx, by);
      landmarkEl.style.left = `${sp.x}px`;
      landmarkEl.style.top = `${sp.y}px`;
      landmarkEl.style.transform = `translate(-50%, 0) scale(${sp.s})`;
      landmarkEl.style.transformOrigin = 'top center';
    }

    // Synchronize DOM avatar position
    this.updateAvatarDOM();
    this.updatePadlockPosition();
  }

  /* ── Kingdom switching ──────────────────────────────────────────── */

  private async switchKingdom(kingdom: KingdomId): Promise<void> {
    if (kingdom === this.currentKingdom) return;
    this.avatarAtFront = false;
    this.orbitGoal = null;

    this.currentKingdom = kingdom;
    this.deriveCurrentLevel();
    this.generateKingdom(kingdom);
    this.createNodeElements();
    this.updateNodeStates();
    this.updateKingdomLockVisuals();

    if (!this.isKingdomEntered(kingdom)) {
      this.zoom = 1.25;
      const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
      const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 310 + this.lmShift();
      this.centerOnLocation(bx, by);
      this.updateAvatarDOM();
    } else {
      const startNode = this.pathNodes[this.currentLevel - 1];
      if (startNode) {
        this.avatarX = startNode.x;
        this.avatarY = startNode.y;
      }
      this.zoom = 1.45;
      this.centerOnLevel(this.currentLevel, true);
      this.updateAvatarDOM();
    }
  }

  private deriveCurrentLevel(): void {
    // From history, figure out how many levels completed in this kingdom
    let maxCompleted = 0;
    for (const h of this.starsHistory) {
      const mapId = h.mapId ?? h.orderIndex;
      if (mapId === this.currentKingdom && h.questionIndex) {
        maxCompleted = Math.max(maxCompleted, h.questionIndex);
      }
    }
    this.currentLevel = Math.min(LEVELS_PER_KINGDOM, maxCompleted + 1);
  }


  /* ── Camera ─────────────────────────────────────────────────────── */

  private centerOnLevel(level: number, animate: boolean): void {
    const node = this.pathNodes[level - 1];
    if (!node) return;

    // Center camera directly on the character at this level node
    const targetX = node.x - this.viewportW / (2 * this.zoom);
    const targetY = node.y - this.viewportH / (2 * this.zoom);

    if (animate) {
      this.targetViewY = targetY;
      this.viewX = targetX;
      // Smooth scroll will happen in the frame loop
    } else {
      this.viewX = targetX;
      this.viewY = targetY;
      this.targetViewY = targetY;
      this.clampView();
    }
    this.updateNodePositions();
  }

  /* ── Render loop ────────────────────────────────────────────────── */

  /** Last time something moved (see the battery saver in frame()). */
  private lastActiveTime = 0;

  /** True while the pupil or an animation moves the map: full 60 fps. */
  private isMapActive(): boolean {
    return (
      this.isDragging ||
      this.avatarWalking ||
      this.isPostWalkZoomEasing ||
      this.inputLocked ||
      this.layoutDirty ||
      !!this.orbitGoal ||
      this.orbitPendingYaw !== 0 ||
      this.orbitPendingPitch !== 0 ||
      Math.abs(this.orbitVelYaw) > 0.02 ||
      Math.abs(this.orbitVelPitch) > 0.02 ||
      Math.abs(this.inertiaVY) > 0.3 ||
      Math.abs(this.targetViewY - this.viewY) > 0.5 ||
      Math.abs(this.avatarStandOffsetY + 28) > 0.5
    );
  }

  private frame(timestamp: number): void {
    if (this.destroyed) return;

    // Map not on screen (question screen, detached or hidden container): draw nothing, like Tala's
    // frameloop 'never' while the map is covered. Checked cheaply once per frame.
    if (!this.root.isConnected || this.root.clientWidth === 0) {
      this.lastFrame = 0; // no time jump when it comes back
      this.animFrameId = requestAnimationFrame((t) => this.frame(t));
      return;
    }

    // Battery saver: when nothing is moving (no drag, walk, glide or animation) for a moment, the
    // map runs at half rate (~30 fps). Clouds, birds, sparkles and the idle student still move,
    // the GPU does half the work. Any input or movement brings 60 fps back on the next frame.
    if (this.isMapActive()) {
      this.lastActiveTime = timestamp;
    } else if (this.lastFrame && timestamp - this.lastActiveTime > IDLE_HALF_RATE_MS && timestamp - this.lastFrame < 30) {
      this.animFrameId = requestAnimationFrame((t) => this.frame(t));
      return;
    }

    const dt = this.lastFrame ? Math.min(timestamp - this.lastFrame, 50) : 16;
    this.lastFrame = timestamp;
    this.time = timestamp;
    this.lastDt = dt;

    this.update(dt);
    this.updateAvatarDOM();
    this.draw();

    this.animFrameId = requestAnimationFrame((t) => this.frame(t));
  }

  private update(dt: number): void {
    const dtSec = dt / 1000;

    // Smooth camera follow
    // Frame-rate independent easing (Tala: 1 - exp(-dt * rate)). The rates give the same feel as the
    // old per-frame factors at 60 Hz (0.1, 0.12, 0.16, inertia x0.88), but no longer run twice as fast
    // on 120 Hz tablets or stutter when a frame is late.
    const frames = dt / (1000 / 60);
    const ease = (perFrame60: number) => 1 - Math.pow(1 - perFrame60, frames);

    if (!this.isDragging) {
      // Smooth momentum inertia (inertiaVY is in px per 60 Hz frame)
      if (Math.abs(this.inertiaVY) > 0.3) {
        this.viewY += this.inertiaVY * frames;
        this.targetViewY = this.viewY;
        this.inertiaVY *= Math.pow(0.88, frames);
        this.clampView();
        this.updateNodePositions();
      } else {
        this.inertiaVY = 0;
      }

      // Smooth scroll to targetViewY (when explicitly set by centerOnLevel / wheel)
      if (!this.avatarWalking && !this.isPostWalkZoomEasing && Math.abs(this.targetViewY - this.viewY) > 0.5) {
        this.viewY += (this.targetViewY - this.viewY) * ease(0.1);
        this.clampView();
        this.updateNodePositions();
      }

      // Follow avatar smoothly if walking with dynamic deep zoom-in
      if (this.avatarWalking) {
        // Deep focus zoom-in while running (target 1.72) so character is close and prominent
        const targetZoom = 1.72;
        this.zoom += (targetZoom - this.zoom) * Math.min(1, dtSec * 3.5);

        const targetY = this.avatarY - this.viewportH / (2 * this.zoom);
        const targetX = this.avatarX - this.viewportW / (2 * this.zoom);
        this.viewY += (targetY - this.viewY) * ease(0.16);
        this.viewX += (targetX - this.viewX) * ease(0.16);
        this.targetViewY = this.viewY;
        this.clampView();
        this.updateNodePositions();
        this.updatePadlockPosition();
      } else if (this.isPostWalkZoomEasing) {
        // Smoothly ease zoom back to base gameplay zoom (1.45) ONLY right after walking finishes
        const targetZoom = this.postWalkZoom;
        this.zoom += (targetZoom - this.zoom) * Math.min(1, dtSec * 2.5);
        const targetY = this.avatarY + this.postWalkFocusDY - this.viewportH / (2 * this.zoom);
        const targetX = this.avatarX - this.viewportW / (2 * this.zoom);
        this.viewY += (targetY - this.viewY) * ease(0.12);
        this.viewX += (targetX - this.viewX) * ease(0.12);
        this.targetViewY = this.viewY;
        this.clampView();
        this.updateNodePositions();
        this.updatePadlockPosition();

        if (Math.abs(this.zoom - targetZoom) < 0.01) {
          this.zoom = targetZoom;
          this.isPostWalkZoomEasing = false;
        }
      }
    }

    // Avatar walking
    if (this.avatarWalking && this.walkPath.length > 0) {
      const target = this.walkPath[this.walkIndex];
      if (target) {
        const dx = target.x - this.avatarX;
        const dy = target.y - this.avatarY;
        const dist = Math.hypot(dx, dy);
        const step = this.walkSpeed * dtSec;

        if (dist < step) {
          this.avatarX = target.x;
          this.avatarY = target.y;
          this.walkIndex++;

          if (this.walkIndex >= this.walkPath.length) {
            this.avatarWalking = false;
            this.isPostWalkZoomEasing = true;
            this.walkPath = [];
            this.walkBubbleText = '';
            if (this.walkCallback) {
              const cb = this.walkCallback;
              this.walkCallback = null;
              cb();
            }
          }
        } else {
          if (Math.abs(dx) > 0.5) {
            this.avatarFacingRight = dx > 0;
          }
          this.avatarX += (dx / dist) * step;
          this.avatarY += (dy / dist) * step;

          // Play step sound (rate-limited every ~26px)
          this.walkDistanceTraveled += step;
          if (this.walkDistanceTraveled - this.lastStepSoundDist >= 26) {
            this.lastStepSoundDist = this.walkDistanceTraveled;
            this.hooks.step?.();
          }
        }
      }
    }

    // 3D drag turn: once per frame, then a short glide after release (Tala: OrbitControls damping)
    if (this.world3d) {
      const w = this.world3d;
      let turned = false;
      if (this.orbitPendingYaw !== 0 || this.orbitPendingPitch !== 0) {
        w.orbitBy(this.orbitPendingYaw, this.orbitPendingPitch);
        if (dtSec > 0) {
          const vy = Math.max(-6, Math.min(6, this.orbitPendingYaw / dtSec));
          const vp = Math.max(-3, Math.min(3, this.orbitPendingPitch / dtSec));
          this.orbitVelYaw += (vy - this.orbitVelYaw) * 0.5;
          this.orbitVelPitch += (vp - this.orbitVelPitch) * 0.5;
        }
        this.orbitPendingYaw = 0;
        this.orbitPendingPitch = 0;
        turned = true;
      } else if (this.isDragging) {
        // finger held still: no glide when it lets go
        const k = Math.exp(-dtSec * 20);
        this.orbitVelYaw *= k;
        this.orbitVelPitch *= k;
      } else if (Math.abs(this.orbitVelYaw) > 0.02 || Math.abs(this.orbitVelPitch) > 0.02) {
        w.orbitBy(this.orbitVelYaw * dtSec, this.orbitVelPitch * dtSec);
        const k = Math.exp(-dtSec * 6);
        this.orbitVelYaw *= k;
        this.orbitVelPitch *= k;
        turned = true;
      } else {
        this.orbitVelYaw = 0;
        this.orbitVelPitch = 0;
      }
      if (turned || this.layoutDirty) {
        this.layoutDirty = false;
        this.updateNodePositions();
        this.updatePadlockPosition();
      }
    }

    // 3D: ease the camera turn towards its goal (e.g. facing the kingdom building's front)
    if (this.orbitGoal && this.world3d && !this.isDragging) {
      const o = this.world3d.orbit;
      const dYaw = Math.atan2(Math.sin(this.orbitGoal.yaw - o.yaw), Math.cos(this.orbitGoal.yaw - o.yaw));
      const dPitch = this.orbitGoal.pitch - o.pitch;
      if (Math.abs(dYaw) < 0.002 && Math.abs(dPitch) < 0.002) {
        this.world3d.setOrbit(this.orbitGoal.yaw, this.orbitGoal.pitch);
        this.orbitGoal = null;
      } else {
        const k = Math.min(1, dtSec * 2.2);
        this.world3d.setOrbit(o.yaw + dYaw * k, o.pitch + dPitch * k);
      }
      this.updateNodePositions();
      this.updatePadlockPosition();
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy -= 30 * dtSec; // float up
      p.life -= dtSec;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Spawn ambient particles near current node (per time, so half-rate idle frames keep the density)
    if (Math.random() < 0.15 * Math.min(3, dt / (1000 / 60))) {
      const cn = this.pathNodes[this.currentLevel - 1];
      if (cn) {
        const theme = KINGDOM_THEMES[this.currentKingdom];
        this.particles.push({
          x: cn.x + (Math.random() - 0.5) * 80,
          y: cn.y + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 10,
          vy: -15 - Math.random() * 15,
          life: 1.5 + Math.random(),
          maxLife: 2.5,
          size: 2 + Math.random() * 3,
          color: theme.particleColor,
        });
      }
    }
  }

  /**
   * Ground position of the 3D student. When idle it stands just behind the current level button
   * (avatarStandOffsetY eases to -28) so the level number stays readable; while walking it is on the road.
   */
  private avatar3DY(): number {
    return this.avatarY - 10 + this.avatarStandOffsetY * 1.7;
  }

  /** 3D frame: three.js draws the world and the student; the 2D canvas only adds the gate portal and sparkles. */
  private draw3D(w: World3D): void {
    const theme = KINGDOM_THEMES[this.currentKingdom];
    w.viewingBuilding = this.avatarAtFront && !this.avatarWalking;
    w.setView(this.viewX, this.viewY, this.zoom);
    try {
      w.render(this.time, this.lastDt / 1000, {
        x: this.avatarX,
        y: this.avatar3DY(),
        walking: this.avatarWalking,
        visible: this.use3DAvatar && this.isKingdomEntered(this.currentKingdom),
      });
    } catch (err) {
      console.error('3D render failed, using the 2D map', err);
      this.disable3D();
      return;
    }

    const ctx = this.ctx;
    const dpr = this.dpr;

    // Gate portal as a standing billboard at its ground point.
    let portal: { x: number; y: number; locked: boolean; name: string } | null = null;
    if (this.activePortalPos) {
      const nextK = Math.min(3, this.currentKingdom + 1) as KingdomId;
      portal = { x: this.activePortalPos.x, y: this.activePortalPos.y, locked: false, name: KINGDOM_THEMES[nextK].name };
    } else if (this.currentKingdom < 3) {
      const nextK = (this.currentKingdom + 1) as KingdomId;
      portal = { x: MAP_W / 2, y: PATH_TOP_Y - 100, locked: !this.isKingdomUnlocked(nextK), name: KINGDOM_THEMES[nextK].name };
    }
    let portalScreen: { x: number; y: number; s: number } | null = null;
    if (portal) {
      const p = this.toScreen(portal.x, portal.y);
      if (p.x > -600 && p.x < this.viewportW + 600 && p.y > -600 && p.y < this.viewportH + 600) portalScreen = p;
    }
    // Nothing to draw on the overlay: leave the (already clear) canvas alone.
    if (!portalScreen && !this.particles.length) {
      if (this.overlayDrawn) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.overlayDrawn = false;
      }
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.overlayDrawn = true;
    if (portal && portalScreen) {
      const p = portalScreen;
      ctx.setTransform(dpr * p.s, 0, 0, dpr * p.s, dpr * (p.x - p.s * portal.x), dpr * (p.y - p.s * portal.y));
      drawKingdomGatePortal(ctx, portal.x, portal.y, portal.locked, portal.name, theme, this.time);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const pt of this.particles) {
      const alpha = pt.life / pt.maxLife;
      const sp = this.toScreen(pt.x, pt.y, 0.25);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, Math.max(0.5, pt.size * alpha * sp.s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private draw(): void {
    if (this.world3d) {
      this.draw3D(this.world3d);
      return;
    }
    if (this.pending3D) {
      // 3D code still downloading: plain sky instead of flashing the old 2D map
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#bfe6fb';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.overlayDrawn = true;
      return;
    }
    const ctx = this.ctx;
    const theme = KINGDOM_THEMES[this.currentKingdom];

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Clear
    ctx.clearRect(0, 0, this.viewportW, this.viewportH);

    // Sky (fixed, not scrolling)
    drawSky(ctx, this.viewportW, this.viewportH, theme);

    // Mountains (parallax)
    ctx.save();
    ctx.translate(0, -this.viewY * 0.05);
    drawMountains(ctx, this.viewY, theme);
    ctx.restore();

    // Clouds (in sky area)
    for (const cloud of this.clouds) {
      drawCloud(ctx, cloud, this.time, theme);
    }

    // World transform
    ctx.save();
    ctx.translate(-this.viewX * this.zoom, -this.viewY * this.zoom);
    ctx.scale(this.zoom, this.zoom);

    // Grass terrain
    drawGrassTerrain(ctx, theme, this.time);

    // Water bodies
    for (const wb of this.waterBodies) {
      drawWater(ctx, wb, this.time, theme);
    }

    // Path
    drawPath(ctx, this.pathNodes, theme, this.time);

    // Entrance plaza road connection (connecting building courtyard to Node 1)
    const p0 = this.pathNodes[0];
    if (p0) {
      const bx = p0.x;
      const by = p0.y + 115;
      ctx.fillStyle = theme.pathColor;
      ctx.strokeStyle = theme.pathBorder;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(bx - 55, by);
      ctx.lineTo(bx + 55, by);
      ctx.lineTo(p0.x + 40, p0.y);
      ctx.lineTo(p0.x - 40, p0.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Road leading into top gate
    const pLast = this.pathNodes[this.pathNodes.length - 1];
    if (pLast && this.currentKingdom < 3) {
      const gx = MAP_W / 2;
      const gy = PATH_TOP_Y - 100;
      ctx.fillStyle = theme.pathColor;
      ctx.strokeStyle = theme.pathBorder;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(pLast.x - 36, pLast.y);
      ctx.lineTo(pLast.x + 36, pLast.y);
      ctx.lineTo(gx + 46, gy + 10);
      ctx.lineTo(gx - 46, gy + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Ground shadow for 3D HTML Landmark at the start
    const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
    const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 280;
    const shadowGrad = ctx.createRadialGradient(bx, by, 30, bx, by, 240);
    shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
    shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(bx, by, 240, 0, Math.PI * 2);
    ctx.fill();

    // Soft, feathered dark ground shadow directly under the locked kingdom building (zero visible edges, seamless fade)
    if (!this.isKingdomEntered(this.currentKingdom)) {
      const mistA = this.unlockingPadlock ? this.unlockingPadlock.mistAlpha : 1;
      const mistGrad = ctx.createRadialGradient(bx, by, 10, bx, by, 170);
      mistGrad.addColorStop(0, `rgba(15, 23, 42, ${0.45 * mistA})`);
      mistGrad.addColorStop(0.35, `rgba(15, 23, 42, ${0.25 * mistA})`);
      mistGrad.addColorStop(0.65, `rgba(15, 23, 42, ${0.08 * mistA})`);
      mistGrad.addColorStop(0.88, `rgba(15, 23, 42, ${0.01 * mistA})`);
      mistGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 170, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scenery (sorted by Y for depth)
    for (const item of this.scenery) {
      switch (item.type) {
        case 'tree':
          drawIsometricTree(ctx, item.x, item.y, item.scale, item.variant, theme, this.time);
          break;
        case 'bush':
          drawBush(ctx, item.x, item.y, item.scale, item.variant, theme);
          break;
        case 'flower':
          drawFlower(ctx, item.x, item.y, item.scale, item.variant, this.time);
          break;
        case 'rock':
          drawRock(ctx, item.x, item.y, item.scale, item.variant);
          break;
        case 'lamp':
          drawLamp(ctx, item.x, item.y, item.scale, this.time, theme);
          break;
        case 'mountain':
          drawIsometricMountain(ctx, item.x, item.y, item.scale, item.variant, theme, this.time);
          break;
        case 'kubo':
          drawBahayKubo(ctx, item.x, item.y, item.scale, item.variant, theme, this.time);
          break;
      }
    }

    // Grand Gate Portal at top level (or active transition portal)
    if (this.activePortalPos) {
      const nextK = (Math.min(3, this.currentKingdom + 1)) as KingdomId;
      const nextTheme = KINGDOM_THEMES[nextK];
      drawKingdomGatePortal(ctx, this.activePortalPos.x, this.activePortalPos.y, false, nextTheme.name, theme, this.time);
    } else if (this.currentKingdom < 3) {
      const nextK = (this.currentKingdom + 1) as KingdomId;
      const nextTheme = KINGDOM_THEMES[nextK];
      drawKingdomGatePortal(ctx, MAP_W / 2, PATH_TOP_Y - 100, !this.isKingdomUnlocked(nextK), nextTheme.name, theme, this.time);
    }

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // world transform
    ctx.restore(); // dpr
  }

  /* ── Event system ───────────────────────────────────────────────── */

  private emit(event: EventName, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (list) {
      for (const fn of list) {
        (fn as (...a: unknown[]) => void)(...args);
      }
    }
  }

  on<K extends EventName>(event: K, fn: MapEvents[K]): void {
    const list = this.listeners.get(event) ?? [];
    list.push(fn as Listener);
    this.listeners.set(event, list);
  }

  /* ── MapRenderer interface ──────────────────────────────────────── */

  updateProgress(activeMapId: number, qIndex: number, starsHistory?: StarHistoryItem[]): void {
    const newKingdom = Math.min(3, Math.max(1, activeMapId)) as KingdomId;
    if (starsHistory) this.starsHistory = starsHistory;

    if (newKingdom !== this.currentKingdom) {
      this.switchKingdom(newKingdom);
    }

    const prevLevel = this.currentLevel;
    this.currentLevel = Math.max(1, Math.min(LEVELS_PER_KINGDOM, qIndex));
    this.updateNodeStates();
    this.updateKingdomLockVisuals();

    // 3D: a student looking at the kingdom building stays there until the level changes
    // (switchKingdom already cleared avatarAtFront when the kingdom changed)
    const stayAtFront = this.avatarAtFront && prevLevel === this.currentLevel;
    if (!stayAtFront) this.avatarAtFront = false;

    // Move avatar to current level ONLY if not walking and not in walking_to_question phase
    if (!stayAtFront && !this.avatarWalking && this.flowOpts?.mapPhase !== 'walking_to_question') {
      const node = this.pathNodes[this.currentLevel - 1];
      if (node) {
        this.avatarX = node.x;
        this.avatarY = node.y;
      }
    }
  }

  setMapFlowOptions(o: MapFlowOptions): void {
    this.flowOpts = o;
    this.updateNodeStates();
    this.updateKingdomLockVisuals();
  }

  setAvailability(_a: Record<number, number>): void {
    this.updateNodeStates();
  }

  isInputLocked(): boolean {
    return this.inputLocked;
  }

  async animatePadlockUnlock(kingdomId: number): Promise<void> {
    this.inputLocked = true;
    const duration = 850;
    const startTime = performance.now();
    let hasPlayedSound = false;

    this.unlockingPadlock = {
      kingdomId,
      progress: 0,
      shackleLift: 0,
      shackleAngle: 0,
      lockWobbleX: 0,
      alpha: 1,
      mistAlpha: 1,
      dropY: 0,
    };

    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);

        let shackleLift = 0;
        let shackleAngle = 0;
        let lockWobbleX = 0;
        let alpha = 1;
        let mistAlpha = 1;
        let dropY = 0;

        if (p < 0.15) {
          const t = p / 0.15;
          lockWobbleX = Math.sin(t * Math.PI * 4) * 2 * (1 - t);
        } else if (p < 0.50) {
          if (!hasPlayedSound) {
            hasPlayedSound = true;
            this.hooks.padlockUnlock?.();
          }
          const t = (p - 0.15) / 0.35;
          const popEase = Math.sin(t * Math.PI * 0.5);
          shackleLift = popEase * 14;
          shackleAngle = -popEase * 0.65;
        } else {
          const t = (p - 0.50) / 0.50;
          shackleLift = 14;
          shackleAngle = -0.65;
          dropY = t * 12;
          alpha = Math.max(0, 1 - t * 1.35);
          mistAlpha = Math.max(0, 1 - t);
        }

        if (this.unlockingPadlock) {
          this.unlockingPadlock.progress = p;
          this.unlockingPadlock.shackleLift = shackleLift;
          this.unlockingPadlock.shackleAngle = shackleAngle;
          this.unlockingPadlock.lockWobbleX = lockWobbleX;
          this.unlockingPadlock.alpha = alpha;
          this.unlockingPadlock.mistAlpha = mistAlpha;
          this.unlockingPadlock.dropY = dropY;
        }

        // Animate DOM 3D padlock mesh & badge (unaffected by 70% dark overlay)
        if (this.padlockEl) {
          const shackle = this.padlockEl.querySelector('.p-shackle') as HTMLElement | null;
          const body = this.padlockEl.querySelector('.p-body') as HTMLElement | null;
          const badge = this.padlockEl.querySelector('.vq-building-badge') as HTMLElement | null;
          if (shackle) {
            shackle.style.transform = `translateY(${-shackleLift}px) rotate(${shackleAngle}rad)`;
          }
          if (body) {
            body.style.transform = `translateX(${lockWobbleX}px) translateY(${dropY}px)`;
          }
          if (badge && p > 0.15) {
            badge.style.opacity = '0';
          }
          this.padlockEl.style.opacity = String(alpha);
        }

        // Clear locked styling on building and illuminate with triumphant warm glow
        const landmarkEl = this.nodeLayer.querySelector('.vq-landmark-container') as HTMLElement | null;
        if (landmarkEl) {
          if (p >= 0.15) {
            if (landmarkEl.classList.contains('is-locked')) this.world3d?.setLandmarkLocked(false, true);
            landmarkEl.classList.remove('is-locked');
            landmarkEl.classList.add('is-unlocking');
          }
          if (p >= 0.95) {
            landmarkEl.classList.remove('is-unlocking');
          }
        }

        // Spawn golden sparkle particles during unlock
        if (p >= 0.25 && p <= 0.85 && Math.random() < 0.45) {
          const p0 = this.pathNodes[0];
          const bx = p0?.x ?? MAP_W / 2;
          const by = (p0?.y ?? PATH_BOT_Y) + 310 + this.lmShift();
          this.particles.push({
            x: bx + (Math.random() - 0.5) * 70,
            y: by + (Math.random() - 0.5) * 50,
            vx: (Math.random() - 0.5) * 90,
            vy: -40 - Math.random() * 60,
            life: 1.1,
            maxLife: 1.1,
            size: 3.5 + Math.random() * 4,
            color: '#FFD700',
          });
        }

        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          if (this.padlockEl) {
            this.padlockEl.remove();
            this.padlockEl = null;
          }
          this.unlockingPadlock = null;
          this.inputLocked = false;
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  async playKingdomEntryAnimation(kingdomId: number): Promise<void> {
    this.inputLocked = true;
    try {
      const k = Math.min(3, Math.max(1, kingdomId)) as KingdomId;
      const p0 = this.pathNodes[0];
      const bx = p0?.x ?? MAP_W / 2;
      const focalY = (p0?.y ?? PATH_BOT_Y) + 235 + this.lmShift(); // Center point framing both landmark building and padlock

      // Immediately fade out the "TAP TO UNLOCK" badge so it does not clutter during zoom & unlock
      if (this.padlockEl) {
        const badge = this.padlockEl.querySelector('.vq-building-badge') as HTMLElement | null;
        if (badge) {
          badge.style.opacity = '0';
          badge.style.transition = 'opacity 0.2s ease-out';
        }
      }

      // Prepare cinematic dark vignette overlay (darkening sides while spotlighting the kingdom & padlock)
      this.unlockOverlay.style.display = 'block';
      this.unlockOverlay.style.opacity = '0';
      this.unlockOverlay.style.transition = 'none';

      const updateSpotlight = (alpha: number) => {
        const fp = this.toScreen(bx, focalY);
        const sx = fp.x;
        const sy = fp.y;
        this.unlockOverlay.style.background = `radial-gradient(ellipse 56vw 66vh at ${sx}px ${sy}px, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 28%, rgba(8, 14, 26, 0.30) 52%, rgba(6, 10, 20, 0.55) 75%, rgba(3, 7, 16, 0.70) 100%)`;
        this.unlockOverlay.style.opacity = String(alpha);
      };

      // 1. Smoothly zoom in on the kingdom building & padlock
      const startZoom = this.zoom;
      const targetZoom = 1.68;
      const startViewX = this.viewX;
      const startViewY = this.viewY;
      const targetViewX = bx - this.viewportW / (2 * targetZoom);
      const targetViewY = focalY - this.viewportH / (2 * targetZoom);

      const zoomDuration = 800;
      const zoomStart = performance.now();

      await new Promise<void>((resolve) => {
        const stepZoom = (now: number) => {
          const elapsed = now - zoomStart;
          const p = Math.min(1, elapsed / zoomDuration);
          const ease = 0.5 - Math.cos(p * Math.PI) / 2;

          this.zoom = startZoom + (targetZoom - startZoom) * ease;
          this.viewX = startViewX + (targetViewX - startViewX) * ease;
          this.viewY = startViewY + (targetViewY - startViewY) * ease;
          this.clampView();
          this.updateNodePositions();
          this.updatePadlockPosition();
          updateSpotlight(ease);

          if (p < 1) {
            requestAnimationFrame(stepZoom);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(stepZoom);
      });

      // Keep spotlight fully active during the padlock unlatch
      updateSpotlight(1);

      // 2. Animate the Padlock Unlock (wobble, shackle pops open with sound & golden sparkles, fade)
      await this.animatePadlockUnlock(k);

      // 3. Play whoosh sound
      this.hooks.whoosh?.();

      // 4. Kingdom welcome banner icon intentionally removed per user request for seamless, premium UX

      if (k !== this.currentKingdom) {
        await this.switchKingdom(k);
      }

      // 5. Fade out dark overlay while smoothly gliding camera from entrance to Level 1
      this.unlockOverlay.style.transition = 'opacity 0.65s ease-out';
      this.unlockOverlay.style.opacity = '0';

      const glideStartZoom = this.zoom;
      const glideTargetZoom = 1.45;
      const glideStartViewX = this.viewX;
      const glideStartViewY = this.viewY;
      const targetL1X = (p0?.x ?? MAP_W / 2) - this.viewportW / (2 * glideTargetZoom);
      const targetL1Y = (p0?.y ?? PATH_BOT_Y) - this.viewportH / (2 * glideTargetZoom);
      const glideDuration = 850;
      const glideStart = performance.now();

      await new Promise<void>((resolve) => {
        const stepGlide = (now: number) => {
          const elapsed = now - glideStart;
          const p = Math.min(1, elapsed / glideDuration);
          const ease = 0.5 - Math.cos(p * Math.PI) / 2;

          this.zoom = glideStartZoom + (glideTargetZoom - glideStartZoom) * ease;
          this.viewX = glideStartViewX + (targetL1X - glideStartViewX) * ease;
          this.viewY = glideStartViewY + (targetL1Y - glideStartViewY) * ease;
          this.targetViewY = this.viewY;
          this.clampView();
          this.updateNodePositions();
          this.updateAvatarDOM();

          if (p < 1) {
            requestAnimationFrame(stepGlide);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(stepGlide);
      });

      this.unlockOverlay.style.display = 'none';
    } finally {
      this.inputLocked = false;
      if (this.unlockOverlay) {
        this.unlockOverlay.style.display = 'none';
        this.unlockOverlay.style.opacity = '0';
      }
    }
  }

  clearEntryFade(): void {
    if (this.unlockOverlay) {
      this.unlockOverlay.style.display = 'none';
      this.unlockOverlay.style.opacity = '0';
    }
  }

  async playPortalEntryAnimation(targetPos?: { x: number; y: number }): Promise<void> {
    this.inputLocked = true;
    try {
      const px = targetPos?.x ?? (this.pathNodes[this.currentLevel - 1]?.x ?? MAP_W / 2);
      const py = targetPos?.y ?? (this.pathNodes[this.currentLevel - 1]?.y ?? PATH_TOP_Y - 100);

      // Active portal location (draw portal right at avatar position)
      this.activePortalPos = { x: px, y: py - 40 };

      // Avatar enters portal
      this.avatarX = px;
      this.avatarY = py - 30;
      this.walkBubbleText = 'ENTERING PORTAL...';
      this.updateAvatarDOM();

      // Sound
      this.hooks.whoosh?.();

      // Camera zoom & 50% dark overlay fade
      const startZoom = this.zoom;
      const targetZoom = Math.min(1.5, startZoom * 1.6);
      const startTime = performance.now();
      const duration = 850;

      if (this.portalOverlay) {
        this.portalOverlay.style.opacity = '1';
      }

      await new Promise<void>((resolve) => {
        const stepAnim = (now: number) => {
          const elapsed = now - startTime;
          const p = Math.min(1, elapsed / duration);
          const easeP = 0.5 - Math.cos(p * Math.PI) / 2; // smooth cosine ease

          this.zoom = startZoom + (targetZoom - startZoom) * easeP;
          this.centerOnLocation(px, py - 30);

          if (p < 1) {
            requestAnimationFrame(stepAnim);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(stepAnim);
      });

      // Brief hold at 50% dark overlay
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      this.inputLocked = false;
    }
  }

  clearPortalOverlay(): void {
    if (this.portalOverlay) {
      this.portalOverlay.style.opacity = '0';
    }
    this.activePortalPos = null;
    this.walkBubbleText = '';
    this.zoom = 1.45;
    this.centerOnActiveLocation();
  }

  centerOnLocation(x: number, y: number): void {
    if (y > MAP_H || y < 0) {
      this.centerOnLevel(this.currentLevel, false);
      return;
    }
    this.inertiaVY = 0;
    this.isPostWalkZoomEasing = false;
    this.viewX = x - this.viewportW / (2 * this.zoom);
    this.viewY = y - this.viewportH / (2 * this.zoom);
    this.targetViewY = this.viewY;
    this.clampView();
    this.updateNodePositions();
  }

  centerOnKingdom(id: number): void {
    const k = Math.min(3, Math.max(1, id)) as KingdomId;
    if (k !== this.currentKingdom) {
      void this.switchKingdom(k);
    } else {
      this.updateKingdomLockVisuals();
      this.inertiaVY = 0;
      this.isPostWalkZoomEasing = false;
      if (!this.isKingdomEntered(k)) {
        this.zoom = 1.25;
        const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
        const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 310 + this.lmShift();
        this.centerOnLocation(bx, by);
        this.createPadlockElement();
        this.updateAvatarDOM();
      } else {
        this.zoom = 1.45;
        this.centerOnLevel(this.currentLevel, true);
        this.updateAvatarDOM();
      }
    }
  }

  centerOnActiveLocation(): void {
    this.updateKingdomLockVisuals();
    this.inertiaVY = 0;
    this.isPostWalkZoomEasing = false;
    if (!this.isKingdomEntered(this.currentKingdom)) {
      this.zoom = 1.25;
      const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
      const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 310 + this.lmShift();
      this.centerOnLocation(bx, by);
      this.createPadlockElement();
      this.updateAvatarDOM();
    } else {
      this.zoom = 1.45;
      this.centerOnLevel(this.currentLevel, true);
      this.updateAvatarDOM();
    }
  }

  centerOnLandmark(): void {
    this.inertiaVY = 0;
    this.isPostWalkZoomEasing = false;
    this.zoom = 1.15;
    const bx = this.pathNodes[0]?.x ?? MAP_W / 2;
    const by = (this.pathNodes[0]?.y ?? PATH_BOT_Y) + 310 + this.lmShift();
    this.centerOnLocation(bx, by);
    this.updateAvatarDOM();
  }

  centerOnPeak(): void {
    this.inertiaVY = 0;
    this.isPostWalkZoomEasing = false;
    this.zoom = 1.25;
    const lastNode = this.pathNodes[this.pathNodes.length - 1];
    if (lastNode) {
      this.centerOnLocation(lastNode.x, lastNode.y);
      this.updateAvatarDOM();
    }
  }

  /** Generate smooth intermediate waypoints along the road curve between two levels (1..45). */
  private generateRoadSegmentPath(fromLevel: number, toLevel: number): Array<{ x: number; y: number }> {
    const lA = Math.max(1, Math.min(LEVELS_PER_KINGDOM, fromLevel));
    const lB = Math.max(1, Math.min(LEVELS_PER_KINGDOM, toLevel));
    const tA = (lA - 1) / (LEVELS_PER_KINGDOM - 1);
    const tB = (lB - 1) / (LEVELS_PER_KINGDOM - 1);

    const steps = Math.max(16, Math.abs(lB - lA) * 16);
    const path: Array<{ x: number; y: number }> = [];

    const centerX = MAP_W / 2;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const t = tA + (tB - tA) * p;
      const y = PATH_BOT_Y - t * (PATH_BOT_Y - PATH_TOP_Y);
      const x = centerX + Math.sin(t * Math.PI * 6) * 260;
      path.push({ x, y });
    }
    return path;
  }

  animateWalkingPath(waypoints: Array<{ x: number; y: number }>, bubbleText?: string, onArrival?: () => void): void {
    if (!waypoints || waypoints.length === 0) {
      onArrival?.();
      return;
    }

    let finalPath = waypoints;

    // Check if waypoints are legacy/out-of-bounds coordinates (e.g. y > MAP_H or y < -100)
    const isOutOfBounds = waypoints.some((p) => p.y < -100 || p.y > MAP_H + 500);
    if (isOutOfBounds) {
      let targetLevel = this.currentLevel;
      const match = bubbleText?.match(/LEVEL\s*(\d+)/i);
      if (match) {
        const parsed = parseInt(match[1], 10);
        targetLevel = ((parsed - 1) % LEVELS_PER_KINGDOM) + 1;
      }
      const startLevel = Math.max(1, targetLevel - 1);
      finalPath = this.generateRoadSegmentPath(startLevel, targetLevel);
    } else if (finalPath.length === 2) {
      const p0 = finalPath[0];
      const p1 = finalPath[1];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (dist > 40) {
        const subSteps = Math.max(12, Math.round(dist / 14));
        const smooth: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= subSteps; i++) {
          const t = i / subSteps;
          smooth.push({
            x: p0.x + (p1.x - p0.x) * t,
            y: p0.y + (p1.y - p0.y) * t,
          });
        }
        finalPath = smooth;
      }
    }

    if (finalPath.length < 2) {
      onArrival?.();
      return;
    }

    // Short hops are walked; long trips (several levels) are run, capped at about 2.6 s.
    let total = 0;
    for (let i = 1; i < finalPath.length; i++) total += Math.hypot(finalPath[i].x - finalPath[i - 1].x, finalPath[i].y - finalPath[i - 1].y);
    this.walkSpeed = total > 520 ? Math.min(420, Math.max(160, total / 2.6)) : 160;

    this.avatarAtFront = false;
    this.postWalkZoom = 1.45;
    this.postWalkFocusDY = 0;
    this.walkPath = finalPath;
    this.walkIndex = 0;
    this.avatarWalking = true;
    this.walkCallback = onArrival ?? null;
    this.walkBubbleText = bubbleText ?? '';
    this.walkDistanceTraveled = 0;
    this.lastStepSoundDist = 0;

    // Start from first waypoint
    this.avatarX = finalPath[0].x;
    this.avatarY = finalPath[0].y;

    // Center camera on starting avatar position immediately so character is visible
    this.centerOnLocation(this.avatarX, this.avatarY);

    // 3D (user request): whatever turn/tilt the pupil dragged to, a walk glides the camera to one
    // fixed view: looking up the road (north) from a medium height, so the student is always seen
    // walking from the same good angle. A drag during the walk still takes over (orbitGoal = null).
    if (this.world3d) {
      this.orbitVelYaw = 0;
      this.orbitVelPitch = 0;
      this.orbitGoal = { yaw: 0, pitch: WALK_VIEW_PITCH };
    }

    this.hooks.whoosh?.();
  }

  /** Where the student stands to look at the kingdom building: on the school yard, in front of the steps. */
  private kingdomFrontSpot(): { x: number; y: number } {
    const p0 = this.pathNodes[0];
    const lx = p0?.x ?? MAP_W / 2;
    const ly = (p0?.y ?? PATH_BOT_Y) + 590; // same landmark point World3D is given
    return { x: lx + 30, y: ly + 300 };
  }

  /**
   * 3D: walks (or runs) the student along the drawn road from where it stands to `to`
   * (a level, or the front of the kingdom building), then calls `onArrival`.
   */
  private walkAlongRoad(to: { x: number; y: number }, onArrival: () => void): void {
    const road = this.world3d?.roadPath() ?? [];
    const from = { x: this.avatarX, y: this.avatarY };
    const nearest = (p: { x: number; y: number }) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < road.length; i++) {
        const d = (road[i].x - p.x) ** 2 + (road[i].y - p.y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };
    const path: Array<{ x: number; y: number }> = [from];
    if (road.length > 1) {
      const a = nearest(from);
      const b = nearest(to);
      const dir = b >= a ? 1 : -1;
      for (let i = a; i !== b + dir; i += dir) path.push({ x: road[i].x, y: road[i].y });
    }
    path.push(to);
    const wasFront = this.avatarAtFront;
    this.animateWalkingPath(path, '', onArrival);
    this.avatarAtFront = wasFront;
    // long trips run faster so even level 45 reaches the building in about 8 s
    let total = 0;
    for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (total > 520) this.walkSpeed = Math.min(900, Math.max(160, total / 5));
  }

  /** 3D tap on the kingdom building: go to its front to look at it, or (already there) walk back to the current level. */
  private onBuildingTap3D(): void {
    if (this.inputLocked || !this.world3d) return;
    this.hooks.click?.();
    if (this.avatarAtFront) {
      const node = this.pathNodes[this.currentLevel - 1];
      if (!node) return;
      this.walkAlongRoad({ x: node.x, y: node.y }, () => {
        this.avatarAtFront = false;
      });
      return;
    }
    this.walkAlongRoad(this.kingdomFrontSpot(), () => {
      this.avatarAtFront = true;
      // turn the camera to face the building's front and pull back a little so all of it shows
      this.orbitGoal = { yaw: 0, pitch: THREE_FRONT_PITCH };
    });
    this.postWalkZoom = 1.2;
    this.postWalkFocusDY = -110;
  }

  onStepClick(cb: (mapId: number, questionIndex: number) => void): void {
    this.onStepClickCb = cb;
  }

  onKingdomClick(cb: (kingdomId: number) => void): void {
    this.onKingdomClickCb = cb;
  }

  onLockedKingdomClick(cb: () => void): void {
    this.onLockedKingdomClickCb = cb;
  }

  /* ── Avatar DOM Rendering ───────────────────────────────────────── */

  private initAvatarDOM(url: string): void {
    this.avatarUrl = url;
    if (!this.avatarLayer) return;
    this.avatarLayer.innerHTML = '';
    // The 3D student canvas lives in the avatar layer so it is drawn above the level buttons.
    if (this.world3d) this.avatarLayer.appendChild(this.world3d.charCanvas);

    const el = document.createElement('div');
    el.className = 'vq-avatar-container';
    el.innerHTML = `
      <div class="vq-avatar-bubble"></div>
      <div class="vq-avatar-badge">YOU</div>
      <div class="vq-avatar-sprite-wrapper">
        <img class="vq-avatar-img" src="${url}" alt="Player Avatar" />
      </div>
      <div class="vq-avatar-shadow"></div>
    `;

    this.avatarEl = el;
    this.avatarImgEl = el.querySelector('.vq-avatar-img') as HTMLImageElement;
    this.avatarBubbleEl = el.querySelector('.vq-avatar-bubble') as HTMLDivElement;

    if (this.avatarImgEl) {
      this.avatarImgEl.onerror = () => {
        if (this.avatarImgEl) {
          this.avatarImgEl.src =
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 70">
                <ellipse cx="30" cy="65" rx="18" ry="4" fill="rgba(0,0,0,0.2)"/>
                <circle cx="30" cy="22" r="16" fill="#FCD34D"/>
                <rect x="18" y="38" width="24" height="24" rx="8" fill="#3B82F6"/>
                <circle cx="25" cy="20" r="2.5" fill="#1E293B"/>
                <circle cx="35" cy="20" r="2.5" fill="#1E293B"/>
                <path d="M26 26 Q30 30 34 26" stroke="#1E293B" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
            `);
        }
      };
    }

    this.avatarLayer.appendChild(el);
  }

  private updateAvatarDOM(): void {
    if (!this.avatarEl) return;

    // Hide avatar if current kingdom has not been entered yet (no character on Level 1 before unlock)
    if (!this.isKingdomEntered(this.currentKingdom)) {
      this.avatarEl.style.display = 'none';
      return;
    }

    // Target vertical offset: -28px when idle on a node (perched proudly on top), 0px when walking along road
    const targetOffset = this.avatarWalking ? 0 : -28;
    this.avatarStandOffsetY += (targetOffset - this.avatarStandOffsetY) * 0.15;

    const feetX = this.avatarX;
    const feetY = this.avatarY + this.avatarStandOffsetY;

    const is3D = this.use3DAvatar && !!this.world3d?.avatarReady;
    this.avatarEl.classList.toggle('is-3d', is3D);
    // The 3D student stands on the node itself; only the YOU badge and bubble stay in the DOM above its head.
    let sp = this.toScreen(feetX, feetY);
    if (is3D) {
      // Anchor so the badge's bottom edge sits just above the 3D head (container is 80px tall, badge on top).
      const head = this.toScreen(this.avatarX, this.avatar3DY(), AVATAR_HEAD_H);
      sp = { x: head.x, y: head.y - 4 + 80 * head.s, s: head.s };
    }
    const screenX = sp.x;
    const screenY = sp.y;

    // Check if within visible bounds (with 140px margin)
    if (screenX < -140 || screenX > this.viewportW + 140 || screenY < -140 || screenY > this.viewportH + 140) {
      this.avatarEl.style.display = 'none';
      return;
    }
    this.avatarEl.style.display = 'flex';

    // Bobbing: gentle breathing when idle, energetic bounce when walking
    const bob = this.avatarWalking
      ? Math.abs(Math.sin(this.time * 0.015)) * 6
      : Math.sin(this.time * 0.005) * 3;

    this.avatarEl.style.left = `${screenX}px`;
    this.avatarEl.style.top = `${screenY - (is3D ? 0 : bob * sp.s)}px`;
    this.avatarEl.style.transform = `translate(-50%, -100%) scale(${sp.s})`;

    // Facing direction and walking lean
    const spriteWrapper = this.avatarEl.querySelector('.vq-avatar-sprite-wrapper') as HTMLElement | null;
    if (spriteWrapper) {
      const facing = this.avatarFacingRight ? 1 : -1;
      const lean = this.avatarWalking ? (this.avatarFacingRight ? 6 : -6) : 0;
      spriteWrapper.style.transform = `scaleX(${facing}) rotate(${lean}deg)`;
    }

    // Speech bubble
    if (this.avatarBubbleEl) {
      if (this.walkBubbleText) {
        this.avatarBubbleEl.textContent = this.walkBubbleText;
        this.avatarBubbleEl.style.display = 'block';
      } else {
        this.avatarBubbleEl.style.display = 'none';
      }
    }
  }

  remount(container: HTMLElement): void {
    if (this.root.parentElement !== container) {
      this.root.remove();
      container.appendChild(this.root);
      this.container = container;
      this.resizeCanvas();
      this.updateNodePositions();
      this.updateAvatarDOM();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.world3d?.dispose();
    this.world3d = null;
    this.avatarLayer?.remove();
    this.root.remove();
  }

  /* ── Demo / Game Compatibility Helpers ───────────────────────────── */

  jumpToNode(kingdom: KingdomId, level: number): void {
    if (kingdom !== this.currentKingdom) {
      this.switchKingdom(kingdom);
    }
    this.currentLevel = Math.max(1, Math.min(LEVELS_PER_KINGDOM, level));
    this.avatarAtFront = false;
    const node = this.pathNodes[this.currentLevel - 1];
    if (node) {
      this.avatarX = node.x;
      this.avatarY = node.y;
    }
    this.centerOnLevel(this.currentLevel, false);
    this.updateNodeStates();
    this.updateAvatarDOM();
  }

  setQuality(_tier: string): void {
    // Modern map is crisp high-DPI vector canvas
  }

  setReducedMotion(_reduced: boolean): void {
    // Reduced motion preference
  }

  setProgress(p: { currentKingdom: KingdomId; currentLevel: number; completedLevels: Array<{ kingdom: KingdomId; level: number; stars: number }> }): void {
    if (p.currentKingdom !== this.currentKingdom) {
      this.switchKingdom(p.currentKingdom);
    }
    this.currentLevel = Math.max(1, Math.min(LEVELS_PER_KINGDOM, p.currentLevel));
    this.starsHistory = p.completedLevels.map((c) => ({
      mapId: c.kingdom,
      questionIndex: c.level,
      stars: c.stars,
    }));
    this.updateNodeStates();
    this.avatarAtFront = false;
    const node = this.pathNodes[this.currentLevel - 1];
    if (node) {
      this.avatarX = node.x;
      this.avatarY = node.y;
    }
    this.centerOnLevel(this.currentLevel, true);
    this.updateAvatarDOM();
  }

  recenter(): void {
    this.centerOnActiveLocation();
  }

  setAvatarImage(url: string): void {
    this.avatarUrl = url;
    this.avatarImg = new Image();
    this.avatarImg.crossOrigin = 'anonymous';
    this.avatarImg.src = url;
    if (this.avatarImgEl) {
      this.avatarImgEl.src = url;
    }
    if (this.world3d) this.use3DAvatar = this.world3d.setAvatar(url);
  }

  getAvatar(): { x: number; y: number } {
    return { x: this.avatarX, y: this.avatarY };
  }

  setDebug(_debug: boolean | { nodes?: boolean; stats?: boolean }): void {}

  setCompareMode(_compare: boolean): void {}

  getSprites(): Record<string, any> {
    return {
      sprite: {
        get(_key: string): any {
          return null;
        },
      },
    };
  }

  /* ── Public: stats (for the demo panel) ──────────────────────────── */

  getStats(): { fps: number; drawMs: number; quality: string; bakedSegments: number; bakedMB: number; three?: ReturnType<World3D['stats']> } {
    return { fps: 60, drawMs: 2, quality: this.world3d ? '3d' : '2d', bakedSegments: 0, bakedMB: 0, three: this.world3d?.stats() };
  }
}
