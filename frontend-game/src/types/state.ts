import { type MapInteractionPhase, type PendingMapAction } from '../mapFlowController';
import { type CurrentQuestionResponse, type SubmitAnswerResponse } from '../api';

/**
 * Student game application state interface
 * Pure extraction from main.ts
 */
export interface StudentGameAppState {
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

  // Map flow state
  mapPhase: MapInteractionPhase;
  enteredKingdomIds: number[];
  pendingMapAction: PendingMapAction | null;
  lastCompletedStep: { mapId: number; questionIndex: number } | null;
  starCelebration: { stars: number; globalLevel: number } | null;
  dialogueType: 'global' | 'kingdom';
  hasSeenGlobalIntro: boolean;
}
