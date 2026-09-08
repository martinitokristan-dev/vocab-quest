import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

function getVoiceoverUrl(q: any): string | null {
  return q?.voice_audio_url || q?.voice_video_url || q?.audio_url || null;
}

interface QuestionScreenProps {
  playerName: string;
  avatarSlug: string;
  avatarImage: string;
  totalStars: number;
  question: any;
  isReview: boolean;
  viewingHistoryItem: any;
  submitResult: any;
  selectedAnswerId: number | null;
  wrongAnswerIds: number[];
  submitting: boolean;
  customMascotSpeech: string | null;
  currentFeedbackSprite: string | null;
  lastNarratedQuestionId: number | null;
  onAvatarClick: () => void;
  onPauseClick: () => void;
  onWorldMapClick: () => void;
  onReplayClick: () => void;
  onAnswerSelect: (answerId: number | null, typedAnswer?: string) => void;
  onTeacherAnimationClear: () => void;
  onQuestionNarrated: (questionId: number) => void;
}

/**
 * QuestionScreen component - Renders the question gameplay screen with teacher guide
 * Pure extraction from main.ts renderQuestionScreen method
 */
export class QuestionScreen {
  private container: HTMLElement;
  private props: QuestionScreenProps;
  private updateReadButton: (isSpeaking: boolean) => void = () => {};
  private narrationTimeout: number | null = null;

  constructor(container: HTMLElement, props: QuestionScreenProps) {
    this.container = container;
    this.props = props;
  }

