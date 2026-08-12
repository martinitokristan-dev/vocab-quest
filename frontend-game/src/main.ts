import './style.css';
import { gameApi, type CurrentQuestionResponse, type SubmitAnswerResponse } from './api';
import { Game2DMapRenderer } from './game2d';

interface StudentGameAppState {
  screen: 'join' | 'world_map' | 'question' | 'completed';
  pin: string;
  playerName: string;
  avatarSlug: string;
  currentData: CurrentQuestionResponse | null;
  selectedAnswerId: number | null;
  submitResult: SubmitAnswerResponse | null;
  submitting: boolean;
  score: number;
  error: string | null;
  history: Array<{ questionId: number; word: string; isCorrect: boolean }>;
}

const AVATARS = [
  { slug: 'knight', label: 'Knight', icon: '⚔️' },
  { slug: 'wizard', label: 'Wizard', icon: '🔮' },
  { slug: 'ranger', label: 'Ranger', icon: '🏹' },
  { slug: 'cyber-ninja', label: 'Cyber Ninja', icon: '🥷' },
];

class StudentArcadeGame {
  private appEl: HTMLElement;
  private bgLayerEl: HTMLImageElement;
  private mapRenderer: Game2DMapRenderer | null = null;

  private state: StudentGameAppState = {
    screen: 'join',
    pin: '',
    playerName: '',
    avatarSlug: 'knight',
    currentData: null,
    selectedAnswerId: null,
    submitResult: null,
    submitting: false,
    score: 0,
    error: null,
    history: [],
  };

  private pollInterval: number | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.appEl = document.getElementById('app') as HTMLElement;
    this.bgLayerEl = document.createElement('img');
    this.bgLayerEl.className = 'game-bg-layer';
    this.bgLayerEl.style.display = 'none';
    document.body.prepend(this.bgLayerEl);

