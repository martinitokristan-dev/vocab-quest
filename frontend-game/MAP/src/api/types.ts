export type KingdomId = 1 | 2 | 3;
export type NodeStatus = 'locked' | 'unlocked' | 'current' | 'completed';

export interface NodeRecord {
  readonly kingdom: KingdomId;
  readonly level: number; // 1..45, per kingdom
  readonly globalIndex: number; // (kingdom-1)*45 + level, 1..135
  readonly x: number; // world units, node centre
  readonly y: number; // world units, from world top
  readonly blockH: number; // standing block height (avatar offset), 54..66
  readonly segment: number; // global segment index 0..20
  /** Marks the node reached by one of the two reference bridge hops (spacing may exceed 200). */
  readonly hop?: 'bridge';
  readonly station?: string;
}

export interface NodeState extends NodeRecord {
  status: NodeStatus;
  available: boolean; // level <= total_questions for its kingdom
  stars: 0 | 1 | 2 | 3;
}

export interface Progress {
  currentKingdom: KingdomId;
  currentLevel: number;
  completed: Array<{ kingdom: KingdomId; level: number; stars: number }>;
}

/** Same shape as StarHistoryItem in src/game2d.ts so main.ts data passes through unchanged. */
export interface StarHistoryItem {
  questionId?: number;
  mapId?: number;
  orderIndex?: number;
  questionIndex?: number;
  stars: number;
}

export interface MapFlowOptions {
  activeMapId: number;
  enteredKingdomIds: number[];
  mapPhase: string;
}

export interface MapSoundHooks {
  hover?(): void;
  click?(): void;
  wrong?(): void;
  step?(): void;
  padlockUnlock?(): void;
  whoosh?(): void;
  success?(): void;
  gateOpen?(): void;
}

export interface MapEvents {
  levelClick(kingdom: KingdomId, level: number): void;
  kingdomClick(id: number): void;
  lockedKingdomClick(): void;
  cameraArrived(): void;
  walkArrived(): void;
}

/** Methods the game uses; Game2DMapRenderer satisfies this structurally (see tests/types.test-d.ts). */
export interface MapRenderer {
  updateProgress(activeMapId: number, qIndex: number, starsHistory?: StarHistoryItem[]): void;
  setMapFlowOptions(o: MapFlowOptions): void;
  isInputLocked(): boolean;
  playKingdomEntryAnimation(kingdomId: number): Promise<void>;
  animatePadlockUnlock(kingdomId: number): Promise<void>;
  clearEntryFade(): void;
  playPortalEntryAnimation?(targetPos?: { x: number; y: number }): Promise<void>;
  clearPortalOverlay?(): void;
  centerOnLocation(x: number, y: number): void;
  centerOnKingdom(id: number): void;
  centerOnActiveLocation(): void;
  centerOnLandmark?(): void;
  centerOnPeak?(): void;
  animateWalkingPath(waypoints: Array<{ x: number; y: number }>, bubbleText?: string, onArrival?: () => void): void;
  onStepClick(cb: (mapId: number, questionIndex: number) => void): void;
  onKingdomClick(cb: (kingdomId: number) => void): void;
  onLockedKingdomClick(cb: () => void): void;
  remount(container: HTMLElement): void;
  destroy(): void;
}
