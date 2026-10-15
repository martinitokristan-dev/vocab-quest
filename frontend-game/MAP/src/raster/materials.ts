import type { Material } from '../../data/models/types';
import type { KingdomId } from '../api/types';

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function c8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Multiplies a colour by factor f and returns a #rrggbb string (usable as a material colour). */
export function hexShade(hex: string, f: number): string {
  const [r, g, b] = parseHex(hex);
  return `#${[r, g, b].map((v) => c8(v * f).toString(16).padStart(2, '0')).join('')}`;
}

/** Linear mix of two #rrggbb colours (t = 0 gives a, t = 1 gives b) as a #rrggbb string. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return `#${[ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t].map((v) => c8(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Multiplies a colour by factor f and returns a CSS rgb() string. */
export function shade(hex: string, f: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${c8(r * f)},${c8(g * f)},${c8(b * f)})`;
}

/** `count` tones of a colour spread over +/- amp (for seeded per-voxel noise lookups). */
export function toneTable(hex: string, count = 8, amp = 0.05, base = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(shade(hex, base * (1 + ((i / (count - 1)) * 2 - 1) * amp)));
  return out;
}

export const MATERIALS: Readonly<Record<string, Material>> = {
  grass: { base: '#3e7f2b', top: '#5aa63c', noise: 1 },
  dirt: { base: '#7a5230', top: '#9a6a3f', noise: 0.8 },
  stone: { base: '#7d8087', top: '#a3a6ad', noise: 1 },
  cobble: { base: '#c9b27a', top: '#e8d5a0', noise: 0.6 },
  poleGrey: { base: '#cfcfcf', top: '#f0f0f0', noise: 0.1 },
  water: { base: '#1f78dc', top: '#3c9cf0', noise: 0.4 },
  trunk: { base: '#6b4423', top: '#8a5a2e', noise: 0.8 },
  leaf: { base: '#2f8a2e', top: '#46b043', noise: 1 },
  leafDark: { base: '#1f6a22', top: '#2f8a2e', noise: 0.8 },
  wood: { base: '#8b5a2b', top: '#a8733a', noise: 0.8 },
  woodDark: { base: '#5a3a1e', top: '#6e4826', noise: 0.8 },
  plank: { base: '#b07a3c', top: '#c98f4a', noise: 0.9 },
  wall: { base: '#dcb560', top: '#ecc97c', noise: 0.8 },
  wallAlt: { base: '#c79f4e', top: '#d9b46c', noise: 0.8 },
  wallLight: { base: '#ecd9a0', top: '#f4e6b8', noise: 0.6 },
  cream: { base: '#e6d3a0', top: '#f0e2b8', noise: 0.5 },
  navy: { base: '#1d3157', top: '#2a416e', noise: 0.3 },
  glass: { base: '#2c4a78', top: '#3f6296', noise: 0.3 },
  door: { base: '#4a2f1c', top: '#5c3b24', noise: 0.3 },
  roofGreenA: { base: '#2f8f3a', top: '#47b04d', noise: 0.7 },
  roofGreenB: { base: '#25772f', top: '#3a9a42', noise: 0.7 },
  roofGreenDark: { base: '#1c5a26', top: '#2a7434', noise: 0.5 },
  roofGreenRidge: { base: '#3fa84a', top: '#6bd070', noise: 0.4 },
  roofRedDark: { base: '#7a2418', top: '#92301f', noise: 0.5 },
  roofRedRidge: { base: '#d85a42', top: '#ee7a5e', noise: 0.4 },
  roofRedA: { base: '#c23c2a', top: '#dc5440', noise: 0.7 },
  roofRedB: { base: '#a6321f', top: '#c04630', noise: 0.7 },
  roofBrown: { base: '#8a5a2a', top: '#a56e35', noise: 0.8 },
  colBlue: { base: '#2b6bd0', top: '#4285e8', noise: 0.4 },
  gold: { base: '#e0b030', top: '#f0c848', noise: 0.4 },
  pillar: { base: '#d2bd84', top: '#e0cf9c', noise: 0.5 },
  stepGray: { base: '#9a9a96', top: '#b4b4ae', noise: 0.8 },
  vanWhite: { base: '#e8e6df', top: '#f6f4ee', noise: 0.4 },
  carRed: { base: '#c23a2e', top: '#da5446', noise: 0.4 },
  carDark: { base: '#2d3036', top: '#454a52', noise: 0.4 },
  tyre: { base: '#1a1c20', top: '#262a30', noise: 0.2 },
  lampYellow: { base: '#ffd45a', top: '#ffe48a', noise: 0.2, emissive: true },
  lampPost: { base: '#2c2c2c', top: '#3c3c3c', noise: 0.2 },
  foam: { base: '#e8f4fb', top: '#ffffff', noise: 0.3 },
  fall: { base: '#7cc4f2', top: '#a4daf8', noise: 0.5 },
  rock: { base: '#8a8c90', top: '#b0b2b6', noise: 1 },
  rockDark: { base: '#6e7074', top: '#92949a', noise: 1 },
  lily: { base: '#2f9a3a', top: '#4cbf4c', noise: 0.6 },
  hillGrass: { base: '#38591f', top: '#4c7228', noise: 1 },
  hillDirt: { base: '#68502e', top: '#7e6038', noise: 1 },
  hillStone: { base: '#5a6054', top: '#757c6c', noise: 1 },
  leafHi: { base: '#5c9230', top: '#80b83a', noise: 1 },
  bloomY: { base: '#f0c030', top: '#ffd850', noise: 0.3 },
  bloomO: { base: '#ee7a22', top: '#ff9a40', noise: 0.3 },
  bloomP: { base: '#e86aa6', top: '#ff8cc0', noise: 0.3 },
  bloomW: { base: '#f4f0f0', top: '#ffffff', noise: 0.3 },
  letterBlue: { base: '#2a6fd0', top: '#4a8ff0', noise: 0.4 },
  letterRed: { base: '#d42a2a', top: '#f04a4a', noise: 0.4 },
  letterYellow: { base: '#e8c020', top: '#fbd840', noise: 0.4 },
  letterGreen: { base: '#3aa83a', top: '#58c858', noise: 0.4 },
  letterOrange: { base: '#ee8a1c', top: '#ffa83a', noise: 0.4 },
  letterPink: { base: '#e0405a', top: '#f86078', noise: 0.4 },
  planter: { base: '#5a3a24', top: '#74492c', noise: 0.8 },
  soil: { base: '#4a3020', top: '#5c3c28', noise: 0.8 },
  // Kingdom 2 (warm sandstone and teal)
  sandstone: { base: '#cfae78', top: '#e2c690', noise: 0.7 },
  sandstoneDark: { base: '#a98a58', top: '#bf9e68', noise: 0.7 },
  terracotta: { base: '#c8602f', top: '#df7a45', noise: 0.7 },
  roofTeal: { base: '#1f8f8a', top: '#35b0a8', noise: 0.6 },
  roofTealDark: { base: '#17706c', top: '#238a84', noise: 0.5 },
  awnRed: { base: '#d23c3c', top: '#ea5a5a', noise: 0.3 },
  awnBlue: { base: '#2e6fc4', top: '#4a8be0', noise: 0.3 },
  awnYellow: { base: '#e8b82a', top: '#f6d24a', noise: 0.3 },
  awnWhite: { base: '#ece8de', top: '#fbf8f0', noise: 0.3 },
  palmTrunk: { base: '#8a6a3a', top: '#a58348', noise: 0.8 },
  palmLeaf: { base: '#3f9a3c', top: '#5cc254', noise: 1 },
  palmLeafDark: { base: '#2d7a30', top: '#3f9a3c', noise: 0.8 },
  reed: { base: '#7aa040', top: '#98c050', noise: 0.8 },
  reedTop: { base: '#b08a3a', top: '#c8a24a', noise: 0.6 },
  boatWood: { base: '#8a4e2a', top: '#a8643a', noise: 0.6 },
  sail: { base: '#f2eee4', top: '#ffffff', noise: 0.3 },
  mesaA: { base: '#b98a5a', top: '#d3a874', noise: 0.8 },
  mesaB: { base: '#a8714a', top: '#c08a60', noise: 0.8 },
  mesaDark: { base: '#8a5a3a', top: '#a4704c', noise: 0.8 },
  // Kingdom 3 (cool slate, marble and cypress)
  marble: { base: '#e2e6ec', top: '#f4f7fa', noise: 0.3 },
  marbleDark: { base: '#bcc3ce', top: '#d2d8e0', noise: 0.4 },
  slate: { base: '#6e7a88', top: '#8795a4', noise: 0.9 },
  slateDark: { base: '#566270', top: '#6e7c8c', noise: 0.9 },
  copper: { base: '#3f9c86', top: '#5fc2aa', noise: 0.5 },
  cypress: { base: '#1c5436', top: '#2c7448', noise: 1 },
  cypressDark: { base: '#143e28', top: '#1c5436', noise: 0.8 },
  snow: { base: '#e8eef4', top: '#ffffff', noise: 0.3 },
  peakStone: { base: '#6a7872', top: '#869590', noise: 1 },
  peakDark: { base: '#55625d', top: '#6c7b75', noise: 1 },
  bronze: { base: '#8c7a4e', top: '#a8946a', noise: 0.5 },
  carBlue: { base: '#2f5fa8', top: '#487ac4', noise: 0.4 },
  carGreen: { base: '#2d7a56', top: '#44986e', noise: 0.4 },
  vanCream: { base: '#e6dcb8', top: '#f4ecd0', noise: 0.4 },
  vine: { base: '#4a7a2c', top: '#68a03c', noise: 1 },
  grape: { base: '#6a3a7a', top: '#8a52a0', noise: 0.5 },
};

export interface KingdomPalette {
  readonly grassTop: string;
  readonly grassFront: string;
  readonly dirtTop: string;
  readonly dirtFront: string;
  readonly stoneTop: string;
  readonly stoneFront: string;
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly leaf: string;
  readonly leafTop: string;
}

/** DESIGN 7.2: grass and sky tints per kingdom. */
export const PALETTES: Readonly<Record<KingdomId, KingdomPalette>> = {
  1: {
    // tuned against the reference render (fidelity gate): darker olive ground, deeper leaf greens
    grassTop: '#5a8a2c', grassFront: '#3b6424', dirtTop: '#76592f', dirtFront: '#58401f',
    stoneTop: '#80827a', stoneFront: '#5c5e56', skyTop: '#2f9fe8', skyBottom: '#8fd0f5',
    leaf: '#2f6a1a', leafTop: '#54942a',
  },
  2: {
    grassTop: '#7bb04a', grassFront: '#587f35', dirtTop: '#b98a55', dirtFront: '#8f6838',
    stoneTop: '#c8b99a', stoneFront: '#9b8d72', skyTop: '#4aa8d8', skyBottom: '#bfe6ef',
    leaf: '#4f9a3a', leafTop: '#6cb54c',
  },
  3: {
    grassTop: '#4f9a5a', grassFront: '#2f6e42', dirtTop: '#8c7352', dirtFront: '#6a5538',
    stoneTop: '#aab3b0', stoneFront: '#7b8582', skyTop: '#5b8fd9', skyBottom: '#cfd8f2',
    leaf: '#2c7a4c', leafTop: '#3f9a63',
  },
};

/** Materials table with the kingdom's tree colours substituted. */
export function materialsFor(k: KingdomId): Record<string, Material> {
  const p = PALETTES[k];
  return {
    ...MATERIALS,
    leaf: { base: p.leaf, top: p.leafTop, noise: 1 },
    leafDark: { base: hexShade(p.leaf, 0.75), top: p.leaf, noise: 0.8 },
  };
}

export const WATER_TONES = ['#1f6fc8', '#2a82dc', '#3a98ec'] as const;
