import { ENTRANCES, GATES } from '../data/gates';
import { NODES } from '../data/nodes';
import { KINGDOMS, LEVELS_PER_KINGDOM, SEGMENT_COUNT, WORLD_H, WORLD_W } from '../data/world';
import type {
  KingdomId,
  MapEvents,
  MapFlowOptions,
  MapRenderer,
  MapSoundHooks,
  NodeState,
  Progress,
  StarHistoryItem,
} from './api/types';
import {
  KINGDOM_TRAVEL_MS,
  clampToWorld,
  defaultZoom,
  followTarget,
  glideAt,
  glideDuration,
  shouldWarp,
  smoothDamp,
  zoomAround,
  type Camera,
} from './core/camera';
import { nearestNode } from './core/layout';
import { clamp } from './core/math';
import { detectQualityFromNavigator, type QualityTier } from './core/quality';
import { avatarNode, deriveStatuses, globalLevelNumber, type Availability } from './core/status';
import { A11y } from './hud/a11y';
import { Banner } from './hud/banner';
import { Hud } from './hud/hud';
import { KeyboardInput } from './input/keyboard';
import { PointerInput } from './input/pointer';
import { buildSegmentScene } from './gen/segmentScene';
import { bakeScale, maxBaked } from './render/bakeBudget';
import { BakeQueue } from './render/bakeQueue';
import { drawSegments, setWorldTransform, updateView, visibleRange, type View } from './render/frame';
import { drawFade, drawVignette } from './render/layers/overlays';
import { drawSky } from './render/layers/sky';
import { makeAvatar, type AvatarDraw } from './render/layers/avatar';
import { driftClouds, driftX, cloudSpriteSize } from './render/layers/clouds';
import { drawAmbient } from './render/layers/effects';
import { Confetti, drawGateDoors, drawMist, drawPadlock, padlockAnimAt } from './render/layers/gate';
import type { NodeDraw } from './render/layers/nodes';
import { drawObjects, kingdomAtY, sortKey, type Drawable } from './render/layers/objects';
import { WaterFx } from './render/layers/water';
import { measureLandmarkBoxes, type Box } from './render/landmarkBoxes';
import { Sprites } from './render/sprites';

type EventName = keyof MapEvents;
type Listener = (...args: never[]) => void;

export interface MapStats {
  fps: number;
  drawMs: number;
  bakedSegments: number;
  bakedMB: number;
  quality: string;
}

interface Warp {
  t0: number;
  stage: 0 | 1;
  target: Camera;
  outMs: number;
  inMs: number;
  done: (() => void) | null;
  /** Runs at the moment the screen is fully covered (the jump). */
  mid: (() => void) | null;
}

interface Glide {
  from: Camera;
  to: Camera;
  t0: number;
  dur: number;
  done: (() => void) | null;
}

interface Walk {
  pts: Array<{ x: number; y: number }>;
  cum: number[];
  total: number;
  dist: number;
  speed: number;
  onArrival: (() => void) | null;
  token: number;
  lastStepDist: number;
  lastStepTime: number;
  lastDustDist: number;
  /** Indices i where pts[i - 1] -> pts[i] is a teleport (walkPlan warp), ascending. */
  jumps: number[];
  nextJump: number;
  /** True while a jump warp is running. */
  waiting: boolean;
  bubble: string;
}

interface GateAnim {
  gate: (typeof GATES)[number];
  t0: number;
  dur: number;
  /** 0..1 progress, set each frame. */
  p: number;
}

/** Segments longer than this in an animated polyline are teleports (DESIGN 5.4). */
const JUMP_MIN = 400;

const FALLBACK_W = 1366;
const FALLBACK_H = 768;
const STEP_EVERY = 24;
const STEP_MIN_INTERVAL = 1 / 6;
const MB = 1024 * 1024;

function reducedQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
}

export class VoxelWorldMap implements MapRenderer {
  private container: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: Hud;
  private readonly a11y: A11y;
  private readonly banner: Banner;
  private readonly water = new WaterFx();
  private readonly confetti = new Confetti();
  private gateAnim: GateAnim | null = null;
  private padlockAnims = new Map<number, number>();
  private readonly openedPadlocks = new Set<number>();
  private hoverEntrance = 0;
  private focusNodeIdx = -1;
  private lastA11yUpdate = 0;
  private lastAnnouncedGlobal = -1;
  private dprQuery: MediaQueryList | null = null;
  private onDprChange: (() => void) | null = null;
  private readonly pointer: PointerInput;
  private readonly keyboard: KeyboardInput;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private readonly queue: BakeQueue;
  private readonly sprites: Sprites;
  private readonly view: View;
  private readonly hooks: MapSoundHooks;
  private readonly avatar: AvatarDraw;
  private readonly nodeDraws: NodeDraw[];
  private readonly nodesBySeg: NodeDraw[][] = [];
  private readonly items: Drawable[] = [];

  private vw = FALLBACK_W;
  private vh = FALLBACK_H;
  private dpr = 1;
  private cam: Camera = { cx: WORLD_W / 2, cy: WORLD_H - 400, zoom: 0.77 };
  private glide: Glide | null = null;
  private warp: Warp | null = null;
  private walk: Walk | null = null;
  private walkToken = 0;
  private following = false;
  private locked = false;
  private entryFade = 0;
  private camVy = 0;

  private progress: Progress;
  private availability: Availability = {};
  private flow: MapFlowOptions;
  private states: NodeState[] = [];
  private hovered: NodeDraw | null = null;
  private hasProgress = false;

  private qualityMode: QualityTier | 'auto';
  private tier: QualityTier;
  private reducedSetting: boolean | 'auto' = 'auto';
  private readonly reducedMq: MediaQueryList | null;
  private reduced = false;
  private time = 0;
  private governorRaised = false;
  private governorSince = 0;
  private governorCooldown = typeof performance !== 'undefined' ? performance.now() + 8000 : 0;

  private raf = 0;
  private lastNow = 0;
  private running = false;
  private hiddenDoc = false;
  private offscreen = false;
  private destroyed = false;
  private sizeDirty = true;
  private lastBakeKey = -1;
  private lastBakedCount = -1;

  private emaInterval = 16.7;
  private emaWork = 1;
  private debug: { nodes?: boolean; stats?: boolean } = {};

  private readonly listeners = new Map<EventName, Set<Listener>>();
  private legacyUnsubs: Partial<Record<'step' | 'kingdom' | 'locked', () => void>> = {};
  private readonly pending = new Set<{ timer: ReturnType<typeof setTimeout>; resolve: () => void }>();
  private readonly tweens = new Set<{ t0: number; ms: number; fn: (p: number) => void; resolve: () => void }>();

  private readonly onVisibility: () => void;
  private readonly onWinResize: () => void;
  private readonly onReducedChange: () => void;
  private readonly onContextLost: (e: Event) => void;
  private readonly onLeave = (): void => {
    this.hud.hideTooltip();
    if (this.hovered) this.hovered.hover = false;
    this.hovered = null;
    this.hoverEntrance = 0;
    this.canvas.style.cursor = '';
  };

