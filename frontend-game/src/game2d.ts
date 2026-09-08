// 2.5D Minecraft / Voxel Style Grounded Kingdom World Map Engine (EPCES, Bayan ng Prosperidad, Provincial Capitol)
import { soundManager } from './soundManager';
import type { MapFlowOptions } from './mapFlowController';

export interface StarHistoryItem {
  questionId?: number;
  mapId?: number;
  orderIndex?: number;
  questionIndex?: number;
  stars: number;
}

export interface QuestionStepNode {
  mapId: number;
  questionIndex: number;
  label: string;
  x: number;
  y: number;
  blockW: number;
  blockH: number;
  blockR: number;
  starOffsetY: number;
  completed: boolean;
  current: boolean;
  locked: boolean;
  stars: number;
}

export interface BuildingKingdom {
  id: number;
  name: string;
  subtitle: string;
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  unlocked: boolean;
  entered: boolean;
  clickable: boolean;
  totalQuestions: number;
  icon: string;
  color: string;
  zone: string;
  topBannerX?: number;
  topBannerY?: number;
}

export class Game2DMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private avatarImgUrl: string;
  private avatarImg: HTMLImageElement | null = null;

  // Low-end device detection
  private isLowEndDevice: boolean = false;
  private animationQuality: 'high' | 'medium' | 'low' = 'high';

  // World Map Coordinate System (1774 x 887 Voxel Map)
  private readonly WORLD_WIDTH = 1774;
  private readonly WORLD_HEIGHT = 887;

  private panOffset = { x: 0, y: 0 };
  private zoomLevel = 1.0;
  private minZoom = 1.0;
  private maxZoom = 3.2;

  // Drag & Zoom interaction state
  private isDragging = false;
  private hasDragged = false;
  private dragStart = { x: 0, y: 0 };
  private dragPanStart = { x: 0, y: 0 };
  private touchInitialDist = 0;
  private touchInitialZoom = 1.0;

  private playerPos = { x: 140, y: 747 };
  private targetPlayerPos = { x: 140, y: 747 };

  private onStepClickCallback: ((mapId: number, questionIndex: number) => void) | null = null;
  private onKingdomClickCallback: ((kingdomId: number) => void) | null = null;
  private onLockedKingdomClickCallback: (() => void) | null = null;

  private mapFlowOptions: MapFlowOptions = {
    activeMapId: 1,
    enteredKingdomIds: [],
    mapPhase: 'awaiting_kingdom_click',
  };
  private inputLocked = false;
  private vacuumProgress = 0;
  private vacuumAlpha = 0;
  private vacuumFocal = { x: 0, y: 0 };
  private fullScreenFadeAlpha = 0;
  private showPlayerAvatar = true;

  // Assets
  private mapImg: HTMLImageElement | null = null;

  private clouds: Array<{ x: number; y: number; scale: number; speed: number; opacity: number; layer: 'bg' | 'fg' }> = [];
  private sparkles: Array<{ x: number; y: number; size: number; speedY: number; opacity: number; phase: number }> = [];

  private hoveredKingdomId: number | null = null;
  private hoveredStepNode: QuestionStepNode | null = null;

  private isWalkingAnimation = false;
  private walkBubbleText = 'QUEST READY!';
  private walkingWaypoints: Array<{ x: number; y: number }> = [];
  private currentWaypointIndex = 0;
  private walkDistance = 0;
  private lastStepDistance = 0;
  private runDustParticles: Array<{ x: number; y: number; size: number; opacity: number; vx: number; vy: number }> = [];
  private lastDustDistance = 0;
  private playerFacing: 'left' | 'right' = 'right';
  private onWalkArrivalCallback: (() => void) | null = null;
  private lastFrameTime = 0;

  // 3D Padlock Opening Animation State
  private unlockingPadlock: {
    kingdomId: number;
    progress: number;
    shackleLift: number;
    shackleAngle: number;
    lockWobbleX: number;
    alpha: number;
    mistAlpha: number;
    dropY: number;
  } | null = null;

  // Kingdom landmarks on the voxel map (with Top Roof Banner Coordinates)
  private kingdoms: BuildingKingdom[] = [
    {
      id: 1,
      name: 'EPCES Kingdom',
      subtitle: 'East Prosperidad Central Elementary School',
      tag: 'School Grounds & Academic Plaza',
      zone: 'Whispering Pine Heights',
      x: 310,
      y: 450,
      width: 310,
      height: 210,
      unlocked: true,
      entered: false,
      clickable: true,
      totalQuestions: 5,
      icon: '🏫',
      color: '#10B981',
      topBannerX: 280,
      topBannerY: 265,
    },
    {
      id: 2,
      name: 'Bayan ng Prosperidad',
      subtitle: 'Prosperidad Municipal Town Hall',
      tag: 'Government Center Plaza',
      zone: 'Lake Promenade Plaza',
      x: 910,
      y: 390,
      width: 330,
      height: 210,
      unlocked: false,
      entered: false,
      clickable: false,
      totalQuestions: 5,
      icon: '🏛️',
      color: '#0284C7',
      topBannerX: 910,
      topBannerY: 240,
    },
    {
      id: 3,
      name: 'Provincial Capitol',
      subtitle: 'Agusan del Sur Provincial Capitol',
      tag: 'Grand Capitol Colonnade & Oval',
      zone: 'Oakhaven Coastal Estate',
      x: 1530,
      y: 250,
      width: 330,
      height: 210,
      unlocked: false,
      entered: false,
      clickable: false,
      totalQuestions: 5,
      icon: '🚩',
      color: '#F59E0B',
      topBannerX: 1530,
      topBannerY: 65,
    },
  ];

  private steps: QuestionStepNode[] = [];
  private starsHistory: StarHistoryItem[] = [];

  constructor(
    container: HTMLElement,
    avatarImgUrl = '/assets/mascot_girl.png',
    activeMapId = 1,
    currentQuestionIndex = 1,
    customMaps?: Array<{ id: number; title: string; background_url?: string }>,
    initialPlayerPos?: { x: number; y: number },
    starsHistory?: StarHistoryItem[],
    mapFlowOptions?: MapFlowOptions
  ) {
    this.avatarImgUrl = avatarImgUrl;
    if (starsHistory) {
      this.starsHistory = starsHistory;
    }
    if (mapFlowOptions) {
      this.mapFlowOptions = mapFlowOptions;
    }

    // Detect low-end device capabilities
    this.detectDeviceCapabilities();

    this.canvas = document.createElement('canvas');
    this.resizeCanvas();

    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.position = 'fixed';
    this.canvas.style.inset = '0';
    this.canvas.style.zIndex = '5';
    this.canvas.style.cursor = 'default';

    this.ctx = this.canvas.getContext('2d')!;
    container.replaceChildren(this.canvas);

    if (customMaps && customMaps.length > 0) {
      customMaps.forEach((cm) => {
        const k = this.kingdoms.find((item) => item.id === cm.id);
        if (k) {
          k.name = cm.title;
        }
      });
    }

    this.loadAssets();
    this.initSkyEnvironment();
    this.initLayout(activeMapId, currentQuestionIndex, starsHistory);

    if (initialPlayerPos) {
      this.playerPos = { x: initialPlayerPos.x, y: initialPlayerPos.y };
    }
    this.fitCameraToScreen();

    this.bindEvents();
    this.startLoop();
  }

  private clampCameraBounds() {
    const w = this.canvas.width || window.innerWidth;
    const h = this.canvas.height || window.innerHeight;
    const scaledW = this.WORLD_WIDTH * this.zoomLevel;
    const scaledH = this.WORLD_HEIGHT * this.zoomLevel;

    // Strict horizontal boundary clamping (never show outside world map)
    if (scaledW <= w) {
      this.panOffset.x = (w - scaledW) / 2;
    } else {
      const minX = w - scaledW;
      const maxX = 0;
      this.panOffset.x = Math.max(minX, Math.min(maxX, this.panOffset.x));
    }

    // Strict vertical boundary clamping (never show outside world map)
    if (scaledH <= h) {
      this.panOffset.y = (h - scaledH) / 2;
    } else {
      const minY = h - scaledH;
      const maxY = 0;
      this.panOffset.y = Math.max(minY, Math.min(maxY, this.panOffset.y));
    }
  }

  public getActiveFocalPoint(): { x: number; y: number } {
    const activeMapId = this.mapFlowOptions?.activeMapId || 1;
    if (activeMapId === 3) {
      return { x: 1450, y: 390 };
    } else if (activeMapId === 2) {
      return { x: 938, y: 500 };
    } else {
      return { x: 378, y: 620 };
    }
  }

  private fitCameraToScreen() {
    const w = this.canvas.width || window.innerWidth;
    const h = this.canvas.height || window.innerHeight;

    const isPortraitMobile = w < 860 && w < h;
    let baseScale: number;

    if (isPortraitMobile) {
      // Option A: "Kingdom Fit" - Fits all 5 stations of the active kingdom edge-to-edge
      // with comfortable padding on mobile portrait screens (typically 360px - 430px wide).
      const kingdomFitScale = Math.max(0.55, Math.min(0.70, w / 580));
      baseScale = kingdomFitScale;
      this.minZoom = Math.min(0.35, w / this.WORLD_WIDTH);
      this.maxZoom = 2.4;
      this.zoomLevel = kingdomFitScale;
    } else {
      // Desktop / Landscape view: fill viewport edge-to-edge
      baseScale = Math.max(w / this.WORLD_WIDTH, h / this.WORLD_HEIGHT);
      this.minZoom = baseScale;
      this.maxZoom = baseScale * 3.1;
      this.zoomLevel = baseScale;
    }

    // If whole map width fits comfortably on screen, center the entire map
    if (w >= this.WORLD_WIDTH * baseScale) {
      this.panOffset.x = (w - this.WORLD_WIDTH * baseScale) / 2;
      this.panOffset.y = (h - this.WORLD_HEIGHT * baseScale) / 2;
    } else {
      // On mobile / portrait screens where map is wider than the viewport,
      // center camera directly on the active kingdom / player position
      const isAwaitingKingdom = this.mapFlowOptions?.mapPhase === 'awaiting_kingdom_click';
      const focal = isAwaitingKingdom
        ? this.getActiveFocalPoint()
        : ((this.playerPos && this.playerPos.x > 0) ? this.playerPos : this.getActiveFocalPoint());
      const targetPan = this.computePanForWorldCenter(focal.x, focal.y, baseScale);
      this.panOffset.x = targetPan.x;
      this.panOffset.y = targetPan.y;
    }
    this.clampCameraBounds();
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.fitCameraToScreen();
  }

  private detectDeviceCapabilities() {
    // Check for low-end device indicators
    const hardwareConcurrency = (navigator as any).hardwareConcurrency || 4;
    const deviceMemory = (navigator as any).deviceMemory || 4;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Low-end device criteria
    this.isLowEndDevice =
      hardwareConcurrency <= 2 ||
      deviceMemory <= 2 ||
      (isMobile && hardwareConcurrency <= 4);

    // Set animation quality based on device
    if (this.isLowEndDevice) {
      this.animationQuality = 'low';
    } else if (hardwareConcurrency <= 4 || deviceMemory <= 4) {
      this.animationQuality = 'medium';
    } else {
      this.animationQuality = 'high';
    }

    console.log(`Device detected: ${this.animationQuality} quality, Low-end: ${this.isLowEndDevice}`);
  }

  private loadAssets() {
    // 1. High-Resolution Voxel Prosperidad District Map
    const img = new Image();
    img.src = '/assets/vocab-map.png';
    (img as any).loading = 'eager';
    const handleMapLoad = () => {
      this.mapImg = img;
    };
    if ('decode' in img) {
      img.decode().then(handleMapLoad).catch(() => {
        (img as any).onload = handleMapLoad;
      });
    } else {
      (img as any).onload = handleMapLoad;
    }

    // 2. Student Avatar Mascot Sprite
    const avatar = new Image();
    avatar.src = this.avatarImgUrl;
    (avatar as any).loading = 'eager';
    const handleAvatarLoad = () => {
      this.avatarImg = avatar;
    };
    if ('decode' in avatar) {
      avatar.decode().then(handleAvatarLoad).catch(() => {
        (avatar as any).onload = handleAvatarLoad;
      });
    } else {
      (avatar as any).onload = handleAvatarLoad;
    }
  }

  private initSkyEnvironment() {
    // Reduce cloud count on low-end devices
    if (this.animationQuality === 'low') {
      this.clouds = [
        { x: 100, y: 65, scale: 1.3, speed: 0.3, opacity: 0.45, layer: 'bg' },
        { x: 620, y: 55, scale: 1.5, speed: 0.25, opacity: 0.4, layer: 'bg' },
      ];
    } else if (this.animationQuality === 'medium') {
      this.clouds = [
        { x: 100, y: 65, scale: 1.3, speed: 0.3, opacity: 0.45, layer: 'bg' },
        { x: 620, y: 55, scale: 1.5, speed: 0.25, opacity: 0.4, layer: 'bg' },
        { x: 1250, y: 75, scale: 1.2, speed: 0.35, opacity: 0.5, layer: 'bg' },
        { x: 280, y: 650, scale: 1.6, speed: 0.32, opacity: 0.55, layer: 'fg' },
      ];
    } else {
      this.clouds = [
        { x: 100, y: 65, scale: 1.3, speed: 0.3, opacity: 0.45, layer: 'bg' },
        { x: 620, y: 55, scale: 1.5, speed: 0.25, opacity: 0.4, layer: 'bg' },
        { x: 1250, y: 75, scale: 1.2, speed: 0.35, opacity: 0.5, layer: 'bg' },
        { x: 280, y: 650, scale: 1.6, speed: 0.32, opacity: 0.55, layer: 'fg' },
        { x: 1050, y: 700, scale: 1.8, speed: 0.28, opacity: 0.6, layer: 'fg' },
      ];
    }
    // Reduce sparkle count on low-end devices
    const sparkleCount = this.animationQuality === 'low' ? 10 : this.animationQuality === 'medium' ? 25 : 40;
    this.sparkles = [];
    for (let i = 0; i < sparkleCount; i++) {
      this.sparkles.push({
        x: Math.random() * this.WORLD_WIDTH,
        y: Math.random() * this.WORLD_HEIGHT,
        size: Math.random() * 4 + 2,
        speedY: Math.random() * 0.6 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Checkpoints physically aligned with the exact 15 voxel pink cubes on vocab-map.png
   */
  private initLayout(activeMapId: number, currentQuestionIndex: number, starsHistory?: StarHistoryItem[]) {
    if (starsHistory) {
      this.starsHistory = starsHistory;
    }

    this.kingdoms.forEach((k) => {
      k.unlocked = k.id <= activeMapId;
      k.entered = this.mapFlowOptions.enteredKingdomIds.includes(k.id);
      k.clickable = k.unlocked && !k.entered;
    });

    // Always show mascot at the current active step (including before kingdom entry)
    this.showPlayerAvatar = true;

    this.steps = [];

    const getEarnedStars = (mapId: number, qIndex: number, isCompleted: boolean): number => {
      if (this.starsHistory && this.starsHistory.length > 0) {
        const item = this.starsHistory.find(
          (h) => (h.mapId || 1) === mapId && ((h.orderIndex || h.questionIndex) === qIndex)
        );
        if (item && item.stars !== undefined && item.stars !== null) {
          return item.stars;
        }
      }
      return isCompleted ? 3 : 0;
    };

    // --- LEVEL 1: EPCES Kingdom (Nodes 1, 2, 3, 4, 5) ---
    const epcesStations = [
      { name: 'EPCES Garden',           x: 140, y: 780, blockW: 60, blockH: 66, blockR: 13, starOffsetY: 46 },
      { name: 'School Courtyard',       x: 287, y: 744, blockW: 60, blockH: 64, blockR: 13, starOffsetY: 44 },
      { name: 'EPCES Bridge Ramp',      x: 411, y: 707, blockW: 58, blockH: 62, blockR: 12, starOffsetY: 42 },
      { name: 'Riverside Overlook',     x: 515, y: 662, blockW: 58, blockH: 60, blockR: 12, starOffsetY: 42 },
      { name: 'Timber Bridge Crossing', x: 616, y: 615, blockW: 56, blockH: 58, blockR: 12, starOffsetY: 40 },
    ];

    epcesStations.forEach((st, idx) => {
      const qIndex = idx + 1;
      const isCurrent = activeMapId === 1 && currentQuestionIndex === qIndex;
      const isCompleted = activeMapId > 1 || (activeMapId === 1 && currentQuestionIndex > qIndex);
      const isLocked = activeMapId < 1 || (activeMapId === 1 && qIndex > currentQuestionIndex);
      const earnedStars = getEarnedStars(1, qIndex, isCompleted);

      this.steps.push({
        mapId: 1,
        questionIndex: qIndex,
        label: st.name,
        x: st.x,
        y: st.y,
        blockW: st.blockW,
        blockH: st.blockH,
        blockR: st.blockR,
        starOffsetY: st.starOffsetY,
        completed: isCompleted,
        current: isCurrent,
        locked: isLocked,
        stars: earnedStars,
      });

      if (isCurrent) {
        this.playerPos = { x: st.x, y: st.y - st.blockH / 2 + 10 };
        this.targetPlayerPos = { x: st.x, y: st.y - st.blockH / 2 + 10 };
      }
    });

    // --- LEVEL 2: Bayan ng Prosperidad (Nodes 6, 7, 8, 9, 10) ---
    const bayanStations = [
      { name: 'Bridge Promenade',       x: 720,  y: 537, blockW: 56, blockH: 58, blockR: 11, starOffsetY: 40 },
      { name: 'West Terrace Walk',      x: 816,  y: 558, blockW: 56, blockH: 58, blockR: 11, starOffsetY: 40 },
      { name: 'Bayan Municipal Plaza',  x: 932,  y: 566, blockW: 58, blockH: 60, blockR: 11, starOffsetY: 41 },
      { name: 'East Terrace Walk',      x: 1043, y: 560, blockW: 56, blockH: 58, blockR: 11, starOffsetY: 40 },
      { name: 'Park Playground Turn',   x: 1155, y: 536, blockW: 56, blockH: 58, blockR: 11, starOffsetY: 40 },
    ];

    bayanStations.forEach((st, idx) => {
      const qIndex = idx + 1;
      const isCurrent = activeMapId === 2 && currentQuestionIndex === qIndex;
      const isCompleted = activeMapId > 2 || (activeMapId === 2 && currentQuestionIndex > qIndex);
      const isLocked = activeMapId < 2 || (activeMapId === 2 && qIndex > currentQuestionIndex);
      const earnedStars = getEarnedStars(2, qIndex, isCompleted);

      this.steps.push({
        mapId: 2,
        questionIndex: qIndex,
        label: st.name,
        x: st.x,
        y: st.y,
        blockW: st.blockW,
        blockH: st.blockH,
        blockR: st.blockR,
        starOffsetY: st.starOffsetY,
        completed: isCompleted,
        current: isCurrent,
        locked: isLocked,
        stars: earnedStars,
      });

      if (isCurrent) {
        this.playerPos = { x: st.x, y: st.y - st.blockH / 2 + 10 };
        this.targetPlayerPos = { x: st.x, y: st.y - st.blockH / 2 + 10 };
      }
    });

    // --- LEVEL 3: Provincial Capitol (Nodes 11, 12, 13, 14, 15) ---
    const capitolStations = [
      { name: 'Capitol Hill Drive',       x: 1265, y: 366, blockW: 52, blockH: 54, blockR: 10, starOffsetY: 36 },
      { name: 'Highland Incline',         x: 1340, y: 405, blockW: 54, blockH: 54, blockR: 10, starOffsetY: 37 },
      { name: 'Capitol Colonnade Walk',   x: 1430, y: 440, blockW: 56, blockH: 56, blockR: 10, starOffsetY: 37 },
      { name: 'Grand Courtyard Loop',     x: 1526, y: 465, blockW: 56, blockH: 56, blockR: 10, starOffsetY: 38 },
      { name: 'Provincial Capitol Steps', x: 1638, y: 484, blockW: 56, blockH: 58, blockR: 10, starOffsetY: 38 },
    ];

    capitolStations.forEach((st, idx) => {
      const qIndex = idx + 1;
      const isCurrent = activeMapId === 3 && currentQuestionIndex === qIndex;
      const isCompleted = activeMapId === 3 && currentQuestionIndex > qIndex;
      const isLocked = activeMapId < 3 || (activeMapId === 3 && qIndex > currentQuestionIndex);
      const earnedStars = getEarnedStars(3, qIndex, isCompleted);

      this.steps.push({
        mapId: 3,
        questionIndex: qIndex,
        label: st.name,
        x: st.x,
        y: st.y,
        blockW: st.blockW,
        blockH: st.blockH,
        blockR: st.blockR,
        starOffsetY: st.starOffsetY,
        completed: isCompleted,
        current: isCurrent,
        locked: isLocked,
        stars: earnedStars,
      });

      if (isCurrent) {
        this.playerPos = { x: st.x, y: st.y - st.blockH / 2 + 10 };
        this.targetPlayerPos = { x: st.x, y: st.y - st.blockH / 2 + 10 };
      }
    });
  }

  public updateProgress(activeMapId: number, currentQuestionIndex: number, starsHistory?: StarHistoryItem[]) {
    this.initLayout(activeMapId, currentQuestionIndex, starsHistory);
    if (!this.isWalkingAnimation) {
      this.centerOnActiveLocation();
    }
  }

  public setMapFlowOptions(opts: MapFlowOptions) {
    const prevActiveMapId = this.mapFlowOptions?.activeMapId;
    const prevPhase = this.mapFlowOptions?.mapPhase;
    this.mapFlowOptions = opts;
    this.kingdoms.forEach((k) => {
      k.unlocked = k.id <= opts.activeMapId;
      k.entered = opts.enteredKingdomIds.includes(k.id);
      k.clickable = k.unlocked && !k.entered;
    });
    this.showPlayerAvatar = true;
    if ((prevActiveMapId !== opts.activeMapId || prevPhase !== opts.mapPhase) && !this.isWalkingAnimation) {
      this.centerOnActiveLocation();
    }
  }

  public isInputLocked(): boolean {
    return this.inputLocked || this.isWalkingAnimation;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoomLevel + this.panOffset.x,
      y: worldY * this.zoomLevel + this.panOffset.y,
    };
  }

  private computePanForWorldCenter(worldX: number, worldY: number, zoom: number): { x: number; y: number } {
    const w = this.canvas.width;
    const h = this.canvas.height;
    return {
      x: w / 2 - worldX * zoom,
      y: h / 2 - worldY * zoom,
    };
  }

  /**
   * Deep zoom into kingdom: pan eases toward center as zoom increases, clamped each frame
   * so the map never exposes empty space outside the artwork.
   */
  private tweenKingdomEntryZoom(
    worldX: number,
    worldY: number,
    anchorScreenX: number,
    anchorScreenY: number,
    targetZoom: number,
    durationMs: number,
    onProgress?: (progress: number, focalScreen: { x: number; y: number }) => void
  ): Promise<void> {
    const startZoom = this.zoomLevel;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawT = Math.min(1, elapsed / durationMs);
        const zoomT = this.easeInOutCubic(rawT);
        const panBlend = this.easeInOutQuad(Math.max(0, (rawT - 0.12) / 0.88));

        this.zoomLevel = startZoom + (targetZoom - startZoom) * zoomT;

        const anchorPanX = anchorScreenX - worldX * this.zoomLevel;
        const anchorPanY = anchorScreenY - worldY * this.zoomLevel;
        const centerPan = this.computePanForWorldCenter(worldX, worldY, this.zoomLevel);

        this.panOffset.x = anchorPanX + (centerPan.x - anchorPanX) * panBlend;
        this.panOffset.y = anchorPanY + (centerPan.y - anchorPanY) * panBlend;
        this.clampCameraBounds();

        const focalScreen = this.worldToScreen(worldX, worldY);
        if (onProgress) onProgress(rawT, focalScreen);

        if (rawT < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  private animateFullScreenFade(from: number, to: number, durationMs: number): Promise<void> {
    const startTime = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = this.easeInOutCubic(t);
        this.fullScreenFadeAlpha = from + (to - from) * eased;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.fullScreenFadeAlpha = to;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  public async playKingdomEntryAnimation(kingdomId: number): Promise<void> {
    const kingdom = this.kingdoms.find((k) => k.id === kingdomId);
    if (!kingdom) return;

    this.inputLocked = true;
    this.fullScreenFadeAlpha = 0;
    this.vacuumAlpha = 0;
    this.vacuumProgress = 0;
    soundManager.playWhoosh();

    this.fitCameraToScreen();

    const focalX = kingdom.x;
    const focalY = kingdom.y - kingdom.height * 0.1;
    const anchor = this.worldToScreen(focalX, focalY);

    // Deep zoom — feels like stepping close to the kingdom gate & padlock
    const targetZoom = this.maxZoom;

    // Phase 1: smooth zoom into kingdom + subtle tunnel vignette
    await this.tweenKingdomEntryZoom(
      focalX,
      focalY,
      anchor.x,
      anchor.y,
      targetZoom,
      1500,
      (progress, focalScreen) => {
        this.vacuumFocal.x = focalScreen.x;
        this.vacuumFocal.y = focalScreen.y;
        if (progress > 0.6) {
          const vignetteT = (progress - 0.6) / 0.4;
          this.vacuumProgress = this.easeInOutQuad(vignetteT) * 0.35;
          this.vacuumAlpha = this.easeInOutQuad(vignetteT) * 0.35;
        }
      }
    );

    // Phase 1.5: Realistic 3D Padlock Opening Animation right in front of the camera!
    if (!kingdom.entered) {
      await this.animatePadlockUnlock(kingdomId);
    }

    // Phase 2: Whoosh & deep push into the open kingdom gates to black
    soundManager.playWhoosh();
    this.vacuumProgress = 1;
    this.vacuumAlpha = 1;
    await this.animateFullScreenFade(0, 1, 450);

    // Reset camera under black so gameplay map is ready after dialogue
    this.fitCameraToScreen();
    this.vacuumProgress = 0;
    this.vacuumAlpha = 0;
    // fullScreenFadeAlpha stays at 1 — cleared when welcome dialogue opens

    this.clampCameraBounds();
    this.inputLocked = false;
  }

  public animatePadlockUnlock(kingdomId: number): Promise<void> {
    return new Promise((resolve) => {
      const kingdom = this.kingdoms.find((k) => k.id === kingdomId);
      const duration = 850; // Crisp 850ms mechanical unlatch & fade
      const startTime = performance.now();
      let hasPlayedSound = false;

      this.unlockingPadlock = {
        kingdomId,
        progress: 0,
        shackleLift: 0,
        shackleAngle: 0,
        lockWobbleX: 0,
        alpha: 1,
        mistAlpha: 1,
        dropY: 0,
      };

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);

        let shackleLift = 0;
        let shackleAngle = 0;
        let lockWobbleX = 0;
        let alpha = 1;
        let mistAlpha = 1;
        let dropY = 0;

        if (p < 0.15) {
          // Subtle mechanical tension shudder
          const t = p / 0.15;
          lockWobbleX = Math.sin(t * Math.PI * 4) * 1.5 * (1 - t);
        } else if (p < 0.50) {
          // Mechanical latch release: shackle pops UP (+13px) and swings open (-35 deg / -0.6 rad)
          if (!hasPlayedSound) {
            hasPlayedSound = true;
            soundManager.playPadlockUnlock();
          }
          const t = (p - 0.15) / 0.35; // 0 to 1
          const popEase = Math.sin(t * Math.PI * 0.5);
          shackleLift = popEase * 13;
          shackleAngle = -popEase * 0.6;
        } else {
          // Shackle stays open; padlock and dark mist fade away smoothly
          const t = (p - 0.50) / 0.50; // 0 to 1
          shackleLift = 13;
          shackleAngle = -0.6;
          dropY = t * 10;
          alpha = Math.max(0, 1 - t * 1.35);
          mistAlpha = Math.max(0, 1 - t);
        }

        if (this.unlockingPadlock) {
          this.unlockingPadlock.progress = p;
          this.unlockingPadlock.shackleLift = shackleLift;
          this.unlockingPadlock.shackleAngle = shackleAngle;
          this.unlockingPadlock.lockWobbleX = lockWobbleX;
          this.unlockingPadlock.alpha = alpha;
          this.unlockingPadlock.mistAlpha = mistAlpha;
          this.unlockingPadlock.dropY = dropY;
        }

        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          this.unlockingPadlock = null;
          if (kingdom) {
            kingdom.entered = true;
          }
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  /** Clear the post-entry black screen when welcome dialogue appears or map resumes. */
  public clearEntryFade(): void {
    this.fullScreenFadeAlpha = 0;
    this.vacuumAlpha = 0;
    this.vacuumProgress = 0;
  }

  public centerOnLocation(x: number, y: number) {
    const targetPan = this.computePanForWorldCenter(x, y, this.zoomLevel);
    this.panOffset = targetPan;
    this.clampCameraBounds();
  }

  public centerOnKingdom(kingdomId: number) {
    let focalX = 378;
    let focalY = 620;
    if (kingdomId === 3) {
      focalX = 1450;
      focalY = 390;
    } else if (kingdomId === 2) {
      focalX = 938;
      focalY = 500;
    } else {
      focalX = 378;
      focalY = 620;
    }
    const targetPan = this.computePanForWorldCenter(focalX, focalY, this.zoomLevel);
    this.panOffset = targetPan;
    this.clampCameraBounds();
  }

  public centerOnActiveLocation() {
    if (this.mapFlowOptions?.mapPhase === 'awaiting_kingdom_click') {
      const activeMapId = this.mapFlowOptions?.activeMapId || 1;
      this.centerOnKingdom(activeMapId);
      return;
    }

    const focal = (this.playerPos && this.playerPos.x > 0)
      ? this.playerPos
      : this.getActiveFocalPoint();
    const targetPan = this.computePanForWorldCenter(focal.x, focal.y, this.zoomLevel);
    this.panOffset = targetPan;
    this.clampCameraBounds();
  }

  public onStepClick(callback: (mapId: number, questionIndex: number) => void) {
    this.onStepClickCallback = callback;
  }

  public onKingdomClick(callback: (kingdomId: number) => void) {
    this.onKingdomClickCallback = callback;
  }

  public onLockedKingdomClick(callback: () => void) {
    this.onLockedKingdomClickCallback = callback;
  }

  public animateWalkingPath(
    waypoints: Array<{ x: number; y: number }>,
    bubbleText = 'TRAVELING...',
    onArrival?: () => void
  ) {
    if (!waypoints || waypoints.length === 0) return;
    this.playerPos = { x: waypoints[0].x, y: waypoints[0].y };
    this.targetPlayerPos = { x: waypoints[0].x, y: waypoints[0].y };
    // Immediately pre-center camera on the start of the walking path so mobile view looks directly at the character
    const startPan = this.computePanForWorldCenter(waypoints[0].x, waypoints[0].y, this.zoomLevel);
    this.panOffset = startPan;
    this.clampCameraBounds();
    this.isWalkingAnimation = true;
    this.walkBubbleText = bubbleText;
    this.walkingWaypoints = waypoints;
    this.currentWaypointIndex = waypoints.length > 1 ? 1 : 0;
    this.walkDistance = 0;
    this.lastStepDistance = 0;
    this.onWalkArrivalCallback = onArrival || null;
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    // Mouse Dragging for Panning
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.inputLocked) return;
      this.isDragging = true;
      this.hasDragged = false;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragPanStart = { x: this.panOffset.x, y: this.panOffset.y };
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 5) {
          this.hasDragged = true;
        }
        this.panOffset.x = this.dragPanStart.x + dx;
        this.panOffset.y = this.dragPanStart.y + dy;
        this.clampCameraBounds();
      } else {
        this.handleHover(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = this.hoveredStepNode || this.hoveredKingdomId ? 'pointer' : 'default';
      }
    });

    // Mouse Wheel Zooming (towards cursor position)
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.inputLocked) return;
        const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomDelta));

        if (newZoom !== this.zoomLevel) {
          const mouseX = e.clientX;
          const mouseY = e.clientY;
          const worldX = (mouseX - this.panOffset.x) / this.zoomLevel;
          const worldY = (mouseY - this.panOffset.y) / this.zoomLevel;

          this.zoomLevel = newZoom;
          this.panOffset.x = mouseX - worldX * newZoom;
          this.panOffset.y = mouseY - worldY * newZoom;
          this.clampCameraBounds();
        }
      },
      { passive: false }
    );

    // Touch Support: Dragging & 2-Finger Pinch Zoom
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.hasDragged = false;
        this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.dragPanStart = { x: this.panOffset.x, y: this.panOffset.y };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this.touchInitialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.touchInitialZoom = this.zoomLevel;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.dragStart.x;
        const dy = e.touches[0].clientY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 5) {
          this.hasDragged = true;
        }
        this.panOffset.x = this.dragPanStart.x + dx;
        this.panOffset.y = this.dragPanStart.y + dy;
        this.clampCameraBounds();
      } else if (e.touches.length === 2 && this.touchInitialDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / this.touchInitialDist;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.touchInitialZoom * factor));

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const worldX = (midX - this.panOffset.x) / this.zoomLevel;
        const worldY = (midY - this.panOffset.y) / this.zoomLevel;

        this.zoomLevel = newZoom;
        this.panOffset.x = midX - worldX * newZoom;
        this.panOffset.y = midY - worldY * newZoom;
        this.clampCameraBounds();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        this.isDragging = false;
        this.touchInitialDist = 0;
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.inputLocked || this.isWalkingAnimation) return;
      if (!this.hasDragged) {
        this.handleClick(e.clientX, e.clientY);
      }
    });
  }

  private handleHover(screenX: number, screenY: number) {
    const worldX = (screenX - this.panOffset.x) / this.zoomLevel;
    const worldY = (screenY - this.panOffset.y) / this.zoomLevel;

    let hoveredK: number | null = null;
    let hoveredS: QuestionStepNode | null = null;

    // Check player hover
    if (this.playerPos) {
      const distToPlayer = Math.hypot(worldX - this.playerPos.x, worldY - (this.playerPos.y - 20));
      if (distToPlayer < 55) {
        hoveredS = this.steps.find((s) => s.current) || this.steps[0] || null;
      }
    }

    if (!hoveredS) {
      for (const step of this.steps) {
        const hitRadius = Math.max(48, 30 / this.zoomLevel);
        const inBlockX = Math.abs(worldX - step.x) <= Math.max(hitRadius * 0.8, step.blockW * 0.8);
        const inBlockY = Math.abs(worldY - step.y) <= Math.max(hitRadius * 0.8, step.blockH * 0.8);
        const dist = Math.hypot(worldX - step.x, worldY - step.y);
        if (dist < hitRadius || (inBlockX && inBlockY)) {
          hoveredS = step;
          break;
        }
      }
    }

    if (!hoveredS) {
      for (const k of this.kingdoms) {
        if (
          worldX >= k.x - k.width / 2 &&
          worldX <= k.x + k.width / 2 &&
          worldY >= k.y - k.height / 2 &&
          worldY <= k.y + k.height / 2
        ) {
          hoveredK = k.id;
          break;
        }
      }
    }

    if (hoveredS !== this.hoveredStepNode || hoveredK !== this.hoveredKingdomId) {
      if (hoveredS || hoveredK) soundManager.playHover();
      this.hoveredStepNode = hoveredS;
      this.hoveredKingdomId = hoveredK;
      this.canvas.style.cursor = hoveredS || hoveredK ? 'pointer' : 'default';
    }
  }

  private handleClick(screenX: number, screenY: number) {
    if (this.inputLocked || this.isWalkingAnimation) return;

    const worldX = (screenX - this.panOffset.x) / this.zoomLevel;
    const worldY = (screenY - this.panOffset.y) / this.zoomLevel;

    const kingdomEntered = (mapId: number) =>
      this.mapFlowOptions.enteredKingdomIds.includes(mapId);

    // Check kingdom buildings first (entry takes priority)
    for (const k of this.kingdoms) {
      if (
        worldX >= k.x - k.width / 2 &&
        worldX <= k.x + k.width / 2 &&
        worldY >= k.y - k.height / 2 &&
        worldY <= k.y + k.height / 2
      ) {
        if (k.clickable && !k.entered && this.onKingdomClickCallback) {
          soundManager.playClick();
          this.onKingdomClickCallback(k.id);
          return;
        }
        if (!k.unlocked) {
          soundManager.playWrong();
          if (this.onLockedKingdomClickCallback) {
            this.onLockedKingdomClickCallback();
          }
        }
        return;
      }
    }

    // Check player avatar click (only when kingdom entered)
    if (this.showPlayerAvatar && this.playerPos) {
      const distToPlayer = Math.hypot(worldX - this.playerPos.x, worldY - (this.playerPos.y - 20));
      if (distToPlayer < 55) {
        const currentStep = this.steps.find((s) => s.current);
        if (currentStep && kingdomEntered(currentStep.mapId) && this.onStepClickCallback) {
          soundManager.playClick();
          this.onStepClickCallback(currentStep.mapId, currentStep.questionIndex);
          return;
        }
      }
    }

    // Check step nodes (only when kingdom entered)
    for (const step of this.steps) {
      const hitRadius = Math.max(48, 30 / this.zoomLevel);
      const inBlockX = Math.abs(worldX - step.x) <= Math.max(hitRadius * 0.8, step.blockW * 0.8);
      const inBlockY = Math.abs(worldY - step.y) <= Math.max(hitRadius * 0.8, step.blockH * 0.8);
      const dist = Math.hypot(worldX - step.x, worldY - step.y);
      if (dist < hitRadius || (inBlockX && inBlockY)) {
        if (!kingdomEntered(step.mapId)) {
          soundManager.playWrong();
          return;
        }
        if (step.completed || step.current) {
          soundManager.playClick();
          if (this.onStepClickCallback) {
            this.onStepClickCallback(step.mapId, step.questionIndex);
          }
        }
        return;
      }
    }
  }

  private startLoop() {
    const loop = () => {
      this.render();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /** Re-attach canvas after DOM rebuild (e.g. returning from question screen). */
  public remount(container: HTMLElement) {
    container.replaceChildren(this.canvas);
    this.resizeCanvas();
    if (!this.animFrameId) {
      this.startLoop();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  private render() {
    const time = Date.now() * 0.001;
    const now = performance.now();
    const dt = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, 0.05) : 0.016;
    this.lastFrameTime = now;

    if (this.isWalkingAnimation && this.walkingWaypoints.length > 0) {
      if (this.currentWaypointIndex < this.walkingWaypoints.length) {
        const targetWP = this.walkingWaypoints[this.currentWaypointIndex];
        const dx = targetWP.x - this.playerPos.x;
        const dy = targetWP.y - this.playerPos.y;
        const dist = Math.hypot(dx, dy);

        if (Math.abs(dx) > 1.5) {
          this.playerFacing = dx < 0 ? 'left' : 'right';
        }

        const moveSpeed = 150;
        const step = moveSpeed * dt;

        if (dist <= step) {
          this.playerPos.x = targetWP.x;
          this.playerPos.y = targetWP.y;
          this.currentWaypointIndex++;

          if (this.currentWaypointIndex >= this.walkingWaypoints.length) {
            this.isWalkingAnimation = false;
            this.walkBubbleText = 'QUEST READY!';
            this.targetPlayerPos = { x: this.playerPos.x, y: this.playerPos.y };
            soundManager.playSuccess();
            if (this.onWalkArrivalCallback) {
              this.onWalkArrivalCallback();
              this.onWalkArrivalCallback = null;
            }
          }
        } else {
          this.playerPos.x += (dx / dist) * step;
          this.playerPos.y += (dy / dist) * step;
          this.walkDistance += step;

          if (this.walkDistance - this.lastStepDistance > 24) {
            this.lastStepDistance = this.walkDistance;
            soundManager.playStep();
          }
        }
      }

      // Dynamic camera tracking: keep running mascot centered on screen (vital for mobile viewports)
      const targetPan = this.computePanForWorldCenter(this.playerPos.x, this.playerPos.y, this.zoomLevel);
      this.panOffset.x += (targetPan.x - this.panOffset.x) * 0.12;
      this.panOffset.y += (targetPan.y - this.panOffset.y) * 0.12;
      this.clampCameraBounds();
    } else {
      this.playerPos.x += (this.targetPlayerPos.x - this.playerPos.x) * 0.1;
      this.playerPos.y += (this.targetPlayerPos.y - this.playerPos.y) * 0.1;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 0. Ambient Sky Environment
    this.drawCelestialSky(time);

    this.ctx.save();
    this.ctx.translate(this.panOffset.x, this.panOffset.y);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);

    // 1. Background Clouds
    this.drawClouds('bg');

    // ── LAYER 1: Pristine Grounded Voxel Map Artwork ──
    if (this.mapImg) {
      this.ctx.drawImage(this.mapImg, 0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
    }

    // ── LAYER 2: Flowing Water Caustics & Sparkles on Lakes & Waterfalls ──
    this.drawFluidWaterLayer(time);

    // ── LAYER 2.5: Dark Mist Overlay & 3D Metallic Padlocks on Locked Kingdoms ──
    this.drawLockedKingdoms(time);

    // ── LAYER 3: Interactive Kingdom Banners & Badges ──
    this.drawKingdomBanners(time);

    // ── LAYER 4: Checkpoint Node Highlights ──
    this.drawStepNodes(time);

    // ── LAYER 5: Student Mascot Player Avatar & Running Dust ──
    this.drawRunDust();
    if (this.showPlayerAvatar) {
      this.drawPlayerAvatar(time);
    }

    // 6. Magic Sparkles & Foreground Atmosphere
    this.drawSparkles(time);
    this.drawClouds('fg');

    this.ctx.restore();

    // Screen-space overlays during kingdom entry animation
    if (this.vacuumAlpha > 0) {
      this.drawVacuumOverlay();
    }
    if (this.fullScreenFadeAlpha > 0) {
      this.drawFullScreenFade();
    }
  }

  private drawFullScreenFade() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.save();
    this.ctx.fillStyle = `rgba(2, 6, 23, ${this.fullScreenFadeAlpha})`;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.restore();
  }

  private drawVacuumOverlay() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const progress = this.vacuumProgress;
    const alpha = this.vacuumAlpha;
    const fx = this.vacuumFocal.x || w / 2;
    const fy = this.vacuumFocal.y || h / 2;

    this.ctx.save();

    // Radial tunnel closing in on the kingdom focal point
    const maxRadius = Math.hypot(w, h) * 0.85;
    const holeRadius = maxRadius * Math.max(0.05, 1 - progress * 0.96);

    const tunnelGrad = this.ctx.createRadialGradient(fx, fy, holeRadius * 0.08, fx, fy, holeRadius);
    tunnelGrad.addColorStop(0, 'rgba(0,0,0,0)');
    tunnelGrad.addColorStop(0.35, `rgba(0,0,0,${0.35 * alpha})`);
    tunnelGrad.addColorStop(0.7, `rgba(0,0,0,${0.75 * alpha})`);
    tunnelGrad.addColorStop(1, `rgba(0,0,0,${0.98 * alpha})`);
    this.ctx.fillStyle = tunnelGrad;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.restore();
  }

  private drawCelestialSky(time: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Crisp Azure Sky gradient matching the voxel artwork sky
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#38BDF8');   // Vibrant Sky Blue
    skyGrad.addColorStop(0.5, '#60A5FA'); // Gentle Azure
    skyGrad.addColorStop(1, '#0284C7');   // Rich Deep Blue
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    const sunGrad = this.ctx.createRadialGradient(w * 0.25, h * 0.15, 20, w * 0.25, h * 0.15, w * 0.7);
    sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
    sunGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.1)');
    sunGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
    this.ctx.fillStyle = sunGrad;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let r = 0; r < 5; r++) {
      const angle = (r * Math.PI) / 8 + Math.sin(time * 0.3 + r) * 0.05;
      this.ctx.beginPath();
      this.ctx.moveTo(w * 0.25, 0);
      this.ctx.lineTo(w * 0.25 + Math.cos(angle) * w * 1.5, Math.sin(angle) * h * 1.5);
      this.ctx.lineTo(w * 0.25 + Math.cos(angle + 0.08) * w * 1.5, Math.sin(angle + 0.08) * h * 1.5);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawFluidWaterLayer(time: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    // River sparkles along the central valley (x: 750..1400, y: 700..950)
    const numGlints = 10;
    for (let i = 0; i < numGlints; i++) {
      const t = (time * 0.25 + i * (1 / numGlints)) % 1;
      const px = 700 + t * 650 + Math.sin(time * 2 + i) * 30;
      const py = 740 + t * 180 + Math.cos(time * 1.5 + i) * 20;
      const alpha = Math.sin(t * Math.PI) * 0.55;
      this.drawWaterSparkle(px, py, alpha, time, i);
    }

    this.ctx.restore();
  }

  private drawWaterSparkle(x: number, y: number, baseAlpha: number, time: number, index: number) {
    const pulse = (Math.sin(time * 3.5 + index * 1.6) + 1) / 2;
    const alpha = baseAlpha * (0.35 + pulse * 0.65);
    if (alpha <= 0.05) return;

    const size = 3 + pulse * 4;

    this.ctx.save();
    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x + size * 0.35, y);
    this.ctx.lineTo(x + size, y);
    this.ctx.lineTo(x + size * 0.35, y);
    this.ctx.lineTo(x, y + size);
    this.ctx.lineTo(x - size * 0.35, y);
    this.ctx.lineTo(x - size, y);
    this.ctx.lineTo(x - size * 0.35, y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawKingdomBanners(time: number) {
    this.kingdoms.forEach((k) => {
      const isHovered = this.hoveredKingdomId === k.id;
      this.ctx.save();

      // Top Floating Coordinates (floating above building roof peak)
      const bx = k.topBannerX ?? k.x;
      const bob = Math.sin(time * 2.5 + k.id * 1.5) * 3.5;
      const by = (k.topBannerY ?? (k.y - 130)) + bob;

      // Font & Measurement
      this.ctx.font = '700 16px "Quicksand", sans-serif';
      const text = k.name.toUpperCase();
      const textMetrics = this.ctx.measureText(text);
      const bannerWidth = Math.max(220, textMetrics.width + 56);
      const bannerHeight = 42;
      const radius = 14;

      // 1. Ambient Glow Halo (for unlocked kingdoms)
      if (k.unlocked) {
        const glowGrad = this.ctx.createRadialGradient(bx, by, bannerHeight * 0.2, bx, by, bannerWidth * 0.7);
        glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        this.ctx.fillStyle = glowGrad;
        this.ctx.beginPath();
        this.ctx.ellipse(bx, by, bannerWidth * 0.65, bannerHeight * 1.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // 2. Heavy Drop Shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      this.drawRoundedRect(bx - bannerWidth / 2 + 2, by - bannerHeight / 2 + 6, bannerWidth, bannerHeight, radius);
      this.ctx.fill();

      // 3. Pointer Arrow Notch (Points downward toward the roof)
      this.ctx.fillStyle = k.unlocked ? '#0F172A' : '#090D16';
      this.ctx.strokeStyle = k.unlocked ? (isHovered ? '#FDE047' : k.color) : '#475569';
      this.ctx.lineWidth = 2.5;

      this.ctx.beginPath();
      this.ctx.moveTo(bx - 8, by + bannerHeight / 2 - 1);
      this.ctx.lineTo(bx, by + bannerHeight / 2 + 8);
      this.ctx.lineTo(bx + 8, by + bannerHeight / 2 - 1);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // 4. Plaque Body (Linear Gradient)
      const grad = this.ctx.createLinearGradient(bx, by - bannerHeight / 2, bx, by + bannerHeight / 2);
      if (k.unlocked) {
        grad.addColorStop(0, '#1E293B');
        grad.addColorStop(1, '#0F172A');
      } else {
        grad.addColorStop(0, '#181E2C');
        grad.addColorStop(1, '#090D16');
      }
      this.ctx.fillStyle = grad;
      this.drawRoundedRect(bx - bannerWidth / 2, by - bannerHeight / 2, bannerWidth, bannerHeight, radius);
      this.ctx.fill();
      this.ctx.stroke();

      // 5. Inner Top Glass Highlight
      this.ctx.strokeStyle = k.unlocked ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(bx - bannerWidth / 2 + radius, by - bannerHeight / 2 + 2);
      this.ctx.lineTo(bx + bannerWidth / 2 - radius, by - bannerHeight / 2 + 2);
      this.ctx.stroke();

      // 6. Left Status Indicator Dot / Icon
      const dotX = bx - bannerWidth / 2 + 20;
      this.ctx.beginPath();
      this.ctx.arc(dotX, by, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = k.unlocked ? '#34D399' : '#64748B';
      this.ctx.fill();
      this.ctx.strokeStyle = k.unlocked ? '#059669' : '#334155';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // 7. High-Contrast Text
      this.ctx.font = '700 16px "Quicksand", sans-serif';
      this.ctx.fillStyle = k.unlocked ? (isHovered ? '#FEF08A' : '#FDE047') : '#94A3B8';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Soft text shadow for maximum legibility against rich voxel backgrounds
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;
      this.ctx.fillText(text, bx + 6, by);

      // Reset shadow
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

      this.ctx.restore();
    });
  }

  /**
   * Layer 2.5: Dark Mist Overlay & 3D Metallic Padlock on Locked Kingdoms
   */
  private drawLockedKingdoms(time: number) {
    this.kingdoms.forEach((k) => {
      // Show lock overlay on kingdoms not yet entered (including first kingdom on fresh join)
      if (!k.entered) {
        this.ctx.save();

        const isUnlocking = this.unlockingPadlock && this.unlockingPadlock.kingdomId === k.id;
        const u = isUnlocking ? this.unlockingPadlock! : null;

        // 1. Soft Dark Feathered Mask over the locked kingdom structure (fades during unlock)
        const maskW = k.width + 40;
        const maskH = k.height + 20;
        const darkGrad = this.ctx.createRadialGradient(k.x, k.y, k.width * 0.15, k.x, k.y, maskW * 0.5);
        const mistA = u ? u.mistAlpha : 1;
        darkGrad.addColorStop(0, `rgba(2, 6, 23, ${0.76 * mistA})`);
        darkGrad.addColorStop(0.55, `rgba(15, 23, 42, ${0.65 * mistA})`);
        darkGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

        this.ctx.fillStyle = darkGrad;
        this.ctx.beginPath();
        this.ctx.ellipse(k.x, k.y, maskW * 0.5, maskH * 0.5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // 2. Realistic 3D Metallic Padlock with gentle floating bob or unlocking animation
        const padBob = isUnlocking ? 0 : Math.sin(time * 3 + k.id * 1.5) * 4;
        const lockY = k.y + padBob + (u ? u.dropY : 0);

        this.drawRealisticPadlock(k.x, lockY, 42, isUnlocking ? {
          shackleLift: u!.shackleLift,
          shackleAngle: u!.shackleAngle,
          lockWobbleX: u!.lockWobbleX,
          alpha: u!.alpha,
          hideBadge: true,
        } : undefined);

        this.ctx.restore();
      }
    });
  }

  /**
   * Bold 3D Candy Jelly Star with Silver-White Bezel Rim and Yellow Gloss Body (Large & Bold)
   */
  private drawCandyStar(cx: number, cy: number, r: number = 16, angle = 0, filled = true) {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    if (angle !== 0) {
      this.ctx.rotate(angle);
    }

    const spikes = 5;
    const innerR = r * 0.54;
    const step = Math.PI / spikes;

    const buildStarPath = (radius: number, innerRadius: number) => {
      this.ctx.beginPath();
      let curRot = (Math.PI / 2) * 3;
      this.ctx.moveTo(0, -radius);
      for (let i = 0; i < spikes; i++) {
        const x1 = Math.cos(curRot) * radius;
        const y1 = Math.sin(curRot) * radius;
        this.ctx.lineTo(x1, y1);
        curRot += step;

        const x2 = Math.cos(curRot) * innerRadius;
        const y2 = Math.sin(curRot) * innerRadius;
        this.ctx.lineTo(x2, y2);
        curRot += step;
      }
      this.ctx.lineTo(0, -radius);
      this.ctx.closePath();
    };

    // 1. Soft Ground Cast Drop Shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetX = 1.5;
    this.ctx.shadowOffsetY = 3;

    // 2. Thick Silver-White Outer Bezel Rim
    buildStarPath(r + 2.5, innerR + 1.6);
    this.ctx.fillStyle = filled ? '#FFFFFF' : 'rgba(226, 232, 240, 0.8)';
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.fill();

    // Reset shadow for crisp inner layers
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // 3. Inner Candy Body Fill
    buildStarPath(r, innerR);

    if (filled) {
      // Bold, bright, glossy yellow-orange gradient
      const candyGrad = this.ctx.createLinearGradient(0, -r, 0, r);
      candyGrad.addColorStop(0, '#FFF566');    // Bright lemon gloss top
      candyGrad.addColorStop(0.25, '#FFD000'); // Vivid golden yellow
      candyGrad.addColorStop(0.7, '#FF9900');  // Warm rich orange
      candyGrad.addColorStop(1, '#E67300');    // Deep amber base

      this.ctx.fillStyle = candyGrad;
      this.ctx.strokeStyle = '#9A3412';
      this.ctx.lineWidth = 1.8;
      this.ctx.fill();
      this.ctx.stroke();

      // 4. Glossy Jelly Gel Highlights
      // Curved upper dome reflection
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.beginPath();
      this.ctx.ellipse(0, -r * 0.42, r * 0.35, r * 0.22, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Top point sparkle dot
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(0, -r * 0.65, r * 0.13, 0, Math.PI * 2);
      this.ctx.fill();

      // Right arm soft candy gleam
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.beginPath();
      this.ctx.arc(r * 0.35, -r * 0.05, r * 0.15, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Empty slot (translucent dark glass with silver rim)
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
      this.ctx.lineWidth = 1.4;
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Realistic 3D Metallic Dark Steel / Gray Padlock (Locked / Inactive)
   */
  private drawRealisticPadlock(
    x: number,
    y: number,
    size = 42,
    anim?: {
      shackleLift?: number;
      shackleAngle?: number;
      lockWobbleX?: number;
      alpha?: number;
      hideBadge?: boolean;
    }
  ) {
    this.ctx.save();
    if (anim?.alpha !== undefined) {
      this.ctx.globalAlpha = Math.max(0, Math.min(1, anim.alpha));
    }
    const wobbleX = anim?.lockWobbleX || 0;
    x += wobbleX;

    const shackleLift = anim?.shackleLift || 0;
    const shackleAngle = anim?.shackleAngle || 0;
    const hideBadge = anim?.hideBadge || false;

    // 1. Soft Ambient Shadow behind the lock
    const glow = this.ctx.createRadialGradient(x, y, size * 0.2, x, y, size * 1.35);
    glow.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
    glow.addColorStop(0.55, 'rgba(15, 23, 42, 0.15)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 1.35, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. Heavy Cast Drop Shadow under padlock
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + size * 0.65, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 3. Shackle (Hardened Chrome Steel Arch with Realistic Specular Highlight & Unlocking Hinge)
    const shackleR = size * 0.32;
    const shackleThick = size * 0.16;
    const shackleY = y - size * 0.14;

    this.ctx.save();
    // Left leg hinge pivot point
    const pivotX = x - shackleR + shackleThick * 0.5;
    const pivotY = y + size * 0.08;

    this.ctx.translate(pivotX, pivotY);
    if (shackleAngle !== 0) {
      this.ctx.rotate(shackleAngle);
    }
    this.ctx.translate(-pivotX, -pivotY - shackleLift);

    this.ctx.beginPath();
    this.ctx.arc(x, shackleY, shackleR, Math.PI, 0, false);
    // Right leg: lifts completely clear of the lock socket when shackleLift pops up
    this.ctx.lineTo(x + shackleR, y + size * 0.12);
    this.ctx.lineTo(x + shackleR - shackleThick, y + size * 0.12);
    this.ctx.lineTo(x + shackleR - shackleThick, shackleY);
    this.ctx.arc(x, shackleY, shackleR - shackleThick, 0, Math.PI, true);
    // Left leg: remains connected to the hinge inside body socket even when lifted
    this.ctx.lineTo(x - shackleR + shackleThick, y + size * 0.12 + shackleLift);
    this.ctx.lineTo(x - shackleR, y + size * 0.12 + shackleLift);
    this.ctx.closePath();

    const shackleGrad = this.ctx.createLinearGradient(x - shackleR, shackleY, x + shackleR, shackleY);
    shackleGrad.addColorStop(0, '#334155');
    shackleGrad.addColorStop(0.25, '#94A3B8');
    shackleGrad.addColorStop(0.48, '#E2E8F0');
    shackleGrad.addColorStop(0.72, '#64748B');
    shackleGrad.addColorStop(1, '#1E293B');

    this.ctx.fillStyle = shackleGrad;
    this.ctx.strokeStyle = '#0F172A';
    this.ctx.lineWidth = 2.5;
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // 4. Padlock Metallic Body (Dark Steel / Slate Gray Gradient)
    const bodyW = size * 0.96;
    const bodyH = size * 0.78;
    const bodyX = x - bodyW / 2;
    const bodyY = y - size * 0.04;
    const cornerR = 9;

    const bodyGrad = this.ctx.createLinearGradient(bodyX, bodyY, bodyX + bodyW, bodyY + bodyH);
    bodyGrad.addColorStop(0, '#64748B');
    bodyGrad.addColorStop(0.2, '#475569');
    bodyGrad.addColorStop(0.65, '#334155');
    bodyGrad.addColorStop(0.85, '#1E293B');
    bodyGrad.addColorStop(1, '#0F172A');

    this.ctx.fillStyle = bodyGrad;
    this.ctx.strokeStyle = '#020617';
    this.ctx.lineWidth = 2.5;
    this.drawRoundedRect(bodyX, bodyY, bodyW, bodyH, cornerR);
    this.ctx.fill();
    this.ctx.stroke();

    // Inner Metallic Bevel Highlight Line
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1.5;
    this.drawRoundedRect(bodyX + 2.5, bodyY + 2.5, bodyW - 5, bodyH - 5, cornerR - 2);
    this.ctx.stroke();

    // Top Metallic Sheen Bar
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.beginPath();
    this.drawRoundedRect(bodyX + 6, bodyY + 4, bodyW - 12, 3, 2);
    this.ctx.fill();

    // 5. Inset Keyhole
    const keyY = bodyY + bodyH * 0.44;
    this.ctx.fillStyle = '#020617';
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1.5;

    // Circle
    this.ctx.beginPath();
    this.ctx.arc(x, keyY, size * 0.12, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Slot
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.06, keyY + size * 0.04);
    this.ctx.lineTo(x + size * 0.06, keyY + size * 0.04);
    this.ctx.lineTo(x + size * 0.04, keyY + size * 0.22);
    this.ctx.lineTo(x - size * 0.04, keyY + size * 0.22);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // 6. Floating "TAP TO UNLOCK" Badge Below Padlock (Clean dark pill, white text, no yellow border)
    if (!hideBadge) {
      const badgeW = 110;
      const badgeH = 22;
      const badgeY = bodyY + bodyH + 14;

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.lineWidth = 1.5;
      this.drawRoundedRect(x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = '700 11px "Fredoka", "Quicksand", sans-serif';
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('TAP TO UNLOCK', x, badgeY);
    }

    this.ctx.restore();
  }



  private drawStepNodes(time: number) {
    this.steps.forEach((step) => {
      const isHovered = this.hoveredStepNode === step;
      this.ctx.save();

      // Calibrated 3D Silhouette of the specific Voxel Platform:
      const bw = step.blockW || 54;
      const bh = step.blockH || 58;
      const br = step.blockR || 11;
      const starY = step.y + (step.starOffsetY || 40);

      // 1. Active Quest: Pulsing Golden Border Line Wrapping the Specific 3D Voxel Block
      if (step.current) {
        const pulse = Math.sin(time * 4.5) * 1.5;
        const fw = bw + pulse * 2;
        const fh = bh + pulse * 2;

        this.ctx.save();
        this.ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
        this.ctx.shadowBlur = 10;
        this.ctx.strokeStyle = '#FACC15';
        this.ctx.lineWidth = 4.5;
        this.drawRoundedRect(step.x - fw / 2, step.y - fh / 2, fw, fh, br + 1);
        this.ctx.stroke();
        this.ctx.restore();

        const arrowY = step.y - bh / 2 - 16 + Math.sin(time * 5) * 4;
        this.ctx.fillStyle = '#FBBF24';
        this.ctx.strokeStyle = '#78350F';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(step.x, arrowY + 12);
        this.ctx.lineTo(step.x - 9, arrowY);
        this.ctx.lineTo(step.x - 4, arrowY);
        this.ctx.lineTo(step.x - 4, arrowY - 12);
        this.ctx.lineTo(step.x + 4, arrowY - 12);
        this.ctx.lineTo(step.x + 4, arrowY);
        this.ctx.lineTo(step.x + 9, arrowY);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      // 2. Completed (Done) Question: Glowing Bold Emerald Border Line Wrapping the Specific 3D Voxel Block
      if (step.completed) {
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(16, 185, 129, 0.85)';
        this.ctx.shadowBlur = 9;
        this.ctx.strokeStyle = '#10B981';
        this.ctx.lineWidth = 4.5;
        this.drawRoundedRect(step.x - bw / 2, step.y - bh / 2, bw, bh, br);
        this.ctx.stroke();

        // Top-edge glossy 3D shine
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.lineWidth = 2.2;
        this.ctx.beginPath();
        this.ctx.moveTo(step.x - bw / 2 + br, step.y - bh / 2 + 1);
        this.ctx.lineTo(step.x + bw / 2 - br, step.y - bh / 2 + 1);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // 3. Hover / Click Selection: Sky-Blue Border Line Wrapping the Specific 3D Voxel Block
      if (isHovered && !step.current) {
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
        this.ctx.shadowBlur = 9;
        this.ctx.strokeStyle = '#38BDF8';
        this.ctx.lineWidth = 4.0;
        this.drawRoundedRect(step.x - (bw + 2) / 2, step.y - (bh + 2) / 2, bw + 2, bh + 2, br + 1);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // 4. ACCURATE BOLD 3D YELLOW CANDY STARS ALIGNED BELOW NUMBER (LARGE & PROMINENT)
      if (step.completed) {
        const starCount = Math.max(1, Math.min(3, step.stars || 3));

        const starConfigs =
          starCount === 3
            ? [
                { offsetX: -22, offsetY: 3,  rot: -0.16, r: 14.0 },
                { offsetX: 0,   offsetY: -3, rot: 0,     r: 17.5 },
                { offsetX: 22,  offsetY: 3,  rot: 0.16,  r: 14.0 },
              ]
            : starCount === 2
            ? [
                { offsetX: -13, offsetY: 0,  rot: -0.08, r: 15.5 },
                { offsetX: 13,  offsetY: 0,  rot: 0.08,  r: 15.5 },
              ]
            : [
                { offsetX: 0,   offsetY: 0,  rot: 0,     r: 17.5 },
              ];

        starConfigs.forEach((cfg) => {
          this.drawCandyStar(step.x + cfg.offsetX, starY + cfg.offsetY, cfg.r, cfg.rot, true);
        });
      }

      // 5. Hover Tooltip (Only displayed when hovering other stations, perfectly elevated)
      if (isHovered && !step.current) {
        const tipY = step.y - bh / 2 - 20;
        const starSummary = step.completed
          ? ` • ${step.stars}/3 STARS`
          : ' • LOCKED';
        const text = `${step.questionIndex}. ${step.label.toUpperCase()}${starSummary}`;

        this.ctx.font = '700 13px "Quicksand", sans-serif';
        const tw = this.ctx.measureText(text).width + 22;

        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        this.ctx.shadowBlur = 6;
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        this.ctx.strokeStyle = '#38BDF8';
        this.ctx.lineWidth = 2.5;
        this.drawRoundedRect(step.x - tw / 2, tipY - 13, tw, 26, 8);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        this.ctx.fillStyle = '#F8FAFC';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, step.x, tipY);
      }

      this.ctx.restore();
    });
  }

  private spawnRunDust(x: number, y: number) {
    for (let i = 0; i < 2; i++) {
      this.runDustParticles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 4,
        size: Math.random() * 4 + 3,
        opacity: 0.7,
        vx: (this.playerFacing === 'left' ? 1 : -1) * (Math.random() * 1.5 + 0.8),
        vy: -(Math.random() * 1.2 + 0.4),
      });
    }
  }

  private drawRunDust() {
    for (let i = this.runDustParticles.length - 1; i >= 0; i--) {
      const p = this.runDustParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.size += 0.15;
      p.opacity -= 0.035;

      if (p.opacity <= 0) {
        this.runDustParticles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.fillStyle = `rgba(226, 232, 240, ${p.opacity})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  private drawPlayerAvatar(time: number) {
    this.ctx.save();

    const isWalking = this.isWalkingAnimation;
    const runCycle = this.walkDistance * 0.22;
    const footSwitch = isWalking ? Math.sin(runCycle) : 0;
    const bounce = isWalking ? -Math.abs(Math.sin(runCycle)) * 9 : Math.sin(time * 3.5) * 4;
    const lean = isWalking ? (this.playerFacing === 'left' ? -0.14 : 0.14) : 0;
    const bodyWobble = isWalking ? footSwitch * 0.08 : 0;

    const charX = this.playerPos.x;
    const charY = this.playerPos.y + bounce;
    const shadowScale = isWalking ? 1 + (bounce / 35) : 1;

    // Node Ground Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.ctx.beginPath();
    this.ctx.ellipse(charX, this.playerPos.y + 6, 20 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Spawn running dust puff when feet plant
    if (isWalking && this.walkDistance - this.lastDustDistance > 26) {
      this.lastDustDistance = this.walkDistance;
      const dustX = charX + (this.playerFacing === 'left' ? 14 : -14);
      const dustY = this.playerPos.y + 2;
      this.spawnRunDust(dustX, dustY);
    }

    // Animated Running Feet
    if (isWalking) {
      this.ctx.save();
      this.ctx.translate(charX, this.playerPos.y);
      if (this.playerFacing === 'left') {
        this.ctx.scale(-1, 1);
      }

      // Front Foot
      const frontOffset = footSwitch * 13;
      const frontLift = footSwitch > 0 ? -9 * Math.sin(runCycle) : 0;
      this.ctx.fillStyle = '#0F172A';
      this.ctx.beginPath();
      this.ctx.roundRect(frontOffset - 7, frontLift - 6, 14, 8, 3);
      this.ctx.fill();
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.roundRect(frontOffset - 6, frontLift - 5, 12, 6, 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#EF4444';
      this.ctx.fillRect(frontOffset - 3, frontLift - 4, 6, 3);

      // Back Foot
      const backOffset = -footSwitch * 13;
      const backLift = footSwitch < 0 ? -9 * Math.abs(Math.sin(runCycle)) : 0;
      this.ctx.fillStyle = '#0F172A';
      this.ctx.beginPath();
      this.ctx.roundRect(backOffset - 7, backLift - 6, 14, 8, 3);
      this.ctx.fill();
      this.ctx.fillStyle = '#E2E8F0';
      this.ctx.beginPath();
      this.ctx.roundRect(backOffset - 6, backLift - 5, 12, 6, 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#3B82F6';
      this.ctx.fillRect(backOffset - 3, backLift - 4, 6, 3);

      this.ctx.restore();
    }

    // Avatar Sprite
    this.ctx.save();
    this.ctx.translate(charX, charY);
    if (this.playerFacing === 'left') {
      this.ctx.scale(-1, 1);
    }
    this.ctx.rotate((this.playerFacing === 'left' ? -1 : 1) * lean + bodyWobble);

    if (this.avatarImg) {
      const spriteW = 54;
      const spriteH = 68;
      this.ctx.drawImage(this.avatarImg, -spriteW / 2, -spriteH + 6, spriteW, spriteH);
    } else {
      this.ctx.font = '28px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('👦', 0, -20);
    }
    this.ctx.restore();

    // Floating Speech Bubble above mascot's head (Clean place name & number with vector pin icon)
    const activeStep = this.steps.find((s) => s.current);
    const placeText = activeStep ? `${activeStep.questionIndex}. ${activeStep.label}` : '1. EPCES Garden';
    const displayText = isWalking ? (this.walkBubbleText || 'Exploring...') : placeText;

    this.ctx.font = '700 13px "Quicksand", sans-serif';
    const textMetrics = this.ctx.measureText(displayText);
    const iconGap = isWalking ? 0 : 18;
    const bubbleWidth = Math.max(90, textMetrics.width + iconGap + 26);

    const bubbleY = charY - 84;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    this.ctx.shadowBlur = 6;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#1E293B';
    this.ctx.lineWidth = 2.5;
    this.drawRoundedRect(charX - bubbleWidth / 2, bubbleY - 14, bubbleWidth, 28, 8);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Little Speech Pointer Arrow
    this.ctx.beginPath();
    this.ctx.moveTo(charX - 5, bubbleY + 14);
    this.ctx.lineTo(charX, bubbleY + 21);
    this.ctx.lineTo(charX + 5, bubbleY + 14);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();
    this.ctx.strokeStyle = '#1E293B';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    // Draw Vector Location Pin Icon (Non-emoji)
    if (!isWalking) {
      const pinX = charX - bubbleWidth / 2 + 16;
      const pinY = bubbleY;

      // Pin Body
      this.ctx.save();
      this.ctx.fillStyle = '#059669'; // Vivid emerald pin
      this.ctx.beginPath();
      this.ctx.arc(pinX, pinY - 2, 4.5, Math.PI, 0, false);
      this.ctx.lineTo(pinX, pinY + 5);
      this.ctx.closePath();
      this.ctx.fill();

      // Pin Inner Dot
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(pinX, pinY - 2, 1.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Render Text (Crisp slate navy)
    this.ctx.font = '700 13px "Quicksand", sans-serif';
    this.ctx.fillStyle = isWalking ? '#0284C7' : '#0F172A';
    this.ctx.textBaseline = 'middle';
    if (isWalking) {
      this.ctx.textAlign = 'center';
      this.ctx.fillText(displayText, charX, bubbleY);
    } else {
      this.ctx.textAlign = 'left';
      const textStartX = charX - bubbleWidth / 2 + 25;
      this.ctx.fillText(displayText, textStartX, bubbleY);
    }

    this.ctx.restore();
  }

  private drawSparkles(time: number) {
    this.sparkles.forEach((s) => {
      s.y -= s.speedY;
      if (s.y < 50) {
        s.y = this.WORLD_HEIGHT * 0.85;
        s.x = Math.random() * this.WORLD_WIDTH;
      }

      const pulse = (Math.sin(time * 3 + s.phase) + 1) / 2;
      this.ctx.save();
      this.ctx.fillStyle = `rgba(253, 224, 71, ${s.opacity * pulse})`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private drawClouds(layer: 'bg' | 'fg') {
    this.clouds
      .filter((c) => c.layer === layer)
      .forEach((cloud) => {
        cloud.x += cloud.speed;
        if (cloud.x > this.WORLD_WIDTH + 300) {
          cloud.x = -300;
        }

        this.ctx.save();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(cloud.x, cloud.y, 32 * cloud.scale, 0, Math.PI * 2);
        this.ctx.arc(cloud.x + 28 * cloud.scale, cloud.y - 12 * cloud.scale, 40 * cloud.scale, 0, Math.PI * 2);
        this.ctx.arc(cloud.x + 64 * cloud.scale, cloud.y, 30 * cloud.scale, 0, Math.PI * 2);
        this.ctx.arc(cloud.x + 35 * cloud.scale, cloud.y + 12 * cloud.scale, 32 * cloud.scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });
  }

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }
}
