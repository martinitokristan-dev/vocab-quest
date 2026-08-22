import './style.css';
import { gameApi, type CurrentQuestionResponse, type SubmitAnswerResponse } from './api';
import { Game2DMapRenderer } from './game2d';
import { soundManager } from './soundManager';
import { Icons } from './icons';
import { KINGDOM_DIALOGUES } from './dialogueData';

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
  history: Array<{
    questionId: number;
    mapId?: number;
    orderIndex?: number;
    questionIndex?: number;
    word: string;
    isCorrect: boolean;
    stars: number;
    selectedAnswerId?: number;
    typedAnswer?: string;
    questionData?: any;
  }>;
  viewingHistoryItem: {
    questionId: number;
    mapId?: number;
    orderIndex?: number;
    questionIndex?: number;
    word: string;
    isCorrect: boolean;
    stars: number;
    selectedAnswerId?: number;
    typedAnswer?: string;
    questionData?: any;
  } | null;
  lastPraiseIndex: number;
  lastTryAgainIndex: number;
  lastHappyPoseIndex: number;
  lastSadPoseIndex: number;
  customMascotSpeech: string | null;
  currentFeedbackSprite: string | null;
  wrongAnswerIds: number[];

  // Modals, Dialogue & Status
  isDialogueOpen: boolean;
  dialogueKingdomId: number;
  dialogueSlideIndex: number;
  seenKingdomDialogues: number[];
  isHowToPlayOpen: boolean;
  isSettingsOpen: boolean;
  isPauseMenuOpen: boolean;
  isTeacherPaused: boolean;
  roomStatus: 'waiting' | 'in_progress' | 'paused' | 'closed' | string;
  loadingProgress: number; // 0 to 12 segments
  loadingTargetScreen: 'join' | 'world_map';
}

const AVATARS = [
  { slug: 'learner-girl', label: 'Learner Girl', image: '/assets/mascot_girl.png' },
  { slug: 'learner-boy', label: 'Learner Boy', image: '/assets/mascot_boy.png' },
  { slug: 'scholar-girl', label: 'School Girl', image: '/assets/scholar_girl.png' },
  { slug: 'scholar-boy', label: 'School Boy', image: '/assets/scholar_boy.png' },
  { slug: 'morena-girl', label: 'Sporty Girl', image: '/assets/morena_girl.png' },
  { slug: 'explorer-boy', label: 'Explorer Boy', image: '/assets/moreno_boy.png' },
];

