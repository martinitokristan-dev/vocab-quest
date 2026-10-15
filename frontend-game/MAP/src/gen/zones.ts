import { ENTRANCES } from '../../data/gates';
import { KINGDOM_H, WORLD_W, kingdomBottomY } from '../../data/world';
import { hash01 } from '../core/rng';

/**
 * Kingdom seams (DESIGN 6.4). Boundary b sits at the top of kingdom b (b = 3 is the top of the world):
 * the lower kingdom's last 330 units are its sky gate zone, the upper kingdom's first 270 units are the
 * cloud-stairs arrival zone, with a stepped peninsula carrying the entrance arch. Everything between the
 * two land edges is sky. Pure functions of the grid cell, so neighbouring segments agree exactly.
 */
export type Boundary = 1 | 2 | 3;
export const BOUNDARIES: readonly Boundary[] = [1, 2, 3];
/** Height of the sky gate zone below the boundary (u > 5879). */
export const SKY_BAND = 330;
/** Land of the next kingdom ends this far above its bottom edge (peninsula excluded). */
export const ISLAND_DROP = 270;
/** Terrain flattens to one level over this distance from a land edge. */
export const TAPER = 130;

const CW = 18;
const CD = 10;
const GRID_COLS_FOR_ZONES = Math.ceil(WORLD_W / CW);

export function boundaryY(b: Boundary): number {
  return kingdomBottomY(b) - KINGDOM_H;
}

function jag(gi: number, b: number, side: number): number {
  return (Math.floor(hash01(gi, b, side) * 3) - 1) * 10;
}

/** World x of the entrance arch of the kingdom above boundary b, or undefined at the top of the world. */
export function arrivalX(b: Boundary): number | undefined {
  const e = ENTRANCES.find((en) => en.kingdom === b + 1);
  return e ? e.hit.x + e.hit.w / 2 : undefined;
}

function bump(b: Boundary, x: number): number {
  const ax = arrivalX(b);
  if (ax === undefined) return 0;
  const dx = Math.abs(x - ax);
  return dx < 162 ? 210 : dx < 198 ? 150 : dx < 234 ? 90 : dx < 270 ? 40 : 0;
}

const lowerCache = new Map<number, number[]>();
const upperCache = new Map<number, number[]>();

/** World y of the lower kingdom's horizon at column gi (land is at and below this y). */
export function lowerEdge(b: Boundary, gi: number): number {
  let t = lowerCache.get(b);
  if (!t) {
    t = [];
    for (let i = 0; i < GRID_COLS_FOR_ZONES; i++) t.push(boundaryY(b) + SKY_BAND + jag(i, b, 1));
    lowerCache.set(b, t);
  }
  return t[Math.min(Math.max(gi, 0), GRID_COLS_FOR_ZONES - 1)];
}

/** World y of the upper kingdom's island edge at column gi (land is at and above this y); -Infinity at the world top. */
export function upperEdge(b: Boundary, gi: number): number {
  if (b === 3) return -Infinity;
  let t = upperCache.get(b);
  if (!t) {
    t = [];
    for (let i = 0; i < GRID_COLS_FOR_ZONES; i++) t.push(boundaryY(b) - ISLAND_DROP + jag(i, b, 2) + bump(b, i * CW + CW / 2));
    upperCache.set(b, t);
  }
  return t[Math.min(Math.max(gi, 0), GRID_COLS_FOR_ZONES - 1)];
}

/** Cheap rejection: true when world y is anywhere near a seam. */
export function nearSeam(y: number): boolean {
  for (const b of BOUNDARIES) {
    const Y = boundaryY(b);
    if (y > Y - ISLAND_DROP - TAPER - 20 && y < Y + SKY_BAND + TAPER + 20) return true;
  }
  return false;
}

/** True when the cell centre lies in the sky between two land edges. */
export function isSkyCell(gi: number, gj: number): boolean {
  const y = gj * CD + CD / 2;
  if (!nearSeam(y)) return false;
  for (const b of BOUNDARIES) {
    if (y < lowerEdge(b, gi) && y > upperEdge(b, gi)) return true;
  }
  return false;
}

/** Distance to the nearest land edge for land cells within TAPER of one (Infinity otherwise). */
export function edgeDistance(gi: number, gj: number): number {
  const y = gj * CD + CD / 2;
  if (!nearSeam(y)) return Infinity;
  let best = Infinity;
  for (const b of BOUNDARIES) {
    const lo = lowerEdge(b, gi);
    if (y >= lo && y - lo < TAPER) best = Math.min(best, y - lo);
    const up = upperEdge(b, gi);
    if (y <= up && up - y < TAPER) best = Math.min(best, up - y);
  }
  return best;
}

/** World-space sky test for objects. */
export function isSkyAt(x: number, y: number): boolean {
  return isSkyCell(Math.floor(x / CW), Math.floor(y / CD));
}
