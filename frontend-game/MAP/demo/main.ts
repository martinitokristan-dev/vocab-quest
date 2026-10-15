import { NODES } from '../data/nodes';
import { MODELS } from '../data/models';
import { ModernWorldMap } from '../src/ModernWorldMap';
import type { KingdomId } from '../src/api/types';
import { validateNodes } from '../src/core/layout';
import type { QualityTier } from '../src/core/quality';
import { buildTransitionPlan, computeWalkPath, getStepRef } from '../src/flow/flowAdapter';

/**
 * Demo shell: full-window map, stats panel, controls and deep-link params
 *   ?k=1&l=20       current kingdom / level (camera jumps there)
 *   ?active=2       highest unlocked kingdom (default: k)
 *   ?quality=low    high | medium | low | auto
 *   ?reduced=1      reduced motion on
 *   ?compare=1      1774x887 reference compare skeleton with an overlay slider (dev only)
 */
const params = new URLSearchParams(location.search);
const k0 = Math.min(3, Math.max(1, Number(params.get('k')) || 1)) as KingdomId;
const l0 = Math.min(45, Math.max(1, Number(params.get('l')) || 1));
const active0 = Math.min(3, Math.max(k0, Number(params.get('active')) || k0));
const quality = (params.get('quality') ?? 'auto') as QualityTier | 'auto';
const compare = params.get('compare') === '1';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const stage = $('stage');
const statsEl = $('stats');
if (compare) document.body.classList.add('compare');

// ---- node data validation (shows a panel instead of a blank page)
try {
  const problems = validateNodes(NODES);
  if (problems.length) showError(`Node validation failed:\n${problems.slice(0, 8).join('\n')}`);
} catch (e) {
  showError(`validateNodes threw: ${e instanceof Error ? e.message : String(e)}`);
}

function showError(text: string): void {
  const el = $('errors');
  el.textContent = text;
  el.hidden = false;
}

interface DemoState {
  k: KingdomId;
  l: number;
  stars: Map<number, number>;
  avail: number;
  active: number;
  entered: number[];
  phase: string;
}

const enteredParam = params.get('entered');
const initialEntered = enteredParam !== null
  ? (enteredParam === '0' || enteredParam === '' ? [] : enteredParam.split(',').map(Number))
  : (k0 === 1 && l0 === 1 ? [] : [1, 2, 3].filter((k) => k <= k0));

const state: DemoState = {
  k: k0,
  l: l0,
  stars: new Map(),
  avail: 45,
  active: active0,
  entered: initialEntered,
  phase: initialEntered.includes(k0) ? 'kingdom_active' : 'awaiting_kingdom_click',
};

const map = new ModernWorldMap($('stage'), '/assets/explorer_boy.png', k0, l0, undefined, undefined, undefined, {
  activeMapId: state.active,
  enteredKingdomIds: state.entered.slice(),
  mapPhase: state.phase,
});
if (quality !== 'auto') map.setQuality(quality);
if (params.get('reduced') === '1') {
  map.setReducedMotion(true);
  ($('chk-reduced') as HTMLInputElement).checked = true;
}
map.jumpToNode(k0, l0);

const globalOf = (k: number, l: number): number => (k - 1) * 45 + l;

function apply(): void {
  map.setAvailability({ 1: state.avail, 2: state.avail, 3: state.avail });
  map.setMapFlowOptions({ activeMapId: state.active, enteredKingdomIds: state.entered.slice(), mapPhase: state.phase });
  const completed: Array<{ kingdom: KingdomId; level: number; stars: number }> = [];
  for (const [g, s] of state.stars) completed.push({ kingdom: (Math.floor((g - 1) / 45) + 1) as KingdomId, level: ((g - 1) % 45) + 1, stars: s });
  map.setProgress({ currentKingdom: state.k, currentLevel: state.l, completedLevels: completed });
  readout();
}

