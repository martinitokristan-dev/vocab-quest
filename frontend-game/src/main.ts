import './style.css';
import { gameApi, type CurrentQuestionResponse, type SubmitAnswerResponse } from './api';
import { Game2DMapRenderer } from './game2d';
import { soundManager } from './soundManager';
import { Icons } from './icons';

const PRAISE_PHRASES = [
  'Excellent work! You found the right meaning!',
  'Fantastic choice! That is correct!',
  'Brilliant job! You are a true vocabulary master!',
  'Outstanding! Perfect answer!',
  'Great job! Keep up the amazing learning!',
  'Superb! You nailed that vocabulary word!',
  'Wonderful! That is the exact definition!',
  'Spot on! Keep conquering the quest!',
];

const TRY_AGAIN_PHRASES = [
  "Not quite, but don't give up! Try again.",
  "Good try! Listen to the question again and pick the best choice.",
  "That's okay! Review the options and give it another shot.",
  "Almost there! Listen closely and try another choice.",
];

interface StudentGameAppState {
  screen: 'title' | 'loading' | 'join' | 'world_map' | 'question' | 'completed';
  pin: string;
  playerName: string;
  avatarSlug: string;
  currentData: CurrentQuestionResponse | null;
  selectedAnswerId: number | null;
  submitResult: SubmitAnswerResponse | null;
  submitting: boolean;
  score: number;
  error: string | null;
  attempts: Record<number, number>; // questionId -> attempt count
  history: Array<{ questionId: number; word: string; isCorrect: boolean; stars: number }>;
  lastPraiseIndex: number;
  lastTryAgainIndex: number;
  customMascotSpeech: string | null;
  wrongAnswerIds: number[];

  // Modals
  isHowToPlayOpen: boolean;
  isSettingsOpen: boolean;
  isPauseMenuOpen: boolean;
  loadingProgress: number; // 0 to 12 segments
  loadingTargetScreen: 'join' | 'world_map';
}

const AVATARS = [
  { slug: 'learner-girl', label: 'Learner Girl', image: '/assets/mascot_girl.png' },
  { slug: 'quest-boy', label: 'Learner Boy', image: '/assets/mascot_boy.png' },
  { slug: 'scholar-girl', label: 'School Girl', image: '/assets/scholar_girl.png' },
  { slug: 'scholar-boy', label: 'School Boy', image: '/assets/scholar_boy.png' },
  { slug: 'morena-girl', label: 'Sporty Girl', image: '/assets/morena_girl.png' },
  { slug: 'moreno-boy', label: 'Explorer Boy', image: '/assets/moreno_boy.png' },
];

class StudentArcadeGame {
  private appEl: HTMLElement;
  private bgLayerEl: HTMLImageElement;
  private mapRenderer: Game2DMapRenderer | null = null;

  private state: StudentGameAppState = {
    screen: 'title',
    pin: '',
    playerName: '',
    avatarSlug: 'learner-girl',
    currentData: null,
    selectedAnswerId: null,
    submitResult: null,
    submitting: false,
    score: 0,
    error: null,
    attempts: {},
    history: [],
    lastPraiseIndex: -1,
    lastTryAgainIndex: -1,
    customMascotSpeech: null,
    wrongAnswerIds: [],
    isHowToPlayOpen: false,
    isSettingsOpen: false,
    isPauseMenuOpen: false,
    loadingProgress: 0,
    loadingTargetScreen: 'join',
  };

  private pollInterval: number | null = null;
  private loadingInterval: number | null = null;
  private lastNarratedQuestionId: number | null = null;
  private lastActiveMapId: number = 1;

  constructor() {
    this.appEl = document.getElementById('app') as HTMLElement;
    this.bgLayerEl = document.createElement('img');
    this.bgLayerEl.className = 'game-bg-layer';
    this.bgLayerEl.style.display = 'none';
    document.body.prepend(this.bgLayerEl);

    this.bindGlobalKeyboard();
    this.render();
  }

