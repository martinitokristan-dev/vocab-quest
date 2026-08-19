// 2.5D Minecraft / Voxel Style Grounded Kingdom World Map Engine (EPCES, Bayan ng Prosperidad, Provincial Capitol)
import { soundManager } from './soundManager';

export interface QuestionStepNode {
  mapId: number;
  questionIndex: number;
  label: string;
  x: number;
  y: number;
  completed: boolean;
  current: boolean;
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
  totalQuestions: number;
  icon: string;
  color: string;
  zone: string;
}

export class Game2DMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private avatarImgUrl: string;
  private avatarImg: HTMLImageElement | null = null;

  // World Map Coordinate System (1774 x 887 Voxel Map)
  private readonly WORLD_WIDTH = 1774;
  private readonly WORLD_HEIGHT = 887;

  private panOffset = { x: 0, y: 0 };
  private zoomLevel = 1.0;

  private playerPos = { x: 174, y: 756 };
  private targetPlayerPos = { x: 174, y: 756 };

  private onStepClickCallback: ((mapId: number, questionIndex: number) => void) | null = null;

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

  // Kingdom landmarks on the voxel map
  private kingdoms: BuildingKingdom[] = [
    {
      id: 1,
      name: 'EPCES Kingdom',
      subtitle: 'East Prosperidad Central Elementary School',
      tag: 'School Grounds & Academic Plaza',
      zone: 'Whispering Pine Heights',
      x: 330,
      y: 460,
      width: 310,
      height: 210,
      unlocked: true,
      totalQuestions: 3,
      icon: '🏫',
      color: '#84CC16',
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
      totalQuestions: 5,
      icon: '🏛️',
      color: '#0284C7',
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
      totalQuestions: 5,
      icon: '🚩',
      color: '#F59E0B',
    },
  ];

  private steps: QuestionStepNode[] = [];

  constructor(
    container: HTMLElement,
    avatarImgUrl = '/assets/mascot_girl.png',
    activeMapId = 1,
    currentQuestionIndex = 1,
    customMaps?: Array<{ id: number; title: string; background_url?: string }>,
    initialPlayerPos?: { x: number; y: number }
  ) {
    this.avatarImgUrl = avatarImgUrl;

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
    this.initLayout(activeMapId, currentQuestionIndex);

    if (initialPlayerPos) {
      this.playerPos = { x: initialPlayerPos.x, y: initialPlayerPos.y };
      this.targetPlayerPos = { x: initialPlayerPos.x, y: initialPlayerPos.y };
    }
    this.fitCameraToScreen();

    this.bindEvents();
    this.startLoop();
  }

  private fitCameraToScreen() {
    const w = this.canvas.width || window.innerWidth;
    const h = this.canvas.height || window.innerHeight;

    // Cover the screen edge to edge without any empty background visible
    const scale = Math.max(w / this.WORLD_WIDTH, h / this.WORLD_HEIGHT);
    this.zoomLevel = scale;

    // Center the 1774 x 887 voxel map on screen
    this.panOffset.x = (w - this.WORLD_WIDTH * scale) / 2;
    this.panOffset.y = (h - this.WORLD_HEIGHT * scale) / 2;
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.fitCameraToScreen();
  }

  private loadAssets() {
    // 1. High-Resolution Voxel Prosperidad District Map
    const img = new Image();
    img.src = '/assets/vocab-quest-map.png';
    img.onload = () => {
      this.mapImg = img;
    };

    // 2. Student Avatar Mascot Sprite
    const avatar = new Image();
    avatar.src = this.avatarImgUrl;
    avatar.onload = () => {
      this.avatarImg = avatar;
    };
  }

  private initSkyEnvironment() {
    this.clouds = [
      { x: 100, y: 65, scale: 1.3, speed: 0.3, opacity: 0.45, layer: 'bg' },
      { x: 620, y: 55, scale: 1.5, speed: 0.25, opacity: 0.4, layer: 'bg' },
      { x: 1250, y: 75, scale: 1.2, speed: 0.35, opacity: 0.5, layer: 'bg' },
      { x: 280, y: 650, scale: 1.6, speed: 0.32, opacity: 0.55, layer: 'fg' },
      { x: 1050, y: 700, scale: 1.8, speed: 0.28, opacity: 0.6, layer: 'fg' },
    ];

    this.sparkles = [];
    for (let i = 0; i < 40; i++) {
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
   * Checkpoints physically aligned with the exact 13 voxel pink cubes on vocab-quest-map.png
   */
  private initLayout(activeMapId: number, currentQuestionIndex: number) {
    this.kingdoms.forEach((k) => {
      k.unlocked = k.id <= activeMapId;
    });

    this.steps = [];

    // --- LEVEL 1: EPCES Kingdom (Nodes 1, 2, 3) ---
    const epcesStations = [
      { name: 'I ❤️ EPCES Garden', x: 174, y: 768 },
      { name: 'School Courtyard',  x: 350, y: 715 },
      { name: 'EPCES Bridge Ramp', x: 502, y: 661 },
    ];

    epcesStations.forEach((st, idx) => {
      const qIndex = idx + 1;
      const isCurrent = activeMapId === 1 && currentQuestionIndex === qIndex;
      const isCompleted = activeMapId > 1 || (activeMapId === 1 && currentQuestionIndex > qIndex);

      this.steps.push({
        mapId: 1,
        questionIndex: qIndex,
        label: st.name,
        x: st.x,
        y: st.y,
        completed: isCompleted,
        current: isCurrent,
      });

      if (isCurrent) {
        this.playerPos = { x: st.x, y: st.y - 12 };
        this.targetPlayerPos = { x: st.x, y: st.y - 12 };
      }
    });

    // --- LEVEL 2: Bayan ng Prosperidad (Nodes 4, 5, 6, 7, 8) ---
    const bayanStations = [
      { name: 'Bridge Promenade',       x: 713,  y: 534 },
      { name: 'West Terrace Walk',      x: 809,  y: 559 },
      { name: 'Bayan Municipal Plaza',  x: 926,  y: 567 },
      { name: 'East Terrace Walk',      x: 1043, y: 559 },
      { name: 'Park Playground Turn',   x: 1152, y: 533 },
    ];

    bayanStations.forEach((st, idx) => {
      const qIndex = idx + 1;
      const isCurrent = activeMapId === 2 && currentQuestionIndex === qIndex;
      const isCompleted = activeMapId > 2 || (activeMapId === 2 && currentQuestionIndex > qIndex);

      this.steps.push({
        mapId: 2,
        questionIndex: qIndex,
        label: st.name,
        x: st.x,
        y: st.y,
        completed: isCompleted,
        current: isCurrent,
      });

      if (isCurrent) {
        this.playerPos = { x: st.x, y: st.y - 12 };
        this.targetPlayerPos = { x: st.x, y: st.y - 12 };
      }
    });

    // --- LEVEL 3: Provincial Capitol (Nodes 9, 10, 11, 12, 13) ---
    const capitolStations = [
      { name: 'Capitol Hill Drive',    x: 1268, y: 363 },
      { name: 'Highland Incline',      x: 1347, y: 407 },
      { name: 'Capitol Colonnade Walk',x: 1430, y: 439 },
      { name: 'Grand Courtyard Loop',  x: 1526, y: 468 },
      { name: 'Provincial Capitol Steps', x: 1637, y: 483 },
    ];

    capitolStations.forEach((st, idx) => {
      const qIndex = idx + 1;
      const isCurrent = activeMapId === 3 && currentQuestionIndex === qIndex;
      const isCompleted = activeMapId === 3 && currentQuestionIndex > qIndex;

      this.steps.push({
        mapId: 3,
        questionIndex: qIndex,
        label: st.name,
        x: st.x,
        y: st.y,
        completed: isCompleted,
        current: isCurrent,
      });

      if (isCurrent) {
        this.playerPos = { x: st.x, y: st.y - 12 };
        this.targetPlayerPos = { x: st.x, y: st.y - 12 };
      }
    });
  }

  public centerOnLocation(_x: number, _y: number) {
    this.fitCameraToScreen();
  }

  public centerOnActiveLocation() {
    this.fitCameraToScreen();
  }

  public onStepClick(callback: (mapId: number, questionIndex: number) => void) {
    this.onStepClickCallback = callback;
  }

  public animateWalkingPath(
    waypoints: Array<{ x: number; y: number }>,
    bubbleText = 'TRAVELING...',
    onArrival?: () => void
  ) {
    if (!waypoints || waypoints.length === 0) return;
    this.isWalkingAnimation = true;
    this.walkBubbleText = bubbleText;
    this.walkingWaypoints = waypoints;
    this.currentWaypointIndex = 0;
    this.walkDistance = 0;
    this.lastStepDistance = 0;
    this.onWalkArrivalCallback = onArrival || null;
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.handleHover(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('click', (e) => {
      this.handleClick(e.clientX, e.clientY);
    });
  }

  private handleHover(screenX: number, screenY: number) {
    const worldX = (screenX - this.panOffset.x) / this.zoomLevel;
    const worldY = (screenY - this.panOffset.y) / this.zoomLevel;

    let hoveredK: number | null = null;
    let hoveredS: QuestionStepNode | null = null;

    for (const step of this.steps) {
      const dist = Math.hypot(worldX - step.x, worldY - step.y);
      if (dist < 32) {
        hoveredS = step;
        break;
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
    const worldX = (screenX - this.panOffset.x) / this.zoomLevel;
    const worldY = (screenY - this.panOffset.y) / this.zoomLevel;

    // Check step nodes
    for (const step of this.steps) {
      const dist = Math.hypot(worldX - step.x, worldY - step.y);
      if (dist < 34) {
        if (step.completed || step.current) {
          soundManager.playClick();
          if (this.onStepClickCallback) {
            this.onStepClickCallback(step.mapId, step.questionIndex);
          }
        }
        return;
      }
    }

    // Check kingdom buildings
    for (const k of this.kingdoms) {
      if (
        worldX >= k.x - k.width / 2 &&
        worldX <= k.x + k.width / 2 &&
        worldY >= k.y - k.height / 2 &&
        worldY <= k.y + k.height / 2
      ) {
        if (k.unlocked) {
          soundManager.playClick();
          const firstStep = this.steps.find((s) => s.mapId === k.id && s.current) || this.steps.find((s) => s.mapId === k.id);
          if (firstStep && this.onStepClickCallback) {
            this.onStepClickCallback(firstStep.mapId, firstStep.questionIndex);
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

        const moveSpeed = 220;
        const step = moveSpeed * dt;

        if (dist <= step) {
          this.playerPos.x = targetWP.x;
          this.playerPos.y = targetWP.y;
          this.currentWaypointIndex++;

          if (this.currentWaypointIndex >= this.walkingWaypoints.length) {
            this.isWalkingAnimation = false;
            this.walkBubbleText = 'QUEST READY!';
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

    // ── LAYER 3: Interactive Kingdom Banners & Badges ──
    this.drawKingdomBanners(time);

    // ── LAYER 4: Checkpoint Node Highlights ──
    this.drawStepNodes(time);

    // ── LAYER 5: Student Mascot Player Avatar & Running Dust ──
    this.drawRunDust();
    this.drawPlayerAvatar(time);

    // 6. Magic Sparkles & Foreground Atmosphere
    this.drawSparkles(time);
    this.drawClouds('fg');

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

      // Floating Minecraft Voxel Nameplate Banner
      const bannerWidth = Math.max(190, k.name.length * 12 + 34);
      const bannerHeight = 34;
      const bannerY = k.y + k.height / 2 + 10;

      // Shadow
      this.ctx.fillStyle = '#0F172A';
      this.drawRoundedRect(k.x - bannerWidth / 2 + 3, bannerY - bannerHeight / 2 + 4, bannerWidth, bannerHeight, 8);
      this.ctx.fill();

      // Body
      this.ctx.fillStyle = k.unlocked ? '#1E293B' : '#0F172A';
      this.ctx.strokeStyle = k.unlocked ? (isHovered ? '#FDE047' : k.color) : '#475569';
      this.ctx.lineWidth = 3;
      this.drawRoundedRect(k.x - bannerWidth / 2, bannerY - bannerHeight / 2, bannerWidth, bannerHeight, 8);
      this.ctx.fill();
      this.ctx.stroke();

      // Text
      this.ctx.font = '700 14px "Quicksand", sans-serif';
      this.ctx.fillStyle = k.unlocked ? '#FDE047' : '#94A3B8';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(k.name.toUpperCase(), k.x, bannerY);

      // Lock Emblem for locked kingdoms
      if (!k.unlocked) {
        const padY = k.y + Math.sin(time * 2.5) * 3;
        this.drawVectorLock(k.x, padY);
      }

      this.ctx.restore();
    });
  }

  private drawVectorStar(cx: number, cy: number, r: number = 7) {
    const spikes = 5;
    const innerR = r * 0.45;
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - r);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * r;
      y = cy + Math.sin(rot) * r;
      this.ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      this.ctx.lineTo(x, y);
      rot += step;
    }
    this.ctx.lineTo(cx, cy - r);
    this.ctx.closePath();
    this.ctx.fillStyle = '#FACC15';
    this.ctx.strokeStyle = '#CA8A04';
    this.ctx.lineWidth = 1.5;
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawVectorLock(x: number, y: number) {
    this.ctx.save();
    // Shackle
    this.ctx.beginPath();
    this.ctx.arc(x, y - 6, 8, Math.PI, 0, false);
    this.ctx.strokeStyle = '#E2E8F0';
    this.ctx.lineWidth = 3.5;
    this.ctx.stroke();

    // Body
    this.ctx.fillStyle = '#F59E0B';
    this.ctx.strokeStyle = '#B45309';
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(x - 11, y - 6, 22, 18, 4);
    this.ctx.fill();
    this.ctx.stroke();

    // Keyhole
    this.ctx.fillStyle = '#78350F';
    this.ctx.beginPath();
    this.ctx.arc(x, y + 1, 2.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillRect(x - 1.5, y + 2, 3, 5);
    this.ctx.restore();
  }



  private drawStepNodes(time: number) {
    this.steps.forEach((step) => {
      const isHovered = this.hoveredStepNode === step;
      this.ctx.save();

      const r = 26;

      // 1. Active Quest Pulsing Halo & Energy Aura
      if (step.current) {
        // Outer pulsing ring
        const pulse = r + 8 + Math.sin(time * 4.5) * 5;
        this.ctx.beginPath();
        this.ctx.arc(step.x, step.y, pulse, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        // Soft golden ambient aura
        const aura = this.ctx.createRadialGradient(step.x, step.y, r * 0.3, step.x, step.y, pulse + 10);
        aura.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
        aura.addColorStop(1, 'rgba(251, 191, 36, 0)');
        this.ctx.fillStyle = aura;
        this.ctx.beginPath();
        this.ctx.arc(step.x, step.y, pulse + 10, 0, Math.PI * 2);
        this.ctx.fill();

        // Vibrant 3D Cursor Arrow
        const arrowY = step.y - 48 + Math.sin(time * 5) * 5;
        this.ctx.fillStyle = '#FBBF24';
        this.ctx.strokeStyle = '#78350F';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(step.x, arrowY + 12);
        this.ctx.lineTo(step.x - 10, arrowY);
        this.ctx.lineTo(step.x - 4, arrowY);
        this.ctx.lineTo(step.x - 4, arrowY - 14);
        this.ctx.lineTo(step.x + 4, arrowY - 14);
        this.ctx.lineTo(step.x + 4, arrowY);
        this.ctx.lineTo(step.x + 10, arrowY);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      // 2. Completed Step: Glowing Checkmark / 3 Stars Badge
      if (step.completed) {
        // Subtle emerald completed halo
        this.ctx.beginPath();
        this.ctx.arc(step.x, step.y, r + 2, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // 3-Star Rating Badge Below Node
        const starY = step.y + 24;
        const starOffsets = [-12, 0, 12];
        starOffsets.forEach((sx, sidx) => {
          const sy = starY + (sidx === 1 ? -2 : 1);
          this.drawVectorStar(step.x + sx, sy, 5.5);
        });
      }

      // 3. Hover Ring & Tooltip
      if (isHovered) {
        this.ctx.beginPath();
        this.ctx.arc(step.x, step.y, r + 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#38BDF8';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }

      if (step.current || isHovered) {
        const tipY = step.y - (step.current ? 78 : 42);
        const text = `${step.label.toUpperCase()}`;
        this.ctx.font = '700 13px "Quicksand", sans-serif';
        const tw = this.ctx.measureText(text).width + 20;

        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        this.ctx.strokeStyle = step.current ? '#F59E0B' : '#38BDF8';
        this.ctx.lineWidth = 2.5;
        this.drawRoundedRect(step.x - tw / 2, tipY - 13, tw, 26, 8);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = step.current ? '#FDE047' : '#F8FAFC';
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

    // Speech Bubble
    const bubbleText = this.walkBubbleText || 'QUEST READY!';
    this.ctx.font = '700 12px "Quicksand", sans-serif';
    const textMetrics = this.ctx.measureText(bubbleText);
    const bubbleWidth = Math.max(94, textMetrics.width + 24);

    const bubbleY = charY - 78;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#1E293B';
    this.ctx.lineWidth = 2.5;
    this.drawRoundedRect(charX - bubbleWidth / 2, bubbleY - 12, bubbleWidth, 24, 7);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(charX - 4, bubbleY + 12);
    this.ctx.lineTo(charX, bubbleY + 18);
    this.ctx.lineTo(charX + 4, bubbleY + 12);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();

    this.ctx.font = '700 12px "Quicksand", sans-serif';
    this.ctx.fillStyle = isWalking ? '#0284C7' : '#15803D';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(bubbleText, charX, bubbleY);

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