  constructor(
    container: HTMLElement,
    avatarImgUrl: string,
    activeMapId: number,
    currentQuestionIndex: number,
    _customMaps?: unknown,
    _initialPlayerPos?: unknown,
    starsHistory?: StarHistoryItem[],
    mapFlowOptions?: MapFlowOptions,
    hooks?: MapSoundHooks,
  ) {
    this.container = container;
    this.hooks = hooks ?? {};
    const kingdom = clamp(Math.round(activeMapId) || 1, 1, 3) as KingdomId;
    const level = clamp(Math.round(currentQuestionIndex) || 1, 1, LEVELS_PER_KINGDOM);
    this.progress = { currentKingdom: kingdom, currentLevel: level, completed: [] };
    this.flow = mapFlowOptions ?? {
      activeMapId: kingdom,
      enteredKingdomIds: [1, 2, 3].filter((k) => k <= kingdom),
      mapPhase: 'kingdom_active',
    };

    this.root = document.createElement('div');
    this.root.className = 'vq-map-root';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vq-world';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', 'Vocab Quest world map. Use arrow keys to look around, Home to recenter.');
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.hud = new Hud(
      () => this.recenter(),
      (k) => this.onKingdomDot(k),
    );
    this.a11y = new A11y({
      focusNode: (n) => this.onProxyFocus(n),
      activate: (n) => this.activateNode(n),
      focusChanged: (n) => {
        this.focusNodeIdx = n ? n.globalIndex - 1 : -1;
        for (const nd of this.nodeDraws) nd.focus = nd.state.globalIndex - 1 === this.focusNodeIdx;
      },
    });
    this.banner = new Banner();
    this.root.append(this.canvas, this.a11y.el, this.hud.el, this.banner.el);
    container.appendChild(this.root);

    this.reducedMq = reducedQuery();
    this.reduced = this.reducedMq?.matches ?? false;
    this.qualityMode = 'auto';
    this.tier = detectQualityFromNavigator();
    this.measure();

    this.view = {
      ctx, dpr: this.dpr, vw: this.vw, vh: this.vh, left: 0, top: 0, right: 0, bottom: 0, zoom: 1, time: 0, tier: this.tier,
    };
    const scale = bakeScale(this.vw, this.vh, window.devicePixelRatio || 1, this.tier);
    this.queue = new BakeQueue(scale);
    this.sprites = new Sprites(scale);

    const img = new Image();
    img.src = avatarImgUrl;
    this.avatar = makeAvatar(img);

    this.nodeDraws = NODES.map((n) => ({
      t: 2 as const,
      x: n.x,
      y: n.y,
      state: { ...n, status: 'locked', available: true, stars: 0 } as NodeState,
      hover: false,
      spark: false,
      focus: false,
    }));
    for (let i = 0; i < SEGMENT_COUNT; i++) this.nodesBySeg.push([]);
    for (const nd of this.nodeDraws) this.nodesBySeg[nd.state.segment].push(nd);

    this.pointer = new PointerInput(this.canvas, {
      pan: (dx, dy) => this.panScreen(dx, dy),
      zoomAt: (f, sx, sy) => this.zoomAtScreen(f, sx, sy),
      tap: (sx, sy) => this.onTap(sx, sy),
      hover: (sx, sy) => this.onHover(sx, sy),
      gestureStart: () => this.cancelGlide(),
      isLocked: () => this.isInputLocked(),
    });
    this.keyboard = new KeyboardInput(this.canvas, {
      pan: (dx, dy) => this.panWorld(dx, dy),
      panViewport: (pages) => this.panWorld(0, (pages * this.vh * 0.9) / this.cam.zoom),
      zoom: (f) => this.zoomAtScreen(f, this.vw / 2, this.vh / 2),
      recenter: () => this.recenter(),
      gestureStart: () => this.cancelGlide(),
      isLocked: () => this.isInputLocked(),
    });

