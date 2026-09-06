import { soundManager } from '../soundManager';

interface TeacherAnimationState {
  isSpeaking: boolean;
  submitting: boolean;
  wrongAnswerIds: number[];
  submitResult: { is_correct: boolean } | null;
  currentFeedbackSprite: string | null;
  currentData: { data?: { map?: { id: number } } } | null;
}

interface TeacherAnimationTimers {
  mouthInterval: number | null;
  outroTimeouts: number[];
}

/**
 * Teacher animation utilities
 * Pure extraction from main.ts teacher animation methods
 */

/**
 * Clear teacher animation timers
 * @param timers - Timer references to clear
 */
export function clearTeacherAnimationTimers(timers: TeacherAnimationTimers): void {
  if (timers.mouthInterval) {
    clearInterval(timers.mouthInterval);
    timers.mouthInterval = null;
  }
  timers.outroTimeouts.forEach((t) => clearTimeout(t));
  timers.outroTimeouts = [];
}

/**
 * Update teacher speaking UI based on state
 * @param state - Current teacher animation state
 * @param timers - Timer references for animation
 * @returns Updated timer references
 */
export function updateTeacherSpeakingUI(
  state: TeacherAnimationState,
  timers: TeacherAnimationTimers
): TeacherAnimationTimers {
  const readBtn = document.getElementById('readQuestionBtn');
  const readIcon = document.getElementById('readQuestionIcon');
  const readText = document.getElementById('readQuestionText');
  
  if (readIcon && readText && readBtn) {
    if (state.isSpeaking) {
      readIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>';
      readText.textContent = 'STOP';
      readBtn.style.background = '#DC2626';
      readBtn.style.borderColor = '#EF4444';
    } else {
      readIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';
      readText.textContent = 'REPLAY';
      readBtn.style.background = '#0284C7';
      readBtn.style.borderColor = '#0369A1';
    }
  }

  const badgeDot = document.getElementById('teacherBadgeDot');
  if (badgeDot) {
    badgeDot.classList.toggle('active-pulse', state.isSpeaking);
  }

  const spriteImg = document.getElementById('teacherCharacterSprite') as HTMLImageElement | null;
  if (!spriteImg) return timers;

  const activeMapId = state.currentData?.data?.map?.id || 1;
  const isYellow = activeMapId === 3;
  const isGevina = activeMapId === 2;

  clearTeacherAnimationTimers(timers);

  if (state.isSpeaking && !state.submitting) {
    return startSpeakingAnimation(spriteImg, isYellow, isGevina, state.wrongAnswerIds, timers);
  } else {
    return setIdleAnimation(spriteImg, isYellow, isGevina, state, timers);
  }
}

/**
 * Start speaking animation for teacher
 */
function startSpeakingAnimation(
  spriteImg: HTMLImageElement,
  isYellow: boolean,
  isGevina: boolean,
  wrongAnswerIds: number[],
  timers: TeacherAnimationTimers
): TeacherAnimationTimers {
  spriteImg.className = 'teacher-character-img reading';
  
  if (isYellow) {
    spriteImg.src = `/assets/guide/teacher_yellow_pose1.png`;
  } else if (isGevina) {
    // Kingdom 2: Teacher Gevina (G1 to G9)
    const isReplaying = wrongAnswerIds.length > 0;
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

    timers = runAnimationLoop(spriteImg, introFrames, loopFrames, isReplaying, timers);
  } else {
    // Kingdom 1: Teacher Faith (F1 to F9)
    const isReplaying = wrongAnswerIds.length > 0;
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

    timers = runAnimationLoop(spriteImg, introFrames, loopFrames, isReplaying, timers);
  }

  return timers;
}

/**
 * Run animation loop for teacher speaking
 */
function runAnimationLoop(
  spriteImg: HTMLImageElement,
  introFrames: string[],
  loopFrames: string[],
  isReplaying: boolean,
  timers: TeacherAnimationTimers
): TeacherAnimationTimers {
  let introIndex = 0;
  let loopIndex = 0;
  let isIntroFinished = isReplaying;

  spriteImg.src = isReplaying ? loopFrames[0] : introFrames[0];

  timers.mouthInterval = window.setInterval(() => {
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

  return timers;
}

/**
 * Set idle animation for teacher
 */
function setIdleAnimation(
  spriteImg: HTMLImageElement,
  isYellow: boolean,
  isGevina: boolean,
  state: TeacherAnimationState,
  timers: TeacherAnimationTimers
): TeacherAnimationTimers {
  if (state.submitResult?.is_correct) {
    spriteImg.src = isYellow
      ? (state.currentFeedbackSprite || `/assets/guide/teacher_yellow_happy.png`)
      : isGevina
      ? (state.currentFeedbackSprite || `/assets/guide/teacher_gevina_correct_1.png`)
      : (state.currentFeedbackSprite || `/assets/guide/teacher_blue_correct_1.png`);
    spriteImg.className = 'teacher-character-img celebrating';
  } else if (state.wrongAnswerIds.length > 0 && state.currentFeedbackSprite) {
    // Maintain sympathetic/try-again pose - DO NOT overwrite with idle timers!
    spriteImg.src = state.currentFeedbackSprite;
    spriteImg.className = 'teacher-character-img sympathetic';
  } else {
    spriteImg.className = 'teacher-character-img idle';
    if (isYellow) {
      spriteImg.src = `/assets/guide/teacher_yellow_pose1.png`;
    } else if (isGevina) {
      // Smooth settle to closed mouth rest stance
      spriteImg.src = '/assets/guide/G3.png';
      const t = window.setTimeout(() => {
        if (!soundManager.isNarrating() && !state.submitResult && state.wrongAnswerIds.length === 0) {
          spriteImg.src = '/assets/guide/G1.png';
        }
      }, 400);
      timers.outroTimeouts.push(t);
    } else {
      // Kingdom 1: Teacher Faith
      spriteImg.src = '/assets/guide/F3.png';
      const t = window.setTimeout(() => {
        if (!soundManager.isNarrating() && !state.submitResult && state.wrongAnswerIds.length === 0) {
          spriteImg.src = '/assets/guide/F1.png';
        }
      }, 400);
      timers.outroTimeouts.push(t);
    }
  }

  return timers;
}