let lastEvent = 'none';
function readout(): void {
  $('readout').textContent = `Kingdom ${state.k}, level ${state.l} (global ${globalOf(state.k, state.l)})\nunlocked ${state.active}, entered ${state.entered.join(',')}\nlast event: ${lastEvent}`;
  $('readout').dataset.k = String(state.k);
  $('readout').dataset.l = String(state.l);
}

function jump(k: KingdomId, l: number): void {
  if (map.isInputLocked()) return;
  state.k = k;
  state.l = Math.min(45, Math.max(1, l));
  state.active = Math.max(state.active, k);
  for (let i = 1; i <= k; i++) if (!state.entered.includes(i)) state.entered.push(i);
  state.phase = 'kingdom_active';
  apply();
}

/** Same flow as production: walk to the next level (or the top gate), then update progress. */
function completeLevel(): void {
  if (map.isInputLocked()) return;
  const k = state.k;
  const l = state.l;
  const last = Math.min(45, state.avail);
  state.stars.set(globalOf(k, l), 1 + Math.floor(Math.random() * 3));
  const from = getStepRef(k, Math.min(l, 45));
  if (!from) return;
  if (l < last) {
    const to = getStepRef(k, l + 1);
    if (!to) return;
    map.animateWalkingPath(computeWalkPath(from, to), 'QUEST READY!', () => {
      state.l = l + 1;
      apply();
    });
  } else if (k < 3) {
    const plan = buildTransitionPlan(k, l, k + 1);
    if (!plan) return;
    map.animateWalkingPath(plan.path, 'NEW KINGDOM UNLOCKED!', () => {
      state.k = (k + 1) as KingdomId;
      state.l = 1;
      state.active = k + 1;
      state.phase = 'awaiting_kingdom_click';
      apply();
    });
  } else {
    map.animateWalkingPath(computeWalkPath(from, from), 'KINGDOM COMPLETE!', () => {
      lastEvent = 'finale done';
      readout();
    });
  }
  readout();
}

function reset(): void {
  if (map.isInputLocked()) return;
  state.k = 1;
  state.l = 1;
  state.stars.clear();
  state.active = 1;
  state.entered = [];
  state.phase = 'awaiting_kingdom_click';
  apply();
  map.recenter();
}

map.on('levelClick', (k, l) => {
  lastEvent = `levelClick ${k}/${l}`;
  readout();
});
map.on('lockedKingdomClick', () => {
  lastEvent = 'lockedKingdomClick';
  readout();
});
map.on('kingdomClick', (id) => {
  lastEvent = `kingdomClick ${id}`;
  readout();
  void (async () => {
    await map.playKingdomEntryAnimation(id);
    if (!state.entered.includes(id)) state.entered.push(id);
    state.phase = 'kingdom_active';
    apply();
    map.clearEntryFade();
    map.recenter();
  })();
});

// ---- controls
const pickK = $<HTMLSelectElement>('pick-k');
const pickL = $<HTMLInputElement>('pick-l');
pickK.value = String(k0);
pickL.value = String(l0);

$('btn-k1').addEventListener('click', () => {
  pickK.value = '1';
  pickL.value = '1';
  jump(1, 1);
  map.centerOnLandmark?.();
});

$('btn-k2').addEventListener('click', () => {
  pickK.value = '2';
  pickL.value = '1';
  jump(2, 1);
  map.centerOnLandmark?.();
});

$('btn-k3').addEventListener('click', () => {
  pickK.value = '3';
  pickL.value = '1';
  jump(3, 1);
  map.centerOnLandmark?.();
});

$('btn-view-landmark').addEventListener('click', () => {
  map.centerOnLandmark?.();
});

$('btn-view-peak').addEventListener('click', () => {
  map.centerOnPeak?.();
});