    this.onVisibility = () => {
      this.hiddenDoc = document.hidden;
      this.lastNow = performance.now();
    };
    this.onWinResize = () => {
      this.sizeDirty = true;
    };
    this.onReducedChange = () => {
      if (this.reducedSetting === 'auto') {
        this.reduced = this.reducedMq?.matches ?? false;
        this.pointer.setReducedMotion(this.reduced);
      }
    };
    this.onContextLost = (e) => e.preventDefault();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onWinResize);
    this.reducedMq?.addEventListener?.('change', this.onReducedChange);
    this.canvas.addEventListener('contextlost', this.onContextLost);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.observe();
    this.watchDpr();
    this.pointer.setReducedMotion(this.reduced);
    this.hud.setUnlocked(this.flow.activeMapId);

    this.setProgressInternal(this.progress, starsHistory, true);
    this.start();
  }

  // ---------------------------------------------------------------- lifecycle

  private observe(): void {
    this.ro?.disconnect();
    this.io?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        this.sizeDirty = true;
      });
      this.ro.observe(this.container);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last) {
          this.offscreen = !last.isIntersecting;
          this.lastNow = performance.now();
        }
      });
      this.io.observe(this.root);
    }
  }

  /** Re-measures when the device pixel ratio changes (zoom, monitor move). */
  private watchDpr(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (this.dprQuery && this.onDprChange) this.dprQuery.removeEventListener?.('change', this.onDprChange);
    const q = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery = q;
    this.onDprChange = () => {
      this.sizeDirty = true;
      this.watchDpr();
    };
    q.addEventListener?.('change', this.onDprChange);
  }

  private start(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.lastNow = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  remount(container: HTMLElement): void {
    if (this.destroyed) return;
    this.container = container;
    container.appendChild(this.root);
    this.observe();
    this.sizeDirty = true;
    this.lastNow = performance.now();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.walk = null;
    this.walkToken++;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onWinResize);
    this.reducedMq?.removeEventListener?.('change', this.onReducedChange);
    this.canvas.removeEventListener('contextlost', this.onContextLost);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.ro = this.io = null;
    if (this.dprQuery && this.onDprChange) this.dprQuery.removeEventListener?.('change', this.onDprChange);
    this.dprQuery = null;
    this.onDprChange = null;
    this.pointer.destroy();
    this.keyboard.destroy();
    this.queue.destroy();
    this.sprites.destroy();
    this.water.destroy();
    this.hud.destroy();
    this.a11y.destroy();
    this.banner.destroy();
    for (const p of this.pending) {
      clearTimeout(p.timer);
      p.resolve();
    }
    this.pending.clear();
    for (const tw of this.tweens) tw.resolve();
    this.tweens.clear();
    this.listeners.clear();
    this.root.remove();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  // ---------------------------------------------------------------- size and quality

  private measure(): void {
    const w = this.container.clientWidth || FALLBACK_W;
    const h = this.container.clientHeight || FALLBACK_H;
    this.vw = w;
    this.vh = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * this.dpr);
    const bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.sizeDirty = false;
  }

  private applyScale(): void {
    const scale = bakeScale(this.vw, this.vh, window.devicePixelRatio || 1, this.tier);
    if (scale !== this.queue.bakeScale) {
      this.queue.setScale(scale);
      this.sprites.setScale(scale);
      this.lastBakeKey = -1;
    }
  }

  setQuality(q: QualityTier | 'auto'): void {
    this.qualityMode = q;
    this.tier = q === 'auto' ? detectQualityFromNavigator() : q;
    this.governorRaised = false;
    this.measure();
    this.applyScale();
  }

  setReducedMotion(v: boolean | 'auto'): void {
    this.reducedSetting = v;
    this.reduced = v === 'auto' ? (this.reducedMq?.matches ?? false) : v;
    this.pointer.setReducedMotion(this.reduced);
  }

  setDebug(o: { nodes?: boolean; stats?: boolean }): void {
    this.debug = { ...this.debug, ...o };
  }

  getStats(): MapStats {
    return {
      fps: this.emaInterval > 0 ? 1000 / this.emaInterval : 0,
      drawMs: this.emaWork,
      bakedSegments: this.queue.bakedCount,
      bakedMB: (this.queue.bakedBytes + this.sprites.bytes) / MB,
      quality: this.tier,
    };
  }

  /** True while segments are still being baked. */
  isBaking(): boolean {
    return this.queue.isPending();
  }

  // ---------------------------------------------------------------- events

  on<E extends EventName>(e: E, cb: MapEvents[E]): () => void {
    let set = this.listeners.get(e);
    if (!set) this.listeners.set(e, (set = new Set()));
    const fn = cb as unknown as Listener;
    set.add(fn);
    return () => void set.delete(fn);
  }

  private emit<E extends EventName>(e: E, ...args: Parameters<MapEvents[E]>): void {
    const set = this.listeners.get(e);
    if (!set) return;
    for (const fn of [...set]) (fn as unknown as (...a: unknown[]) => void)(...args);
  }

  onStepClick(cb: (mapId: number, questionIndex: number) => void): void {
    this.legacyUnsubs.step?.();
    this.legacyUnsubs.step = this.on('levelClick', (k, l) => cb(k, l));
  }

  onKingdomClick(cb: (kingdomId: number) => void): void {
    this.legacyUnsubs.kingdom?.();
    this.legacyUnsubs.kingdom = this.on('kingdomClick', (id) => cb(id));
  }

  onLockedKingdomClick(cb: () => void): void {
    this.legacyUnsubs.locked?.();
    this.legacyUnsubs.locked = this.on('lockedKingdomClick', () => cb());
  }

  // ---------------------------------------------------------------- progress

  updateProgress(activeMapId: number, qIndex: number, starsHistory?: StarHistoryItem[]): void {
    const k = clamp(Math.round(activeMapId) || 1, 1, 3) as KingdomId;
    const l = clamp(Math.round(qIndex) || 1, 1, LEVELS_PER_KINGDOM);
    this.setProgressInternal({ currentKingdom: k, currentLevel: l, completed: [] }, starsHistory, false);
  }

  setProgress(p: { currentKingdom: KingdomId; currentLevel: number; completedLevels: Array<{ kingdom: KingdomId; level: number; stars: number }> }): void {
    const next: Progress = {
      currentKingdom: p.currentKingdom,
      currentLevel: p.currentLevel,
      completed: p.completedLevels.slice(),
    };
    this.setProgressInternal(next, undefined, false);
  }

  setAvailability(totalQuestionsByKingdom: Partial<Record<KingdomId, number>>): void {
    this.availability = { ...totalQuestionsByKingdom };
    this.rederive();
  }

  setMapFlowOptions(o: MapFlowOptions): void {
    this.flow = { activeMapId: o.activeMapId, enteredKingdomIds: o.enteredKingdomIds.slice(), mapPhase: o.mapPhase };
    this.hud.setUnlocked(this.flow.activeMapId);
    // a padlock opened by the unlock animation returns if its kingdom is locked again (new run, reset)
    for (const k of [...this.openedPadlocks]) if (k > this.flow.activeMapId) this.openedPadlocks.delete(k);
  }

  private setProgressInternal(p: Progress, history: StarHistoryItem[] | undefined, initial: boolean): void {
    const cur = globalLevelNumber(p.currentKingdom, p.currentLevel);
    const stars = new Map<number, number>();
    for (const h of history ?? []) {
      const k = h.orderIndex ?? h.mapId;
      const q = h.questionIndex;
      if (k && q) stars.set((k - 1) * LEVELS_PER_KINGDOM + q, h.stars);
    }
    const completed = p.completed.slice();
    if (completed.length === 0) {
      for (const n of NODES) {
        if (n.globalIndex < cur) {
          completed.push({ kingdom: n.kingdom, level: n.level, stars: stars.get(n.globalIndex) ?? 3 });
        }
      }
    }
    const prevGlobal = this.hasProgress ? globalLevelNumber(this.progress.currentKingdom, this.progress.currentLevel) : -1;
    this.progress = { currentKingdom: p.currentKingdom, currentLevel: p.currentLevel, completed };
    this.hasProgress = true;
    this.rederive();
    const stand = this.standPoint();
    if (!stand) return;
    if (initial) {
      this.avatar.x = stand.x;
      this.avatar.y = stand.y;
      const t = followTarget(stand.x, stand.y, this.vh, this.cam.zoom);
      this.cam = clampToWorld({ cx: t.cx, cy: t.cy, zoom: defaultZoom(this.vw, this.vh) }, this.vw, this.vh);
      return;
    }
    if (cur === prevGlobal + 1 && (this.walk || this.locked)) return; // the flow animates this step
    if (cur !== prevGlobal) {
      // Advancing by one after the flow's own walk: the avatar already stands there, so only the node states change.
      const stayed = cur === prevGlobal + 1 && Math.hypot(this.avatar.x - stand.x, this.avatar.y - stand.y) < 6;
      if (stayed) return;
      this.avatar.x = stand.x;
      this.avatar.y = stand.y;
      this.avatar.alpha = 1;
      this.recenter();
    }
  }

  private rederive(): void {
    this.states = deriveStatuses(this.progress, this.availability);
    let cur = -1;
    for (let i = 0; i < this.nodeDraws.length; i++) {
      this.nodeDraws[i].state = this.states[i];
      if (this.states[i].status === 'current') cur = i;
    }
    for (let i = 0; i < this.nodeDraws.length; i++) {
      const nd = this.nodeDraws[i];
      nd.spark = cur >= 0 && (i === cur || (i === cur + 1 && nd.state.available));
    }
    const node = cur >= 0 ? this.states[cur] : undefined;
    const global = node?.globalIndex ?? globalLevelNumber(this.progress.currentKingdom, this.progress.currentLevel);
    this.hud.setProgress(this.progress.currentKingdom, this.progress.currentLevel, global);
    if (global !== this.lastAnnouncedGlobal) {
      this.lastAnnouncedGlobal = global;
      this.a11y.announce(`Level ${this.progress.currentLevel} of ${LEVELS_PER_KINGDOM} in ${KINGDOMS[this.progress.currentKingdom - 1].name}`, performance.now());
    }
  }

  private standPoint(): { x: number; y: number } | null {
    const n = avatarNode(this.progress, this.availability);
    return n ? { x: n.x, y: n.y - n.blockH / 2 + 10 } : null;
  }

  getNodePosition(kingdom: KingdomId, level: number): { x: number; y: number; blockH: number } | null {
    const n = NODES[(kingdom - 1) * LEVELS_PER_KINGDOM + level - 1];
    return n && n.kingdom === kingdom && n.level === level ? { x: n.x, y: n.y, blockH: n.blockH } : null;
  }

  getGlobalIndex(kingdom: KingdomId, level: number): number | null {
    return this.getNodePosition(kingdom, level) ? (kingdom - 1) * LEVELS_PER_KINGDOM + level : null;
  }

  // ---------------------------------------------------------------- camera control

  isInputLocked(): boolean {
    return this.locked || this.walk !== null;
  }

  private cancelGlide(): void {
    if (this.locked) return;
    if (this.glide) {
      this.glide = null;
    }
    this.following = false;
  }

  private panScreen(dx: number, dy: number): void {
    this.panWorld(-dx / this.cam.zoom, -dy / this.cam.zoom);
  }

  private panWorld(dx: number, dy: number): void {
    this.cam = clampToWorld({ cx: this.cam.cx + dx, cy: this.cam.cy + dy, zoom: this.cam.zoom }, this.vw, this.vh);
  }

  private zoomAtScreen(factor: number, sx: number, sy: number): void {
    this.cam = clampToWorld(zoomAround(this.cam, factor, sx, sy, this.vw, this.vh), this.vw, this.vh);
  }

  /** Glide (or warp for large distances / reduced motion) to a camera target. */
  private moveTo(target: Camera, opts: { ms?: number; maxMs?: number; done?: () => void } = {}): void {
    const t = clampToWorld(target, this.vw, this.vh);
    const dist = Math.hypot(t.cx - this.cam.cx, t.cy - this.cam.cy) / (this.vh / this.cam.zoom);
    // a replaced move still settles its promise so awaiting flows never hang
    const prevDone = this.glide?.done ?? this.warp?.done ?? null;
    this.glide = null;
    this.warp = null;
    this.following = false;
    prevDone?.();
    if (dist < 0.0005 && Math.abs(t.zoom - this.cam.zoom) < 0.001) {
      opts.done?.();
      return;
    }
    if (this.reduced || shouldWarp(dist)) {
      this.warp = {
        t0: performance.now(),
        stage: 0,
        target: t,
        outMs: this.reduced ? 80 : 120,
        inMs: this.reduced ? 70 : 220,
        done: opts.done ?? null,
        mid: null,
      };
      return;
    }
    const base = opts.ms ?? glideDuration(dist);
    this.glide = {
      from: { ...this.cam },
      to: t,
      t0: performance.now(),
      dur: opts.maxMs ? Math.min(base, opts.maxMs) : base,
      done: opts.done ?? null,
    };
  }

  /** Warp fade (cover, run `mid`, uncover) used for walkPlan jumps. */
  private startWarp(target: Camera, mid: () => void, done: () => void): void {
    this.glide = null;
    this.warp = {
      t0: performance.now(),
      stage: 0,
      target: clampToWorld(target, this.vw, this.vh),
      outMs: this.reduced ? 80 : 120,
      inMs: this.reduced ? 70 : 220,
      done,
      mid,
    };
  }

  private currentTarget(zoom: number): Camera {
    const s = this.standPoint() ?? { x: WORLD_W / 2, y: WORLD_H - 400 };
    const t = followTarget(s.x, s.y, this.vh, zoom);
    return { cx: t.cx, cy: t.cy, zoom };
  }

  /** Glides (or warps for large distances) back to the current level at the default zoom, always inside 1 s. */
  recenter(): void {
    if (this.locked || this.walk) return;
    this.cancelGlide();
    this.moveTo(this.currentTarget(defaultZoom(this.vw, this.vh)), { maxMs: 900, done: () => this.emit('cameraArrived') });
  }

  centerOnLocation(x: number, y: number): void {
    this.moveTo({ cx: x, cy: y, zoom: this.cam.zoom }, { done: () => this.emit('cameraArrived') });
  }

  centerOnKingdom(id: number): void {
    const e = ENTRANCES.find((en) => en.kingdom === id);
    if (!e) return;
    this.centerOnLocation(e.hit.x + e.hit.w / 2, e.hit.y + e.hit.h / 2);
  }

  centerOnActiveLocation(): void {
    if (this.flow.mapPhase === 'awaiting_kingdom_click') this.centerOnKingdom(this.flow.activeMapId);
    else this.recenter();
  }

  // ---------------------------------------------------------------- flow animations

  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.destroyed) return resolve();
      const entry = {
        timer: setTimeout(() => {
          this.pending.delete(entry);
          resolve();
        }, ms),
        resolve,
      };
      this.pending.add(entry);
    });
  }

  /** 1.5 s push-in on the kingdom entrance followed by a fade (the caller clears it with clearEntryFade). */
  async playKingdomEntryAnimation(kingdomId: number): Promise<void> {
    if (this.destroyed) return;
    this.locked = true;
    try {
      this.hooks.whoosh?.();
      const e = ENTRANCES.find((en) => en.kingdom === kingdomId);
      const ms = this.reduced ? 150 : 1500;
      const target: Camera = e
        ? { cx: e.hit.x + e.hit.w / 2, cy: e.hit.y + e.hit.h / 2, zoom: Math.min(3.2, this.cam.zoom * 1.25) }
        : this.cam;
      await new Promise<void>((resolve) => this.moveTo(target, { ms, done: resolve }));
      this.hooks.whoosh?.();
      this.entryFade = 1;
    } finally {
      this.locked = false;
    }
  }

  /** 850 ms padlock unlock on the kingdom entrance (wobble, shackle lifts, fade). */
  async animatePadlockUnlock(kingdomId: number): Promise<void> {
    if (this.destroyed) return;
    this.hooks.padlockUnlock?.();
    const ms = this.reduced ? 100 : 850;
    this.padlockAnims.set(kingdomId, performance.now() - (850 - ms));
    try {
      await this.wait(ms);
    } finally {
      this.padlockAnims.delete(kingdomId);
      this.openedPadlocks.add(kingdomId);
    }
  }

  clearEntryFade(): void {
    this.entryFade = 0;
  }

  /** Kingdom-travel glide used by the transition flow (2800 ms). */
  travelTo(x: number, y: number): Promise<void> {
    return new Promise<void>((resolve) => this.moveTo({ cx: x, cy: y, zoom: this.cam.zoom }, { ms: KINGDOM_TRAVEL_MS, done: resolve }));
  }

  /**
   * Walks the avatar along `waypoints` at clamp(length / 4, 150, 400) units/s (a segment longer than 400 units is a
   * walkPlan teleport and runs as a warp fade). When the walk ends at a top gate the gate sequence follows; a zero-length
   * walk on Kingdom 3 level 45 plays the finale. `onArrival` fires once, after the whole sequence.
   */
  animateWalkingPath(waypoints: Array<{ x: number; y: number }>, bubbleText?: string, onArrival?: () => void): void {
    if (this.destroyed) return;
    const token = ++this.walkToken;
    if (waypoints.length < 2) {
      requestAnimationFrame(() => {
        if (token === this.walkToken && !this.destroyed) {
          onArrival?.();
          this.emit('walkArrived');
        }
      });
      return;
    }
    const cum = [0];
    const jumps: number[] = [];
    for (let i = 1; i < waypoints.length; i++) {
      const seg = Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].y - waypoints[i - 1].y);
      if (seg > JUMP_MIN) {
        jumps.push(i);
        cum.push(cum[i - 1]);
      } else {
        cum.push(cum[i - 1] + seg);
      }
    }
    const total = cum[cum.length - 1];
    let speed = clamp(total / 4, 150, 400);
    if (this.reduced) speed = Math.max(speed, total / 0.6);
    this.glide = null;
    this.warp = null;
    this.following = true;
    this.avatar.x = waypoints[0].x;
    this.avatar.y = waypoints[0].y;
    this.avatar.alpha = 1;
    this.avatar.walking = true;
    this.avatar.walkDist = 0;
    this.walk = {
      pts: waypoints.slice(),
      cum,
      total,
      dist: 0,
      speed,
      onArrival: onArrival ?? null,
      token,
      lastStepDist: 0,
      lastStepTime: -1,
      lastDustDist: 0,
      jumps,
      nextJump: 0,
      waiting: false,
      bubble: bubbleText ?? 'QUEST READY!',
    };
    
    // Reset camera to optimal walking view (Tala-Salitaan pattern: zoom in slightly during walk)
    // This ensures good POV regardless of user's manual drag before walking
    const walkZoom = this.vw >= this.vh ? 1.05 : 1.15; // slightly closer than default for better character visibility
    const startTarget = followTarget(this.avatar.x, this.avatar.y, this.vh, walkZoom);
    this.moveTo({ cx: startTarget.cx, cy: startTarget.cy, zoom: walkZoom }, { ms: 400 });
  }

  private advanceWalk(dt: number): void {
    const w = this.walk;
    if (!w) return;
    const av = this.avatar;
    if (w.waiting) return;
    w.dist = Math.min(w.total, w.dist + w.speed * dt);
    const j = w.jumps[w.nextJump];
    if (j !== undefined && w.dist >= w.cum[j - 1]) {
      // walkPlan teleport: fade, jump, fade in, then keep walking
      w.dist = w.cum[j - 1];
      w.nextJump++;
      w.waiting = true;
      const to = w.pts[j];
      const t = followTarget(to.x, to.y, this.vh, this.cam.zoom);
      this.startWarp(
        { cx: t.cx, cy: t.cy, zoom: this.cam.zoom },
        () => {
          av.x = to.x;
          av.y = to.y;
        },
        () => {
          w.waiting = false;
        },
      );
      return;
    }
    let i = 1;
    while (i < w.cum.length - 1 && w.cum[i] <= w.dist) i++;
    const a = w.pts[i - 1];
    const b = w.pts[i];
    const seg = w.cum[i] - w.cum[i - 1];
    const f = seg > 0 ? (w.dist - w.cum[i - 1]) / seg : 1;
    const nx = a.x + (b.x - a.x) * f;
    if (Math.abs(nx - av.x) > 0.01) av.facing = nx >= av.x ? 1 : -1;
    av.x = nx;
    av.y = a.y + (b.y - a.y) * f;
    av.walkDist = w.dist;
    av.bubble = w.bubble;
    av.bubbleTtl = 1;
    if (!this.reduced && w.dist - w.lastDustDist > 26) {
      w.lastDustDist = w.dist;
      av.dust.spawn(av.x - av.facing * 14, av.y + 2);
    }
    if (w.dist - w.lastStepDist >= STEP_EVERY && this.time - w.lastStepTime >= STEP_MIN_INTERVAL) {
      w.lastStepDist = w.dist;
      w.lastStepTime = this.time;
      this.hooks.step?.();
    }
    if (w.dist >= w.total) {
      this.walk = null;
      this.following = false;
      av.walking = false;
      if (w.token !== this.walkToken || this.destroyed) return;
      this.finishWalk(w);
    }
  }

  private gateAt(p: { x: number; y: number }): (typeof GATES)[number] | null {
    for (const g of GATES) if (Math.abs(p.x - g.frontX) < 4 && p.y > g.frontY - 30 && p.y < g.frontY + 2) return g;
    return null;
  }

  private finishWalk(w: Walk): void {
    const last = w.pts[w.pts.length - 1];
    const gate = this.gateAt(last);
    if (gate) {
      void this.runGateSequence(gate, w);
      return;
    }
    const k3 = NODES[(3 - 1) * LEVELS_PER_KINGDOM + LEVELS_PER_KINGDOM - 1];
    if (w.total < 1 && Math.abs(last.x - k3.x) < 4 && Math.abs(last.y - (k3.y - k3.blockH / 2 + 10)) < 4) {
      void this.runFinale(w);
      return;
    }
    this.avatar.bubble = 'QUEST READY!';
    this.avatar.bubbleTtl = 2.2;
    // settle the camera exactly on the level (the eased follow lags a little behind the avatar)
    const t = followTarget(this.avatar.x, this.avatar.y, this.vh, this.cam.zoom);
    this.moveTo({ cx: t.cx, cy: t.cy, zoom: this.cam.zoom }, { ms: 600, done: () => this.emit('cameraArrived') });
    this.hooks.success?.();
    w.onArrival?.();
    this.emit('walkArrived');
  }

  /** Per-frame tween (used by the gate and finale sequences). */
  private tween(ms: number, fn: (p: number) => void): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.destroyed || ms <= 0) {
        fn(1);
        resolve();
        return;
      }
      this.tweens.add({ t0: performance.now(), ms, fn, resolve });
    });
  }

  private stepTweens(now: number): void {
    for (const tw of this.tweens) {
      const p = clamp((now - tw.t0) / tw.ms, 0, 1);
      tw.fn(p);
      if (p >= 1) {
        this.tweens.delete(tw);
        tw.resolve();
      }
    }
  }

  /** Gate doors, step-through, title banner and camera travel to the next kingdom (DESIGN 5.4 stage A). */
  private async runGateSequence(g: (typeof GATES)[number], w: Walk): Promise<void> {
    this.locked = true;
    const av = this.avatar;
    try {
      const nextK = (g.kingdom + 1) as KingdomId;
      const def = KINGDOMS[nextK - 1];
      av.bubbleTtl = 0;
      this.hooks.gateOpen?.();
      const openMs = this.reduced ? 150 : 900;
      this.gateAnim = { gate: g, t0: performance.now(), dur: openMs, p: 0 };
      await this.wait(openMs);
      const sx = av.x;
      const sy = av.y;
      const ty = g.archY - 24;
      await this.tween(this.reduced ? 100 : 300, (p) => {
        av.x = sx + (g.archX - sx) * p;
        av.y = sy + (ty - sy) * p;
        av.alpha = 1 - p;
      });
      av.alpha = 0;
      const bannerDone = this.banner.show(def.name, def.subtitle, def.color, this.reduced, (ms) => this.wait(ms));
      await this.wait(this.reduced ? 0 : 400);
      const stand = followTarget(g.nextSpawnX, g.nextSpawnY, this.vh, this.cam.zoom);
      await new Promise<void>((resolve) => this.moveTo({ cx: stand.cx, cy: stand.cy, zoom: this.cam.zoom }, { ms: KINGDOM_TRAVEL_MS, done: resolve }));
      if (this.destroyed) return;
      av.x = g.nextSpawnX;
      av.y = g.nextSpawnY;
      av.facing = 1;
      await this.tween(this.reduced ? 80 : 300, (p) => {
        av.alpha = p;
      });
      this.gateAnim = null;
      av.bubble = w.bubble;
      av.bubbleTtl = 2;
      this.hooks.success?.();
      await bannerDone;
      if (this.destroyed) return;
      this.emit('cameraArrived');
      w.onArrival?.();
      this.emit('walkArrived');
    } finally {
      av.alpha = 1;
      this.gateAnim = null;
      this.locked = false;
    }
  }

  /** Kingdom 3 finale: flags wave, confetti falls, no gate and no banner. */
  private async runFinale(w: Walk): Promise<void> {
    this.locked = true;
    try {
      this.avatar.bubble = 'KINGDOM COMPLETE!';
      this.avatar.bubbleTtl = 2.6;
      this.hooks.success?.();
      if (!this.reduced) this.confetti.burst(this.avatar.x, this.avatar.y);
      await this.wait(this.reduced ? 100 : 2400);
      if (this.destroyed) return;
      w.onArrival?.();
      this.emit('walkArrived');
    } finally {
      this.locked = false;
    }
  }

  // ---------------------------------------------------------------- input

  private worldAt(sx: number, sy: number): { x: number; y: number } {
    return { x: this.view.left + sx / this.cam.zoom, y: this.view.top + sy / this.cam.zoom };
  }

  private hitRadius(): number {
    return Math.max(48, 22 / this.cam.zoom);
  }

  private visibleNodes(): NodeState[] {
    const [a, b] = visibleRange(this.view.top, this.view.bottom);
    const out: NodeState[] = [];
    for (let s = a; s <= b; s++) for (const nd of this.nodesBySeg[s]) out.push(nd.state);
    return out;
  }

  private onTap(sx: number, sy: number): void {
    if (this.destroyed) return;
    const p = this.worldAt(sx, sy);
    const hit = nearestNode(this.visibleNodes(), p.x, p.y, this.hitRadius()) as NodeState | null;
    if (hit) {
      this.activateNode(hit);
      return;
    }
    for (const e of ENTRANCES) {
      if (p.x >= e.hit.x && p.x <= e.hit.x + e.hit.w && p.y >= e.hit.y && p.y <= e.hit.y + e.hit.h) {
        const unlocked = e.kingdom <= this.flow.activeMapId;
        const entered = this.flow.enteredKingdomIds.includes(e.kingdom);
        if (unlocked && !entered) {
          this.hooks.click?.();
          this.emit('kingdomClick', e.kingdom);
        } else if (!unlocked) {
          this.hooks.wrong?.();
          this.emit('lockedKingdomClick');
        }
        return;
      }
    }
  }

  /** Click, tap or Enter on a node (gating table, DESIGN 5.4): exactly one event or one wrong-sound per activation. */
  private activateNode(hit: NodeState): void {
    if (this.destroyed || this.isInputLocked()) return;
    const entered = this.flow.enteredKingdomIds.includes(hit.kingdom);
    if (entered && hit.available && (hit.status === 'completed' || hit.status === 'current')) {
      this.hooks.click?.();
      this.emit('levelClick', hit.kingdom, hit.level);
    } else {
      this.hooks.wrong?.();
    }
  }

  private onProxyFocus(n: NodeState): void {
    if (this.destroyed || this.isInputLocked()) return;
    this.cancelGlide();
    this.moveTo({ cx: n.x, cy: n.y, zoom: this.cam.zoom }, { maxMs: 900 });
  }

  private onKingdomDot(k: number): void {
    if (this.destroyed || this.isInputLocked() || k > this.flow.activeMapId) return;
    this.cancelGlide();
    this.centerOnKingdom(k);
  }

  private entranceAt(x: number, y: number): (typeof ENTRANCES)[number] | null {
    for (const e of ENTRANCES) {
      if (x >= e.hit.x && x <= e.hit.x + e.hit.w && y >= e.hit.y && y <= e.hit.y + e.hit.h) return e;
    }
    return null;
  }

  private onHover(sx: number, sy: number): void {
    if (this.destroyed) return;
    if (this.isInputLocked()) {
      this.hud.hideTooltip();
      return;
    }
    const p = this.worldAt(sx, sy);
    const hit = nearestNode(this.visibleNodes(), p.x, p.y, this.hitRadius());
    const nd = hit ? this.nodeDraws[hit.globalIndex - 1] : null;
    const ent = nd ? null : this.entranceAt(p.x, p.y);
    const entId = ent ? ent.kingdom : 0;
    if (entId !== this.hoverEntrance) {
      this.hoverEntrance = entId;
      if (ent && ent.kingdom <= this.flow.activeMapId && !this.flow.enteredKingdomIds.includes(ent.kingdom)) this.hooks.hover?.();
    }
    if (nd !== this.hovered) {
      if (this.hovered) this.hovered.hover = false;
      this.hovered = nd;
      if (nd) {
        nd.hover = true;
        this.hooks.hover?.();
      }
    }
    this.canvas.style.cursor = nd || ent ? 'pointer' : '';
    if (nd) {
      const s = nd.state;
      const text = s.available ? (s.station ?? `${KINGDOMS[s.kingdom - 1].name} - Level ${s.level}`) : 'Coming soon';
      this.hud.showTooltip(text, sx, sy, this.vw);
    } else if (ent) {
      const unlocked = ent.kingdom <= this.flow.activeMapId;
      this.hud.showTooltip(`${KINGDOMS[ent.kingdom - 1].name}${unlocked ? '' : ' (locked)'}`, sx, sy, this.vw);
    } else {
      this.hud.hideTooltip();
    }
  }

  // ---------------------------------------------------------------- loop

  private loop(now: number): void {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
    if (this.hiddenDoc || this.offscreen) {
      this.lastNow = now;
      return;
    }
    const rawDt = now - this.lastNow;
    this.lastNow = now;
    const dt = Math.min(0.05, Math.max(0, rawDt / 1000));
    if (rawDt > 0 && rawDt < 500) this.emaInterval += (rawDt - this.emaInterval) * 0.05;
    const t0 = performance.now();
    
    // Track camera before update
    const prevCam = { cx: this.cam.cx, cy: this.cam.cy, zoom: this.cam.zoom };
    const hadWalk = !!this.walk;
    const hadWarp = !!this.warp;
    const hadGlide = !!this.glide;
    const hadGateAnim = !!this.gateAnim;
    const prevTime = this.time;
    
    this.update(dt, now);
    
    // Only redraw if something changed (Tala-Salitaan pattern: conditional rendering)
    const camMoved = Math.abs(this.cam.cx - prevCam.cx) > 0.1 || 
                     Math.abs(this.cam.cy - prevCam.cy) > 0.1 || 
                     Math.abs(this.cam.zoom - prevCam.zoom) > 0.001;
    const animating = this.walk || this.warp || this.glide || this.gateAnim;
    const wasAnimating = hadWalk || hadWarp || hadGlide || hadGateAnim;
    const timeChanged = !this.reduced && Math.abs(this.time - prevTime) > 0.001;
    const confettiActive = this.confetti.active;
    const avatarBubble = this.avatar.bubbleTtl > 0;
    
    // Redraw when: camera moved, animations running, or visual effects active
    if (camMoved || animating || wasAnimating || timeChanged || confettiActive || avatarBubble || this.sizeDirty) {
      this.draw();
    }
    
    this.emaWork += (performance.now() - t0 - this.emaWork) * 0.05;
    this.governor(now);
  }

  private update(dt: number, now: number): void {
    if (this.sizeDirty) {
      const ow = this.vw;
      const oh = this.vh;
      const s = this.standPoint();
      const sx = s ? (s.x - (this.cam.cx - ow / (2 * this.cam.zoom))) * this.cam.zoom : 0;
      const sy = s ? (s.y - (this.cam.cy - oh / (2 * this.cam.zoom))) * this.cam.zoom : 0;
      const hadNode = !!s && sx >= 0 && sx <= ow && sy >= 0 && sy <= oh;
      this.measure();
      this.applyScale();
      if (this.vw !== ow || this.vh !== oh) {
        // keep the artwork unstretched (uniform zoom) and the current level in view after a resize
        const flipped = ow >= oh !== this.vw >= this.vh;
        if (hadNode && !this.locked && !this.walk) {
          this.glide = null;
          this.warp = null;
          this.cam = clampToWorld(this.currentTarget(flipped ? defaultZoom(this.vw, this.vh) : this.cam.zoom), this.vw, this.vh);
        } else {
          this.cam = clampToWorld(this.cam, this.vw, this.vh);
        }
      }
    }
    if (!this.reduced) this.time += dt;
    const prevY = this.cam.cy;
    this.stepTweens(now);
    if (this.gateAnim) this.gateAnim.p = clamp((now - this.gateAnim.t0) / this.gateAnim.dur, 0, 1);
    if (!this.reduced) {
      this.avatar.dust.step(dt);
      this.confetti.step(dt);
    }
    if (!this.walk && this.avatar.bubbleTtl > 0) this.avatar.bubbleTtl = Math.max(0, this.avatar.bubbleTtl - dt);
    if (this.warp) {
      const w = this.warp;
      const e = now - w.t0;
      if (w.stage === 0) {
        if (e >= w.outMs) {
          this.cam = w.target;
          w.stage = 1;
          w.t0 = now;
          w.mid?.();
        }
      } else if (e >= w.inMs) {
        this.warp = null;
        w.done?.();
      }
    } else if (this.glide) {
      const g = this.glide;
      const t = (now - g.t0) / g.dur;
      this.cam = clampToWorld(glideAt(g.from, g.to, t), this.vw, this.vh);
      if (t >= 1) {
        this.glide = null;
        g.done?.();
      }
    }
    this.advanceWalk(dt);
    if (this.following && this.walk && !this.warp && !this.walk.waiting) {
      const t = followTarget(this.avatar.x, this.avatar.y, this.vh, this.cam.zoom);
      // eased follow; one frame never moves more than 20 percent of the viewport height (AC16)
      const cap = (0.2 * this.vh) / this.cam.zoom;
      let dx = smoothDamp(this.cam.cx, t.cx, dt) - this.cam.cx;
      let dy = smoothDamp(this.cam.cy, t.cy, dt) - this.cam.cy;
      const m = Math.hypot(dx, dy);
      if (m > cap) {
        dx = (dx / m) * cap;
        dy = (dy / m) * cap;
      }
      this.cam = clampToWorld({ cx: this.cam.cx + dx, cy: this.cam.cy + dy, zoom: this.cam.zoom }, this.vw, this.vh);
    }
    this.pointer.update(dt);
    this.cam = clampToWorld(this.cam, this.vw, this.vh);
    this.camVy = dt > 0 ? (this.cam.cy - prevY) / dt : 0;
    this.updateHud(now);
  }

  /** Recenter emphasis, accessibility proxies and tooltip placement (throttled to about 10 Hz). */
  private updateHud(now: number): void {
    if (now - this.lastA11yUpdate < 100) return;
    this.lastA11yUpdate = now;
    const s = this.standPoint();
    if (s) {
      const sx = (s.x - (this.cam.cx - this.vw / (2 * this.cam.zoom))) * this.cam.zoom;
      const sy = (s.y - (this.cam.cy - this.vh / (2 * this.cam.zoom))) * this.cam.zoom;
      const outside = sx < 0 || sx > this.vw || sy < 0 || sy > this.vh;
      if (outside !== this.hud.emphasized) this.hud.setEmphasis(outside);
    }
    const left = this.cam.cx - this.vw / (2 * this.cam.zoom);
    const top = this.cam.cy - this.vh / (2 * this.cam.zoom);
    const [a, b] = visibleRange(top, top + this.vh / this.cam.zoom);
    const vis: NodeState[] = [];
    const k = this.cam.zoom;
    for (let sg = a; sg <= b; sg++) {
      for (const nd of this.nodesBySeg[sg]) {
        const px = (nd.x - left) * k;
        const py = (nd.y - top) * k;
        if (px >= -24 && px <= this.vw + 24 && py >= -24 && py <= this.vh + 24) vis.push(nd.state);
      }
    }
    this.a11y.update(vis, (x, y) => ({ x: (x - left) * k, y: (y - top) * k }));
  }

  private warpAlpha(now: number): number {
    const w = this.warp;
    if (!w) return 0;
    const e = now - w.t0;
    return w.stage === 0 ? clamp(e / w.outMs, 0, 1) : 1 - clamp(e / w.inMs, 0, 1);
  }

  private updateBake(first: number, last: number): void {
    const key = first * 100 + last;
    if (key === this.lastBakeKey && this.queue.bakedCount === this.lastBakedCount && !this.queue.isPending()) return;
    this.lastBakeKey = key;
    this.lastBakedCount = this.queue.bakedCount;
    const visible: number[] = [];
    for (let i = first; i <= last; i++) visible.push(i);
    const cy = this.cam.cy;
    visible.sort((a, b) => Math.abs((a + 0.5) * 887 - cy) - Math.abs((b + 0.5) * 887 - cy));
    const limit = maxBaked(this.vw, this.vh);
    const wanted = visible.slice();
    const unbakedVisible = visible.filter((i) => !this.queue.getBaked(i)).length;
    if (this.queue.bakedCount + unbakedVisible < limit) {
      const up = first - 1;
      const down = last + 1;
      const order = this.camVy <= 0 ? [up, down] : [down, up];
      for (const i of order) if (i >= 0 && i < SEGMENT_COUNT) wanted.push(i);
    }
    this.queue.request(wanted);
    this.queue.prune(visible.concat(wanted.slice(visible.length, wanted.length)), limit);
  }

  private lastHeavyDraw = 0;
  private readonly heavyDrawDelay = 33; // 33ms = ~30 FPS during drag (smooth enough, saves CPU)

  private draw(): void {
    const now = performance.now();
    const isDragging = this.pointer.isDragging();
    
    const v = this.view;
    v.dpr = this.dpr;
    v.vw = this.vw;
    v.vh = this.vh;
    v.time = this.time;
    v.tier = this.tier;
    v.reduced = this.reduced;
    updateView(v, this.cam.cx, this.cam.cy, this.cam.zoom);
    const [first, last] = visibleRange(v.top, v.bottom);
    
    // Optimize: Skip heavy baked segment updates during drag (debounce)
    // This makes drag feel MUCH smoother by reducing CPU work
    const shouldDrawHeavy = !isDragging || (now - this.lastHeavyDraw) > this.heavyDrawDelay;
    
    if (shouldDrawHeavy) {
      this.queue.touch(first, last);
      this.updateBake(first, last);
      this.lastHeavyDraw = now;
    }

    const ctx = this.ctx;
    if (v.left < 0 || v.right > WORLD_W) drawSky(v, kingdomAtY(this.cam.cy));
    
    // Draw baked segments only if not dragging OR enough time passed
    // During drag: uses last rendered frame (slightly stale but smooth!)
    if (shouldDrawHeavy) {
      drawSegments(v, this.queue, first, last);
    }

    // depth-sorted objects
    const items = this.items;
    items.length = 0;
    for (let s = first; s <= last; s++) {
      const sc = buildSegmentScene(s);
      for (const o of sc.objects) items.push(o);
      for (const nd of this.nodesBySeg[s]) items.push(nd);
    }
    // tall sprites whose base lies just below the view (capitol, gates, colosseum) still reach into it
    const below = last + 1;
    if (below < SEGMENT_COUNT && below * 887 - v.bottom < 420) {
      for (const o of buildSegmentScene(below).objects) items.push(o);
    }
    if (this.avatar.alpha > 0.01 && this.avatar.y >= v.top - 140 && this.avatar.y <= v.bottom + 100) items.push(this.avatar);
    items.sort((a, b) => sortKey(a) - sortKey(b));
    setWorldTransform(v);
    ctx.imageSmoothingEnabled = true;
    if (!v.plain) {
      this.water.drawWater(v, first, last);
      this.drawDriftClouds(v);
      if (this.gateAnim) drawGateDoors(v, this.gateAnim.gate, this.gateAnim.p);
    }
    drawObjects(v, this.sprites, items, this.water);
    if (!v.plain) {
      this.drawLocks(v);
      this.confetti.draw(v);
    }
    if (this.debug.nodes) this.drawDebug(first, last);

    if (this.tier === 'high') drawVignette(v);
    if (!v.plain) drawAmbient(v);
    drawFade(v, Math.max(this.warpAlpha(performance.now()), this.entryFade));
  }

  /** Near-layer clouds drifting across the sky seams (8, 5 or 2 per seam by tier). */
  private drawDriftClouds(v: View): void {
    const per = v.tier === 'high' ? 8 : v.tier === 'medium' ? 5 : 2;
    const list = driftClouds();
    const ctx = this.ctx;
    for (let i = 0; i < list.length; i++) {
      if (i % 8 >= per) continue;
      const d = list[i];
      const size = cloudSpriteSize(d.cloud);
      const y = d.cloud.y - (d.cloud.levels - 1) * 14;
      if (y > v.bottom || y + size.h < v.top) continue;
      const x = driftX(d, v.time);
      if (x > v.right || x + size.w < v.left) continue;
      ctx.drawImage(this.sprites.cloud(d.cloud) as CanvasImageSource, x, y, size.w, size.h);
    }
  }

  /** Mist over locked kingdoms and padlocks on entrances that are locked or not entered yet. */
  private drawLocks(v: View): void {
    for (const k of [1, 2, 3] as const) {
      if (k > this.flow.activeMapId) drawMist(v, k);
    }
    const now = performance.now();
    for (const e of ENTRANCES) {
      const x = e.hit.x + e.hit.w / 2;
      const y = e.hit.y + e.hit.h / 2;
      if (y < v.top - 80 || y > v.bottom + 80 || x < v.left - 80 || x > v.right + 80) continue;
      const t0 = this.padlockAnims.get(e.kingdom);
      if (t0 !== undefined) {
        drawPadlock(v, this.sprites, x, y, 76, padlockAnimAt(clamp((now - t0) / 850, 0, 1)));
        continue;
      }
      const locked = e.kingdom > this.flow.activeMapId;
      const pending = !locked && !this.flow.enteredKingdomIds.includes(e.kingdom);
      if ((locked || pending) && !this.openedPadlocks.has(e.kingdom)) drawPadlock(v, this.sprites, x, y, 76);
    }
  }

  private drawDebug(first: number, last: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    const r = this.hitRadius();
    for (let s = first; s <= last; s++) {
      for (const nd of this.nodesBySeg[s]) {
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /** EMA governor (DESIGN 9.2): above 22 ms drops a tier, below 12 ms for 10 s raises once. */
  private governor(now: number): void {
    if (this.qualityMode !== 'auto' || now < this.governorCooldown || this.walk) return;
    if (this.emaInterval > 22 && this.tier !== 'low') {
      this.tier = this.tier === 'high' ? 'medium' : 'low';
      this.governorCooldown = now + 4000;
      this.governorSince = 0;
      this.sizeDirty = true;
    } else if (this.emaInterval < 12 && !this.governorRaised && this.tier !== 'high') {
      if (this.governorSince === 0) this.governorSince = now;
      else if (now - this.governorSince > 10000) {
        this.tier = this.tier === 'low' ? 'medium' : 'high';
        this.governorRaised = true;
        this.governorSince = 0;
        this.sizeDirty = true;
      }
    } else {
      this.governorSince = 0;
    }
  }

  // ---------------------------------------------------------------- test hooks for the demo

  /** Moves the camera immediately (no glide), centred on a node. Used by the demo and the perf gate. */
  jumpToNode(kingdom: KingdomId, level: number, zoom?: number): void {
    const n = this.getNodePosition(kingdom, level);
    if (!n) return;
    const z = zoom ?? defaultZoom(this.vw, this.vh);
    const t = followTarget(n.x, n.y - n.blockH / 2 + 10, this.vh, z);
    this.glide = null;
    this.warp = null;
    this.cam = clampToWorld({ cx: t.cx, cy: t.cy, zoom: z }, this.vw, this.vh);
  }

  /** Demo compare mode (K1 S1 at 1774x887, no avatar, no HUD, plain nodes). */
  setCompareMode(on: boolean): void {
    this.view.plain = on;
    this.hud.el.style.display = on ? 'none' : '';
    if (on) this.setCamera({ cx: WORLD_W / 2, cy: 20 * 887 + 887 / 2, zoom: 1 });
  }

  /** Rendered landmark boxes and node centres in reference px (compare tool). */
  getCompareData(): { boxes: Box[]; nodes: Array<{ level: number; x: number; y: number }> } {
    const nodes = NODES.filter((n) => n.kingdom === 1 && n.level <= 13).map((n) => ({
      level: n.level,
      x: n.x,
      y: n.y - 17740,
    }));
    return { boxes: measureLandmarkBoxes(this.sprites, this.queue.bakeScale), nodes };
  }

  /** Sprite factory for the demo atlas route. */
  getSprites(): Sprites {
    return this.sprites;
  }

  /** Snapshot for the demo readouts and browser checks. */
  getDebugState(): {
    camera: Camera;
    avatar: { x: number; y: number; alpha: number; walking: boolean };
    locked: boolean;
    walking: boolean;
    bannerVisible: boolean;
    proxies: number;
    reduced: boolean;
    tier: string;
    warpAlpha: number;
    gateOpen: boolean;
    tooltip: string;
    emphasis: boolean;
    viewport: { w: number; h: number; dpr: number };
  } {
    return {
      camera: { ...this.cam },
      avatar: { x: this.avatar.x, y: this.avatar.y, alpha: this.avatar.alpha, walking: this.avatar.walking },
      locked: this.locked,
      walking: this.walk !== null,
      bannerVisible: this.banner.visible,
      proxies: this.a11y.visibleCount,
      reduced: this.reduced,
      tier: this.tier,
      warpAlpha: this.warpAlpha(performance.now()),
      gateOpen: this.gateAnim !== null,
      tooltip: this.hud.tooltipText,
      emphasis: this.hud.emphasized,
      viewport: { w: this.vw, h: this.vh, dpr: this.dpr },
    };
  }

  /** Swaps the avatar picture (demo avatar picker). */
  setAvatarImage(url: string): void {
    const img = new Image();
    img.src = url;
    this.avatar.img = img;
  }

  /** Avatar position (copy). */
  getAvatar(): { x: number; y: number } {
    return { x: this.avatar.x, y: this.avatar.y };
  }

  /** Current camera (copy). */
  getCamera(): Camera {
    return { ...this.cam };
  }

  setCamera(cam: Camera): void {
    this.glide = null;
    this.warp = null;
    this.cam = clampToWorld(cam, this.vw, this.vh);
  }
}
