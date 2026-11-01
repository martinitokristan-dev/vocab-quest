import type { KingdomId, NodeRecord, NodeState, NodeStatus, Progress } from '../api/types';
import { NODES } from '../../data/nodes';
import { LEVELS_PER_KINGDOM } from '../../data/world';

export type Availability = Partial<Record<KingdomId, number>>;

export function globalLevelNumber(k: number, q: number): number {
  if (!Number.isInteger(k) || k < 1 || k > 3) throw new RangeError(`kingdom ${k} out of range`);
  if (!Number.isInteger(q) || q < 1 || q > LEVELS_PER_KINGDOM) throw new RangeError(`level ${q} out of range`);
  return (k - 1) * LEVELS_PER_KINGDOM + q;
}

function isAvailable(n: NodeRecord, availability: Availability): boolean {
  return n.level <= (availability[n.kingdom] ?? LEVELS_PER_KINGDOM);
}

/**
 * Single status rule (DESIGN 3.5). If the current level itself is unavailable, no node is `current`
 * (see `avatarNode` for where the avatar stands instead) and a warning is logged.
 */
export function deriveStatuses(
  progress: Progress,
  availability: Availability = {},
  nodes: readonly NodeRecord[] = NODES,
): NodeState[] {
  const currentGlobal = globalLevelNumber(progress.currentKingdom, progress.currentLevel);
  const history = new Map<number, number>();
  for (const c of progress.completed) {
    if (Number.isInteger(c.level) && c.level >= 1 && c.level <= LEVELS_PER_KINGDOM) {
      history.set((c.kingdom - 1) * LEVELS_PER_KINGDOM + c.level, c.stars);
    }
  }
  const currentNode = nodes.find((n) => n.globalIndex === currentGlobal);
  if (currentNode && !isAvailable(currentNode, availability)) {
    console.warn(`Current level ${progress.currentLevel} of kingdom ${progress.currentKingdom} is unavailable`);
  }
  return nodes.map((n) => {
    const available = isAvailable(n, availability);
    let status: NodeStatus;
    if (!available) status = 'locked';
    else if (n.globalIndex < currentGlobal) status = 'completed';
    else if (n.globalIndex === currentGlobal) status = 'current';
    else status = 'locked';
    let stars: 0 | 1 | 2 | 3 = 0;
    if (status === 'completed') {
      const s = history.get(n.globalIndex);
      stars = (s === undefined ? 3 : Math.min(3, Math.max(1, Math.round(s)))) as 1 | 2 | 3;
    }
    return { ...n, status, available, stars };
  });
}

/**
 * Status of one level inside a kingdom (ModernWorldMap). Only levels before the current one are
 * completed and only the current one is playable; every later level is locked.
 */
export function levelStatus(level: number, currentLevel: number, entered: boolean): NodeStatus {
  if (!entered) return 'locked';
  if (level < currentLevel) return 'completed';
  if (level === currentLevel) return 'current';
  return 'locked';
}

/** Node the avatar stands on: the current node, or the last available node of the current kingdom. */
export function avatarNode(
  progress: Progress,
  availability: Availability = {},
  nodes: readonly NodeRecord[] = NODES,
): NodeRecord | null {
  const currentGlobal = globalLevelNumber(progress.currentKingdom, progress.currentLevel);
  const cur = nodes.find((n) => n.globalIndex === currentGlobal);
  if (cur && isAvailable(cur, availability)) return cur;
  const inKingdom = nodes.filter((n) => n.kingdom === progress.currentKingdom && isAvailable(n, availability));
  return inKingdom.length ? inKingdom[inKingdom.length - 1] : null;
}