$('btn-toggle-lock').addEventListener('click', () => {
  const k = state.k;
  const idx = state.entered.indexOf(k);
  if (idx >= 0) {
    state.entered.splice(idx, 1);
    state.phase = 'awaiting_kingdom_click';
  } else {
    state.entered.push(k);
    state.phase = 'kingdom_active';
  }
  apply();
  map.centerOnLandmark?.();
});

$('btn-unlock-all').addEventListener('click', () => {
  state.active = 3;
  state.entered = [1, 2, 3];
  state.avail = 45;
  state.phase = 'kingdom_active';
  for (let k = 1; k <= 3; k++) {
    for (let l = 1; l <= 45; l++) {
      state.stars.set(globalOf(k, l), 3);
    }
  }
  apply();
  readout();
});

$('btn-jump').addEventListener('click', () => jump(Number(pickK.value) as KingdomId, Number(pickL.value) || 1));
$('btn-complete').addEventListener('click', completeLevel);
$('btn-reset').addEventListener('click', reset);
$('btn-recenter').addEventListener('click', () => map.recenter());
const avail = $<HTMLInputElement>('avail');
avail.addEventListener('input', () => {
  state.avail = Number(avail.value);
  $('avail-out').textContent = avail.value;
  apply();
});
const qualitySel = $<HTMLSelectElement>('quality');
qualitySel.value = quality;
qualitySel.addEventListener('change', () => map.setQuality(qualitySel.value as QualityTier | 'auto'));
$<HTMLSelectElement>('avatar').addEventListener('change', (e) => map.setAvatarImage((e.target as HTMLSelectElement).value));
$<HTMLInputElement>('chk-reduced').addEventListener('change', (e) => map.setReducedMotion((e.target as HTMLInputElement).checked));
$<HTMLInputElement>('chk-debug').addEventListener('change', (e) => map.setDebug({ nodes: (e.target as HTMLInputElement).checked, stats: (e.target as HTMLInputElement).checked }));
if (window.innerWidth < 700) ($('controls') as HTMLDetailsElement).open = false;
apply();

if (compare) {
  const bar = $('compare-bar');
  bar.hidden = false;
  const img = document.createElement('img');
  img.id = 'reference-overlay';
  img.alt = '';
  // The reference image is only ever loaded by the demo compare mode.
  img.src = new URL('../reference/vocab-quest-map.png', import.meta.url).href;
  stage.appendChild(img);
  const slider = $<HTMLInputElement>('compare-opacity');
  slider.addEventListener('input', () => {
    img.style.opacity = String(Number(slider.value) / 100);
  });
  map.setCompareMode(true);
}

if (params.get('atlas') === '1') {
  // QA sprite atlas: every authored model (with decals) on its own canvas, exported by tools/export-atlas.mjs.
  const wrap = document.createElement('div');
  wrap.id = 'atlas';
  document.body.appendChild(wrap);
  const sprites = map.getSprites();
  for (const key of Object.keys(MODELS)) {
    const src = sprites.sprite(key, 1);
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.id = `atlas-${key}`;
    c.title = key;
    c.getContext('2d')?.drawImage(src as CanvasImageSource, 0, 0);
    const cell = document.createElement('figure');
    const cap = document.createElement('figcaption');
    cap.textContent = key;
    cell.append(c, cap);
    wrap.appendChild(cell);
  }
}

const timer = window.setInterval(() => {
  const s = map.getStats();
  statsEl.textContent = `${s.fps.toFixed(0)} fps | work ${s.drawMs.toFixed(2)} ms | baked ${s.bakedSegments} seg ${s.bakedMB.toFixed(0)} MB | ${s.quality}`;
}, 500);

window.addEventListener('beforeunload', () => {
  window.clearInterval(timer);
  map.destroy();
});

// Handles for the perf gate and screenshot tools.
const w = window as unknown as { __map: ModernWorldMap; __demo: { state: DemoState; jump: typeof jump; complete: typeof completeLevel; reset: typeof reset } };
w.__map = map;
w.__demo = { state, jump, complete: completeLevel, reset };