  /**
   * Render the question screen
   */
  render(): void {
    const { question, isReview, viewingHistoryItem, submitResult, selectedAnswerId, wrongAnswerIds, submitting, customMascotSpeech, currentFeedbackSprite } = this.props;
    const historySelectedId = viewingHistoryItem?.selectedAnswerId;

    if (!question) {
      this.container.innerHTML = `
        <div class="candy-loading-card animate-fade-in" style="margin: 60px auto; max-width: 480px; text-align: center;">
          <div class="candy-spinner"></div>
          <p style="margin-top: 16px; font-weight: 700; color: #F59E0B;">LOADING QUESTION DATA...</p>
          <button id="retryQuestionBtn" class="vocab-hud-btn" style="margin-top: 16px;">RETURN TO MAP</button>
        </div>
      `;
      document.getElementById('retryQuestionBtn')?.addEventListener('click', () => {
        this.props.onWorldMapClick();
      });
      return;
    }

    const isIdentification = (question.question_type === 'identification') || (!question.answers || question.answers.length === 0);
    const activeMapId = question.map?.id || 1;
    const isYellow = activeMapId === 3;
    const isGevina = activeMapId === 2;
    const teacherName = isYellow ? 'Teacher Yanna' : isGevina ? 'Teacher Gevina' : 'Teacher Faith';

    const currentWord = question.highlighted_word;
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let formattedSentence = question.sentence;

    // In Kingdom 2, format underlined context clue
    if (isGevina && question.context_clue) {
      const clueText = question.context_clue.trim();
      const clueRegex = new RegExp(`(${escapeRegExp(clueText)})`, 'gi');
      formattedSentence = formattedSentence.replace(
        clueRegex,
        `<span class="underlined-clue">$1</span>`
      );
    } else if (isGevina && /<u>(.*?)<\/u>/i.test(formattedSentence)) {
      formattedSentence = formattedSentence.replace(/<u>(.*?)<\/u>/gi, `<span class="underlined-clue">$1</span>`);
    }

    // Format yellow highlighted target word
    if (currentWord) {
      const wordRegex = new RegExp(`(${escapeRegExp(currentWord)})`, 'gi');
      formattedSentence = formattedSentence.replace(
        wordRegex,
        `<span class="highlighted-word">$1</span>`
      );
    }

    const studentName = this.props.playerName?.trim() || 'Hero Student';
    const hasVoiceover = Boolean(getVoiceoverUrl(question));
    const willAutoNarrate = !isReview && !submitResult && this.props.lastNarratedQuestionId !== question.id && hasVoiceover;

    let teacherSpeech = '';
    if (isReview) {
      teacherSpeech = `Great job! You mastered this question challenge!`;
    } else if (submitResult) {
      teacherSpeech = customMascotSpeech || (submitResult.is_correct
        ? 'Great job! Moving to the next challenge!'
        : 'Oops! Give it another try!');
    } else if (wrongAnswerIds.length > 0) {
      teacherSpeech = customMascotSpeech || 'Oops! Give it another try!';
    } else if (willAutoNarrate || soundManager.isNarrating()) {
      teacherSpeech = `Listen carefully, ${studentName}...`;
    } else {
      teacherSpeech = `Take your time, ${studentName}! Choose wisely.`;
    }

    const baseIdleSprite = isYellow 
      ? `/assets/guide/teacher_yellow_pose1.png` 
      : isGevina 
      ? `/assets/guide/G1.png` 
      : `/assets/guide/F1.png`;

    let initialTeacherSprite = baseIdleSprite;
    let initialTeacherAnimClass = 'idle';

    if (submitResult?.is_correct) {
      initialTeacherSprite = isYellow
        ? (currentFeedbackSprite || `/assets/guide/teacher_yellow_happy.png`)
        : isGevina
        ? (currentFeedbackSprite || `/assets/guide/teacher_gevina_correct_1.png`)
        : (currentFeedbackSprite || `/assets/guide/teacher_blue_correct_1.png`);
      initialTeacherAnimClass = 'celebrating';
    } else if (wrongAnswerIds.length > 0 && !submitResult && !submitting) {
      initialTeacherSprite = isYellow
        ? (currentFeedbackSprite || `/assets/guide/teacher_yellow_sad.png`)
        : isGevina
        ? (currentFeedbackSprite || `/assets/guide/teacher_gevina_incorrect_1.png`)
        : (currentFeedbackSprite || `/assets/guide/teacher_blue_incorrect_1.png`);
      initialTeacherAnimClass = 'sympathetic';
    } else if (soundManager.isNarrating()) {
      initialTeacherSprite = baseIdleSprite;
      initialTeacherAnimClass = 'reading';
    } else {
      initialTeacherSprite = baseIdleSprite;
      initialTeacherAnimClass = 'idle';
    }

    this.container.innerHTML = `
      <!-- Top-Left Player Profile & Star HUD (Fixed Top Left) -->
      <div class="candy-hud-top-left animate-fade-in">
        <div class="candy-player-card candy-hud-interactive" id="questionAvatarBox" title="Tap to hear character voice">
          <div class="candy-avatar-circle">
            <img src="${this.props.avatarImage || '/assets/mascot_girl.png'}" class="candy-avatar-img" />
          </div>
          <div class="candy-player-info">
            <div class="candy-player-name">${this.props.playerName || 'Hero Student'}</div>
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
              <span class="candy-star-count-num">${this.props.totalStars}</span>
              <span class="candy-star-count-label">STARS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top-Right Controls HUD (Fixed Top Right) -->
      <div class="candy-hud-top-right animate-fade-in">
        <button id="worldMapNavBtn" class="candy-zone-pill candy-hud-interactive" title="Back to 2D Map">
          <span>${Icons.map(16)}</span>
          <span>2D MAP</span>
        </button>
        <button id="questionPauseBtn" class="candy-menu-btn candy-hud-interactive" title="Pause Game Menu">
          <span>${Icons.pause(16)}</span>
          <span>MENU</span>
        </button>
      </div>

      <div class="question-scene-container animate-fade-in">
        <!-- Dual Stage Layout: Centered Question Arena + Right Teacher Stage -->
        <div class="question-stage-layout">
          <!-- Centered Main Question Arena -->
          <div class="question-arena-card ${isGevina || !question.image_url ? 'no-image-arena' : ''}">
            ${isReview ? `
              <div style="margin-bottom: 12px; padding: 8px 16px; background: rgba(245, 158, 11, 0.15); border: 1.5px solid #F59E0B; border-radius: 14px; font-size: 14.5px; font-weight: 700; color: #FDE047; display: flex; align-items: center; justify-content: space-between;">
                <span>⭐ COMPLETED QUESTION REVIEW (READ-ONLY)</span>
                <span>${viewingHistoryItem?.stars || 3} STARS EARNED</span>
              </div>
            ` : ''}

            <!-- Mobile Teacher Mascot Strip (visible on mobile <= 860px) -->
            <div class="mobile-teacher-strip" id="mobileTeacherStrip">
              <div class="mobile-teacher-avatar-box">
                <img
                  id="mobileTeacherAvatar"
                  src="${initialTeacherSprite}"
                  alt="${teacherName}"
                  class="mobile-teacher-avatar-img ${initialTeacherAnimClass}"
                />
              </div>
              <div class="mobile-teacher-bubble ${submitResult?.is_correct ? 'bubble-correct' : wrongAnswerIds.length > 0 ? 'bubble-wrong' : ''}">
                <div class="mobile-teacher-author">${teacherName}</div>
                <div class="mobile-teacher-speech-text" id="mobileTeacherSpeech">"${teacherSpeech}"</div>
              </div>
            </div>

            <div class="question-arena-header">
              <button id="readQuestionBtn" class="hud-btn question-replay-btn" title="Replay voice narration">
                <span id="readQuestionIcon">${Icons.rotateCcw(18)}</span>
                <span id="readQuestionText">REPLAY</span>
              </button>
            </div>



            <!-- Centered Question Visual Clue Image (Hidden in Kingdom 2) -->
            ${(!isGevina && question.image_url) ? `
              <div class="question-visual-clue-card">
                <img src="${question.image_url}" alt="Question visual clue" class="question-visual-clue-img" />
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
                    class="identification-text-input ${wrongAnswerIds.length > 0 ? 'animate-shake wrong' : ''}"
                    placeholder="Type word here..."
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    ${isReview ? 'disabled' : ''}
                    value="${isReview ? (viewingHistoryItem?.typedAnswer || viewingHistoryItem?.word || '') : ''}"
                  />
                  ${!isReview ? `
                    <button id="identificationSubmitBtn" class="identification-submit-btn">
                      <span>SUBMIT</span>
                    </button>
                  ` : ''}
                </div>
                ${isReview ? `
                  <div class="identification-review-footer">
                    <span style="color: #4ADE80; font-weight: 700;">Target Word: ${question.highlighted_word}</span>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="answers-grid" ${isReview ? 'style="pointer-events: none;"' : ''}>
                ${(question.answers || []).map((ans: any, idx: number) => {
                  const letter = String.fromCharCode(65 + idx);
                  let stateClass = '';
                  if (isReview) {
                    if (ans.id === historySelectedId) {
                      stateClass = viewingHistoryItem?.isCorrect ? 'correct' : 'wrong';
                    }
                  } else if (submitResult && ans.id === selectedAnswerId) {
                    stateClass = submitResult.is_correct ? 'correct' : 'wrong';
                  } else if (wrongAnswerIds.includes(ans.id)) {
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
            <div
              class="teacher-speech-bubble ${submitResult?.is_correct ? 'bubble-correct' : wrongAnswerIds.length > 0 ? 'bubble-wrong' : ''}"
            >
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

    this.attachEventListeners(question, isReview, isIdentification, submitResult, wrongAnswerIds, submitting);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(question: any, isReview: boolean, isIdentification: boolean, submitResult: any, wrongAnswerIds: number[], submitting: boolean): void {
    document.getElementById('questionAvatarBox')?.addEventListener('click', () => {
      soundManager.playClick();
      if (this.props.avatarSlug) {
        soundManager.speakCharacterVoice(this.props.avatarSlug);
      }
    });

    document.getElementById('questionPauseBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.props.onPauseClick();
    });

    document.getElementById('worldMapNavBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.props.onWorldMapClick();
    });

    const readBtn = document.getElementById('readQuestionBtn');
    const readIcon = document.getElementById('readQuestionIcon');
    const readText = document.getElementById('readQuestionText');

    this.updateReadButton = (isSpeaking: boolean) => {
      const studentName = this.props.playerName?.trim() || 'Hero Student';
      const desktopBubble = document.querySelector('.teacher-speech-text');
      const mobileBubble = document.getElementById('mobileTeacherSpeech');

      if (readIcon && readText && readBtn) {
        if (isSpeaking) {
          readIcon.innerHTML = Icons.stop(18);
          readText.textContent = 'STOP';
          readBtn.style.background = '#DC2626';
          readBtn.style.borderColor = '#EF4444';

          const listenText = `"Listen carefully, ${studentName}..."`;
          if (desktopBubble) desktopBubble.textContent = listenText;
          if (mobileBubble) mobileBubble.textContent = listenText;
        } else {
          readIcon.innerHTML = Icons.rotateCcw(18);
          readText.textContent = 'REPLAY';
          readBtn.style.background = '#059669';
          readBtn.style.borderColor = '#047857';

          let currentSpeech = `Take your time, ${studentName}! Choose wisely.`;
          if (isReview) {
            currentSpeech = 'Great job! You mastered this question challenge!';
          } else if (submitResult) {
            currentSpeech = this.props.customMascotSpeech || (submitResult.is_correct
              ? 'Great job! Moving to the next challenge!'
              : 'Oops! Give it another try!');
          } else if (wrongAnswerIds.length > 0) {
            currentSpeech = this.props.customMascotSpeech || 'Oops! Give it another try!';
          }

          const idleText = `"${currentSpeech}"`;
          if (desktopBubble) desktopBubble.textContent = idleText;
          if (mobileBubble) mobileBubble.textContent = idleText;
        }
      }
    };

    readBtn?.addEventListener('click', () => {
      soundManager.playClick();
      if (soundManager.isNarrating()) {
        soundManager.stopSpeech();
        this.updateReadButton(false);
      } else {
        const voiceUrl = getVoiceoverUrl(question);
        if (voiceUrl) {
          soundManager.playCustomVoiceRecording(
            voiceUrl,
            () => this.updateReadButton(true),
            () => this.updateReadButton(false)
          );
        } else {
          soundManager.playSuccess();
        }
      }
    });

    if (isIdentification && !isReview) {
      const inputEl = document.getElementById('identificationTextInput') as HTMLInputElement | null;
      const submitBtn = document.getElementById('identificationSubmitBtn');

      if (inputEl && submitBtn) {
        const submitTyped = () => {
          if (!inputEl) return;
          const textVal = inputEl.value.trim();
          soundManager.stopSpeech();
          this.props.onAnswerSelect(null, textVal);
        };

        submitBtn.addEventListener('click', () => {
          soundManager.playClick();
          submitTyped();
        });

        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            soundManager.playClick();
            submitTyped();
          }
        });

        setTimeout(() => {
          inputEl.focus();
        }, 100);
      }
    } else if (!isReview) {
      document.querySelectorAll('.answer-card').forEach((card) => {
        const answerId = Number(card.getAttribute('data-answer-id'));

        card.addEventListener('pointerdown', () => {
          if (answerId && !submitting && !submitResult && !wrongAnswerIds.includes(answerId)) {
            card.classList.add('selected-active');
            if (this.narrationTimeout) {
              clearTimeout(this.narrationTimeout);
              this.narrationTimeout = null;
            }
            soundManager.stopSpeech();
            this.props.onTeacherAnimationClear();
            soundManager.playClick();
          }
        });

        card.addEventListener('click', () => {
          if (answerId && !submitting && !submitResult && !wrongAnswerIds.includes(answerId)) {
            card.classList.add('selected-active');
            if (this.narrationTimeout) {
              clearTimeout(this.narrationTimeout);
              this.narrationTimeout = null;
            }
            soundManager.stopSpeech();
            this.props.onTeacherAnimationClear();
            this.props.onAnswerSelect(answerId);
          }
        });
      });
    }

    // Auto-play teacher's recorded voiceover on entering active question with a 1.0s preparation delay
    if (!isReview && !submitResult && this.props.lastNarratedQuestionId !== question.id) {
      this.props.onQuestionNarrated(question.id);
      if (this.narrationTimeout) {
        clearTimeout(this.narrationTimeout);
      }
      this.narrationTimeout = window.setTimeout(() => {
        this.narrationTimeout = null;
        const voiceUrl = getVoiceoverUrl(question);
        if (voiceUrl) {
          soundManager.playCustomVoiceRecording(
            voiceUrl,
            () => this.updateReadButton(true),
            () => this.updateReadButton(false)
          );
        }
      }, 1000);
    }
  }

  /**
   * Update props and re-render
   */
  updateProps(newProps: Partial<QuestionScreenProps>): void {
    this.props = { ...this.props, ...newProps };
    this.render();
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    if (this.narrationTimeout) {
      clearTimeout(this.narrationTimeout);
      this.narrationTimeout = null;
    }
  }
}
