/**
 * Segment scene scripts for the procedural kingdoms (K1 S2-S7, K2, K3). Authoring coordinates:
 * u = distance up from the kingdom bottom (world y = kingdomBottomY - u), x is either absolute or a signed
 * horizontal offset from the route at that u.
 */
export interface SceneItem {
  /** Model key in MODELS. */
  readonly m: string;
  readonly u: number;
  /** Signed offset from the route x at this u (negative = left). Ignored when x is set. */
  readonly off?: number;
  /** Absolute world x. */
  readonly x?: number;
  readonly f?: number;
  /** Skip the push-out away from the route (arches and gates stand on it). */
  readonly fixed?: boolean;
}

/** Water pool: [x, u, rx, ry] in world units (centre and radii). */
export type Pond = readonly [x: number, u: number, rx: number, ry: number];

/** Flag cloth: kind, x of the pole, u of the cloth bottom, cloth size. */
export interface SceneFlag {
  readonly kind: 'ph' | 'yellow';
  readonly x: number;
  readonly u: number;
  readonly w: number;
  readonly h: number;
}

export interface SegmentSpec {
  /** 1..7 from the bottom of the kingdom. */
  readonly n: number;
  readonly items: readonly SceneItem[];
  readonly ponds?: readonly Pond[];
  /** Fence polylines as [offset from route, u] points; tiles every 16 units. */
  readonly fences?: ReadonlyArray<ReadonlyArray<readonly [off: number, u: number]>>;
  readonly flags?: readonly SceneFlag[];
  /** 0..1 chance per scatter cell (default 0.5). */
  readonly density?: number;
  /** Segment decor mix [model, weight, scale?]; defaults to the kingdom mix. */
  readonly decor?: ReadonlyArray<readonly [string, number, number?]>;
}

export type DecorMix = ReadonlyArray<readonly [string, number, number?]>;
