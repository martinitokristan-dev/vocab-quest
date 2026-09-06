import './style.css';
import { gameApi, isSessionAuthError } from './api';
import { Game2DMapRenderer } from './game2d';
import { soundManager } from './soundManager';
import { Icons } from './icons';
import { KINGDOM_DIALOGUES, GLOBAL_INTRO_DIALOGUE } from './dialogueData';
import { TitleScreen } from './components/screens/TitleScreen';
import { JoinScreen } from './components/screens/JoinScreen';
import { LoadingScreen } from './components/screens/LoadingScreen';
import { WorldMapScreen } from './components/screens/WorldMapScreen';
import { QuestionScreen } from './components/screens/QuestionScreen';
import { CompletedScreen } from './components/screens/CompletedScreen';
import { PRAISE_PHRASES, TRY_AGAIN_PHRASES, getAvatarBySlug } from './utils/constants';
import { showToast } from './utils/toast';
import {
  globalLevelNumber,
  getStepRef,
  computeWalkPath,
  hydrateEnteredKingdomIds,
  markKingdomEnteredStored,
  markGlobalIntroSeen,
  isGlobalIntroSeen,
  clearMapFlowProgressForPin,
  getFreshMapFlowState,
  buildKingdomTransitionAction,
} from './mapFlowController';
import { showStarBurstOverlay } from './starBurstOverlay';
import { type StudentGameAppState } from './types/state';
import { mergeHistoryWithCompleted } from './utils/history';

class StudentArcadeGame {
  private appEl: HTMLElement;
  private bgLayerEl: HTMLElement;
  private mapRenderer: Game2DMapRenderer | null = null;

