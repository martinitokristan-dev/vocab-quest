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
import { HowToPlayModal } from './components/modals/HowToPlayModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { PauseMenuModal } from './components/modals/PauseMenuModal';
import { DialogueOverlay } from './components/overlays/DialogueOverlay';
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
import { clearTeacherAnimationTimers, updateTeacherSpeakingUI } from './utils/teacherAnimation';
import { loadFeedbackAudios, selectPraiseClip, selectCheerUpClip, type FeedbackAudios } from './utils/feedbackAudio';
import { syncUrl, initRouter, type ScreenType } from './utils/router';

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

  // Modal components
  private howToPlayModal: HowToPlayModal | null = null;
  private settingsModal: SettingsModal | null = null;
  private pauseMenuModal: PauseMenuModal | null = null;

  // Overlay components
  private dialogueOverlay: DialogueOverlay | null = null;

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
  private teacherAnimationTimers = {
    mouthInterval: null as number | null,
    outroTimeouts: [] as number[]
  };
  private feedbackAudios: FeedbackAudios = { praise: [], cheer_up: [] };

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


  private syncUrl(screen: StudentGameAppState['screen'], replace = false) {
    syncUrl(screen, this.state.pin, replace);
  }

  private initRouter() {
    initRouter({
      onScreenChange: (screen: ScreenType) => {
        this.setState({ screen });
        this.render();
      },
      onProfileRestore: (profile) => {
        if (profile.playerName) this.state.playerName = profile.playerName;
        if (profile.avatarSlug) this.state.avatarSlug = profile.avatarSlug;
        if (profile.pin) this.state.pin = profile.pin;
      },
      onPinUpdate: (pin) => {
        this.state.pin = pin;
      }
    });
  }

  private async loadFeedbackAudios() {
    this.feedbackAudios = await loadFeedbackAudios();
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

    this.teacherAnimationTimers = updateTeacherSpeakingUI(
      {
        isSpeaking,
        submitting: this.state.submitting,
        wrongAnswerIds: this.state.wrongAnswerIds,
        submitResult: this.state.submitResult,
        currentFeedbackSprite: this.state.currentFeedbackSprite,
        currentData: this.state.currentData,
      },
      this.teacherAnimationTimers
    );
  }

  private async handleSelectAnswer(answerId?: number | null, typedAnswer?: string | null) {
    if (this.state.submitting || !this.state.currentData?.data || this.state.isTeacherPaused) return;

    this.state.submitting = true;
    soundManager.stopSpeech();
    clearTeacherAnimationTimers(this.teacherAnimationTimers);

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
        const customPraise = selectPraiseClip(this.feedbackAudios, activeMapId);

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
        const customCheer = selectCheerUpClip(this.feedbackAudios, activeMapId);

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
          clearTeacherAnimationTimers(this.teacherAnimationTimers);
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
    if (!this.dialogueOverlay) {
      this.dialogueOverlay = new DialogueOverlay({
        isOpen: this.state.isDialogueOpen,
        dialogueType: this.state.dialogueType,
        dialogueKingdomId: this.state.dialogueKingdomId,
        dialogueSlideIndex: this.state.dialogueSlideIndex,
        playerName: this.state.playerName,
        onNextSlide: () => this.nextDialogueSlide(),
        onPrevSlide: () => this.prevDialogueSlide(),
        onClose: () => this.closeKingdomDialogue()
      });
    } else {
      // Update props for re-render
      this.dialogueOverlay = new DialogueOverlay({
        isOpen: this.state.isDialogueOpen,
        dialogueType: this.state.dialogueType,
        dialogueKingdomId: this.state.dialogueKingdomId,
        dialogueSlideIndex: this.state.dialogueSlideIndex,
        playerName: this.state.playerName,
        onNextSlide: () => this.nextDialogueSlide(),
        onPrevSlide: () => this.prevDialogueSlide(),
        onClose: () => this.closeKingdomDialogue()
      });
    }
    this.dialogueOverlay.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS (HOW TO PLAY, SETTINGS, IN-GAME PAUSE MENU)
  // ─────────────────────────────────────────────────────────────────────────────
  private renderModals() {
    const existingModal = document.getElementById('modalContainer');
    if (existingModal) existingModal.remove();

    if (this.state.isHowToPlayOpen) {
      if (!this.howToPlayModal) {
        this.howToPlayModal = new HowToPlayModal({
          onClose: () => this.setState({ isHowToPlayOpen: false })
        });
      }
      this.howToPlayModal.render();
      this.howToPlayModal.mount();
      return;
    }

    if (this.state.isSettingsOpen) {
      if (!this.settingsModal) {
        this.settingsModal = new SettingsModal({
          onClose: () => this.setState({ isSettingsOpen: false })
        });
      }
      this.settingsModal.render();
      this.settingsModal.mount();
      return;
    }

    if (this.state.isPauseMenuOpen) {
      if (!this.pauseMenuModal) {
        this.pauseMenuModal = new PauseMenuModal({
          onClose: () => this.setState({ isPauseMenuOpen: false }),
          onReturnToMap: () => this.setState({ isPauseMenuOpen: false, screen: 'world_map' }),
          onOpenSettings: () => this.setState({ isPauseMenuOpen: false, isSettingsOpen: true }),
          onQuitToTitle: () => this.setState({
            isPauseMenuOpen: false,
            screen: 'title',
            score: 0,
            attempts: {},
            history: [],
            currentData: null,
            submitResult: null,
            wrongAnswerIds: [],
            customMascotSpeech: null,
          }),
          onClearPollInterval: () => {
            if (this.pollInterval) clearInterval(this.pollInterval);
          }
        });
      }
      this.pauseMenuModal.render();
      this.pauseMenuModal.mount();
      return;
    }
  }
}

new StudentArcadeGame();