const getAvatarBySlug = (slug: string) => {
  return AVATARS.find((a) => a.slug === slug) || AVATARS[0];
};

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
    viewingHistoryItem: null,
    lastPraiseIndex: -1,
    lastTryAgainIndex: -1,
    lastHappyPoseIndex: -1,
    lastSadPoseIndex: -1,
    customMascotSpeech: null,
    currentFeedbackSprite: null,
    wrongAnswerIds: [],
    isDialogueOpen: false,
    dialogueKingdomId: 1,
    dialogueSlideIndex: 0,
    seenKingdomDialogues: [],
    isHowToPlayOpen: false,
    isSettingsOpen: false,
    isPauseMenuOpen: false,
    isTeacherPaused: false,
    roomStatus: 'waiting',
    loadingProgress: 0,
    loadingTargetScreen: 'join',
  };

  private pollInterval: number | null = null;
  private loadingInterval: number | null = null;
  private lastNarratedQuestionId: number | null = null;
  private lastActiveMapId: number = 1;
  private teacherMouthInterval: number | null = null;
  private teacherOutroTimeouts: number[] = [];
  private feedbackAudios: {
    praise: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean }>;
    cheer_up: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean }>;
  } = { praise: [], cheer_up: [] };

  constructor() {
    this.appEl = document.getElementById('app') as HTMLElement;
    this.bgLayerEl = document.createElement('img');
    this.bgLayerEl.className = 'game-bg-layer';
    this.bgLayerEl.style.display = 'none';
    document.body.prepend(this.bgLayerEl);

    this.preloadTeacherAssets();
    this.loadFeedbackAudios();
    this.bindGlobalKeyboard();
    this.initRouter();

    soundManager.onSpeakingStateChange((isSpeaking) => {
      this.updateTeacherSpeakingUI(isSpeaking);
    });
  }

  private preloadTeacherAssets() {
    const assetUrls = [
      '/assets/guide/F1.png',
      '/assets/guide/F2.png',
      '/assets/guide/F3.png',
      '/assets/guide/F4.png',
      '/assets/guide/F5.png',
      '/assets/guide/F6.png',
      '/assets/guide/F7.png',
      '/assets/guide/F8.png',
      '/assets/guide/F9.png',
      '/assets/guide/teacher_blue_correct_1.png',
      '/assets/guide/teacher_blue_correct_2.png',
      '/assets/guide/teacher_blue_correct_3.png',
      '/assets/guide/teacher_blue_incorrect_1.png',
      '/assets/guide/teacher_blue_incorrect_2.png',
      '/assets/guide/teacher_blue_incorrect_3.png',
      '/assets/guide/teacher_yellow_pose1.png',
      '/assets/guide/teacher_yellow_pose2.png',
      '/assets/guide/teacher_yellow_happy.png',
      '/assets/guide/teacher_yellow_sad.png',
      '/assets/guide/G1.png',
      '/assets/guide/G2.png',
      '/assets/guide/G3.png',
      '/assets/guide/G4.png',
      '/assets/guide/G5.png',
      '/assets/guide/G6.png',
      '/assets/guide/G7.png',
      '/assets/guide/G8.png',
      '/assets/guide/G9.png',
      '/assets/guide/teacher_gevina_correct_1.png',
      '/assets/guide/teacher_gevina_correct_2.png',
      '/assets/guide/teacher_gevina_correct_3.png',
      '/assets/guide/teacher_gevina_incorrect_1.png',
      '/assets/guide/teacher_gevina_incorrect_2.png',
      '/assets/guide/teacher_gevina_incorrect_3.png',
    ];

    assetUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    });
  }

  private clearTeacherAnimationTimers() {
    if (this.teacherMouthInterval) {
      clearInterval(this.teacherMouthInterval);
      this.teacherMouthInterval = null;
    }
    this.teacherOutroTimeouts.forEach((t) => clearTimeout(t));
    this.teacherOutroTimeouts = [];
  }

  private getPathForScreen(screen: StudentGameAppState['screen']): string {
    switch (screen) {
      case 'title':
        return '/';
      case 'join':
        return this.state.pin ? `/join?pin=${encodeURIComponent(this.state.pin)}` : '/join';
      case 'world_map':
        return '/map';
      case 'question':
        return '/play';
      case 'completed':
        return '/completed';
      default:
        return '/';
    }
  }

  private syncUrl(screen: StudentGameAppState['screen'], replace = false) {
    if (screen === 'loading') return;
    const targetPath = this.getPathForScreen(screen);
    const currentFull = window.location.pathname + window.location.search;

    if (currentFull !== targetPath) {
      if (replace) {
        window.history.replaceState({ screen }, '', targetPath);
      } else {
        window.history.pushState({ screen }, '', targetPath);
      }
    }
  }

  private initRouter() {
    window.addEventListener('popstate', () => {
      this.handlePopState();
    });

    // Parse initial route and restore student session profile if active
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(window.location.search);
    const pinFromUrl = params.get('pin') || '';
    const profile = gameApi.getSessionProfile();
    const hasToken = Boolean(profile.token);

    if (profile.playerName) this.state.playerName = profile.playerName;
    if (profile.avatarSlug) this.state.avatarSlug = profile.avatarSlug;
    if (profile.pin) this.state.pin = profile.pin;
    if (pinFromUrl) this.state.pin = pinFromUrl;

    if (hasToken) {
      if (path === '/completed') {
        this.state.screen = 'completed';
        this.syncUrl('completed', true);
        this.render();
      } else if (path === '/play' || path === '/question') {
        this.startLoading('world_map');
        this.fetchCurrentQuestion().then(() => {
          const isWaiting = this.state.roomStatus === 'waiting' ||
                            this.state.currentData?.room_status === 'waiting' ||
                            this.state.currentData?.data?.room_status === 'waiting';
          if (isWaiting) {
            this.setState({ screen: 'world_map' });
            this.syncUrl('world_map', true);
            this.showToast(
              'Session Not Started',
              'Your teacher has not started the session yet. Waiting for other players to join!',
              'warning'
            );
          } else {
            this.setState({ screen: 'question' });
          }
          this.startLightweightPoller();
        });
      } else {
        this.startLoading('world_map');
        this.fetchCurrentQuestion('world_map').then(() => {
          if (this.state.currentData?.data?.map?.id) {
            this.lastActiveMapId = this.state.currentData.data.map.id;
          }
          this.startLightweightPoller();
        });
      }
      return;
    }

    if (path === '/join') {
      this.state.screen = 'join';
      this.syncUrl('join', true);
      this.render();
    } else {
      this.state.screen = 'title';
      this.syncUrl('title', true);
      this.render();
    }
  }

  private handlePopState() {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const profile = gameApi.getSessionProfile();
    const hasToken = Boolean(profile.token);

    if (profile.playerName) this.state.playerName = profile.playerName;
    if (profile.avatarSlug) this.state.avatarSlug = profile.avatarSlug;
    if (profile.pin) this.state.pin = profile.pin;

    if (path === '/join') {
      this.setState({ screen: 'join' });
    } else if (path === '/map' || path === '/world-map') {
      if (hasToken) {
        this.setState({ screen: 'world_map' });
      } else {
        this.setState({ screen: 'join' });
      }
    } else if (path === '/play' || path === '/question') {
      if (hasToken) {
        this.setState({ screen: 'question' });
      } else {
        this.setState({ screen: 'join' });
      }
    } else if (path === '/completed') {
      this.setState({ screen: 'completed' });
    } else {
      this.setState({ screen: hasToken ? 'world_map' : 'title' });
    }
  }

  private async loadFeedbackAudios() {
    try {
      const res = await gameApi.getFeedbackAudios();
      this.feedbackAudios = res;
    } catch (e) {
      console.warn('Failed to load feedback voice audios:', e);
    }
  }

  private bindGlobalKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this.state.isDialogueOpen) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.nextDialogueSlide();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeKingdomDialogue();
          return;
        }
      }

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
        }
      }
    });
  }

  private setState(partialState: Partial<StudentGameAppState>) {
    const prevScreen = this.state.screen;
    const prevTeacherPaused = this.state.isTeacherPaused;
    const prevModals = {
      howTo: this.state.isHowToPlayOpen,
      settings: this.state.isSettingsOpen,
      pause: this.state.isPauseMenuOpen,
      dialogue: this.state.isDialogueOpen,
      dialogueSlide: this.state.dialogueSlideIndex,
      dialogueKingdom: this.state.dialogueKingdomId,
    };

    this.state = { ...this.state, ...partialState };

    const screenChanged = prevScreen !== this.state.screen;
    const teacherPausedChanged = prevTeacherPaused !== this.state.isTeacherPaused;
    const modalChanged =
      prevModals.howTo !== this.state.isHowToPlayOpen ||
      prevModals.settings !== this.state.isSettingsOpen ||
      prevModals.pause !== this.state.isPauseMenuOpen;
    const dialogueChanged =
      prevModals.dialogue !== this.state.isDialogueOpen ||
      prevModals.dialogueSlide !== this.state.dialogueSlideIndex ||
      prevModals.dialogueKingdom !== this.state.dialogueKingdomId;

    // Always sync teacher pause overlay independently of other render logic
    if (teacherPausedChanged) {
      this.renderTeacherPauseOverlay();
    }

    if (dialogueChanged) {
      this.renderDialogueOverlay();
    }

    if (screenChanged) {
      this.syncUrl(this.state.screen);
      this.render();
    } else if (modalChanged) {
      this.renderModals();
    } else if (this.state.screen === 'join' && partialState.error !== undefined) {
      this.render();
    } else if (this.state.screen === 'world_map') {
      if (partialState.currentData !== undefined || partialState.history !== undefined || !this.mapRenderer) {
        this.render();
      }
    } else if (this.state.screen === 'question') {
      // On question screen, avoid destroying DOM during feedback; only re-render on new question or review load
      if (partialState.currentData !== undefined || partialState.viewingHistoryItem !== undefined) {
        this.render();
      }
    } else if (this.state.screen !== 'join') {
      this.render();
    }
  }

  private startLoading(targetScreen: 'join' | 'world_map' = 'join', onReady?: () => void) {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      clearTimeout(this.loadingInterval);
      this.loadingInterval = null;
    }

    const totalSegments = 16;
    let currentSegment = 0;
    this.setState({ screen: 'loading', loadingProgress: 0, loadingTargetScreen: targetScreen });

    let isDataReady = targetScreen === 'join';

    const advanceStep = () => {
      currentSegment++;
      if (currentSegment % 2 === 0) {
        soundManager.playStep();
      }

      // Update segment elements directly in the DOM to avoid re-rendering entire screen
      const segments = document.querySelectorAll('.loading-segment');
      if (segments.length > 0) {
        for (let i = 0; i < segments.length; i++) {
          if (i < currentSegment) {
            segments[i].classList.add('active');
          } else {
            segments[i].classList.remove('active');
          }
        }
      }

      if (currentSegment >= totalSegments) {
        if (this.loadingInterval) {
          clearTimeout(this.loadingInterval);
          clearInterval(this.loadingInterval);
          this.loadingInterval = null;
        }
        soundManager.playSuccess();
        setTimeout(() => {
          this.setState({ screen: targetScreen, loadingProgress: totalSegments });
          if (onReady) onReady();
        }, 220);
        return;
      }

      // If data is ready early (fast network), accelerate remaining ticks to 45ms
      const nextDelay = isDataReady ? 45 : 85;
      this.loadingInterval = window.setTimeout(advanceStep, nextDelay);
    };

    this.loadingInterval = window.setTimeout(advanceStep, 70);

    return {
      markDataReady: () => {
        isDataReady = true;
      },
    };
  }

  private async fetchCurrentQuestion(forceScreen?: 'world_map' | 'question') {
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
        const isMapChanged = this.state.currentData?.data?.map.id !== res.data.map.id;
        const shouldChangeScreen = (this.state.screen === 'join');

        let mergedHistory = [...this.state.history];
        if (res.data.completed_questions && res.data.completed_questions.length > 0) {
          res.data.completed_questions.forEach((cq: any) => {
            const existingIdx = mergedHistory.findIndex((h) => h.questionId === cq.question_id);
            const starsCount = cq.stars ?? 3;
            if (existingIdx === -1) {
              mergedHistory.push({
                questionId: cq.question_id,
                mapId: cq.map_id,
                orderIndex: cq.order_index,
                questionIndex: cq.order_index,
                word: cq.word,
                isCorrect: true,
                stars: starsCount,
              });
            } else {
              mergedHistory[existingIdx] = {
                ...mergedHistory[existingIdx],
                mapId: cq.map_id,
                orderIndex: cq.order_index,
                questionIndex: cq.order_index,
                stars: starsCount,
              };
            }
          });
        }

        const isPaused = Boolean(res.is_paused || res.data?.is_paused || res.room_status === 'paused' || res.data?.room_status === 'paused');
        const roomStatus = res.room_status || res.data?.room_status || (isPaused ? 'paused' : 'in_progress');
        const isWaiting = roomStatus === 'waiting';
        const isLoadingScreen = this.state.screen === 'loading';
        const nextScreen = isLoadingScreen
          ? 'loading'
          : (forceScreen || (isWaiting ? 'world_map' : (shouldChangeScreen || isMapChanged ? 'world_map' : this.state.screen)));

        this.setState({
          screen: nextScreen,
          currentData: res,
          score: res.data.session.score,
          history: mergedHistory,
          selectedAnswerId: isNewQuestion ? null : this.state.selectedAnswerId,
          submitResult: isNewQuestion ? null : this.state.submitResult,
          wrongAnswerIds: isNewQuestion ? [] : this.state.wrongAnswerIds,
          customMascotSpeech: isNewQuestion ? null : this.state.customMascotSpeech,
          isTeacherPaused: isPaused,
          roomStatus: roomStatus,
        });
      }
    } catch (err: any) {
      console.error('Fetch question error:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthenticated')) {
        gameApi.clearSession();
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.setState({ screen: 'title' });
      }
    }
  }

  private startLightweightPoller() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    const pingStatus = async () => {
      // While showing praise/feedback animation or not authenticated, do not ping
      if (this.state.submitResult || !gameApi.getToken()) return;

      try {
        const status = await gameApi.getGameStatus();

        if (status.is_completed) {
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.setState({ screen: 'completed', score: status.score || this.state.score });
          return;
        }

        const isPaused = Boolean(status.is_paused || status.room_status === 'paused');
        const roomStatus = status.room_status || (isPaused ? 'paused' : 'in_progress');
        const prevRoomStatus = this.state.roomStatus;

        const stateUpdates: Partial<StudentGameAppState> = {};
        if (this.state.isTeacherPaused !== isPaused) {
          stateUpdates.isTeacherPaused = isPaused;
        }
        if (this.state.roomStatus !== roomStatus) {
          stateUpdates.roomStatus = roomStatus;
        }
        if (Object.keys(stateUpdates).length > 0) {
          this.setState(stateUpdates);
        }

        // Notify student if teacher just clicked Start Session!
        if (prevRoomStatus === 'waiting' && roomStatus === 'in_progress') {
          soundManager.playSuccess();
          this.showToast(
            'Session Started',
            'Your teacher has started the game. Tap Question 1 to begin.',
            'success',
            4500
          );
        }
      } catch (err: any) {
        if (err.message?.includes('401') || err.message?.includes('Unauthenticated')) {
          if (this.pollInterval) clearInterval(this.pollInterval);
        }
      }
    };

    // Fast 2.5s polling while in waiting state for instant start response
    this.pollInterval = window.setInterval(pingStatus, 2500);
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

      const loader = this.startLoading('world_map', () => {
        this.startLightweightPoller();
      });

      // Fetch data in parallel while loader is building terrain
      await this.fetchCurrentQuestion();
      loader?.markDataReady();
    } catch (err: any) {
      this.setState({ error: err.message || 'Failed to join game room', submitting: false });
    }
  }

  private updateTeacherSpeakingUI(isSpeaking: boolean) {
    const readBtn = document.getElementById('readQuestionBtn');
    const readIcon = document.getElementById('readQuestionIcon');
    const readText = document.getElementById('readQuestionText');
    if (readIcon && readText && readBtn) {
      if (isSpeaking) {
        readIcon.innerHTML = Icons.stop(18);
        readText.textContent = 'STOP';
        readBtn.style.background = '#DC2626';
        readBtn.style.borderColor = '#EF4444';
      } else {
        readIcon.innerHTML = Icons.rotateCcw(18);
        readText.textContent = 'REPLAY';
        readBtn.style.background = '#0284C7';
        readBtn.style.borderColor = '#0369A1';
      }
    }

    const badgeDot = document.getElementById('teacherBadgeDot');
    if (badgeDot) {
      badgeDot.classList.toggle('active-pulse', isSpeaking);
    }

    const spriteImg = document.getElementById('teacherCharacterSprite') as HTMLImageElement | null;
    if (!spriteImg) return;

    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    const isYellow = activeMapId === 3;
    const isGevina = activeMapId === 2;

    this.clearTeacherAnimationTimers();

    if (isSpeaking && !this.state.submitting) {
      spriteImg.className = 'teacher-character-img reading';
      if (isYellow) {
        spriteImg.src = `/assets/guide/teacher_yellow_pose1.png`;
      } else if (isGevina) {
        // Kingdom 2: Teacher Gevina (G1 to G9)
        const isReplaying = this.state.wrongAnswerIds.length > 0;
        const introFrames = isReplaying
          ? ['/assets/guide/G3.png']
          : [
              '/assets/guide/G1.png',
              '/assets/guide/G2.png',
              '/assets/guide/G2.png',
              '/assets/guide/G2.png',
              '/assets/guide/G3.png',
            ];
        // Smooth natural vowel reading loop (G4=AH, G5=EH, G6=OH, G3=Closed Rest)
        const loopFrames = [
          '/assets/guide/G4.png', // "AH" open
          '/assets/guide/G5.png', // "EH" wide open
          '/assets/guide/G6.png', // "OH" round open
          '/assets/guide/G3.png', // Closed mouth breath rest
        ];

        let introIndex = 0;
        let loopIndex = 0;
        let isIntroFinished = isReplaying;

        spriteImg.src = isReplaying ? loopFrames[0] : introFrames[0];

        this.teacherMouthInterval = window.setInterval(() => {
          if (!isIntroFinished) {
            introIndex++;
            if (introIndex < introFrames.length) {
              spriteImg.src = introFrames[introIndex];
            } else {
              isIntroFinished = true;
              spriteImg.src = loopFrames[0];
            }
          } else {
            loopIndex = (loopIndex + 1) % loopFrames.length;
            spriteImg.src = loopFrames[loopIndex];
          }
        }, 340);
      } else {
        // Kingdom 1: Teacher Faith (F1 to F9)
        const isReplaying = this.state.wrongAnswerIds.length > 0;
        const introFrames = isReplaying
          ? ['/assets/guide/F3.png']
          : [
              '/assets/guide/F1.png',
              '/assets/guide/F2.png',
              '/assets/guide/F2.png',
              '/assets/guide/F2.png',
              '/assets/guide/F3.png',
            ];

        // Smooth natural vowel reading loop (F4=AH, F5=EH, F6=OH, F3=Closed Rest)
        const loopFrames = [
          '/assets/guide/F4.png', // "AH" open
          '/assets/guide/F5.png', // "EH" wide open
          '/assets/guide/F6.png', // "OH" round open
          '/assets/guide/F3.png', // Closed mouth breath rest
        ];

        let introIndex = 0;
        let loopIndex = 0;
        let isIntroFinished = isReplaying;

        spriteImg.src = isReplaying ? loopFrames[0] : introFrames[0];

        this.teacherMouthInterval = window.setInterval(() => {
          if (!isIntroFinished) {
            introIndex++;
            if (introIndex < introFrames.length) {
              spriteImg.src = introFrames[introIndex];
            } else {
              isIntroFinished = true;
              spriteImg.src = loopFrames[0];
            }
          } else {
            loopIndex = (loopIndex + 1) % loopFrames.length;
            spriteImg.src = loopFrames[loopIndex];
          }
        }, 340);
      }
    } else {
      if (this.state.submitResult?.is_correct) {
        spriteImg.src = isYellow
          ? (this.state.currentFeedbackSprite || `/assets/guide/teacher_yellow_happy.png`)
          : isGevina
          ? (this.state.currentFeedbackSprite || `/assets/guide/teacher_gevina_correct_1.png`)
          : (this.state.currentFeedbackSprite || `/assets/guide/teacher_blue_correct_1.png`);
        spriteImg.className = 'teacher-character-img celebrating';
      } else if (this.state.wrongAnswerIds.length > 0 && this.state.currentFeedbackSprite) {
        // Maintain sympathetic/try-again pose - DO NOT overwrite with idle timers!
        spriteImg.src = this.state.currentFeedbackSprite;
        spriteImg.className = 'teacher-character-img sympathetic';
      } else {
        spriteImg.className = 'teacher-character-img idle';
        if (isYellow) {
          spriteImg.src = `/assets/guide/teacher_yellow_pose1.png`;
        } else if (isGevina) {
          // Smooth settle to closed mouth rest stance
          spriteImg.src = '/assets/guide/G3.png';
          const t = window.setTimeout(() => {
            if (!soundManager.isNarrating() && !this.state.submitResult && this.state.wrongAnswerIds.length === 0) {
              spriteImg.src = '/assets/guide/G1.png';
            }
          }, 400);
          this.teacherOutroTimeouts.push(t);
        } else {
          // Smooth settle to closed mouth rest stance
          spriteImg.src = '/assets/guide/F3.png';
          const t = window.setTimeout(() => {
            if (!soundManager.isNarrating() && !this.state.submitResult && this.state.wrongAnswerIds.length === 0) {
              spriteImg.src = '/assets/guide/F1.png';
            }
          }, 400);
          this.teacherOutroTimeouts.push(t);
        }
      }
    }
  }

  private async handleSelectAnswer(answerId?: number | null, typedAnswer?: string | null) {
    if (this.state.submitting || !this.state.currentData?.data || this.state.isTeacherPaused) return;

    this.state.submitting = true;
    soundManager.stopSpeech();
    this.clearTeacherAnimationTimers();

    const q = this.state.currentData.data.question;
    const currentAttempts = (this.state.attempts[q.id] || 0) + 1;
    const updatedAttempts = { ...this.state.attempts, [q.id]: currentAttempts };
    const starsEarned = currentAttempts === 1 ? 3 : currentAttempts === 2 ? 2 : 1;
    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    const isYellow = activeMapId === 3;
    const isGevina = activeMapId === 2;

    // Immediately disable pointer events on answer cards to prevent double-clicks
    document.querySelectorAll('.answer-card').forEach((c) => {
      (c as HTMLElement).style.pointerEvents = 'none';
    });

    try {
      const res = await gameApi.submitAnswer(q.id, answerId, starsEarned, typedAnswer);

      const spriteImg = document.getElementById('teacherCharacterSprite') as HTMLImageElement | null;

      if (res.is_correct) {
        // Pause background polling so poller does not race against the praise speech!
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }

        // Select non-repeating shuffled correct celebratory pose per Kingdom teacher
        const faithHappySprites = [
          '/assets/guide/teacher_blue_correct_1.png',
          '/assets/guide/teacher_blue_correct_2.png',
          '/assets/guide/teacher_blue_correct_3.png',
        ];
        const gevinaHappySprites = [
          '/assets/guide/teacher_gevina_correct_1.png',
          '/assets/guide/teacher_gevina_correct_2.png',
          '/assets/guide/teacher_gevina_correct_3.png',
        ];
        const yellowHappySprites = [
          '/assets/guide/teacher_yellow_pose2.png',
          '/assets/guide/teacher_yellow_happy.png',
        ];
        const activeHappySprites = isYellow
          ? yellowHappySprites
          : isGevina
          ? gevinaHappySprites
          : faithHappySprites;

        let hIdx = Math.floor(Math.random() * activeHappySprites.length);
        if (hIdx === this.state.lastHappyPoseIndex) {
          hIdx = (hIdx + 1) % activeHappySprites.length;
        }
        const chosenHappy = activeHappySprites[hIdx];

        // DIRECT & INSTANT switch to Celebratory Correct pose (Zero base-frame flash!)
        if (spriteImg) {
          spriteImg.src = chosenHappy;
          spriteImg.className = 'teacher-character-img celebrating';
        }

        // Highlight correct answer card
        if (answerId) {
          const cardEl = document.querySelector(`.answer-card[data-answer-id="${answerId}"]`);
          cardEl?.classList.remove('selected-active');
          cardEl?.classList.add('correct');
        }

        soundManager.playSuccess();

        // --- 1. CORRECT ANSWER: 3-STAR RATING & SHUFFLED TEACHER PRAISE ---
        const questionOrder = q.order_index || (this.state.history.filter((h) => (h.mapId || 1) === activeMapId).length + 1);

        // Check for teacher's uploaded praise audio clips
        const activePraiseClips = this.feedbackAudios.praise.filter((p) => p.is_active !== false);
        const customPraise = activePraiseClips.length > 0
          ? activePraiseClips[Math.floor(Math.random() * activePraiseClips.length)]
          : null;

        let pIdx = Math.floor(Math.random() * PRAISE_PHRASES.length);
        if (pIdx === this.state.lastPraiseIndex) {
          pIdx = (pIdx + 1) % PRAISE_PHRASES.length;
        }
        const praiseText = customPraise ? customPraise.phrase : PRAISE_PHRASES[pIdx];

        const updatedHistory = [
          ...this.state.history.filter((h) => h.questionId !== q.id),
          {
            questionId: q.id,
            mapId: activeMapId,
            orderIndex: questionOrder,
            questionIndex: questionOrder,
            word: q.highlighted_word,
            isCorrect: true,
            stars: starsEarned,
            selectedAnswerId: answerId || undefined,
            typedAnswer: typedAnswer || undefined,
            questionData: q,
          },
        ];

        // Update speech bubble & score counter directly on stage
        const bubbleText = document.querySelector('.teacher-speech-text');
        const bubbleContainer = document.querySelector('.teacher-speech-bubble');
        const scoreVal = document.getElementById('questionScoreVal');
        if (bubbleText) bubbleText.textContent = `"${praiseText}"`;
        if (bubbleContainer) {
          bubbleContainer.className = 'teacher-speech-bubble bubble-correct';
        }
        if (scoreVal) {
          const totalStars = updatedHistory.reduce((acc, h) => acc + (h.stars || 0), 0);
          scoreVal.textContent = String(totalStars);
        }

        this.setState({
          selectedAnswerId: answerId || null,
          submitResult: res,
          score: res.score,
          submitting: false,
          attempts: updatedAttempts,
          history: updatedHistory,
          lastPraiseIndex: pIdx,
          lastHappyPoseIndex: hIdx,
          customMascotSpeech: praiseText,
          currentFeedbackSprite: chosenHappy,
        });

        let hasAdvanced = false;
        const advanceToNext = async () => {
          if (hasAdvanced) return;
          hasAdvanced = true;
          this.setState({ submitResult: null, selectedAnswerId: null, wrongAnswerIds: [], currentFeedbackSprite: null });
          await this.fetchCurrentQuestion();
          this.startLightweightPoller();
        };

        if (customPraise?.audio_url) {
          // Play teacher's authentic recorded voice praise (without overriding celebration pose)
          soundManager.playFeedbackAudio(
            customPraise.audio_url,
            () => {
              setTimeout(advanceToNext, 600);
            }
          );
        } else {
          // Advance smoothly to next challenge
          setTimeout(advanceToNext, 1200);
        }

        // Safety fallback timer (advances in max 3.5s if speech is muted/silent)
        setTimeout(advanceToNext, 3500);
      } else {
        // --- 2. WRONG ANSWER: SHUFFLED TEACHER CHEER-UP ENCOURAGEMENT ---
        const activeCheerClips = this.feedbackAudios.cheer_up.filter((c) => c.is_active !== false);
        const customCheer = activeCheerClips.length > 0
          ? activeCheerClips[Math.floor(Math.random() * activeCheerClips.length)]
          : null;

        let tIdx = Math.floor(Math.random() * TRY_AGAIN_PHRASES.length);
        if (tIdx === this.state.lastTryAgainIndex) {
          tIdx = (tIdx + 1) % TRY_AGAIN_PHRASES.length;
        }
        const tryAgainMsg = customCheer ? customCheer.phrase : TRY_AGAIN_PHRASES[tIdx];

        soundManager.playWrong();

        // Select non-repeating shuffled incorrect / encouraging pose per Kingdom teacher
        const faithSadSprites = [
          '/assets/guide/teacher_blue_incorrect_1.png',
          '/assets/guide/teacher_blue_incorrect_2.png',
          '/assets/guide/teacher_blue_incorrect_3.png',
        ];
        const gevinaSadSprites = [
          '/assets/guide/teacher_gevina_incorrect_1.png',
          '/assets/guide/teacher_gevina_incorrect_2.png',
          '/assets/guide/teacher_gevina_incorrect_3.png',
        ];
        const yellowSadSprites = [
          '/assets/guide/teacher_yellow_sad.png',
        ];
        const activeSadSprites = isYellow
          ? yellowSadSprites
          : isGevina
          ? gevinaSadSprites
          : faithSadSprites;

        let sIdx = Math.floor(Math.random() * activeSadSprites.length);
        if (sIdx === this.state.lastSadPoseIndex) {
          sIdx = (sIdx + 1) % activeSadSprites.length;
        }
        const chosenSad = activeSadSprites[sIdx];

        // DIRECT & INSTANT switch to Sympathetic / Encouraging pose
        if (spriteImg) {
          spriteImg.src = chosenSad;
          spriteImg.className = 'teacher-character-img sympathetic';
        }

        // Highlight wrong answer card
        if (answerId) {
          const cardEl = document.querySelector(`.answer-card[data-answer-id="${answerId}"]`);
          cardEl?.classList.remove('selected-active');
          cardEl?.classList.add('wrong');
        }

        // Update speech bubble directly on stage
        const bubbleText = document.querySelector('.teacher-speech-text');
        const bubbleContainer = document.querySelector('.teacher-speech-bubble');
        if (bubbleText) bubbleText.textContent = `"${tryAgainMsg}"`;
        if (bubbleContainer) {
          bubbleContainer.className = 'teacher-speech-bubble bubble-wrong';
        }

        const wrongIds = answerId ? [...this.state.wrongAnswerIds, answerId] : [999999];

        // Re-enable pointer events for remaining cards
        document.querySelectorAll('.answer-card').forEach((c) => {
          const id = Number(c.getAttribute('data-answer-id'));
          if (!wrongIds.includes(id)) {
            (c as HTMLElement).style.pointerEvents = 'auto';
          }
        });

        this.setState({
          selectedAnswerId: null,
          submitting: false,
          submitResult: null,
          attempts: updatedAttempts,
          wrongAnswerIds: wrongIds,
          lastTryAgainIndex: tIdx,
          lastSadPoseIndex: sIdx,
          customMascotSpeech: tryAgainMsg,
          currentFeedbackSprite: chosenSad,
        });

        const textInput = document.getElementById('identificationTextInput') as HTMLInputElement | null;
        if (textInput) {
          textInput.classList.add('animate-shake', 'wrong');
          setTimeout(() => {
            textInput.classList.remove('animate-shake');
            textInput.focus();
            textInput.select();
          }, 600);
        }

        if (customCheer?.audio_url) {
          soundManager.playFeedbackAudio(customCheer.audio_url);
        }
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
    this.renderTeacherPauseOverlay();
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
    const totalSegments = 16;
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

            <div id="submitJoinBtnFrame" class="vocab-btn-frame" style="margin-top: 6px;">
              <button
                type="submit"
                id="submitJoinBtn"
                class="vocab-btn vocab-btn-green"
                style="height: 50px; font-size: 18px; letter-spacing: 1.5px;"
                ${this.state.submitting ? 'disabled' : ''}
              >
                <span>${Icons.arrowRight(20)}</span>
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
      this.syncUrl('join', true);
    });

    nameIn?.addEventListener('input', (e) => {
      this.state.playerName = (e.target as HTMLInputElement).value;
    });

    btnFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    document.querySelectorAll('.student-avatar-card').forEach((card) => {
      card.addEventListener('mouseenter', () => soundManager.playHover());
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-slug');
        if (slug && this.state.avatarSlug !== slug) {
          soundManager.playClick();
          this.state.avatarSlug = slug;

          document.querySelectorAll('.student-avatar-card').forEach((c) => {
            const isMatch = c.getAttribute('data-slug') === slug;
            c.classList.toggle('selected', isMatch);
            const existingCheck = c.querySelector('.student-avatar-check');
            if (isMatch && !existingCheck) {
              const checkDiv = document.createElement('div');
              checkDiv.className = 'student-avatar-check';
              checkDiv.innerHTML = Icons.check(14);
              c.prepend(checkDiv);
            } else if (!isMatch && existingCheck) {
              existingCheck.remove();
            }
          });

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
    const avatar = getAvatarBySlug(this.state.avatarSlug);
    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    const currentQuestionIndex =
      this.state.currentData?.data?.question?.order_index ||
      this.state.currentData?.data?.map?.current_question_num ||
      (this.state.history.filter((h) => (h.mapId || 1) === activeMapId).length + 1);
    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 0), 0);

    this.appEl.innerHTML = `
      <!-- Top-Left Player Profile & Star HUD -->
      <div class="candy-hud-top-left animate-fade-in">
        <div class="candy-player-card candy-hud-interactive" id="playerAvatarBox" title="${this.state.playerName || 'Hero Student'}">
          <div class="candy-avatar-circle">
            <img src="${avatar.image || '/assets/mascot_girl.png'}" class="candy-avatar-img" />
          </div>
          <div class="candy-player-info">
            <div class="candy-player-name">${this.state.playerName || 'Hero Student'}</div>
            <div class="candy-star-row">
              <div class="candy-star-icon-wrap">
                <svg class="candy-star-svg" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="hudStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FFF566" />
                      <stop offset="35%" stop-color="#FFD000" />
                      <stop offset="75%" stop-color="#FF9900" />
                      <stop offset="100%" stop-color="#E67300" />
                    </linearGradient>
                  </defs>
                  <path d="M 18,2 L 22.5,12.5 L 34,14 L 25.5,22 L 28,33.5 L 18,27.5 L 8,33.5 L 10.5,22 L 2,14 L 13.5,12.5 Z"
                        fill="url(#hudStarGrad)" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round" />
                  <ellipse cx="18" cy="11" rx="4.5" ry="2.2" fill="rgba(255,255,255,0.75)" />
                </svg>
              </div>
              <span class="candy-star-count-num">${totalStars}</span>
              <span class="candy-star-count-label">STARS</span>
            </div>
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
        initialPos,
        this.state.history
      );

      this.mapRenderer.onStepClick((mapId, stepQuestionIndex) => {
        const isWaiting = this.state.roomStatus === 'waiting';

        if (isWaiting) {
          soundManager.playHover();
          this.showToast(
            'Session Not Started',
            'Your teacher has not started the session yet. Waiting for other players to join!',
            'warning'
          );
          return;
        }

        soundManager.stopSpeech();

        // Check if clicked question step was already answered
        const targetMapId = mapId || activeMapId;
        const targetQIndex = stepQuestionIndex || currentQuestionIndex;
        const isAnswered = this.state.history.some(
          (h) => (h.mapId === targetMapId && (h.questionIndex === targetQIndex || h.orderIndex === targetQIndex))
        ) || (targetMapId < activeMapId) || (targetMapId === activeMapId && targetQIndex < currentQuestionIndex);

        if (isAnswered) {
          const historyItem = this.state.history.find(
            (h) => (h.mapId === targetMapId && (h.questionIndex === targetQIndex || h.orderIndex === targetQIndex))
          ) || this.state.history[0] || null;

          // In read-only review mode: do NOT show instructions
          this.setState({ viewingHistoryItem: historyItem, screen: 'question' });
          return;
        }

        // Active uncompleted question:
        this.setState({ viewingHistoryItem: null });

        // Instruction dialogue ONLY appears on Question 1 of that kingdom (never on question 2, 3, etc.)
        const isFirstQuestionOfKingdom = targetQIndex === 1;
        if (isFirstQuestionOfKingdom && !this.isKingdomDialogueSeen(activeMapId) && KINGDOM_DIALOGUES[activeMapId]) {
          this.openKingdomDialogue(activeMapId);
        } else {
          this.setState({ screen: 'question' });
        }
      });

      if (isMapTransition && path.length > 0) {
        this.mapRenderer.animateWalkingPath(path, unlockMsg, () => {
          setTimeout(() => {
            if (this.state.screen === 'world_map') {
              const isWaiting = this.state.roomStatus === 'waiting';
              if (isWaiting) {
                this.showToast(
                  'Session Not Started',
                  'Your teacher has not started the session yet. Waiting for other players to join!',
                  'warning'
                );
                return;
              }
              soundManager.stopSpeech();
              if (!this.isKingdomDialogueSeen(activeMapId) && KINGDOM_DIALOGUES[activeMapId]) {
                this.openKingdomDialogue(activeMapId);
              } else {
                this.setState({ viewingHistoryItem: null, screen: 'question' });
              }
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
    const avatar = getAvatarBySlug(this.state.avatarSlug);
    const isReview = Boolean(this.state.viewingHistoryItem);
    const q = (isReview ? (this.state.viewingHistoryItem?.questionData || this.state.currentData?.data?.question) : this.state.currentData?.data?.question) || this.state.currentData?.data?.question;
    const historySelectedId = this.state.viewingHistoryItem?.selectedAnswerId;

    if (!q) {
      this.appEl.innerHTML = `
        <div class="candy-loading-card animate-fade-in" style="margin: 60px auto; max-width: 480px; text-align: center;">
          <div class="candy-spinner"></div>
          <p style="margin-top: 16px; font-weight: 700; color: #F59E0B;">LOADING QUESTION DATA...</p>
          <button id="retryQuestionBtn" class="vocab-hud-btn" style="margin-top: 16px;">RETURN TO MAP</button>
        </div>
      `;
      document.getElementById('retryQuestionBtn')?.addEventListener('click', () => {
        this.setState({ viewingHistoryItem: null, screen: 'world_map' });
      });
      return;
    }

    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 0), 0);
    const result = this.state.submitResult;
    const selectedId = this.state.selectedAnswerId;
    const isIdentification = (q.question_type === 'identification') || (!q.answers || q.answers.length === 0);

    const currentWord = q.highlighted_word;
    const regex = new RegExp(`(${currentWord})`, 'gi');
    const formattedSentence = q.sentence.replace(
      regex,
      `<span class="highlighted-word">$1</span>`
    );

    let teacherSpeech = this.state.customMascotSpeech;
    if (!teacherSpeech) {
      if (isReview) {
        teacherSpeech = `Great job! You mastered this question challenge!`;
      } else if (result) {
        teacherSpeech = result.is_correct
          ? 'Great job! Moving to the next challenge!'
          : 'Oops! Give it another try!';
      } else {
        teacherSpeech = `Listen carefully and select the best meaning of "${currentWord}"!`;
      }
    }

    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    const isYellow = activeMapId === 3;
    const isGevina = activeMapId === 2;
    const teacherName = isYellow ? 'Principal Flores' : isGevina ? 'Teacher Gevina' : 'Teacher Faith';
    const baseIdleSprite = isYellow 
      ? `/assets/guide/teacher_yellow_pose1.png` 
      : isGevina 
      ? `/assets/guide/G1.png` 
      : `/assets/guide/F1.png`;

    let initialTeacherSprite = baseIdleSprite;
    let initialTeacherAnimClass = 'idle';

    if (result?.is_correct) {
      initialTeacherSprite = isYellow
        ? (this.state.currentFeedbackSprite || `/assets/guide/teacher_yellow_happy.png`)
        : isGevina
        ? (this.state.currentFeedbackSprite || `/assets/guide/teacher_gevina_correct_1.png`)
        : (this.state.currentFeedbackSprite || `/assets/guide/teacher_blue_correct_1.png`);
      initialTeacherAnimClass = 'celebrating';
    } else if (this.state.wrongAnswerIds.length > 0 && !result && !this.state.submitting && this.state.currentFeedbackSprite) {
      initialTeacherSprite = isYellow
        ? (this.state.currentFeedbackSprite || `/assets/guide/teacher_yellow_sad.png`)
        : isGevina
        ? (this.state.currentFeedbackSprite || `/assets/guide/teacher_gevina_incorrect_1.png`)
        : (this.state.currentFeedbackSprite || `/assets/guide/teacher_blue_incorrect_1.png`);
      initialTeacherAnimClass = 'sympathetic';
    } else if (soundManager.isNarrating()) {
      initialTeacherSprite = baseIdleSprite;
      initialTeacherAnimClass = 'reading';
    } else {
      initialTeacherSprite = baseIdleSprite;
      initialTeacherAnimClass = 'idle';
    }

    this.appEl.innerHTML = `
      <!-- Top-Left Player Profile & Star HUD (Fixed Top Left) -->
      <div class="candy-hud-top-left animate-fade-in">
        <div class="candy-player-card candy-hud-interactive" id="questionAvatarBox" title="Tap to hear character voice">
          <div class="candy-avatar-circle">
            <img src="${avatar.image || '/assets/mascot_girl.png'}" class="candy-avatar-img" />
          </div>
          <div class="candy-player-info">
            <div class="candy-player-name">${this.state.playerName || 'Hero Student'}</div>
            <div class="candy-star-row">
              <div class="candy-star-icon-wrap">
                <svg class="candy-star-svg" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="quizStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FFF566" />
                      <stop offset="35%" stop-color="#FFD000" />
                      <stop offset="75%" stop-color="#FF9900" />
                      <stop offset="100%" stop-color="#E67300" />
                    </linearGradient>
                  </defs>
                  <path d="M 18,2 L 22.5,12.5 L 34,14 L 25.5,22 L 28,33.5 L 18,27.5 L 8,33.5 L 10.5,22 L 2,14 L 13.5,12.5 Z"
                        fill="url(#quizStarGrad)" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round" />
                  <ellipse cx="18" cy="11" rx="4.5" ry="2.2" fill="rgba(255,255,255,0.75)" />
                </svg>
              </div>
              <span class="candy-star-count-num">${totalStars}</span>
              <span class="candy-star-count-label">STARS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top-Right Controls HUD (Fixed Top Right) -->
      <div class="candy-hud-top-right animate-fade-in">
        <button id="worldMapNavBtn" class="candy-zone-pill candy-hud-interactive" style="cursor: pointer; border-color: #22C55E; color: #15803D; box-shadow: 0 4px 0 #16A34A, 0 8px 16px rgba(0, 0, 0, 0.15);" title="Back to 2D Map">
          <span>${Icons.map(18)}</span>
          <span>2D MAP</span>
        </button>
        <button id="questionPauseBtn" class="candy-menu-btn candy-hud-interactive" title="Pause Game Menu">
          <span>${Icons.pause(18)}</span>
          <span>MENU</span>
        </button>
      </div>

      <div class="question-scene-container animate-fade-in">
        <!-- Dual Stage Layout: Centered Question Arena + Right Teacher Stage -->
        <div class="question-stage-layout">
          <!-- Centered Main Question Arena -->
          <div class="question-arena-card">
            ${isReview ? `
              <div style="margin-bottom: 12px; padding: 8px 16px; background: rgba(245, 158, 11, 0.15); border: 1.5px solid #F59E0B; border-radius: 14px; font-size: 14.5px; font-weight: 700; color: #FDE047; display: flex; align-items: center; justify-content: space-between;">
                <span>⭐ COMPLETED QUESTION REVIEW (READ-ONLY)</span>
                <span>${this.state.viewingHistoryItem?.stars || 3} STARS EARNED</span>
              </div>
            ` : ''}

            <div class="question-arena-header">
              <button id="readQuestionBtn" class="hud-btn question-replay-btn" title="Replay voice narration">
                <span id="readQuestionIcon">${Icons.rotateCcw(18)}</span>
                <span id="readQuestionText">REPLAY</span>
              </button>
            </div>

            ${q.voice_video_url ? `
              <div style="margin-bottom: 8px; border-radius: 16px; overflow: hidden; max-height: 220px; border: 2px solid #0284C7; background: #020617; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                <div style="padding: 8px 14px; background: rgba(2, 132, 199, 0.2); font-family: var(--font-primary); font-size: 14px; font-weight: 700; color: #38BDF8; display: flex; align-items: center; gap: 8px;">
                  <span>${Icons.video(18)}</span>
                  <span>TEACHER VIDEO VOICEOVER PROMPT</span>
                </div>
                <video src="${q.voice_video_url}" controls playsinline style="width: 100%; max-height: 190px; object-fit: contain; background: #000;"></video>
              </div>
            ` : ''}

            <!-- Centered Question Visual Clue Image -->
            ${q.image_url ? `
              <div class="question-visual-clue-card">
                <img src="${q.image_url}" alt="Question visual clue" class="question-visual-clue-img" />
              </div>
            ` : ''}

            <!-- Centered Full-Width Sentence Box -->
            <div class="sentence-box">
              "${formattedSentence}"
            </div>

            <!-- Answer Choices Grid OR Identification Typing Input -->
            ${isIdentification ? `
              <div class="identification-arena-box">
                <div class="identification-description">
                  Type the correct vocabulary word:
                </div>

                <div class="identification-input-container">
                  <input
                    id="identificationTextInput"
                    type="text"
                    class="identification-text-input ${this.state.wrongAnswerIds.length > 0 ? 'animate-shake wrong' : ''}"
                    placeholder="Type word here..."
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    ${isReview ? 'disabled' : ''}
                    value="${isReview ? (this.state.viewingHistoryItem?.typedAnswer || this.state.viewingHistoryItem?.word || '') : ''}"
                  />
                  ${!isReview ? `
                    <button id="identificationSubmitBtn" class="identification-submit-btn">
                      <span>SUBMIT</span>
                    </button>
                  ` : ''}
                </div>
                ${isReview ? `
                  <div class="identification-review-footer">
                    <span style="color: #4ADE80; font-weight: 700;">Target Word: ${q.highlighted_word}</span>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="answers-grid" ${isReview ? 'style="pointer-events: none;"' : ''}>
                ${(q.answers || []).map((ans: any, idx: number) => {
                  const letter = String.fromCharCode(65 + idx);
                  let stateClass = '';
                  if (isReview) {
                    if (ans.id === historySelectedId) {
                      stateClass = this.state.viewingHistoryItem?.isCorrect ? 'correct' : 'wrong';
                    }
                  } else if (result && ans.id === selectedId) {
                    stateClass = result.is_correct ? 'correct' : 'wrong';
                  } else if (this.state.wrongAnswerIds.includes(ans.id)) {
                    stateClass = 'wrong';
                  }
                  return `
                    <div class="answer-card ${stateClass}" data-answer-id="${ans.id}" ${isReview ? 'style="cursor: default;"' : ''}>
                      <div class="answer-card-content">
                        <div class="answer-badge">${letter}</div>
                        <span class="answer-text">${ans.text}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Right Side Teacher Character Guide Stage -->
          <div class="question-teacher-stage" id="questionTeacherStage">
            <!-- Teacher Speech Bubble -->
            <div class="teacher-speech-bubble ${result?.is_correct ? 'bubble-correct' : this.state.wrongAnswerIds.length > 0 ? 'bubble-wrong' : ''}">
              <div class="teacher-speech-header">
                <span class="teacher-speech-dot"></span>
                <span class="teacher-speech-author">${teacherName}</span>
              </div>
              <div class="teacher-speech-text">
                "${teacherSpeech}"
              </div>
              <div class="teacher-speech-tail"></div>
            </div>

            <div class="teacher-character-frame">
              <img
                id="teacherCharacterSprite"
                src="${initialTeacherSprite}"
                alt="${teacherName}"
                class="teacher-character-img ${initialTeacherAnimClass}"
              />
            </div>

            <div class="teacher-podium-shadow"></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('questionAvatarBox')?.addEventListener('click', () => {
      soundManager.playClick();
      if (this.state.avatarSlug) {
        soundManager.speakCharacterVoice(this.state.avatarSlug);
      }
    });

    document.getElementById('questionPauseBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.setState({ isPauseMenuOpen: true });
    });

    document.getElementById('worldMapNavBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.setState({ viewingHistoryItem: null, screen: 'world_map' });
    });

    const readBtn = document.getElementById('readQuestionBtn');
    const readIcon = document.getElementById('readQuestionIcon');
    const readText = document.getElementById('readQuestionText');

    const updateReadButton = (isSpeaking: boolean) => {
      if (readIcon && readText && readBtn) {
        if (isSpeaking) {
          readIcon.innerHTML = Icons.stop(18);
          readText.textContent = 'STOP';
          readBtn.style.background = '#DC2626';
          readBtn.style.borderColor = '#EF4444';
        } else {
          readIcon.innerHTML = Icons.rotateCcw(18);
          readText.textContent = 'REPLAY';
          readBtn.style.background = '#0284C7';
          readBtn.style.borderColor = '#38BDF8';
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
          soundManager.playSuccess();
        }
      }
    });

    if (isIdentification && !isReview) {
      const inputEl = document.getElementById('identificationTextInput') as HTMLInputElement | null;
      const submitBtn = document.getElementById('identificationSubmitBtn');

      const submitTyped = () => {
        if (!inputEl) return;
        const textVal = inputEl.value.trim();
        if (!textVal || this.state.submitting || this.state.submitResult) return;
        soundManager.stopSpeech();
        this.handleSelectAnswer(null, textVal);
      };

      submitBtn?.addEventListener('click', () => {
        soundManager.playClick();
        submitTyped();
      });

      inputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          soundManager.playClick();
          submitTyped();
        }
      });

      setTimeout(() => {
        inputEl?.focus();
      }, 150);
    } else if (!isReview) {
      document.querySelectorAll('.answer-card').forEach((card) => {
        const answerId = Number(card.getAttribute('data-answer-id'));

        card.addEventListener('pointerdown', () => {
          if (answerId && !this.state.submitting && !this.state.submitResult && !this.state.wrongAnswerIds.includes(answerId)) {
            card.classList.add('selected-active');
            soundManager.stopSpeech();
            this.clearTeacherAnimationTimers();
            soundManager.playClick();
          }
        });

        card.addEventListener('click', () => {
          if (answerId && !this.state.submitting && !this.state.submitResult && !this.state.wrongAnswerIds.includes(answerId)) {
            card.classList.add('selected-active');
            soundManager.stopSpeech();
            this.clearTeacherAnimationTimers();
            this.handleSelectAnswer(answerId);
          }
        });
      });
    }

    // Auto-play teacher's recorded voiceover ONLY on active new question with a 1.5s preparation delay
    if (!isReview && !result && this.lastNarratedQuestionId !== q.id) {
      this.lastNarratedQuestionId = q.id;
      setTimeout(() => {
        if (this.state.screen === 'question' && !this.state.submitResult && !this.state.viewingHistoryItem) {
          const voiceUrl = q.voice_audio_url || q.audio_url;
          if (voiceUrl) {
            soundManager.playCustomVoiceRecording(
              voiceUrl,
              () => updateReadButton(true),
              () => updateReadButton(false)
            );
          }
        }
      }, 1500);
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

        <div style="display: flex; flex-direction: column; gap: 14px; max-width: 360px; margin: 0 auto;">
          <div id="completedRestartBtnFrame" class="vocab-btn-frame">
            <button id="completedRestartBtn" class="vocab-btn vocab-btn-green" style="height: 58px; font-size: 24px;">
              <span>${Icons.refresh(22)}</span>
              <span>PLAY AGAIN</span>
            </button>
          </div>

          <div id="completedSaveExitBtnFrame" class="vocab-btn-frame vocab-btn-frame-blue">
            <button id="completedSaveExitBtn" class="vocab-btn vocab-btn-blue" style="height: 58px; font-size: 24px;">
              <span>${Icons.check(22)}</span>
              <span>SAVE & EXIT</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('completedRestartBtnFrame')?.addEventListener('mouseenter', () => soundManager.playHover());
    document.getElementById('completedRestartBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.lastNarratedQuestionId = null;
      gameApi.clearSession();
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.setState({
        screen: 'join',
        score: 0,
        attempts: {},
        history: [],
        viewingHistoryItem: null,
        currentData: null,
        submitResult: null,
        selectedAnswerId: null,
        wrongAnswerIds: [],
        customMascotSpeech: null,
      });
    });

    document.getElementById('completedSaveExitBtnFrame')?.addEventListener('mouseenter', () => soundManager.playHover());
    document.getElementById('completedSaveExitBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.lastNarratedQuestionId = null;
      gameApi.clearSession();
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.setState({
        screen: 'title',
        score: 0,
        attempts: {},
        history: [],
        viewingHistoryItem: null,
        currentData: null,
        submitResult: null,
        selectedAnswerId: null,
        wrongAnswerIds: [],
        customMascotSpeech: null,
      });
      this.showToast('Quest Completed!', 'Your score has been recorded. Returning to title!', 'success', 3500);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SLEEK MINIMALIST TOAST SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  public showToast(
    title: string,
    message: string,
    type: 'warning' | 'info' | 'success' = 'warning',
    durationMs = 4000
  ) {
    let container = document.getElementById('gameToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'gameToastContainer';
      container.className = 'game-toast-container';
      document.body.appendChild(container);
    }

    container.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'game-toast';

    let iconSvg = '';
    if (type === 'warning') {
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;
    } else if (type === 'success') {
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      `;
    } else {
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      `;
    }

    toast.innerHTML = `
      <div class="game-toast-icon-box toast-${type}">
        ${iconSvg}
      </div>
      <div class="game-toast-content">
        <div class="game-toast-title">${title}</div>
        <div class="game-toast-message">${message}</div>
      </div>
    `;

    const dismiss = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        toast.remove();
      }, 250);
    };

    toast.addEventListener('click', dismiss);
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        dismiss();
      }
    }, durationMs);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEACHER PAUSE OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────
  private renderTeacherPauseOverlay() {
    const OVERLAY_ID = 'teacherPauseOverlay';
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    if (!this.state.isTeacherPaused) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'teacher-pause-overlay';
    overlay.innerHTML = `
      <div class="teacher-pause-card">
        <div class="teacher-pause-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        </div>
        <p class="teacher-pause-title">Game Paused</p>
        <p class="teacher-pause-subtitle">Your teacher has paused the session. Sit tight — it will resume shortly.</p>
        <div class="teacher-pause-badge">
          <span class="teacher-pause-dot"></span>
          Waiting for teacher
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 💬 INTERACTIVE KINGDOM TUTORIAL & STORY DIALOGUE OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────
  private openKingdomDialogue(kingdomId: number) {
    soundManager.playClick();
    this.setState({
      isDialogueOpen: true,
      dialogueKingdomId: kingdomId,
      dialogueSlideIndex: 0,
    });
  }

  private nextDialogueSlide() {
    const kd = KINGDOM_DIALOGUES[this.state.dialogueKingdomId] || KINGDOM_DIALOGUES[1];
    if (this.state.dialogueSlideIndex < kd.slides.length - 1) {
      soundManager.playClick();
      const nextIdx = this.state.dialogueSlideIndex + 1;
      this.setState({ dialogueSlideIndex: nextIdx });
    } else {
      this.closeKingdomDialogue();
    }
  }

  private prevDialogueSlide() {
    if (this.state.dialogueSlideIndex > 0) {
      soundManager.playClick();
      const prevIdx = this.state.dialogueSlideIndex - 1;
      this.setState({ dialogueSlideIndex: prevIdx });
    }
  }

  private isKingdomDialogueSeen(kingdomId: number): boolean {
    const pin = this.state.pin || 'default';
    const localKey = `seen_dialogue_${pin}_k${kingdomId}`;
    return this.state.seenKingdomDialogues.includes(kingdomId) || localStorage.getItem(localKey) === 'true';
  }

  private closeKingdomDialogue() {
    soundManager.playSuccess();
    soundManager.stopSpeech();
    const kingdomId = this.state.dialogueKingdomId;
    const pin = this.state.pin || 'default';
    const localKey = `seen_dialogue_${pin}_k${kingdomId}`;
    localStorage.setItem(localKey, 'true');
    const seen = Array.from(new Set([...this.state.seenKingdomDialogues, kingdomId]));
    this.setState({
      isDialogueOpen: false,
      seenKingdomDialogues: seen,
      screen: 'question',
    });
  }

  private renderDialogueOverlay() {
    const OVERLAY_ID = 'dialogueOverlayContainer';
    const existing = document.getElementById(OVERLAY_ID);

    if (!this.state.isDialogueOpen) {
      if (existing) existing.remove();
      return;
    }

    const kd = KINGDOM_DIALOGUES[this.state.dialogueKingdomId] || KINGDOM_DIALOGUES[1];
    const slide = kd.slides[this.state.dialogueSlideIndex] || kd.slides[0];
    const isFinalSlide = this.state.dialogueSlideIndex >= kd.slides.length - 1;
    const hasPrev = this.state.dialogueSlideIndex > 0;

    const formattedText = slide.text.replace(
      '{playerName}',
      `<span class="dialogue-name-highlight">${this.state.playerName || 'Adventurer'}</span>`
    );

    const dotsHtml = kd.slides
      .map((_, i) => `<div class="dialogue-dot ${i === this.state.dialogueSlideIndex ? 'active' : ''}"></div>`)
      .join('');

    const prevBtnHtml = hasPrev
      ? `<button id="dialoguePrevBtn" class="dialogue-btn-prev"><span>◀ PREV</span></button>`
      : '';

    // If overlay is already in the DOM, update in-place without tearing down backdrop (prevents screen blinking!)
    if (existing) {
      const speakerEl = existing.querySelector('.dialogue-speaker-name');
      if (speakerEl) speakerEl.textContent = slide.speaker;

      const badgeEl = existing.querySelector('.dialogue-badge-sub');
      if (badgeEl) badgeEl.textContent = slide.titleBadge;

      const textEl = existing.querySelector('.dialogue-speech-text');
      if (textEl) textEl.innerHTML = formattedText;

      const dotsContainer = existing.querySelector('.dialogue-step-dots');
      if (dotsContainer) dotsContainer.innerHTML = dotsHtml;

      const actionBtn = existing.querySelector('#dialogueActionBtn span');
      if (actionBtn) actionBtn.textContent = slide.buttonText || (isFinalSlide ? 'START QUEST ⚔️' : 'NEXT ▶');

      const actionsContainer = existing.querySelector('.dialogue-footer-actions');
      if (actionsContainer) {
        actionsContainer.innerHTML = `
          ${prevBtnHtml}
          <button id="dialogueActionBtn" class="dialogue-btn-action">
            <span>${slide.buttonText || (isFinalSlide ? 'START QUEST ⚔️' : 'NEXT ▶')}</span>
          </button>
        `;
        existing.querySelector('#dialoguePrevBtn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.prevDialogueSlide();
        });
        existing.querySelector('#dialogueActionBtn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.nextDialogueSlide();
        });
      }

      const charImg = existing.querySelector<HTMLImageElement>('.dialogue-char-img');
      if (charImg && slide.characterImage) {
        charImg.src = slide.characterImage;
      }
      return;
    }

    // Initial render
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'dialogue-overlay-backdrop';

    const charHtml = slide.characterImage
      ? `<div class="dialogue-char-stage">
           <img class="dialogue-char-img" src="${slide.characterImage}" alt="${slide.speaker}" />
           <div class="dialogue-char-ground-shadow"></div>
         </div>`
      : '';

    overlay.innerHTML = `
      <div class="dialogue-wrapper ${slide.characterImage ? 'has-character' : 'full-dialogue'}">
        <div class="dialogue-card">
          <div class="dialogue-header">
            <div class="dialogue-speaker-tag">
              <span class="dialogue-speaker-name">${slide.speaker}</span>
            </div>
            <div class="dialogue-badge-sub">${slide.titleBadge}</div>
            <button id="dialogueSkipBtn" class="dialogue-skip-btn">Skip ❯❯</button>
          </div>

          <div class="dialogue-body">
            <div class="dialogue-speech-text">${formattedText}</div>
          </div>

          <div class="dialogue-footer">
            <div class="dialogue-step-dots">
              ${dotsHtml}
            </div>
            <div class="dialogue-footer-actions">
              ${prevBtnHtml}
              <button id="dialogueActionBtn" class="dialogue-btn-action">
                <span>${slide.buttonText || (isFinalSlide ? 'START QUEST ⚔️' : 'NEXT ▶')}</span>
              </button>
            </div>
          </div>
        </div>
        ${charHtml}
      </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners
    overlay.querySelector('#dialoguePrevBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevDialogueSlide();
    });

    overlay.querySelector('#dialogueActionBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextDialogueSlide();
    });

    overlay.querySelector('#dialogueSkipBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeKingdomDialogue();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.nextDialogueSlide();
      }
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
        <div class="modal-dialog pause-menu-card">
          <div class="pause-menu-header">
            <div class="pause-menu-title">
              <span>${Icons.menu(22)}</span>
              <span>GAME PAUSED</span>
            </div>
          </div>

          <div class="pause-menu-buttons">
            <button id="pauseContinueBtn" class="pause-btn pause-btn-green">
              <span>${Icons.play(20)}</span>
              <span>CONTINUE QUEST</span>
            </button>

            <button id="pauseWorldMapBtn" class="pause-btn pause-btn-blue">
              <span>${Icons.map(20)}</span>
              <span>RETURN TO WORLD MAP</span>
            </button>

            <button id="pauseSettingsBtn" class="pause-btn pause-btn-yellow">
              <span>${Icons.refresh(20)}</span>
              <span>SETTINGS</span>
            </button>

            <button id="pauseQuitBtn" class="pause-btn pause-btn-red">
              <span>${Icons.x(20)}</span>
              <span>QUIT TO TITLE</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalContainer);

      const contBtn = document.getElementById('pauseContinueBtn');
      const mapBtn = document.getElementById('pauseWorldMapBtn');
      const settBtn = document.getElementById('pauseSettingsBtn');
      const quitBtn = document.getElementById('pauseQuitBtn');

      contBtn?.addEventListener('mouseenter', () => soundManager.playHover());
      mapBtn?.addEventListener('mouseenter', () => soundManager.playHover());
      settBtn?.addEventListener('mouseenter', () => soundManager.playHover());
      quitBtn?.addEventListener('mouseenter', () => soundManager.playHover());

      contBtn?.addEventListener('click', () => {
        soundManager.playClick();
        this.setState({ isPauseMenuOpen: false });
      });

      mapBtn?.addEventListener('click', () => {
        soundManager.playClick();
        soundManager.stopSpeech();
        this.setState({ isPauseMenuOpen: false, screen: 'world_map' });
      });

      settBtn?.addEventListener('click', () => {
        soundManager.playClick();
        this.setState({ isPauseMenuOpen: false, isSettingsOpen: true });
      });

      quitBtn?.addEventListener('click', () => {
        soundManager.playClick();
        soundManager.stopSpeech();
        this.lastActiveMapId = 1;
        gameApi.clearSession();
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
      return;
    }
  }
}

new StudentArcadeGame();
