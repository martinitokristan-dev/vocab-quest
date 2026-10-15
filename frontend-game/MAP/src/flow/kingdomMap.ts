import type { KingdomId } from '../api/types';

export interface MapLike {
  id: number;
  order_index?: number;
}

function isKingdom(v: unknown): v is KingdomId {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 3;
}

/** Kingdom number of a backend map: order_index, falling back to map.id. */
export function kingdomIdOf(map: MapLike): number {
  return isKingdom(map.order_index) ? map.order_index : map.id;
}

/** DB map id -> kingdom. Filled by rememberMap on every question response. */
export const kingdomByMapId: Map<number, KingdomId> = new Map();

const warned = new Set<number>();

export function rememberMap(map: MapLike): void {
  const k = kingdomIdOf(map);
  if (isKingdom(k)) kingdomByMapId.set(map.id, k);
}

/** Kingdom for a history map_id; unknown ids fall back to the id when it is 1..3, else null (warned once). */
export function kingdomForMapId(mapId: number): KingdomId | null {
  const known = kingdomByMapId.get(mapId);
  if (known) return known;
  if (isKingdom(mapId)) return mapId;
  if (!warned.has(mapId)) {
    warned.add(mapId);
    console.warn(`Unknown map_id ${mapId}; history entry skipped`);
  }
  return null;
}