    this.render();
  }

  private setState(partialState: Partial<StudentGameAppState>) {
    const prevScreen = this.state.screen;
    this.state = { ...this.state, ...partialState };
    if (prevScreen !== this.state.screen || this.state.screen !== 'world_map') {
      this.render();
    }
  }

  private playAudio(url: string) {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    this.currentAudio = new Audio(url);
    this.currentAudio.play().catch((err) => console.log('Audio autoplay prevented:', err));
  }

  private startPollingQuestion() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    const checkQuestion = async () => {
      try {
        const res = await gameApi.getCurrentQuestion();

        if (res.is_completed) {
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.setState({ screen: 'completed', score: res.total_correct || this.state.score });
          return;
        }

        if (res.data) {
          const isNewQuestion = !this.state.currentData?.data || this.state.currentData.data.question.id !== res.data.question.id;
          const nextScreen = this.state.screen === 'join' ? 'world_map' : this.state.screen;

          this.setState({
            screen: nextScreen,
            currentData: res,
            score: res.data.session.score,
            selectedAnswerId: isNewQuestion ? null : this.state.selectedAnswerId,
            submitResult: isNewQuestion ? null : this.state.submitResult,
          });

          if (this.state.screen === 'question' && isNewQuestion && res.data.question.audio_url) {
            this.playAudio(res.data.question.audio_url);
          }
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
      this.setState({ error: null, submitting: true });
      await gameApi.joinRoom(this.state.pin, this.state.playerName, this.state.avatarSlug);
      this.setState({ submitting: false });
      this.startPollingQuestion();
    } catch (err: any) {
      this.setState({ error: err.message || 'Failed to join game room', submitting: false });
    }
  }

  private async handleSelectAnswer(answerId: number) {
    if (this.state.submitting || this.state.submitResult || !this.state.currentData?.data) return;

    try {
      this.setState({ selectedAnswerId: answerId, submitting: true });
      const q = this.state.currentData.data.question;
      const res = await gameApi.submitAnswer(q.id, answerId);

      const updatedHistory = [
        ...this.state.history.filter((h) => h.questionId !== q.id),
        { questionId: q.id, word: q.highlighted_word, isCorrect: res.is_correct },
      ];

      this.setState({
        submitResult: res,
        score: res.score,
        submitting: false,
        history: updatedHistory,
      });

      // Advance to next question automatically after 1.8 seconds
      setTimeout(() => {
        this.startPollingQuestion();
      }, 1800);
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
  }

  private renderJoinScreen() {
    this.appEl.innerHTML = `
      <div class="arcade-card animate-fade-in">
        <h1 class="arcade-title">EPCES Vocabulary Arcade</h1>
        <p class="arcade-subtitle">Enter your 6-digit Room PIN to start student gameplay</p>

        ${this.state.error ? `<div style="background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #FB7185; padding: 10px; border-radius: 10px; font-size: 13px; margin-top: 16px; text-align: center;">${this.state.error}</div>` : ''}

        <form id="joinForm" style="margin-top: 20px; display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #A1A1AA; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              6-Digit Room PIN
            </label>
            <input
              type="text"
              id="pinInput"
              required
              maxlength="6"
              placeholder="e.g. 123456"
              value="${this.state.pin}"
              class="arcade-input"
              style="font-family: monospace; font-size: 20px; letter-spacing: 4px; text-align: center;"
            />
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #A1A1AA; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Player Name
            </label>
            <input
              type="text"
              id="nameInput"
              required
              placeholder="Enter your name (e.g. Kristan)"
              value="${this.state.playerName}"
              class="arcade-input"
            />
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #A1A1AA; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Choose Your Game Avatar
            </label>
            <div class="avatar-grid">
              ${AVATARS.map((av) => `
                <div class="avatar-card ${this.state.avatarSlug === av.slug ? 'selected' : ''}" data-avatar="${av.slug}">
                  <span class="avatar-icon">${av.icon}</span>
                  <span class="avatar-label">${av.label}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <button type="submit" ${this.state.submitting ? 'disabled' : ''} class="btn-arcade" style="margin-top: 10px;">
            ${this.state.submitting ? 'Connecting...' : '🚀 Join & Play Arcade Game'}
          </button>
        </form>
      </div>
    `;

    // Event Listeners
    const form = document.getElementById('joinForm');
    const pinInput = document.getElementById('pinInput') as HTMLInputElement;
    const nameInput = document.getElementById('nameInput') as HTMLInputElement;

    pinInput?.addEventListener('input', (e) => {
      this.state.pin = (e.target as HTMLInputElement).value;
    });

    nameInput?.addEventListener('input', (e) => {
      this.state.playerName = (e.target as HTMLInputElement).value;
    });

    document.querySelectorAll('.avatar-card').forEach((card) => {
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-avatar');
        if (slug) this.setState({ avatarSlug: slug });
      });
    });

    form?.addEventListener('submit', (e) => this.handleJoin(e));
  }

  private renderWorldMapScreen() {
    const avatar = AVATARS.find((a) => a.slug === this.state.avatarSlug) || AVATARS[0];
    const activeMapId = this.state.currentData?.data?.map.order_index || 1;
    const currentQuestionIndex = this.state.currentData?.data?.question.id || 1;

    this.appEl.innerHTML = `
      <!-- Floating Sky Top HUD Bar -->
      <div class="world-map-hud animate-fade-in" style="background: rgba(255, 255, 255, 0.85); border-color: rgba(0, 0, 0, 0.15);">
        <div>
          <span class="hud-subtitle" style="color: #0284C7;">Floating Sky Overcooked / Candy Crush Map</span>
          <h2 class="hud-title" style="color: #0F172A;">2D Floating World Map</h2>
        </div>

        <div class="hud-player-chip" style="background: #FFFFFF; border-color: #CBD5E1;">
          <span style="font-size: 24px;">${avatar.icon}</span>
          <div>
            <span style="display: block; font-size: 13px; font-weight: 700; color: #0F172A;">${this.state.playerName}</span>
            <span style="font-size: 11px; color: #0284C7; font-weight: 700;">Score: ${this.state.score} pts ⭐</span>
          </div>
        </div>
      </div>

      <!-- Fullscreen 2D Canvas Engine Container -->
      <div id="canvasContainer" style="width: 100vw; height: 100vh;"></div>
    `;

    // Instantiate 2D Floating Sky Engine
    const container = document.getElementById('canvasContainer');
    if (container) {
      const customMaps = this.state.currentData?.data?.map ? [
        {
          id: this.state.currentData.data.map.id,
          title: this.state.currentData.data.map.title,
        }
      ] : undefined;

      this.mapRenderer = new Game2DMapRenderer(container, avatar.icon, activeMapId, currentQuestionIndex, customMaps);
      this.mapRenderer.onStepClick(() => {
        this.setState({ screen: 'question' });
        if (this.state.currentData?.data?.question.audio_url) {
          this.playAudio(this.state.currentData.data.question.audio_url);
        }
      });
    }
  }

  private renderQuestionScreen() {
    if (!this.state.currentData?.data) return;

    const data = this.state.currentData.data;
    const q = data.question;
    const result = this.state.submitResult;
    const selectedId = this.state.selectedAnswerId;
    const avatar = AVATARS.find((a) => a.slug === this.state.avatarSlug) || AVATARS[0];

    // Show Uploaded Map Background Image in full screen behind gameplay
    const bgUrl = data.map.id === 1 ? '/storage/questions/epces-bg.jpg' : '/storage/questions/prince-bg.jpg';
    this.bgLayerEl.src = bgUrl;
    this.bgLayerEl.style.display = 'block';

    // Highlight target word in sentence
    const regex = new RegExp(`(${q.highlighted_word})`, 'gi');
    const formattedSentence = q.sentence.replace(regex, '<span class="highlighted-word">$1</span>');

    // Mascot Emotional Reaction State
    let mascotEmoji = avatar.icon;
    let mascotSpeech = `Help me solve the word "${q.highlighted_word}"!`;
    let mascotClass = '';

    if (result) {
      if (result.is_correct) {
        mascotEmoji = '🌟';
        mascotSpeech = `🎉 Brilliant! Correct answer! (+1 pt)`;
        mascotClass = 'happy';
      } else {
        mascotEmoji = '🥺';
        mascotSpeech = `Oops! That's wrong. Learn: "${q.highlighted_word}"!`;
        mascotClass = 'wrong';
      }
    }

    this.appEl.innerHTML = `
      <!-- Dual-Column Layout: Left (Question & Options) + Right (Mascot & Scoreboard) -->
      <div class="gameplay-container animate-fade-in">

        <!-- Left Column: Main Question Screen -->
        <div class="main-question-card">
          <!-- Header Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; color: #A1A1AA; text-transform: uppercase;">
                ${data.map.title} • Map ${data.map.order_index}
              </span>
              <h3 style="font-size: 16px; font-weight: 700; color: #FAFAFA;">
                Target Word: <span style="color: #34D399;">${q.highlighted_word}</span>
              </h3>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
              ${q.audio_url ? `
                <button id="playAudioBtn" class="btn-audio">
                  🔊 Listen Audio
                </button>
              ` : ''}

              <button id="worldMapNavBtn" class="btn-audio" style="background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #34D399;">
                🗺️ 2D World Map
              </button>
            </div>
          </div>

          <!-- Question Image (If Present) -->
          ${q.image_url ? `
            <div style="margin-bottom: 16px; border-radius: 14px; overflow: hidden; max-height: 200px; border: 1px solid rgba(255,255,255,0.1);">
              <img src="${q.image_url}" alt="Question hint" style="width: 100%; height: 200px; object-fit: cover;" />
            </div>
          ` : ''}

          <!-- Sentence Box -->
          <div class="sentence-box">
            "${formattedSentence}"
          </div>

          <!-- Answer Options Grid -->
          <div class="answers-grid">
            ${q.answers.map((ans, idx) => {
              const letter = String.fromCharCode(65 + idx);
              let stateClass = '';

              if (result) {
                if (ans.id === selectedId) {
                  stateClass = result.is_correct ? 'correct' : 'wrong';
                }
              }

              return `
                <div class="answer-card ${stateClass}" data-answer-id="${ans.id}">
                  <div class="answer-badge">${letter}</div>
                  <span>${ans.text}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right Column: Mascot Character & Live Scoreboard Docked on Right Side -->
        <div class="sidebar-mascot-card">
          <!-- 2D Character Mascot Docked on Right -->
          <div class="mascot-avatar-box">
            <span class="mascot-emoji ${mascotClass}">${mascotEmoji}</span>
            <div class="mascot-name">${this.state.playerName} (${avatar.label})</div>
            <div class="mascot-speech-bubble ${result && !result.is_correct ? 'wrong' : ''}">
              ${mascotSpeech}
            </div>
          </div>

          <!-- Score Card & Question Tracker -->
          <div style="width: 100%; background: #09090B; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 18px; text-align: center;">
            <span style="font-size: 10px; font-weight: 700; color: #34D399; text-transform: uppercase; letter-spacing: 0.5px;">Current Score</span>
            <h2 style="font-family: var(--font-heading); font-size: 32px; font-weight: 900; color: #10B981; margin-top: 2px;">
              ${this.state.score} pts ⭐
            </h2>

            <!-- Question Score Tracker Breakdown -->
            <div style="margin-top: 14px; text-align: left; border-t: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
              <span style="font-size: 10px; font-weight: 700; color: #A1A1AA; text-transform: uppercase;">
                ${data.map.title} Progress:
              </span>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                ${this.state.history.map((h, i) => `
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: ${h.isCorrect ? '#34D399' : '#FB7185'};">
                    <span>Q${i + 1}: ${h.word}</span>
                    <span>${h.isCorrect ? '✓ (+1 pt)' : '✕'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    // Event Listeners
    document.getElementById('playAudioBtn')?.addEventListener('click', () => {
      if (q.audio_url) this.playAudio(q.audio_url);
    });

    document.getElementById('worldMapNavBtn')?.addEventListener('click', () => {
      this.setState({ screen: 'world_map' });
    });

    document.querySelectorAll('.answer-card').forEach((card) => {
      card.addEventListener('click', () => {
        const answerId = Number(card.getAttribute('data-answer-id'));
        if (answerId) this.handleSelectAnswer(answerId);
      });
    });
  }

  private renderCompletedScreen() {
    this.appEl.innerHTML = `
      <div class="arcade-card text-center animate-fade-in" style="padding: 40px 28px; max-width: 580px; margin: 0 auto;">
        <div style="font-size: 56px; margin-bottom: 12px;">🏆</div>
        <h2 style="font-family: var(--font-heading); font-size: 28px; font-weight: 800; color: #FAFAFA;">
          Game Session Completed!
        </h2>
        <p style="font-size: 14px; color: #A1A1AA; margin-top: 6px;">
          Congratulations, <strong>${this.state.playerName}</strong>! You conquered all 3 Kingdoms across the 2D Overcooked / Candy Crush Floating Sky Map.
        </p>

        <div style="margin: 28px 0; background: #09090B; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 20px;">
          <span style="font-size: 11px; font-weight: 700; color: #A1A1AA; text-transform: uppercase;">Final Total Score</span>
          <h1 style="font-family: var(--font-heading); font-size: 44px; font-weight: 900; color: #10B981; margin-top: 4px;">
            ${this.state.score} pts ⭐
          </h1>
        </div>

        <button id="restartBtn" class="btn-arcade">
          🔄 Play Again / Join Another Room
        </button>
      </div>
    `;

    document.getElementById('restartBtn')?.addEventListener('click', () => {
      gameApi.clearToken();
      window.location.reload();
    });
  }
}

new StudentArcadeGame();
