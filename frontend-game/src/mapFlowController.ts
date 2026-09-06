export type MapInteractionPhase =
  | 'awaiting_kingdom_click'
  | 'kingdom_enter_anim'
  | 'kingdom_active'
  | 'walking_to_question'
  | 'star_celebration';

export interface StepRef {
  mapId: number;
  questionIndex: number;
  x: number;
  y: number;
}

export interface PendingMapAction {
  type: 'walk_to_current' | 'kingdom_transition';
  fromStep: StepRef;
  toStep: StepRef;
  path: Array<{ x: number; y: number }>;
  bubbleText: string;
  thenScreen: 'question' | 'dialogue' | 'completed' | 'await_kingdom';
  thenDialogueKingdomId?: number;
}

export interface MapFlowOptions {
  activeMapId: number;
  enteredKingdomIds: number[];
  mapPhase: MapInteractionPhase;
}

const MAP_OFFSETS: Record<number, number> = { 1: 0, 2: 5, 3: 10 };

/** Hardcoded step coordinates aligned with game2d.ts station arrays */
export const STEP_COORDS: Record<number, Array<{ x: number; y: number; blockH: number }>> = {
  1: [
    { x: 140, y: 780, blockH: 66 },
    { x: 287, y: 744, blockH: 64 },
    { x: 411, y: 707, blockH: 62 },
    { x: 515, y: 662, blockH: 60 },
    { x: 616, y: 615, blockH: 58 },
  ],
  2: [
    { x: 720, y: 537, blockH: 58 },
    { x: 816, y: 558, blockH: 58 },
    { x: 932, y: 566, blockH: 60 },
    { x: 1043, y: 560, blockH: 58 },
    { x: 1155, y: 536, blockH: 58 },
  ],
  3: [
    { x: 1265, y: 366, blockH: 54 },
    { x: 1340, y: 405, blockH: 54 },
    { x: 1430, y: 440, blockH: 56 },
    { x: 1526, y: 465, blockH: 56 },
    { x: 1638, y: 484, blockH: 58 },
  ],
};

export const KINGDOM_TRANSITION_PATHS: Record<string, Array<{ x: number; y: number }>> = {
  '1->2': [
    { x: 616, y: 600 },
    { x: 650, y: 575 },
    { x: 685, y: 550 },
    { x: 720, y: 527 },
  ],
  '2->3': [
    { x: 1155, y: 526 },
    { x: 1195, y: 460 },
    { x: 1230, y: 405 },
    { x: 1265, y: 356 },
  ],
};

export function globalLevelNumber(mapId: number, questionIndex: number): number {
  return (MAP_OFFSETS[mapId] ?? 0) + questionIndex;
}

export function getStepRef(mapId: number, questionIndex: number): StepRef | null {
  const coords = STEP_COORDS[mapId]?.[questionIndex - 1];
  if (!coords) return null;
  return {
    mapId,
    questionIndex,
    x: coords.x,
    y: coords.y - coords.blockH / 2 + 10,
  };
}

export function isKingdomProgressUnlocked(kingdomId: number, activeMapId: number): boolean {
  return kingdomId <= activeMapId;
}

export function isKingdomEntered(kingdomId: number, enteredKingdomIds: number[]): boolean {
  return enteredKingdomIds.includes(kingdomId);
}

export function computeWalkPath(from: StepRef, to: StepRef): Array<{ x: number; y: number }> {
  if (from.mapId === to.mapId) {
    return [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }
  const key = `${from.mapId}->${to.mapId}`;
  const transitionPath = KINGDOM_TRANSITION_PATHS[key];
  if (transitionPath) {
    return [{ x: from.x, y: from.y }, ...transitionPath];
  }
  return [
    { x: from.x, y: from.y },
    { x: to.x, y: to.y },
  ];
}

/** Walk path after finishing the last question of a kingdom — ends near the next kingdom. */
export function buildKingdomTransitionAction(
  fromMapId: number,
  fromQuestionIndex: number,
  toMapId: number
): PendingMapAction | null {
  const fromStep = getStepRef(fromMapId, fromQuestionIndex);
  const toStep = getStepRef(toMapId, 1);
  if (!fromStep || !toStep) return null;

  return {
    type: 'kingdom_transition',
    fromStep,
    toStep,
    path: computeWalkPath(fromStep, toStep),
    bubbleText: 'NEW KINGDOM UNLOCKED!',
    thenScreen: 'await_kingdom',
  };
}

export function inferEnteredKingdomsFromHistory(
  history: Array<{ mapId?: number }>,
  activeMapId: number
): number[] {
  const entered = new Set<number>();
  for (const h of history) {
    if (h.mapId) entered.add(h.mapId);
  }
  for (let id = 1; id < activeMapId; id++) {
    entered.add(id);
  }
  return Array.from(entered).sort((a, b) => a - b);
}

// ── localStorage persistence (keyed by PIN) ──

export function isGlobalIntroSeen(pin: string): boolean {
  return localStorage.getItem(`seen_global_intro_${pin}`) === '1';
}

export function markGlobalIntroSeen(pin: string): void {
  localStorage.setItem(`seen_global_intro_${pin}`, '1');
}

export function isKingdomEnteredStored(pin: string, kingdomId: number): boolean {
  return localStorage.getItem(`entered_kingdom_${pin}_k${kingdomId}`) === '1';
}

export function markKingdomEnteredStored(pin: string, kingdomId: number): void {
  localStorage.setItem(`entered_kingdom_${pin}_k${kingdomId}`, '1');
}

/** Wipe all client-side map/kingdom progress for a room PIN (teacher reset / fresh join). */
export function clearMapFlowProgressForPin(pin: string): void {
  if (!pin) return;
  localStorage.removeItem(`seen_global_intro_${pin}`);
  for (let id = 1; id <= 3; id++) {
    localStorage.removeItem(`entered_kingdom_${pin}_k${id}`);
    localStorage.removeItem(`seen_dialogue_${pin}_k${id}`);
  }
}

export function getFreshMapFlowState(): {
  enteredKingdomIds: number[];
  mapPhase: MapInteractionPhase;
  hasSeenGlobalIntro: boolean;
  seenKingdomDialogues: number[];
  pendingMapAction: null;
  lastCompletedStep: null;
} {
  return {
    enteredKingdomIds: [],
    mapPhase: 'awaiting_kingdom_click',
    hasSeenGlobalIntro: false,
    seenKingdomDialogues: [],
    pendingMapAction: null,
    lastCompletedStep: null,
  };
}

export function hydrateEnteredKingdomIds(
  pin: string,
  history: Array<{ mapId?: number }>,
  activeMapId: number
): number[] {
  const fromHistory = inferEnteredKingdomsFromHistory(history, activeMapId);
  const merged = new Set(fromHistory);
  for (let id = 1; id <= 3; id++) {
    if (isKingdomEnteredStored(pin, id)) merged.add(id);
  }
  return Array.from(merged).sort((a, b) => a - b);
}

export function computeInitialMapPhase(
  enteredKingdomIds: number[],
  activeMapId: number,
  hasGlobalIntroSeen: boolean
): MapInteractionPhase {
  if (!hasGlobalIntroSeen) return 'awaiting_kingdom_click';
  if (!isKingdomEntered(activeMapId, enteredKingdomIds)) return 'awaiting_kingdom_click';
  return 'kingdom_active';
}
