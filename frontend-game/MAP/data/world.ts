import type { KingdomId } from '../src/api/types';

export const WORLD_W = 1774;
export const SEG_H = 887;
export const SEGMENTS_PER_KINGDOM = 7;
export const KINGDOM_H = SEGMENTS_PER_KINGDOM * SEG_H; // 6209
export const SEGMENT_COUNT = 3 * SEGMENTS_PER_KINGDOM; // 21
export const WORLD_H = SEGMENT_COUNT * SEG_H; // 18627
export const LEVELS_PER_KINGDOM = 45;
export const TOTAL_LEVELS = 3 * LEVELS_PER_KINGDOM; // 135

export const LEVEL1_U = 330; // K2 and K3 only
export const LEVEL45_U = 5650;
export const TOP_GATE_U = 5850;
export const GATE_FRONT_DISTANCE = 150; // L45 to gate front, along the end tangent

export const PATH_HALF_W = 26;
export const PATH_CLEAR = 70;

export interface KingdomDef {
  readonly id: KingdomId;
  readonly name: string;
  readonly subtitle: string;
  readonly color: string;
  readonly tint: string;
  readonly seed: number;
}

export const KINGDOMS: readonly KingdomDef[] = [
  { id: 1, name: 'EPCES', subtitle: 'Where the journey begins', color: '#2f9e44', tint: '#bfe8a8', seed: 1101 },
  { id: 2, name: 'Bayan ng Prosperidad', subtitle: 'The town of prosperity', color: '#d9a441', tint: '#f0d9a0', seed: 2202 },
  { id: 3, name: 'Provincial Capitol', subtitle: 'The summit of knowledge', color: '#2b8a6e', tint: '#a9d9c5', seed: 3303 },
];

/** World y of the bottom edge of kingdom k. K3 = 6209, K2 = 12418, K1 = 18627. */
export function kingdomBottomY(k: KingdomId): number {
  return (4 - k) * KINGDOM_H;
}

/** Authoring u (distance up from the kingdom bottom) to world y. */
export function uToWorldY(k: KingdomId, u: number): number {
  return kingdomBottomY(k) - u;
}

export function worldYToU(k: KingdomId, y: number): number {
  return kingdomBottomY(k) - y;
}

/** Global segment index 0..20 (0 at the top) for a world y. */
export function segmentForY(y: number): number {
  return Math.max(0, Math.min(SEGMENT_COUNT - 1, Math.floor(y / SEG_H)));
}

export interface GateRecord {
  readonly kingdom: 1 | 2;
  readonly archX: number;
  readonly archY: number;
  readonly frontX: number;
  readonly frontY: number;
  readonly nextSpawnX: number;
  readonly nextSpawnY: number;
}

export interface EntranceRecord {
  readonly kingdom: KingdomId;
  readonly hit: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly spawnX: number;
  readonly spawnY: number;
}
