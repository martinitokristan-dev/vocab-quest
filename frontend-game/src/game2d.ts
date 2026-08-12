// 2D Floating Sky World Map Renderer with 100% High Opacity Player Character Avatar

export interface QuestionStepNode {
  mapId: number;
  questionIndex: number;
  x: number;
  y: number;
  completed: boolean;
  current: boolean;
}

export class Game2DMapRenderer {
  private static savedPanOffset = { x: 0, y: 0 };
  private static savedZoomLevel = 1.0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private avatarEmoji = '⚔️';

  // 2D Camera Pan & Zoom Controls (Persistent & Clamped)
  private panOffset = { ...Game2DMapRenderer.savedPanOffset };
  private zoomLevel = Game2DMapRenderer.savedZoomLevel;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private hasMoved = false;

  private playerPos = { x: 0, y: 0 };
  private targetPos = { x: 0, y: 0 };

  private onStepClickCallback: ((mapId: number, questionIndex: number) => void) | null = null;
  private mapImages: Map<number, HTMLImageElement> = new Map();

  // Floating Clouds in Sky Area
  private clouds: Array<{ x: number; y: number; scale: number; speed: number }> = [];

  private kingdoms = [
    {
      id: 1,
      name: 'EPCES kingdom',
      x: 0,
      y: 0,
      bgUrl: '/storage/questions/epces-bg.jpg',
      unlocked: true,
      totalQuestions: 3,
    },
    {
      id: 2,
      name: 'Prince Hypermart Kingdom',
      x: 0,
      y: 0,
      bgUrl: '/storage/questions/prince-bg.jpg',
      unlocked: false,
      totalQuestions: 5,
    },
    {
      id: 3,
      name: 'Naliyagan Ground Kingdom',
      x: 0,
      y: 0,
      bgUrl: '/storage/questions/naliyagan-bg.jpg',
      unlocked: false,
      totalQuestions: 5,
    },
  ];

  private steps: QuestionStepNode[] = [];

  constructor(
    container: HTMLElement,
    avatarEmoji = '⚔️',
    activeMapId = 1,
    currentQuestionIndex = 1,
    customMaps?: Array<{ id: number; title: string; background_url?: string }>
  ) {
    this.avatarEmoji = avatarEmoji;
    this.canvas = document.createElement('canvas');
    this.resizeCanvas();

    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.position = 'fixed';
    this.canvas.style.inset = '0';
    this.canvas.style.zIndex = '5';
    this.canvas.style.cursor = 'grab';

    this.ctx = this.canvas.getContext('2d')!;
    container.replaceChildren(this.canvas);

    this.createZoomControls(container);

    if (customMaps && customMaps.length > 0) {
      customMaps.forEach((cm) => {
        const k = this.kingdoms.find((item) => item.id === cm.id);
        if (k) {
          k.name = cm.title;
          if (cm.background_url) k.bgUrl = cm.background_url;
        }
      });
    }

    this.initClouds();
    this.initLayout(activeMapId, currentQuestionIndex);
    this.preloadMapImages();
    this.bindEvents();
    this.startLoop();
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private createZoomControls(container: HTMLElement) {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.position = 'fixed';
    controlsDiv.style.bottom = '28px';
    controlsDiv.style.right = '28px';
    controlsDiv.style.zIndex = '30';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.flexDirection = 'column';
    controlsDiv.style.gap = '8px';

    controlsDiv.innerHTML = `
      <button id="zoomInBtn" style="width: 44px; height: 44px; border-radius: 12px; background: #FFFFFF; border: 2px solid #EA580C; font-size: 20px; font-weight: bold; color: #9A3412; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">＋</button>
      <button id="zoomOutBtn" style="width: 44px; height: 44px; border-radius: 12px; background: #FFFFFF; border: 2px solid #EA580C; font-size: 20px; font-weight: bold; color: #9A3412; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">－</button>
      <button id="resetZoomBtn" style="padding: 6px 10px; border-radius: 10px; background: #FFFFFF; border: 2px solid #EA580C; font-size: 11px; font-weight: bold; color: #9A3412; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">Reset</button>
    `;

    container.appendChild(controlsDiv);

    document.getElementById('zoomInBtn')?.addEventListener('click', () => {
      this.zoomLevel = Math.min(this.zoomLevel + 0.2, 2.2);
      Game2DMapRenderer.savedZoomLevel = this.zoomLevel;
    });

    document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
      this.zoomLevel = Math.max(this.zoomLevel - 0.2, 0.7);
      Game2DMapRenderer.savedZoomLevel = this.zoomLevel;
      this.clampPan();
    });