  private bindGlobalKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state.isHowToPlayOpen || this.state.isSettingsOpen) {
          soundManager.stopSpeech();
          this.setState({ isHowToPlayOpen: false, isSettingsOpen: false });
        } else if (this.state.screen === 'world_map' || this.state.screen === 'question') {
          soundManager.playClick();
          const nextPauseState = !this.state.isPauseMenuOpen;
          if (nextPauseState) {
            soundManager.stopSpeech();
          }
          this.setState({ isPauseMenuOpen: nextPauseState });
          if (!nextPauseState && this.state.screen === 'question' && !this.state.submitResult) {
            soundManager.resumeQuestionNarration();
          }
        }
      }
    });
  }

  private setState(partialState: Partial<StudentGameAppState>) {
    const prevScreen = this.state.screen;
    const prevModals = {
      howTo: this.state.isHowToPlayOpen,
      settings: this.state.isSettingsOpen,
      pause: this.state.isPauseMenuOpen,
    };

    this.state = { ...this.state, ...partialState };

    const screenChanged = prevScreen !== this.state.screen;
    const modalChanged =
      prevModals.howTo !== this.state.isHowToPlayOpen ||
      prevModals.settings !== this.state.isSettingsOpen ||
      prevModals.pause !== this.state.isPauseMenuOpen;

    if (screenChanged) {
      this.render();
    } else if (modalChanged) {
      this.renderModals();
    } else if (this.state.screen !== 'world_map') {
      this.render();
    }
  }

  private startLoading(targetScreen: 'join' | 'world_map' = 'join') {
    if (this.loadingInterval) clearInterval(this.loadingInterval);

    this.setState({ screen: 'loading', loadingProgress: 0, loadingTargetScreen: targetScreen });

    let currentSegment = 0;
    const totalSegments = 12;

    this.loadingInterval = window.setInterval(() => {
      currentSegment++;
      if (currentSegment % 3 === 0) soundManager.playStep();

      this.setState({ loadingProgress: currentSegment });

      if (currentSegment >= totalSegments) {
        if (this.loadingInterval) clearInterval(this.loadingInterval);
        setTimeout(() => {
          soundManager.playSuccess();
          this.setState({ screen: this.state.loadingTargetScreen });
        }, 300);
      }
    }, 120);
  }

  private startPollingQuestion() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    const checkQuestion = async () => {
      // While showing praise/result feedback, do not poll or interrupt speech
      if (this.state.submitResult) return;

      try {
        const res = await gameApi.getCurrentQuestion();

        if (res.is_completed) {
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.setState({ screen: 'completed', score: res.total_correct || this.state.score });
          return;
        }

        if (res.data) {
          const prevQ = this.state.currentData?.data?.question;
          const newQ = res.data.question;
          const isNewQuestion = !prevQ || prevQ.id !== newQ.id;
          const isScoreChanged = this.state.score !== res.data.session.score;
          const isMapChanged = this.state.currentData?.data?.map.id !== res.data.map.id;
          const shouldChangeScreen = (this.state.screen === 'join' || this.state.screen === 'loading');

          // If nothing meaningful changed, avoid re-rendering to prevent screen flickering
          if (!isNewQuestion && !isScoreChanged && !isMapChanged && !shouldChangeScreen) {
            return;
          }

          const nextScreen = shouldChangeScreen || isMapChanged ? 'world_map' : this.state.screen;

          this.setState({
            screen: nextScreen,
            currentData: res,
            score: res.data.session.score,
            selectedAnswerId: isNewQuestion ? null : this.state.selectedAnswerId,
            submitResult: isNewQuestion ? null : this.state.submitResult,
            wrongAnswerIds: isNewQuestion ? [] : this.state.wrongAnswerIds,
            customMascotSpeech: isNewQuestion ? null : this.state.customMascotSpeech,
          });
        }
      } catch (err: any) {
        console.error('Poll question error:', err);
      }
    };

    checkQuestion();
    this.pollInterval = window.setInterval(checkQuestion, 2500);
  }

  private async handleJoin(e: Event) {
    e.preventDefault();
    if (!this.state.pin || !this.state.playerName) {
      this.setState({ error: 'Please enter 6-digit PIN and Player Name' });
      return;
    }

    try {
      soundManager.playClick();
      this.setState({ error: null, submitting: true });
      await gameApi.joinRoom(this.state.pin, this.state.playerName, this.state.avatarSlug);
      this.setState({ submitting: false });
      this.startLoading('world_map');
      this.startPollingQuestion();
    } catch (err: any) {
      this.setState({ error: err.message || 'Failed to join game room', submitting: false });
    }
  }

  private async handleSelectAnswer(answerId: number) {
    if (this.state.submitting || !this.state.currentData?.data) return;

    soundManager.stopSpeech();

    const q = this.state.currentData.data.question;
    const currentAttempts = (this.state.attempts[q.id] || 0) + 1;
    const updatedAttempts = { ...this.state.attempts, [q.id]: currentAttempts };

    try {
      this.setState({ selectedAnswerId: answerId, submitting: true, attempts: updatedAttempts });
      const res = await gameApi.submitAnswer(q.id, answerId);

      if (res.is_correct) {
        // Pause background polling so poller does not race against the praise speech!
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }

        // --- 1. CORRECT ANSWER: 3-STAR RATING & DYNAMIC PRAISE ---
        const starsEarned = currentAttempts === 1 ? 3 : currentAttempts === 2 ? 2 : 1;

        // Select a non-repeating praise phrase
        let pIdx = Math.floor(Math.random() * PRAISE_PHRASES.length);
        if (pIdx === this.state.lastPraiseIndex) {
          pIdx = (pIdx + 1) % PRAISE_PHRASES.length;
        }
        const praise = PRAISE_PHRASES[pIdx];

        soundManager.playSuccess();

        const updatedHistory = [
          ...this.state.history.filter((h) => h.questionId !== q.id),
          { questionId: q.id, word: q.highlighted_word, isCorrect: true, stars: starsEarned },
        ];

        this.setState({
          submitResult: res,
          score: res.score,
          submitting: false,
          history: updatedHistory,
          lastPraiseIndex: pIdx,
          customMascotSpeech: `${praise} (+${starsEarned} Stars!)`,
        });

        let hasAdvanced = false;
        const advanceToNext = () => {
          if (hasAdvanced) return;
          hasAdvanced = true;
          this.setState({ submitResult: null, selectedAnswerId: null });
          this.startPollingQuestion();
        };

        // Speak full praise and advance only after it completely finishes
        soundManager.speakPraise(praise, () => {
          setTimeout(advanceToNext, 1000);
        });

        // Safety fallback timer if speech synthesis is disabled/delayed
        setTimeout(advanceToNext, 8000);
      } else {
        // --- 2. WRONG ANSWER: TRY AGAIN & AUTO-REREAD QUESTION ---
        let tIdx = Math.floor(Math.random() * TRY_AGAIN_PHRASES.length);
        if (tIdx === this.state.lastTryAgainIndex) {
          tIdx = (tIdx + 1) % TRY_AGAIN_PHRASES.length;
        }
        const tryAgainMsg = TRY_AGAIN_PHRASES[tIdx];

        soundManager.playWrong();

        const choicesList = q.answers.map((ans, i) => ({
          letter: String.fromCharCode(65 + i),
          text: ans.text,
        }));

        this.setState({
          submitting: false,
          submitResult: null,
          lastTryAgainIndex: tIdx,
          customMascotSpeech: tryAgainMsg,
          wrongAnswerIds: [...this.state.wrongAnswerIds, answerId],
        });

        // TTS speaks try-again encouragement and automatically re-reads the question & choices
        setTimeout(() => {
          if (this.state.screen === 'question' && !this.state.submitResult) {
            soundManager.speakTryAgain(tryAgainMsg, q.sentence, q.highlighted_word, choicesList);
          }
        }, 300);
      }
    } catch (err: any) {
      this.setState({ error: err.message || 'Failed to submit answer', submitting: false });
    }
  }

  private render() {
    if (this.mapRenderer && this.state.screen !== 'world_map') {
      this.mapRenderer.destroy();
      this.mapRenderer = null;
    }

    switch (this.state.screen) {
      case 'title':
        this.bgLayerEl.style.display = 'none';
        this.renderTitleScreen();
        break;
      case 'loading':
        this.bgLayerEl.style.display = 'none';
        this.renderLoadingScreen();
        break;
      case 'join':
        this.bgLayerEl.style.display = 'none';
        this.renderJoinScreen();
        break;
      case 'world_map':
        this.bgLayerEl.style.display = 'none';
        this.renderWorldMapScreen();
        break;
      case 'question':
        this.renderQuestionScreen();
        break;
      case 'completed':
        this.bgLayerEl.style.display = 'none';
        this.renderCompletedScreen();
        break;
    }

    this.renderModals();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. MINECRAFT TITLE SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderTitleScreen() {
    this.appEl.innerHTML = `
      <div class="title-scene-container animate-fade-in">
        <div class="title-logo-container">
          <img src="/assets/vocab_logo.png" class="title-logo-img" alt="Vocab Quest" />
        </div>

        <div class="title-stage-wrapper">
          <!-- Left Mascot Character -->
          <div class="mascot-character-container girl">
            <div class="pixel-speech-bubble left">
              <span class="pixel-speech-text">
                <span>WELCOME TO</span>
                <span>PROSPERIDAD!</span>
              </span>
            </div>
            <img src="/assets/mascot_girl.png" class="mascot-character-img" alt="Mascot Girl" />
          </div>

          <!-- Center Voxel Buttons Stack -->
          <div class="voxel-buttons-stack">
            <div id="playGameBtnFrame" class="vocab-btn-frame">
              <button id="playGameBtn" class="vocab-btn vocab-btn-green">
                <span class="vocab-icon-play">${Icons.play(26)}</span>
                <span>PLAY QUEST</span>
              </button>
            </div>

            <div id="howToPlayBtnFrame" class="vocab-btn-frame">
              <button id="howToPlayBtn" class="vocab-btn vocab-btn-blue">
                <span class="vocab-icon-book">${Icons.sparkles(24)}</span>
                <span>HOW TO PLAY</span>
              </button>
            </div>

            <div id="settingsBtnFrame" class="vocab-btn-frame">
              <button id="settingsBtn" class="vocab-btn vocab-btn-yellow">
                <span class="vocab-icon-gear">${Icons.refresh(24)}</span>
                <span>SETTINGS</span>
              </button>
            </div>
          </div>

          <!-- Right Mascot Character -->
          <div class="mascot-character-container boy">
            <div class="pixel-speech-bubble right">
              <span class="pixel-speech-text">
                <span>LEARN & CONQUER</span>
                <span>THE KINGDOMS!</span>
              </span>
            </div>
            <img src="/assets/mascot_boy.png" class="mascot-character-img" alt="Mascot Boy" />
          </div>
        </div>

        <div class="title-school-footer">
          Vocab Quest v2.0 • DepEd Prosperidad District Edition
        </div>
      </div>
    `;

    const playFrame = document.getElementById('playGameBtnFrame');
    const howToFrame = document.getElementById('howToPlayBtnFrame');
    const settFrame = document.getElementById('settingsBtnFrame');

    playFrame?.addEventListener('mouseenter', () => soundManager.playHover());
    howToFrame?.addEventListener('mouseenter', () => soundManager.playHover());
    settFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    const playAction = () => {
      soundManager.playClick();
      this.startLoading('join');
    };
    const howToAction = () => {
      soundManager.playClick();
      this.setState({ isHowToPlayOpen: true });
    };
    const settingsAction = () => {
      soundManager.playClick();
      this.setState({ isSettingsOpen: true });
    };

    playFrame?.addEventListener('click', playAction);
    document.getElementById('playGameBtn')?.addEventListener('click', (e) => { e.stopPropagation(); playAction(); });

    howToFrame?.addEventListener('click', howToAction);
    document.getElementById('howToPlayBtn')?.addEventListener('click', (e) => { e.stopPropagation(); howToAction(); });

    settFrame?.addEventListener('click', settingsAction);
    document.getElementById('settingsBtn')?.addEventListener('click', (e) => { e.stopPropagation(); settingsAction(); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderLoadingScreen() {
    const totalSegments = 12;
    const progress = Math.min(this.state.loadingProgress, totalSegments);

    const segmentsHtml = Array.from({ length: totalSegments })
      .map((_, i) => `<div class="loading-segment ${i < progress ? 'active' : ''}"></div>`)
      .join('');

    this.appEl.innerHTML = `
      <div class="loading-scene-container animate-fade-in">
        <div class="loading-box">
          <div class="loading-text-title">BUILDING WORLD TERRAIN...</div>
          <div class="loading-segmented-bar">
            ${segmentsHtml}
          </div>
          <div class="loading-text-subtitle">Generating 2D Island Maps & Challenges</div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. STUDENT JOIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderJoinScreen() {
    const avatarsHtml = AVATARS.map(
      (a) => `
        <div class="student-avatar-card ${this.state.avatarSlug === a.slug ? 'selected' : ''}" data-slug="${a.slug}">
          ${this.state.avatarSlug === a.slug ? `<div class="student-avatar-check">${Icons.check(14)}</div>` : ''}
          <img src="${a.image}" alt="${a.label}" class="student-avatar-img" />
          <span class="student-avatar-label">${a.label}</span>
        </div>
      `
    ).join('');

    this.appEl.innerHTML = `
      <div class="join-scene-container animate-fade-in">
        <div class="join-voxel-card">
          <div class="join-card-header">
            <button id="joinBackBtn" class="vocab-hud-btn">◀ TITLE</button>
            <span class="join-school-badge">PROSPERIDAD DISTRICT</span>
          </div>

          <h2 class="join-title">JOIN GAME ROOM</h2>
          <p class="join-subtitle">Enter your teacher's 6-digit Room PIN and choose your student avatar</p>

          ${this.state.error ? `
            <div class="join-error-box animate-shake">
              <span>${this.state.error}</span>
            </div>
          ` : ''}

          <form id="joinForm" class="join-form">
            <div class="join-field-group">
              <label class="join-label">6-DIGIT ROOM PIN</label>
              <input
                id="pinInput"
                type="text"
                maxlength="6"
                placeholder="123456"
                value="${this.state.pin}"
                class="join-input join-input-pin"
                required
                autocomplete="off"
              />
            </div>

            <div class="join-field-group">
              <label class="join-label">YOUR PLAYER NAME</label>
              <input
                id="nameInput"
                type="text"
                maxlength="25"
                placeholder="Enter hero name..."
                value="${this.state.playerName}"
                class="join-input"
                required
                autocomplete="off"
              />
            </div>

            <div class="join-field-group">
              <label class="join-label">CHOOSE YOUR STUDENT CHARACTER</label>
              <div class="student-avatar-grid">
                ${avatarsHtml}
              </div>
            </div>

            <div id="submitJoinBtnFrame" class="vocab-btn-frame" style="margin-top: 14px;">
              <button
                type="submit"
                id="submitJoinBtn"
                class="vocab-btn vocab-btn-green"
                style="height: 60px; font-size: 24px;"
                ${this.state.submitting ? 'disabled' : ''}
              >
                <span>${Icons.arrowRight(24)}</span>
                <span>${this.state.submitting ? 'JOINING ROOM...' : 'START ADVENTURE'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('joinBackBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      this.setState({ screen: 'title' });
    });

    const pinIn = document.getElementById('pinInput') as HTMLInputElement;
    const nameIn = document.getElementById('nameInput') as HTMLInputElement;
    const btnFrame = document.getElementById('submitJoinBtnFrame');

    pinIn?.focus();

    pinIn?.addEventListener('input', (e) => {
      this.state.pin = (e.target as HTMLInputElement).value;
    });

    nameIn?.addEventListener('input', (e) => {
      this.state.playerName = (e.target as HTMLInputElement).value;
    });

    btnFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    document.querySelectorAll('.student-avatar-card').forEach((card) => {
      card.addEventListener('mouseenter', () => soundManager.playHover());
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-slug');
        if (slug) {
          soundManager.playClick();
          this.setState({ avatarSlug: slug });
          soundManager.speakCharacterVoice(slug);
        }
      });
    });

    document.getElementById('joinForm')?.addEventListener('submit', (e) => this.handleJoin(e));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. 2D WORLD MAP SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderWorldMapScreen() {
    const avatar = AVATARS.find((a) => a.slug === this.state.avatarSlug) || AVATARS[0];
    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    const currentQuestionIndex = this.state.currentData?.data?.question?.id ? 1 : 1;
    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 0), 0);
    const starFillPercent = Math.min(100, Math.max(14, (totalStars / 15) * 100));

    this.appEl.innerHTML = `
      <!-- Top-Left Player Avatar & Candy Star Progress Bar -->
      <div class="candy-hud-top-left animate-fade-in">
        <div class="candy-avatar-box candy-hud-interactive" id="playerAvatarBox" title="${this.state.playerName || 'Hero Student'}">
          <img src="${avatar.image || '/assets/mascot_girl.png'}" class="candy-avatar-img" />
        </div>

        <div class="candy-star-progress-widget candy-hud-interactive">
          <div class="candy-star-badge-wrap">
            <svg class="candy-star-svg" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="starGoldGrad" cx="38%" cy="32%" r="65%">
                  <stop offset="0%" stop-color="#FFFBEB" />
                  <stop offset="35%" stop-color="#FDE047" />
                  <stop offset="70%" stop-color="#EAB308" />
                  <stop offset="100%" stop-color="#CA8A04" />
                </radialGradient>
              </defs>
              <path d="M 50,5 L 63,33 L 95,38 L 72,61 L 78,93 L 50,77 L 22,93 L 28,61 L 5,38 L 37,33 Z"
                    fill="url(#starGoldGrad)" stroke="#FEF3C7" stroke-width="4" stroke-linejoin="round" />
            </svg>
            <span class="candy-star-value">${totalStars}</span>
          </div>
          <div class="candy-pill-progress-track">
            <div class="candy-pill-progress-fill" style="width: ${starFillPercent}%;"></div>
          </div>
        </div>
      </div>

      <!-- Top-Right Controls HUD -->
      <div class="candy-hud-top-right animate-fade-in">
        <div class="candy-zone-pill">
          <span>${Icons.map(18)}</span>
          <span>PROSPERIDAD MAP</span>
        </div>
        <button id="mapPauseBtn" class="candy-menu-btn candy-hud-interactive">
          <span>${Icons.menu(18)}</span>
          <span>MENU</span>
        </button>
      </div>

      <!-- Fullscreen 2D Canvas Container -->
      <div id="canvasContainer" style="width: 100vw; height: 100vh;"></div>
    `;

    document.getElementById('playerAvatarBox')?.addEventListener('click', () => {
      soundManager.playClick();
      if (this.state.avatarSlug) {
        soundManager.speakCharacterVoice(this.state.avatarSlug);
      }
    });

    document.getElementById('mapPauseBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.setState({ isPauseMenuOpen: true });
    });

    const container = document.getElementById('canvasContainer');
    if (container) {
      const isMapTransition = this.lastActiveMapId < activeMapId;
      const fromMap = this.lastActiveMapId;
      this.lastActiveMapId = activeMapId;

      let initialPos: { x: number; y: number } | undefined = undefined;
      let path: Array<{ x: number; y: number }> = [];
      let unlockMsg = 'KINGDOM 2 UNLOCKED!';

      if (isMapTransition) {
        if (fromMap === 1 && activeMapId === 2) {
          initialPos = { x: 502, y: 649 };
          path = [
            { x: 502, y: 649 }, // EPCES Bridge Ramp (Node 3)
            { x: 550, y: 615 }, // Wooden Bridge Ramp
            { x: 620, y: 570 }, // Crossing River Bridge
            { x: 670, y: 540 }, // Bridge East Bank
            { x: 713, y: 522 }, // Bayan Bridge Promenade -> Kingdom 2 Question 1!
          ];
          unlockMsg = 'KINGDOM 2: QUESTION 1!';
        } else if (fromMap === 2 && activeMapId === 3) {
          initialPos = { x: 1152, y: 521 };
          path = [
            { x: 1152, y: 521 }, // Park Playground Turn (Node 8)
            { x: 1195, y: 460 }, // Valley Waterfall Crossing
            { x: 1230, y: 405 }, // Capitol Hill Turn
            { x: 1268, y: 351 }, // Capitol Hill Drive -> Kingdom 3 Question 1!
          ];
          unlockMsg = 'KINGDOM 3: QUESTION 1!';
        }
      }

      this.mapRenderer = new Game2DMapRenderer(
        container,
        avatar.image || '/assets/mascot_girl.png',
        activeMapId,
        currentQuestionIndex,
        undefined,
        initialPos
      );

      this.mapRenderer.onStepClick(() => {
        soundManager.stopSpeech();
        this.setState({ screen: 'question' });
      });

      if (isMapTransition && path.length > 0) {
        this.mapRenderer.animateWalkingPath(path, unlockMsg, () => {
          setTimeout(() => {
            if (this.state.screen === 'world_map') {
              soundManager.stopSpeech();
              this.setState({ screen: 'question' });
            }
          }, 1200);
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. QUESTION GAMEPLAY SCREEN (WITH TTS NARRATION & 3-STAR PROGRESSION)
  // ─────────────────────────────────────────────────────────────────────────────
  private renderQuestionScreen() {
    if (!this.state.currentData?.data) return;

    const data = this.state.currentData.data;
    const q = data.question;
    const result = this.state.submitResult;
    const selectedId = this.state.selectedAnswerId;
    const avatar = AVATARS.find((a) => a.slug === this.state.avatarSlug) || AVATARS[0];

    // Background assignment
    const mapOrder = data.map.order_index || data.map.id || 1;
    let bgUrl = '/assets/kingdom_epces.jpg';
    if ((data.map as any).background_url) {
      bgUrl = (data.map as any).background_url;
    } else if (mapOrder === 1 || data.map.title?.toLowerCase().includes('epces')) {
      bgUrl = '/assets/kingdom_epces.jpg';
    } else if (mapOrder === 2 || data.map.title?.toLowerCase().includes('bayan') || data.map.title?.toLowerCase().includes('prosperidad')) {
      bgUrl = '/assets/kingdom_bayan.jpg';
    } else if (mapOrder === 3 || data.map.title?.toLowerCase().includes('capitol') || data.map.title?.toLowerCase().includes('provincial')) {
      bgUrl = '/assets/kingdom_capitol.jpg';
    }

    this.bgLayerEl.src = bgUrl;
    this.bgLayerEl.style.display = 'block';

    const regex = new RegExp(`(${q.highlighted_word})`, 'gi');
    const formattedSentence = q.sentence.replace(regex, '<span class="highlighted-word">$1</span>');

    let mascotSpeech = this.state.customMascotSpeech || `Help me define the word "${q.highlighted_word}"!`;

    const choicesList = q.answers.map((ans, idx) => ({
      letter: String.fromCharCode(65 + idx),
      text: ans.text,
    }));

    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 0), 0);
    const starFillPercent = Math.min(100, Math.max(14, (totalStars / 15) * 100));

    this.appEl.innerHTML = `
      <!-- Top-Left Player & Star Bar -->
      <div class="candy-hud-top-left animate-fade-in">
        <div class="candy-star-progress-widget candy-hud-interactive">
          <div class="candy-star-badge-wrap">
            <svg class="candy-star-svg" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="quizStarGoldGrad" cx="38%" cy="32%" r="65%">
                  <stop offset="0%" stop-color="#FFFBEB" />
                  <stop offset="35%" stop-color="#FDE047" />
                  <stop offset="70%" stop-color="#EAB308" />
                  <stop offset="100%" stop-color="#CA8A04" />
                </radialGradient>
              </defs>
              <path d="M 50,5 L 63,33 L 95,38 L 72,61 L 78,93 L 50,77 L 22,93 L 28,61 L 5,38 L 37,33 Z"
                    fill="url(#quizStarGoldGrad)" stroke="#FEF3C7" stroke-width="4" stroke-linejoin="round" />
            </svg>
            <span class="candy-star-value">${totalStars}</span>
          </div>
          <div class="candy-pill-progress-track">
            <div class="candy-pill-progress-fill" style="width: ${starFillPercent}%;"></div>
          </div>
        </div>
      </div>

      <!-- Top-Right Controls -->
      <div class="candy-hud-top-right animate-fade-in">
        <button id="worldMapNavBtn" class="candy-zone-pill candy-hud-interactive" style="cursor: pointer; border-color: #10B981; color: #86EFAC;">
          <span>${Icons.map(18)}</span>
          <span>2D MAP</span>
        </button>
        <button id="questionPauseBtn" class="candy-menu-btn candy-hud-interactive">
          <span>${Icons.menu(18)}</span>
          <span>MENU</span>
        </button>
      </div>

      <div class="gameplay-container animate-fade-in">
        <!-- Main Question Box -->
        <div class="main-question-card">
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1.5px solid rgba(255,255,255,0.12); margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
            <div>
              <span style="font-family: var(--font-primary); font-size: 14px; font-weight: 700; color: #38BDF8; letter-spacing: 0.5px; text-transform: uppercase;">
                ${data.map.title}
              </span>
              <h3 style="font-family: var(--font-primary); font-size: 22px; font-weight: 700; color: #FAFAFA; margin-top: 2px;">
                TARGET WORD: <span style="color: #FDE047; text-shadow: 1px 1px 0 #000;">${q.highlighted_word.toUpperCase()}</span>
              </h3>
            </div>

            <button id="readQuestionBtn" class="hud-btn" style="background: ${q.voice_audio_url || q.audio_url ? '#059669' : '#0284C7'}; border-color: ${q.voice_audio_url || q.audio_url ? '#34D399' : '#38BDF8'}; font-family: var(--font-primary); font-size: 18px; font-weight: 700; padding: 10px 18px; transition: all 0.2s ease;">
              <span id="readQuestionIcon">${Icons.volume(20)}</span>
              <span id="readQuestionText">${q.voice_audio_url || q.audio_url ? 'TEACHER VOICE' : 'READ QUESTION'}</span>
            </button>
          </div>

          ${q.voice_video_url ? `
            <div style="margin-bottom: 16px; border-radius: 16px; overflow: hidden; max-height: 220px; border: 2px solid #0284C7; background: #020617; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
              <div style="padding: 8px 14px; background: rgba(2, 132, 199, 0.2); font-family: var(--font-primary); font-size: 14px; font-weight: 700; color: #38BDF8; display: flex; align-items: center; gap: 8px;">
                <span>${Icons.video(18)}</span>
                <span>TEACHER VIDEO VOICEOVER PROMPT</span>
              </div>
              <video src="${q.voice_video_url}" controls playsinline style="width: 100%; max-height: 190px; object-fit: contain; background: #000;"></video>
            </div>
          ` : ''}

          ${q.image_url ? `
            <div style="margin-bottom: 16px; border-radius: 16px; overflow: hidden; max-height: 180px; border: 2px solid #334155;">
              <img src="${q.image_url}" alt="Question hint" style="width: 100%; height: 180px; object-fit: cover;" />
            </div>
          ` : ''}

          <div class="sentence-box">
            "${formattedSentence}"
          </div>

          <div class="answers-grid">
            ${q.answers.map((ans, idx) => {
              const letter = String.fromCharCode(65 + idx);
              let stateClass = '';
              if (result && ans.id === selectedId) {
                stateClass = result.is_correct ? 'correct' : 'wrong';
              } else if (this.state.wrongAnswerIds.includes(ans.id)) {
                stateClass = 'wrong';
              }
              const escapedText = ans.text.replace(/"/g, '&quot;');
              return `
                <div class="answer-card ${stateClass}" data-answer-id="${ans.id}">
                  <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <div class="answer-badge">${letter}</div>
                    <span style="font-size: 22px; font-weight: 500;">${ans.text}</span>
                  </div>
                  <button class="choice-speak-btn" data-letter="${letter}" data-text="${escapedText}" title="Listen to Choice ${letter}" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; color: #93C5FD; padding: 6px 10px; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">
                    ${Icons.volume(18)}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Mascot & Progress Sidebar -->
        <div class="sidebar-mascot-card">
          <div class="mascot-avatar-box">
            <img src="${avatar.image || '/assets/mascot_girl.png'}" style="height: 110px; width: auto; object-fit: contain; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5)); margin-bottom: 6px;" alt="${avatar.label}" />
            <div style="font-family: var(--font-primary); font-size: 18px; font-weight: 700; color: #FDE047; text-shadow: 1px 1px 0 #000;">${this.state.playerName || 'Hero Student'}</div>
            <div style="font-size: 14px; color: #94A3B8; font-weight: 600; margin-bottom: 6px;">${avatar.label}</div>
            <div class="mascot-speech-bubble">
              ${mascotSpeech}
            </div>
          </div>

          <div style="background: #1E293B; border: 3px solid #334155; border-radius: 18px; padding: 16px;">
            <span style="font-family: var(--font-primary); font-size: 14px; font-weight: 700; color: #94A3B8; letter-spacing: 0.5px;">
              ${data.map.title.toUpperCase()} QUEST STARS
            </span>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
              ${this.state.history.map((h, i) => `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 600; color: ${h.isCorrect ? '#86EFAC' : '#FCA5A5'};">
                  <span>Q${i + 1}: ${h.word}</span>
                  <span style="display: inline-flex; gap: 3px;">
                    ${Array.from({ length: h.stars || 1 }).map(() => Icons.star(16)).join('')}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('questionPauseBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.setState({ isPauseMenuOpen: true });
    });

    document.getElementById('worldMapNavBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.setState({ screen: 'world_map' });
    });

    const readBtn = document.getElementById('readQuestionBtn');
    const readIcon = document.getElementById('readQuestionIcon');
    const readText = document.getElementById('readQuestionText');
    const hasCustomVoice = Boolean(q.voice_audio_url || q.audio_url);

    const updateReadButton = (isSpeaking: boolean) => {
      if (readIcon && readText && readBtn) {
        if (isSpeaking) {
          readIcon.innerHTML = Icons.stop(20);
          readText.textContent = 'STOP';
          readBtn.style.background = '#DC2626';
          readBtn.style.borderColor = '#EF4444';
        } else {
          readIcon.innerHTML = Icons.volume(20);
          readText.textContent = hasCustomVoice ? 'TEACHER VOICE' : 'READ QUESTION';
          readBtn.style.background = hasCustomVoice ? '#059669' : '#0284C7';
          readBtn.style.borderColor = hasCustomVoice ? '#34D399' : '#38BDF8';
        }
      }
    };

    readBtn?.addEventListener('click', () => {
      soundManager.playClick();
      if (soundManager.isNarrating()) {
        soundManager.stopSpeech();
        updateReadButton(false);
      } else {
        const voiceUrl = q.voice_audio_url || q.audio_url;
        if (voiceUrl) {
          soundManager.playCustomVoiceRecording(
            voiceUrl,
            () => updateReadButton(true),
            () => updateReadButton(false)
          );
        } else {
          soundManager.speakQuestionNarration(
            q.sentence,
            q.highlighted_word,
            choicesList,
            () => updateReadButton(true),
            () => updateReadButton(false)
          );
        }
      }
    });

    document.querySelectorAll('.choice-speak-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundManager.playClick();
        const letter = btn.getAttribute('data-letter') || '';
        const text = btn.getAttribute('data-text') || '';
        soundManager.speakChoice(letter, text);
      });
    });

    document.querySelectorAll('.answer-card').forEach((card) => {
      card.addEventListener('click', () => {
        const answerId = Number(card.getAttribute('data-answer-id'));
        if (answerId && !this.state.submitting && !this.state.submitResult) {
          soundManager.stopSpeech();
          this.handleSelectAnswer(answerId);
        }
      });
    });

    // Auto-narrate or play custom voiceover when a new question loads
    if (!result && this.lastNarratedQuestionId !== q.id) {
      this.lastNarratedQuestionId = q.id;
      setTimeout(() => {
        if (this.state.screen === 'question' && !this.state.submitResult) {
          const voiceUrl = q.voice_audio_url || q.audio_url;
          if (voiceUrl) {
            soundManager.playCustomVoiceRecording(
              voiceUrl,
              () => updateReadButton(true),
              () => updateReadButton(false)
            );
          } else {
            soundManager.speakQuestionNarration(
              q.sentence,
              q.highlighted_word,
              choicesList,
              () => updateReadButton(true),
              () => updateReadButton(false)
            );
          }
        }
      }, 350);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. COMPLETED SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderCompletedScreen() {
    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 1), 0);
    const maxPossibleStars = this.state.history.length * 3;

    this.appEl.innerHTML = `
      <div class="arcade-card text-center animate-fade-in" style="padding: 40px 28px; max-width: 580px; margin: 0 auto; text-align: center;">
        <div style="margin-bottom: 16px; color: #FACC15; display: flex; justify-content: center;">
          ${Icons.trophy(72)}
        </div>
        <h2 style="font-family: var(--font-primary); font-size: 32px; font-weight: 700; color: #FAFAFA;">
          Vocab Quest Completed!
        </h2>
        <p style="font-size: 18px; font-weight: 400; color: #94A3B8; margin-top: 6px;">
          Congratulations, <strong>${this.state.playerName}</strong>! You conquered all 3 Kingdoms across the 2D Prosperidad Map.
        </p>

        <div style="margin: 24px 0; background: #0F172A; border: 2px solid #334155; border-radius: 18px; padding: 20px; display: flex; justify-content: space-around; align-items: center;">
          <div>
            <span style="font-size: 14px; font-weight: 600; color: #94A3B8; text-transform: uppercase;">Final Score</span>
            <h1 style="font-family: var(--font-primary); font-size: 36px; font-weight: 700; color: #F59E0B; margin-top: 4px;">
              ${this.state.score} pts
            </h1>
          </div>
          <div>
            <span style="font-size: 14px; font-weight: 600; color: #94A3B8; text-transform: uppercase;">Stars Earned</span>
            <h1 style="font-family: var(--font-primary); font-size: 36px; font-weight: 700; color: #FDE047; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ${Icons.star(28)} ${totalStars}/${maxPossibleStars || 9}
            </h1>
          </div>
        </div>

        <div id="completedRestartBtnFrame" class="vocab-btn-frame" style="max-width: 320px; margin: 0 auto;">
          <button id="completedRestartBtn" class="vocab-btn vocab-btn-green" style="height: 60px; font-size: 26px;">
            <span>${Icons.refresh(24)}</span>
            <span>PLAY AGAIN</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('completedRestartBtnFrame')?.addEventListener('mouseenter', () => soundManager.playHover());
    document.getElementById('completedRestartBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.lastNarratedQuestionId = null;
      gameApi.clearToken();
      this.setState({
        screen: 'title',
        score: 0,
        attempts: {},
        history: [],
        currentData: null,
        submitResult: null,
        selectedAnswerId: null,
        wrongAnswerIds: [],
        customMascotSpeech: null,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS (HOW TO PLAY, SETTINGS, IN-GAME PAUSE MENU)
  // ─────────────────────────────────────────────────────────────────────────────
  private renderModals() {
    const existingModal = document.getElementById('modalContainer');
    if (existingModal) existingModal.remove();

    if (!this.state.isHowToPlayOpen && !this.state.isSettingsOpen && !this.state.isPauseMenuOpen) {
      return;
    }

    const modalContainer = document.createElement('div');
    modalContainer.id = 'modalContainer';
    modalContainer.className = 'modal-overlay';

    if (this.state.isHowToPlayOpen) {
      modalContainer.innerHTML = `
        <div class="modal-dialog modal-voxel-box" style="max-width: 720px; width: 92vw; padding: 30px 36px;">
          <div class="modal-header">
            <div class="modal-title minecraft-gold-title" style="font-family: var(--font-primary); font-size: 26px; font-weight: 700;">
              HOW TO PLAY VOCAB QUEST
            </div>
            <button id="closeHowToPlayBtn" class="modal-close-btn voxel-close-btn" style="width: 40px; height: 40px; font-size: 20px;">✕</button>
          </div>

          <div class="how-to-vertical-list">
            <div class="how-to-step-item">
              <div class="step-badge-box step-badge-1">
                <span>01</span>
              </div>
              <div class="step-info-col">
                <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">JOIN GAME ROOM</div>
                <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Enter your teacher's 6-digit Room PIN and choose your student character.</div>
              </div>
            </div>

            <div class="how-to-step-item">
              <div class="step-badge-box step-badge-2">
                <span>02</span>
              </div>
              <div class="step-info-col">
                <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">EXPLORE KINGDOMS</div>
                <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Travel across EPCES School, Bayan ng Prosperidad, and the Provincial Capitol.</div>
              </div>
            </div>

            <div class="how-to-step-item">
              <div class="step-badge-box step-badge-3">
                <span>03</span>
              </div>
              <div class="step-info-col">
                <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">SOLVE VOCAB QUESTS</div>
                <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Listen to pronunciations and earn stars on your first attempt!</div>
              </div>
            </div>

            <div class="how-to-step-item">
              <div class="step-badge-box step-badge-4">
                <span>04</span>
              </div>
              <div class="step-info-col">
                <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">LEVEL UP & WIN</div>
                <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Earn quest points, unlock kingdoms, and top the classroom leaderboard.</div>
              </div>
            </div>
          </div>

          <div id="closeHowToPlayBtnBottomFrame" class="vocab-btn-frame" style="margin-top: 20px;">
            <button id="closeHowToPlayBtnBottom" class="vocab-btn vocab-btn-blue" style="height: 60px; font-size: 24px;">
              <span>${Icons.check(22)}</span>
              <span>GOT IT, LET'S PLAY</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      const bottomFrame = document.getElementById('closeHowToPlayBtnBottomFrame');
      bottomFrame?.addEventListener('mouseenter', () => soundManager.playHover());

      const closeHowTo = () => {
        soundManager.playClick();
        this.setState({ isHowToPlayOpen: false });
      };
      document.getElementById('closeHowToPlayBtn')?.addEventListener('click', closeHowTo);
      bottomFrame?.addEventListener('click', closeHowTo);
      return;
    }

    if (this.state.isSettingsOpen) {
      const settings = soundManager.getSettings();

      modalContainer.innerHTML = `
        <div class="modal-dialog modal-voxel-box">
          <div class="modal-header">
            <div class="modal-title minecraft-gold-title" style="font-family: var(--font-primary); font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span>${Icons.refresh(22)}</span>
              <span>AUDIO & GAME SETTINGS</span>
            </div>
            <button id="closeSettingsBtn" class="modal-close-btn voxel-close-btn">✕</button>
          </div>

          <div class="settings-control-group">
            <div class="settings-slider-row">
              <div class="settings-slider-header">
                <span class="minecraft-label" style="font-family: var(--font-primary); font-size: 16px; font-weight: 600;">Master Volume</span>
                <span id="masterVolLabel" class="minecraft-value-badge">${Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input type="range" id="masterVolSlider" min="0" max="100" value="${Math.round(settings.masterVolume * 100)}" class="minecraft-range-slider" />
            </div>

            <div class="settings-slider-row">
              <div class="settings-slider-header">
                <span class="minecraft-label" style="font-family: var(--font-primary); font-size: 16px; font-weight: 600;">Sound Effects (SFX) Volume</span>
                <span id="sfxVolLabel" class="minecraft-value-badge">${Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input type="range" id="sfxVolSlider" min="0" max="100" value="${Math.round(settings.sfxVolume * 100)}" class="minecraft-range-slider" />
            </div>

            <div class="settings-slider-row">
              <div class="settings-slider-header">
                <span class="minecraft-label" style="font-family: var(--font-primary); font-size: 16px; font-weight: 600;">Background Music (BGM) Volume</span>
                <span id="bgVolLabel" class="minecraft-value-badge">${Math.round(settings.bgmVolume * 100)}%</span>
              </div>
              <input type="range" id="bgmVolSlider" min="0" max="100" value="${Math.round(settings.bgmVolume * 100)}" class="minecraft-range-slider" />
            </div>

            <div class="settings-toggle-row">
              <div>
                <span class="minecraft-label" style="font-family: var(--font-primary); font-weight: 700; color: #F87171; display: block; font-size: 16px;">Mute All Audio</span>
                <span style="font-size: 13px; color: #94A3B8;">Silence sound effects and vocabulary narration</span>
              </div>
              <input type="checkbox" id="muteToggle" ${settings.muted ? 'checked' : ''} class="minecraft-checkbox" />
            </div>
          </div>

          <div style="display: flex; gap: 14px; margin-top: 8px;">
            <div id="testAudioBtnFrame" class="vocab-btn-frame" style="flex: 1;">
              <button id="testAudioBtn" class="vocab-btn vocab-btn-blue" style="height: 52px; font-size: 20px;">
                <span>${Icons.volume(20)}</span>
                <span>TEST SOUND</span>
              </button>
            </div>
            <div id="closeSettingsBtnBottomFrame" class="vocab-btn-frame" style="flex: 1;">
              <button id="closeSettingsBtnBottom" class="vocab-btn vocab-btn-green" style="height: 52px; font-size: 20px;">
                <span>${Icons.check(20)}</span>
                <span>SAVE & CLOSE</span>
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      const testFrame = document.getElementById('testAudioBtnFrame');
      const saveFrame = document.getElementById('closeSettingsBtnBottomFrame');
      testFrame?.addEventListener('mouseenter', () => soundManager.playHover());
      saveFrame?.addEventListener('mouseenter', () => soundManager.playHover());

      const masterSlider = document.getElementById('masterVolSlider') as HTMLInputElement;
      const sfxSlider = document.getElementById('sfxVolSlider') as HTMLInputElement;
      const bgmSlider = document.getElementById('bgmVolSlider') as HTMLInputElement;
      const muteCheckbox = document.getElementById('muteToggle') as HTMLInputElement;

      masterSlider?.addEventListener('input', () => {
        const val = Number(masterSlider.value) / 100;
        soundManager.saveSettings({ masterVolume: val });
        (document.getElementById('masterVolLabel') as HTMLElement).innerText = `${masterSlider.value}%`;
      });

      sfxSlider?.addEventListener('input', () => {
        const val = Number(sfxSlider.value) / 100;
        soundManager.saveSettings({ sfxVolume: val });
        (document.getElementById('sfxVolLabel') as HTMLElement).innerText = `${sfxSlider.value}%`;
      });

      bgmSlider?.addEventListener('input', () => {
        const val = Number(bgmSlider.value) / 100;
        soundManager.saveSettings({ bgmVolume: val });
        (document.getElementById('bgVolLabel') as HTMLElement).innerText = `${bgmSlider.value}%`;
      });

      muteCheckbox?.addEventListener('change', () => {
        soundManager.playClick();
        soundManager.saveSettings({ muted: muteCheckbox.checked });
      });

      testFrame?.addEventListener('click', () => {
        soundManager.playSuccess();
      });

      const closeSettings = () => {
        soundManager.playClick();
        this.setState({ isSettingsOpen: false });
      };

      document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettings);
      saveFrame?.addEventListener('click', closeSettings);
      return;
    }

    if (this.state.isPauseMenuOpen) {
      modalContainer.innerHTML = `
        <div class="modal-dialog modal-voxel-box" style="max-width: 460px; text-align: center;">
          <div class="modal-header" style="justify-content: center;">
            <div class="modal-title minecraft-gold-title" style="font-family: var(--font-primary); font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span>${Icons.menu(20)}</span>
              <span>GAME PAUSED</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px;">
            <div id="pauseContinueFrame" class="vocab-btn-frame">
              <button id="pauseContinueBtn" class="vocab-btn vocab-btn-green" style="height: 54px; font-size: 22px;">
                <span>${Icons.play(20)}</span>
                <span>CONTINUE QUEST</span>
              </button>
            </div>

            <div id="pauseWorldMapFrame" class="vocab-btn-frame">
              <button id="pauseWorldMapBtn" class="vocab-btn vocab-btn-blue" style="height: 54px; font-size: 22px;">
                <span>${Icons.map(20)}</span>
                <span>RETURN TO WORLD MAP</span>
              </button>
            </div>

            <div id="pauseSettingsFrame" class="vocab-btn-frame">
              <button id="pauseSettingsBtn" class="vocab-btn vocab-btn-yellow" style="height: 54px; font-size: 22px;">
                <span>${Icons.refresh(20)}</span>
                <span>SETTINGS</span>
              </button>
            </div>

            <div id="pauseQuitFrame" class="vocab-btn-frame">
              <button id="pauseQuitBtn" class="vocab-btn vocab-btn-red" style="height: 54px; font-size: 22px;">
                <span>${Icons.x(20)}</span>
                <span>QUIT TO TITLE</span>
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      const contFrame = document.getElementById('pauseContinueFrame');
      const mapFrame = document.getElementById('pauseWorldMapFrame');
      const settFrame = document.getElementById('pauseSettingsFrame');
      const quitFrame = document.getElementById('pauseQuitFrame');

      contFrame?.addEventListener('mouseenter', () => soundManager.playHover());
      mapFrame?.addEventListener('mouseenter', () => soundManager.playHover());
      settFrame?.addEventListener('mouseenter', () => soundManager.playHover());
      quitFrame?.addEventListener('mouseenter', () => soundManager.playHover());

      contFrame?.addEventListener('click', () => {
        soundManager.playClick();
        this.setState({ isPauseMenuOpen: false });
        if (this.state.screen === 'question' && !this.state.submitResult) {
          soundManager.resumeQuestionNarration();
        }
      });

      mapFrame?.addEventListener('click', () => {
        soundManager.playClick();
        soundManager.stopSpeech();
        this.setState({ isPauseMenuOpen: false, screen: 'world_map' });
      });

      settFrame?.addEventListener('click', () => {
        soundManager.playClick();
        this.setState({ isPauseMenuOpen: false, isSettingsOpen: true });
      });

      quitFrame?.addEventListener('click', () => {
        soundManager.playClick();
        soundManager.stopSpeech();
        this.lastActiveMapId = 1;
        gameApi.clearToken();
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.setState({
          isPauseMenuOpen: false,
          screen: 'title',
          score: 0,
          attempts: {},
          history: [],
          currentData: null,
          submitResult: null,
          wrongAnswerIds: [],
          customMascotSpeech: null,
        });
      });
    }
  }
}

new StudentArcadeGame();