  // Screen components
  private titleScreen: TitleScreen | null = null;
  private joinScreen: JoinScreen | null = null;
  private loadingScreen: LoadingScreen | null = null;
  private worldMapScreen: WorldMapScreen | null = null;
  private questionScreen: QuestionScreen | null = null;
  private completedScreen: CompletedScreen | null = null;

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
    mapPhase: 'awaiting_kingdom_click',
    enteredKingdomIds: [],
    pendingMapAction: null,
    lastCompletedStep: null,
    starCelebration: null,
    dialogueType: 'kingdom',
    hasSeenGlobalIntro: false,
  };

  private pollInterval: number | null = null;
  private loadingInterval: number | null = null;
  private lastNarratedQuestionId: number | null = null;
  private teacherMouthInterval: number | null = null;
  private teacherOutroTimeouts: number[] = [];
  private feedbackAudios: {
    praise: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean; map_id: number | null }>;
    cheer_up: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean; map_id: number | null }>;
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
      console.log('Loaded feedback audios:', this.feedbackAudios);
      console.log('Praise clips count:', this.feedbackAudios.praise.length);
      console.log('Cheer_up clips count:', this.feedbackAudios.cheer_up.length);
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
      if (this.state.isTeacherPaused) {
        soundManager.pauseAll();
      } else {
        soundManager.resumeAll();
      }
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
      const needsFullRender =
        partialState.currentData !== undefined ||
        partialState.history !== undefined ||
        partialState.enteredKingdomIds !== undefined ||
        partialState.mapPhase !== undefined ||
        !this.mapRenderer;
      if (needsFullRender) {
        this.render();
      } else if (partialState.pendingMapAction !== undefined && partialState.pendingMapAction !== null) {
        this.syncMapRendererOptions();
        this.executePendingMapAction();
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

  private handleSessionResetByTeacher(showToast = true) {
    const pin = this.state.pin || gameApi.getSessionProfile().pin || '';
    if (pin) {
      clearMapFlowProgressForPin(pin);
    }

    if (this.mapRenderer) {
      this.mapRenderer.destroy();
      this.mapRenderer = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    gameApi.clearSession();

    this.setState({
      screen: 'join',
      pin,
      currentData: null,
      history: [],
      attempts: {},
      score: 0,
      viewingHistoryItem: null,
      selectedAnswerId: null,
      submitResult: null,
      wrongAnswerIds: [],
      roomStatus: 'waiting',
      isTeacherPaused: false,
      isDialogueOpen: false,
      dialogueSlideIndex: 0,
      ...getFreshMapFlowState(),
    });

    if (showToast) {
      this.showToast(
        'Session Reset',
        'Your teacher reset the room. Join again for a fresh start!',
        'info',
        6000
      );
    }
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

        let mergedHistory = mergeHistoryWithCompleted(this.state.history, res.data.completed_questions || []);

        const isPaused = Boolean(res.is_paused || res.data?.is_paused || res.room_status === 'paused' || res.data?.room_status === 'paused');
        const roomStatus = res.room_status || res.data?.room_status || (isPaused ? 'paused' : 'in_progress');
        const isWaiting = roomStatus === 'waiting';
        const isLoadingScreen = this.state.screen === 'loading';
        const nextScreen = isLoadingScreen
          ? 'loading'
          : (forceScreen || (isWaiting ? 'world_map' : (shouldChangeScreen || isMapChanged ? 'world_map' : this.state.screen)));

        const pin = this.state.pin || 'default';
        const activeMapId = res.data.map.id;
        const enteredKingdomIds = hydrateEnteredKingdomIds(pin, mergedHistory, activeMapId);
        const hasSeenGlobalIntro = isGlobalIntroSeen(pin);

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
          enteredKingdomIds,
          hasSeenGlobalIntro,
        });
      }
    } catch (err: any) {
      console.error('Fetch question error:', err);
      if (isSessionAuthError(err)) {
        this.handleSessionResetByTeacher();
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
            'Your teacher has started the game. Tap a kingdom on the map to begin!',
            'success',
            4500
          );
        }
      } catch (err: any) {
        if (isSessionAuthError(err)) {
          this.handleSessionResetByTeacher();
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

      clearMapFlowProgressForPin(this.state.pin);

      await gameApi.joinRoom(this.state.pin, this.state.playerName, this.state.avatarSlug);
      this.setState({
        submitting: false,
        history: [],
        attempts: {},
        score: 0,
        currentData: null,
        viewingHistoryItem: null,
        roomStatus: 'waiting',
        ...getFreshMapFlowState(),
      });

      const loader = this.startLoading('world_map', () => {
        this.startLightweightPoller();
      });

      // Fetch data in parallel while loader is preparing kingdom challenges
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

        // Check for teacher's uploaded praise audio clips — filter by active status & current kingdom
        console.log('Current activeMapId:', activeMapId);
        const activePraiseClips = this.feedbackAudios.praise.filter(
          (p) => p.is_active !== false && (p.map_id == null || p.map_id === activeMapId)
        );
        console.log('Filtered activePraiseClips:', activePraiseClips);
        const customPraise = activePraiseClips.length > 0
          ? activePraiseClips[Math.floor(Math.random() * activePraiseClips.length)]
          : null;
        console.log('Selected customPraise:', customPraise);
        if (customPraise) {
          console.log('Custom praise audio URL:', customPraise.audio_url);
        }

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
        const completedStep = getStepRef(activeMapId, questionOrder);
        const globalLevel = globalLevelNumber(activeMapId, questionOrder);

        const proceedAfterPraise = async () => {
          if (hasAdvanced) return;
          hasAdvanced = true;

          await showStarBurstOverlay(starsEarned, globalLevel);

          const prevMapId = activeMapId;
          await this.fetchCurrentQuestion('world_map');

          if (this.state.screen === 'completed') {
            this.startLightweightPoller();
            return;
          }

          if (!completedStep) {
            this.setState({
              submitResult: null,
              selectedAnswerId: null,
              wrongAnswerIds: [],
              currentFeedbackSprite: null,
              mapPhase: 'kingdom_active',
              pendingMapAction: null,
            });
            this.startLightweightPoller();
            return;
          }

          const newMapId = this.state.currentData?.data?.map?.id || prevMapId;
          const newQIndex =
            this.state.currentData?.data?.question?.order_index ||
            this.state.currentData?.data?.map?.current_question_num ||
            1;

          if (newMapId !== prevMapId) {
            const transitionAction = buildKingdomTransitionAction(
              prevMapId,
              questionOrder,
              newMapId
            );
            const enteredKingdomIds = this.state.enteredKingdomIds.filter((id) => id < newMapId);

            this.setState({
              submitResult: null,
              selectedAnswerId: null,
              wrongAnswerIds: [],
              currentFeedbackSprite: null,
              screen: 'world_map',
              mapPhase: transitionAction ? 'walking_to_question' : 'awaiting_kingdom_click',
              pendingMapAction: transitionAction,
              lastCompletedStep: { mapId: prevMapId, questionIndex: questionOrder },
              enteredKingdomIds,
            });

            if (!transitionAction) {
              this.showToast(
                'New Kingdom Unlocked!',
                'Tap the next kingdom on the map to continue your quest!',
                'success',
                5000
              );
            }
            this.startLightweightPoller();
            return;
          }

          const toStep = getStepRef(newMapId, newQIndex);
          if (!toStep) {
            this.setState({
              submitResult: null,
              selectedAnswerId: null,
              wrongAnswerIds: [],
              currentFeedbackSprite: null,
              screen: 'question',
              mapPhase: 'kingdom_active',
            });
            this.startLightweightPoller();
            return;
          }

          this.setState({
            submitResult: null,
            selectedAnswerId: null,
            wrongAnswerIds: [],
            currentFeedbackSprite: null,
            screen: 'world_map',
            mapPhase: 'walking_to_question',
            lastCompletedStep: { mapId: prevMapId, questionIndex: questionOrder },
            pendingMapAction: {
              type: 'walk_to_current',
              fromStep: completedStep,
              toStep,
              path: computeWalkPath(completedStep, toStep),
              bubbleText: `LEVEL ${globalLevelNumber(newMapId, newQIndex)}!`,
              thenScreen: 'question',
            },
          });
          this.startLightweightPoller();
        };

        if (customPraise?.audio_url) {
          soundManager.playFeedbackAudio(customPraise.audio_url, proceedAfterPraise);
        } else {
          setTimeout(proceedAfterPraise, 900);
        }
      } else {
        // --- 2. WRONG ANSWER: SHUFFLED TEACHER CHEER-UP ENCOURAGEMENT ---
        const activeCheerClips = this.feedbackAudios.cheer_up.filter(
          (c) => c.is_active !== false && (c.map_id == null || c.map_id === activeMapId)
        );
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
      if (isSessionAuthError(err)) {
        this.handleSessionResetByTeacher(false);
        return;
      }
      this.setState({ error: err.message || 'Failed to submit answer', submitting: false });
    }
  }

  private render() {
    if (
      this.mapRenderer &&
      this.state.screen !== 'world_map' &&
      this.state.screen !== 'question'
    ) {
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
    if (!this.titleScreen) {
      this.titleScreen = new TitleScreen(
        this.appEl,
        () => this.startLoading('join'),
        () => this.setState({ isHowToPlayOpen: true }),
        () => this.setState({ isSettingsOpen: true })
      );
    }
    this.titleScreen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderLoadingScreen() {
    if (!this.loadingScreen) {
      this.loadingScreen = new LoadingScreen(this.appEl, {
        loadingProgress: this.state.loadingProgress,
        loadingTargetScreen: this.state.loadingTargetScreen
      });
    } else {
      this.loadingScreen.updateProps({
        loadingProgress: this.state.loadingProgress,
        loadingTargetScreen: this.state.loadingTargetScreen
      });
    }
    this.loadingScreen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. STUDENT JOIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderJoinScreen() {
    if (!this.joinScreen) {
      this.joinScreen = new JoinScreen(this.appEl, {
        pin: this.state.pin,
        playerName: this.state.playerName,
        avatarSlug: this.state.avatarSlug,
        error: this.state.error,
        submitting: this.state.submitting,
        onBackClick: () => this.setState({ screen: 'title' }),
        onPinChange: (pin) => {
          this.state.pin = pin;
          this.syncUrl('join', true);
        },
        onPlayerNameChange: (name) => {
          this.state.playerName = name;
        },
        onAvatarSelect: (slug) => {
          this.state.avatarSlug = slug;
          soundManager.speakCharacterVoice(slug);
        },
        onSubmit: (e) => this.handleJoin(e)
      });
    } else {
      this.joinScreen.updateProps({
        pin: this.state.pin,
        playerName: this.state.playerName,
        avatarSlug: this.state.avatarSlug,
        error: this.state.error,
        submitting: this.state.submitting
      });
    }
    this.joinScreen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAP FLOW HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  private getMapFlowOptions(activeMapId: number) {
    return {
      activeMapId,
      enteredKingdomIds: this.state.enteredKingdomIds,
      mapPhase: this.state.mapPhase,
    };
  }

  private syncMapRendererOptions() {
    if (!this.mapRenderer) return;
    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    this.mapRenderer.setMapFlowOptions(this.getMapFlowOptions(activeMapId));
  }



  private bindMapCallbacks(activeMapId: number, currentQuestionIndex: number) {
    if (!this.mapRenderer) return;

    this.mapRenderer.onKingdomClick((kingdomId) => {
      void this.handleKingdomClick(kingdomId);
    });

    this.mapRenderer.onLockedKingdomClick(() => {
      this.showToast(
        'Kingdom Locked',
        'Finish the current kingdom first!',
        'warning'
      );
    });

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

      if (!this.state.enteredKingdomIds.includes(mapId || activeMapId)) {
        soundManager.playWrong();
        this.showToast('Enter the Kingdom', 'Tap the kingdom building first to begin!', 'warning');
        return;
      }

      soundManager.stopSpeech();

      const targetMapId = mapId || activeMapId;
      const targetQIndex = stepQuestionIndex || currentQuestionIndex;
      const isAnswered =
        this.state.history.some(
          (h) =>
            h.mapId === targetMapId &&
            (h.questionIndex === targetQIndex || h.orderIndex === targetQIndex)
        ) ||
        targetMapId < activeMapId ||
        (targetMapId === activeMapId && targetQIndex < currentQuestionIndex);

      if (isAnswered) {
        const historyItem =
          this.state.history.find(
            (h) =>
              h.mapId === targetMapId &&
              (h.questionIndex === targetQIndex || h.orderIndex === targetQIndex)
          ) || this.state.history[0] || null;
        this.setState({ viewingHistoryItem: historyItem, screen: 'question' });
        return;
      }

      this.setState({ viewingHistoryItem: null, screen: 'question' });
    });
  }

  private async handleKingdomClick(kingdomId: number) {
    if (this.state.roomStatus === 'waiting') {
      soundManager.playHover();
      this.showToast(
        'Session Not Started',
        'Your teacher has not started the session yet. Waiting for other players to join!',
        'warning'
      );
      return;
    }

    const activeMapId = this.state.currentData?.data?.map?.id || 1;
    if (kingdomId > activeMapId) {
      soundManager.playWrong();
      this.showToast(
        'Kingdom Locked',
        'Complete the previous kingdom first!',
        'warning'
      );
      return;
    }

    if (this.state.enteredKingdomIds.includes(kingdomId)) return;

    this.setState({ mapPhase: 'kingdom_enter_anim' });

    if (this.mapRenderer) {
      await this.mapRenderer.playKingdomEntryAnimation(kingdomId);
    }

    const pin = this.state.pin || 'default';
    markKingdomEnteredStored(pin, kingdomId);
    const entered = Array.from(new Set([...this.state.enteredKingdomIds, kingdomId]));

    this.setState({
      enteredKingdomIds: entered,
      mapPhase: 'kingdom_active',
    });
    this.syncMapRendererOptions();

    if (!this.isKingdomDialogueSeen(kingdomId) && KINGDOM_DIALOGUES[kingdomId]) {
      this.openKingdomDialogue(kingdomId);
    } else {
      this.mapRenderer?.clearEntryFade();
      this.setState({
        screen: 'question',
        mapPhase: 'kingdom_active',
        pendingMapAction: null,
        viewingHistoryItem: null,
      });
    }
  }



  private executePendingMapAction() {
    const action = this.state.pendingMapAction;
    if (!action || !this.mapRenderer) return;

    this.setState({ pendingMapAction: null });

    this.mapRenderer.animateWalkingPath(action.path, action.bubbleText, () => {
      setTimeout(() => {
        if (this.state.screen !== 'world_map') return;

        if (action.thenScreen === 'question') {
          this.setState({
            screen: 'question',
            mapPhase: 'kingdom_active',
            viewingHistoryItem: null,
            pendingMapAction: null,
          });
        } else if (action.thenScreen === 'dialogue' && action.thenDialogueKingdomId) {
          this.openKingdomDialogue(action.thenDialogueKingdomId);
        } else if (action.thenScreen === 'await_kingdom') {
          this.setState({
            mapPhase: 'awaiting_kingdom_click',
            pendingMapAction: null,
          });
          this.syncMapRendererOptions();
          this.showToast(
            'New Kingdom Unlocked!',
            'Tap the next kingdom on the map to continue your quest!',
            'success',
            5000
          );
        }
      }, 800);
    });
  }

  private maybeShowGlobalIntro() {
    if (
      this.state.hasSeenGlobalIntro ||
      isGlobalIntroSeen(this.state.pin || 'default') ||
      this.state.isDialogueOpen
    ) {
      return;
    }
    setTimeout(() => {
      if (this.state.screen === 'world_map' && !this.state.isDialogueOpen) {
        this.openGlobalIntro();
      }
    }, 600);
  }

  private openGlobalIntro() {
    soundManager.playClick();
    this.setState({
      isDialogueOpen: true,
      dialogueType: 'global',
      dialogueKingdomId: 0,
      dialogueSlideIndex: 0,
    });
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

    if (!this.worldMapScreen) {
      this.worldMapScreen = new WorldMapScreen(this.appEl, {
        playerName: this.state.playerName,
        avatarSlug: this.state.avatarSlug,
        avatarImage: avatar.image || '/assets/mascot_girl.png',
        activeMapId,
        currentQuestionIndex,
        totalStars,
        mapFlowOptions: this.getMapFlowOptions(activeMapId),
        mapRenderer: this.mapRenderer,
        onAvatarClick: () => {
          if (this.state.avatarSlug) {
            soundManager.speakCharacterVoice(this.state.avatarSlug);
          }
        },
        onPauseClick: () => {
          soundManager.stopSpeech();
          this.setState({ isPauseMenuOpen: true });
        },
        onMapRendererInit: (renderer) => {
          this.mapRenderer = renderer;
          this.bindMapCallbacks(activeMapId, currentQuestionIndex);
          if (this.state.pendingMapAction) {
            this.executePendingMapAction();
          }
          this.maybeShowGlobalIntro();
        },
        onMapRendererUpdate: (_renderer) => {
          this.bindMapCallbacks(activeMapId, currentQuestionIndex);
          if (this.state.pendingMapAction) {
            this.executePendingMapAction();
          }
          this.maybeShowGlobalIntro();
        }
      });
    } else {
      this.worldMapScreen.updateProps({
        playerName: this.state.playerName,
        avatarSlug: this.state.avatarSlug,
        avatarImage: avatar.image || '/assets/mascot_girl.png',
        activeMapId,
        currentQuestionIndex,
        totalStars,
        mapFlowOptions: this.getMapFlowOptions(activeMapId),
        mapRenderer: this.mapRenderer
      });
    }
    this.worldMapScreen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. QUESTION GAMEPLAY SCREEN (WITH TTS NARRATION & 3-STAR PROGRESSION)
  // ─────────────────────────────────────────────────────────────────────────────
  private renderQuestionScreen() {
    const avatar = getAvatarBySlug(this.state.avatarSlug);
    const isReview = Boolean(this.state.viewingHistoryItem);
    const q = (isReview ? (this.state.viewingHistoryItem?.questionData || this.state.currentData?.data?.question) : this.state.currentData?.data?.question) || this.state.currentData?.data?.question;
    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 0), 0);

    if (!this.questionScreen) {
      this.questionScreen = new QuestionScreen(this.appEl, {
        playerName: this.state.playerName,
        avatarSlug: this.state.avatarSlug,
        avatarImage: avatar.image || '/assets/mascot_girl.png',
        totalStars,
        question: q,
        isReview,
        viewingHistoryItem: this.state.viewingHistoryItem,
        submitResult: this.state.submitResult,
        selectedAnswerId: this.state.selectedAnswerId,
        wrongAnswerIds: this.state.wrongAnswerIds,
        submitting: this.state.submitting,
        customMascotSpeech: this.state.customMascotSpeech,
        currentFeedbackSprite: this.state.currentFeedbackSprite,
        lastNarratedQuestionId: this.lastNarratedQuestionId,
        onAvatarClick: () => {
          if (this.state.avatarSlug) {
            soundManager.speakCharacterVoice(this.state.avatarSlug);
          }
        },
        onPauseClick: () => {
          soundManager.stopSpeech();
          this.setState({ isPauseMenuOpen: true });
        },
        onWorldMapClick: () => {
          soundManager.stopSpeech();
          this.setState({ viewingHistoryItem: null, screen: 'world_map' });
        },
        onReplayClick: () => {
          // Replay logic handled in component
        },
        onAnswerSelect: (answerId, typedAnswer) => {
          soundManager.stopSpeech();
          this.handleSelectAnswer(answerId, typedAnswer);
        },
        onTeacherAnimationClear: () => {
          this.clearTeacherAnimationTimers();
        },
        onQuestionNarrated: (questionId) => {
          this.lastNarratedQuestionId = questionId;
        }
      });
    } else {
      this.questionScreen.updateProps({
        playerName: this.state.playerName,
        avatarSlug: this.state.avatarSlug,
        avatarImage: avatar.image || '/assets/mascot_girl.png',
        totalStars,
        question: q,
        isReview,
        viewingHistoryItem: this.state.viewingHistoryItem,
        submitResult: this.state.submitResult,
        selectedAnswerId: this.state.selectedAnswerId,
        wrongAnswerIds: this.state.wrongAnswerIds,
        submitting: this.state.submitting,
        customMascotSpeech: this.state.customMascotSpeech,
        currentFeedbackSprite: this.state.currentFeedbackSprite,
        lastNarratedQuestionId: this.lastNarratedQuestionId
      });
    }
    this.questionScreen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. COMPLETED SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  private renderCompletedScreen() {
    const totalStars = this.state.history.reduce((acc, h) => acc + (h.stars || 1), 0);

    if (!this.completedScreen) {
      this.completedScreen = new CompletedScreen(this.appEl, {
        playerName: this.state.playerName,
        score: this.state.score,
        totalStars,
        historyLength: this.state.history.length,
        onRestartClick: () => {
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
        },
        onSaveExitClick: () => {
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
        }
      });
    } else {
      this.completedScreen.updateProps({
        playerName: this.state.playerName,
        score: this.state.score,
        totalStars,
        historyLength: this.state.history.length
      });
    }
    this.completedScreen.render();
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
    showToast(title, message, type, durationMs);
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
    this.mapRenderer?.clearEntryFade();
    this.setState({
      isDialogueOpen: true,
      dialogueType: 'kingdom',
      dialogueKingdomId: kingdomId,
      dialogueSlideIndex: 0,
    });
  }

  private getActiveDialogue() {
    if (this.state.dialogueType === 'global') {
      return GLOBAL_INTRO_DIALOGUE;
    }
    return KINGDOM_DIALOGUES[this.state.dialogueKingdomId] || KINGDOM_DIALOGUES[1];
  }

  private nextDialogueSlide() {
    const kd = this.getActiveDialogue();
    if (this.state.dialogueSlideIndex < kd.slides.length - 1) {
      soundManager.playClick();
      const nextIdx = this.state.dialogueSlideIndex + 1;
      this.setState({ dialogueSlideIndex: nextIdx });
    } else {
      this.closeDialogue();
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

  private closeDialogue() {
    soundManager.playSuccess();
    soundManager.stopSpeech();
    const pin = this.state.pin || 'default';

    if (this.state.dialogueType === 'global') {
      markGlobalIntroSeen(pin);
      this.setState({
        isDialogueOpen: false,
        hasSeenGlobalIntro: true,
        mapPhase: 'awaiting_kingdom_click',
      });
      return;
    }

    const kingdomId = this.state.dialogueKingdomId;
    const localKey = `seen_dialogue_${pin}_k${kingdomId}`;
    localStorage.setItem(localKey, 'true');
    const seen = Array.from(new Set([...this.state.seenKingdomDialogues, kingdomId]));

    this.mapRenderer?.clearEntryFade();

    this.setState({
      isDialogueOpen: false,
      seenKingdomDialogues: seen,
      screen: 'question',
      mapPhase: 'kingdom_active',
      pendingMapAction: null,
      viewingHistoryItem: null,
    });
  }

  /** @deprecated use closeDialogue */
  private closeKingdomDialogue() {
    this.closeDialogue();
  }

  private renderDialogueOverlay() {
    const OVERLAY_ID = 'dialogueOverlayContainer';
    const existing = document.getElementById(OVERLAY_ID);

    if (!this.state.isDialogueOpen) {
      if (existing) existing.remove();
      return;
    }

    const kd = this.getActiveDialogue();
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