    document.getElementById('resetZoomBtn')?.addEventListener('click', () => {
      this.zoomLevel = 1.0;
      this.panOffset = { x: 0, y: 0 };
      Game2DMapRenderer.savedZoomLevel = 1.0;
      Game2DMapRenderer.savedPanOffset = { x: 0, y: 0 };
    });
  }

  private initClouds() {
    this.clouds = [
      { x: 60, y: 65, scale: 1.3, speed: 0.35 },
      { x: 480, y: 100, scale: 1.0, speed: 0.25 },
      { x: 920, y: 60, scale: 1.5, speed: 0.30 },
      { x: 1300, y: 90, scale: 1.1, speed: 0.40 },

      { x: 120, y: this.canvas.height - 110, scale: 1.4, speed: 0.30 },
      { x: 620, y: this.canvas.height - 80, scale: 1.1, speed: 0.20 },
      { x: 1080, y: this.canvas.height - 130, scale: 1.3, speed: 0.35 },
    ];
  }

  private initLayout(activeMapId: number, currentQuestionIndex: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.kingdoms.forEach((k) => {
      k.unlocked = k.id <= activeMapId;
    });

    this.kingdoms[0].x = w * 0.18;
    this.kingdoms[0].y = h * 0.50;

    this.kingdoms[1].x = w * 0.50;
    this.kingdoms[1].y = h * 0.38;

    this.kingdoms[2].x = w * 0.82;
    this.kingdoms[2].y = h * 0.50;

    this.steps = [];

    // Map 1 Path (3 Question Steps: ①, ②, ③)
    const k1 = this.kingdoms[0];
    const k2 = this.kingdoms[1];

    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const x = (1 - t) * k1.x + t * k2.x;
      const y = (1 - t) * k1.y + t * k2.y + 35;

      const isCurrent = activeMapId === 1 && currentQuestionIndex === i;
      const isCompleted = activeMapId > 1 || (activeMapId === 1 && currentQuestionIndex > i);

      this.steps.push({
        mapId: 1,
        questionIndex: i,
        x,
        y,
        completed: isCompleted,
        current: isCurrent,
      });

      if (isCurrent) {
        this.playerPos = { x, y: y - 28 };
        this.targetPos = { x, y: y - 28 };
      }
    }

    // Map 2 Path (5 Question Steps: ①, ②, ③, ④, ⑤)
    const k3 = this.kingdoms[2];

    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const x = (1 - t) * k2.x + t * k3.x;
      const y = (1 - t) * k2.y + t * k3.y + 35;

      const isCurrent = activeMapId === 2 && currentQuestionIndex === i;
      const isCompleted = activeMapId > 2 || (activeMapId === 2 && currentQuestionIndex > i);

      this.steps.push({
        mapId: 2,
        questionIndex: i,
        x,
        y,
        completed: isCompleted,
        current: isCurrent,
      });

      if (isCurrent) {
        this.playerPos = { x, y: y - 28 };
        this.targetPos = { x, y: y - 28 };
      }
    }

    this.clampPan();
  }

  private preloadMapImages() {
    this.kingdoms.forEach((k) => {
      if (k.bgUrl) {
        const img = new Image();
        img.src = k.bgUrl;
        img.onload = () => this.mapImages.set(k.id, img);
      }
    });
  }

  private clampPan() {
    const maxPanX = (this.canvas.width * 0.35) * this.zoomLevel;
    const maxPanY = (this.canvas.height * 0.30) * this.zoomLevel;

    this.panOffset.x = Math.max(-maxPanX, Math.min(maxPanX, this.panOffset.x));
    this.panOffset.y = Math.max(-maxPanY, Math.min(maxPanY, this.panOffset.y));
    Game2DMapRenderer.savedPanOffset = { ...this.panOffset };
  }

  public onStepClick(cb: (mapId: number, questionIndex: number) => void) {
    this.onStepClickCallback = cb;
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.initLayout(1, 1);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.hasMoved = false;
      this.dragStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - (this.dragStart.x + this.panOffset.x);
        const dy = e.clientY - (this.dragStart.y + this.panOffset.y);
        if (Math.hypot(dx, dy) > 4) {
          this.hasMoved = true;
        }

        this.panOffset.x = e.clientX - this.dragStart.x;
        this.panOffset.y = e.clientY - this.dragStart.y;
        this.clampPan();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.max(0.7, Math.min(2.2, this.zoomLevel * zoomFactor));
      this.zoomLevel = newZoom;
      Game2DMapRenderer.savedZoomLevel = this.zoomLevel;
      this.clampPan();
    }, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      if (this.hasMoved) return;

      const rect = this.canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;

      const worldX = (rawX - cx - this.panOffset.x) / this.zoomLevel + cx;
      const worldY = (rawY - cy - this.panOffset.y) / this.zoomLevel + cy;

      for (const step of this.steps) {
        const dist = Math.hypot(worldX - step.x, worldY - step.y);
        if (dist < 32 && this.onStepClickCallback) {
          const map = this.kingdoms.find((k) => k.id === step.mapId);
          if (map && map.unlocked) {
            this.targetPos = { x: step.x, y: step.y - 28 };
            this.onStepClickCallback(step.mapId, step.questionIndex);
            return;
          }
        }
      }

      for (const k of this.kingdoms) {
        const dist = Math.hypot(worldX - k.x, worldY - k.y);
        if (dist < 75 && k.unlocked && this.onStepClickCallback) {
          this.onStepClickCallback(k.id, 1);
          return;
        }
      }
    });
  }

  private drawBackground() {
    this.ctx.fillStyle = '#E0F2FE';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    const spacing = 24;
    for (let x = 12; x < this.canvas.width; x += spacing) {
      for (let y = 12; y < this.canvas.height; y += spacing) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  private drawClouds() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';

    this.clouds.forEach((cloud) => {
      cloud.x += cloud.speed;
      if (cloud.x > this.canvas.width + 160) {
        cloud.x = -160;
      }

      this.ctx.save();
      this.ctx.translate(cloud.x, cloud.y);
      this.ctx.scale(cloud.scale, cloud.scale);

      this.ctx.beginPath();
      this.ctx.arc(0, 0, 32, 0, Math.PI * 2);
      this.ctx.arc(28, -12, 38, 0, Math.PI * 2);
      this.ctx.arc(60, 0, 32, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  private drawKingdomIslands() {
    const time = Date.now() * 0.002;

    this.kingdoms.forEach((k) => {
      const floatY = k.unlocked ? Math.sin(time + k.id) * 8 : 0;
      const cardX = k.x;
      const cardY = k.y + floatY;
      const width = 130;
      const height = 130;
      const radius = 16;

      this.ctx.save();

      this.ctx.fillStyle = k.unlocked ? '#EA580C' : 'rgba(0, 0, 0, 0.2)';
      this.drawRoundedRect(cardX - width / 2 + 6, cardY - height / 2 + 8, width, height, radius);
      this.ctx.fill();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = k.unlocked ? '#000000' : 'rgba(0,0,0,0.2)';
      this.ctx.lineWidth = 2.5;

      this.drawRoundedRect(cardX - width / 2, cardY - height / 2, width, height, radius);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.save();
      this.drawRoundedRect(cardX - width / 2 + 4, cardY - height / 2 + 4, width - 8, height - 8, radius - 4);
      this.ctx.clip();

      const img = this.mapImages.get(k.id);
      if (img) {
        this.ctx.drawImage(img, cardX - width / 2 + 4, cardY - height / 2 + 4, width - 8, height - 8);
      } else {
        this.ctx.fillStyle = k.unlocked ? '#10B981' : '#CBD5E1';
        this.ctx.fillRect(cardX - width / 2, cardY - height / 2, width, height);
        this.ctx.font = '40px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(k.id === 1 ? '🏰' : k.id === 2 ? '🏯' : '🕌', cardX, cardY + 12);
      }

      if (!k.unlocked) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        this.ctx.fillRect(cardX - width / 2, cardY - height / 2, width, height);

        this.ctx.font = '36px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🔒', cardX, cardY);
      }

      this.ctx.restore();
      this.ctx.restore();

      const pillWidth = Math.max(140, k.name.length * 9.5);
      const pillHeight = 32;
      const pillY = cardY + height / 2 + 24;

      this.ctx.save();

      this.ctx.fillStyle = k.unlocked ? '#C2410C' : '#94A3B8';
      this.drawRoundedRect(cardX - pillWidth / 2 + 3, pillY - pillHeight / 2 + 4, pillWidth, pillHeight, 16);
      this.ctx.fill();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = k.unlocked ? '#C2410C' : '#94A3B8';
      this.ctx.lineWidth = 2.5;
      this.drawRoundedRect(cardX - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight, 16);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = 'bold 12px Outfit, sans-serif';
      this.ctx.fillStyle = k.unlocked ? '#9A3412' : '#64748B';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(k.name, cardX, pillY);

      this.ctx.restore();
    });
  }

  private drawPathAndStepNodes() {
    const time = Date.now() * 0.003;

    this.steps.forEach((step) => {
      const isMapUnlocked = this.kingdoms.find((k) => k.id === step.mapId)?.unlocked;
      const isPulse = step.current ? Math.sin(time * 3) * 2.5 : 0;
      const radius = isMapUnlocked ? 17 + isPulse : 14;

      this.ctx.save();

      if (isMapUnlocked) {
        this.ctx.fillStyle = '#0F172A';
        this.ctx.beginPath();
        this.ctx.arc(step.x + 2, step.y + 3, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(step.x, step.y, radius, 0, Math.PI * 2);

        if (step.completed) {
          this.ctx.fillStyle = '#0369A1';
        } else if (step.current) {
          this.ctx.fillStyle = '#0284C7';
        } else {
          this.ctx.fillStyle = '#0F172A';
        }
        this.ctx.fill();

        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = '#0284C7';
        this.ctx.stroke();

        this.ctx.font = 'bold 13px Outfit, sans-serif';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(step.completed ? '✓' : `${step.questionIndex}`, step.x, step.y);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(step.x, step.y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  private drawPlayerAvatar() {
    this.ctx.save();
    this.ctx.globalAlpha = 1.0; // Ensure 100% full opacity

    this.playerPos.x += (this.targetPos.x - this.playerPos.x) * 0.1;
    this.playerPos.y += (this.targetPos.y - this.playerPos.y) * 0.1;

    const bobY = Math.sin(Date.now() * 0.008) * 5;
    const px = this.playerPos.x;
    const py = this.playerPos.y + bobY;

    // Crisp Character Badge Shadow
    this.ctx.beginPath();
    this.ctx.ellipse(px + 2, py + 18, 16, 6, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    this.ctx.fill();

    // Solid White Circular Avatar Badge
    this.ctx.beginPath();
    this.ctx.arc(px, py - 2, 22, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = '#0284C7';
    this.ctx.stroke();

    // 100% Full Opacity Player Emoji Avatar
    this.ctx.font = '28px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(this.avatarEmoji, px, py - 1);

    this.ctx.restore();
  }

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }

  private startLoop() {
    const loop = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.drawBackground();
      this.drawClouds();

      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;

      this.ctx.save();
      this.ctx.translate(cx + this.panOffset.x, cy + this.panOffset.y);
      this.ctx.scale(this.zoomLevel, this.zoomLevel);
      this.ctx.translate(-cx, -cy);

      this.drawPathAndStepNodes();
      this.drawKingdomIslands();
      this.drawPlayerAvatar();

      this.ctx.restore();

      this.animFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}
