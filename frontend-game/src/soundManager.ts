// Audio & Sound Effects Manager using Web Audio API + localStorage Persistence + Web Speech API (TTS)

export interface AudioSettings {
  masterVolume: number; // 0 to 1
  bgmVolume: number;    // 0 to 1
  sfxVolume: number;    // 0 to 1
  muted: boolean;
}

const STORAGE_KEY = 'vocab_game_audio_settings';

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = {
    masterVolume: 0.8,
    bgmVolume: 0.7,
    sfxVolume: 0.9,
    muted: false,
  };

  private currentVoiceAudio: HTMLAudioElement | null = null;
  private bgmGain: GainNode | null = null;
  private isSpeechActive = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private lastQuestionNarrationParams: {
    sentence: string;
    targetWord: string;
    choices: Array<{ letter: string; text: string }>;
    onStart?: () => void;
    onEnd?: () => void;
  } | null = null;

  constructor() {
    this.loadSettings();

    // Pre-populate speech synthesis voices if supported
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    // Auto-resume AudioContext on first user interaction
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load audio settings:', e);
    }
  }

  public saveSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save audio settings:', e);
    }

    if (this.bgmGain && this.ctx) {
      const vol = this.getEffectiveBgmVolume();
      this.bgmGain.gain.setValueAtTime(vol * 0.15, this.ctx.currentTime);
    }

    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.volume = this.getEffectiveSfxVolume();
      this.currentVoiceAudio.muted = this.settings.muted;
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public getEffectiveSfxVolume(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.sfxVolume));
  }

  public getEffectiveBgmVolume(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.bgmVolume));
  }

  public isNarrating(): boolean {
    return this.isSpeechActive;
  }

  // --- Sound Effects using Web Audio API ---

  // 1. Chunky Block Button Click
  public playClick() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(vol * 0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      // Audio context error fallback
    }
  }

  // 2. Button Hover Pop / Chime (Crisp Minecraft UI Feedback)
  public playHover() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(vol * 0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {}
  }

  // 3. Success / Correct Answer Chime (Major Triad)
  public playSuccess() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + index * 0.09);

        gain.gain.setValueAtTime(0.001, this.ctx.currentTime + index * 0.09);
        gain.gain.linearRampToValueAtTime(vol * 0.35, this.ctx.currentTime + index * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + index * 0.09 + 0.32);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + index * 0.09);
        osc.stop(this.ctx.currentTime + index * 0.09 + 0.32);
      });
    } catch (e) {}
  }

  // 4. Wrong Answer Buzz
  public playWrong() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(vol * 0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.28);
    } catch (e) {}
  }

  // 5. Map Step Pop / Footstep
  public playStep() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(vol * 0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {}
  }

  // 6. Level Up / Fanfare
  public playLevelUp() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(vol * 0.4, this.ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.12);
        osc.stop(this.ctx.currentTime + idx * 0.12 + 0.4);
      });
    } catch (e) {}
  }

  // 7. Vocabulary Audio Pronunciation (Audio File URL)
  public playVocabAudio(url: string) {
    this.stopSpeech();

    if (this.settings.muted) return;

    this.currentVoiceAudio = new Audio(url);
    this.currentVoiceAudio.volume = this.getEffectiveSfxVolume();
    this.currentVoiceAudio.play().catch((err) => {
      console.log('Audio playback prevented:', err);
    });
  }

  // 8. Full Question & Choices TTS Narration
  public speakQuestionNarration(
    sentence: string,
    targetWord: string,
    choices: Array<{ letter: string; text: string }>,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    this.lastQuestionNarrationParams = { sentence, targetWord, choices, onStart, onEnd };
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.stopSpeech();

    if (this.settings.muted) return;

    // Clean formatting for natural speech cadence
    const cleanSentence = sentence.replace(/["*_]/g, '').trim();
    const formattedChoices = choices
      .map((c) => `Choice ${c.letter}: ${c.text}.`)
      .join(' ... ');

    const fullScript = `"${cleanSentence}." ... What is the meaning of the word "${targetWord}"? ... Here are the choices: ... ${formattedChoices}`;

    const utterance = new SpeechSynthesisUtterance(fullScript);
    utterance.rate = 0.92; // Clear, friendly educator cadence
    utterance.pitch = 1.04;
    utterance.volume = this.getEffectiveSfxVolume();

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('US') || v.name.includes('Jenny') || v.name.includes('Samantha'))
    ) || voices.find((v) => v.lang.startsWith('en')) || null;

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    this.activeUtterance = utterance;

    utterance.onstart = () => {
      this.isSpeechActive = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeechActive = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeechActive = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  // 9. Dynamic Praise on Correct Answer
  public speakPraise(praiseText: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    this.stopSpeech();

    if (this.settings.muted) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(praiseText);
    utterance.rate = 1.0;
    utterance.pitch = 1.08; // Happy, upbeat praise
    utterance.volume = this.getEffectiveSfxVolume();

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('US') || v.name.includes('Jenny') || v.name.includes('Samantha'))
    ) || voices.find((v) => v.lang.startsWith('en')) || null;

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    this.activeUtterance = utterance;

    let hasEnded = false;
    const handleEnd = () => {
      if (hasEnded) return;
      hasEnded = true;
      this.isSpeechActive = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onstart = () => {
      this.isSpeechActive = true;
    };
    utterance.onend = handleEnd;
    utterance.onerror = handleEnd;

    window.speechSynthesis.speak(utterance);
  }

  // 10. Encouraging Try Again + Re-read Question Narration
  public speakTryAgain(
    tryAgainText: string,
    sentence: string,
    targetWord: string,
    choices: Array<{ letter: string; text: string }>,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.stopSpeech();

    if (this.settings.muted) return;

    const cleanSentence = sentence.replace(/["*_]/g, '').trim();
    const formattedChoices = choices
      .map((c) => `Choice ${c.letter}: ${c.text}.`)
      .join(' ... ');

    const fullScript = `${tryAgainText} ... "${cleanSentence}." ... What is the meaning of the word "${targetWord}"? ... Here are the choices: ... ${formattedChoices}`;

    const utterance = new SpeechSynthesisUtterance(fullScript);
    utterance.rate = 0.92;
    utterance.pitch = 1.04;
    utterance.volume = this.getEffectiveSfxVolume();

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('US') || v.name.includes('Jenny') || v.name.includes('Samantha'))
    ) || voices.find((v) => v.lang.startsWith('en')) || null;

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    this.activeUtterance = utterance;

    utterance.onstart = () => {
      this.isSpeechActive = true;
      if (onStart) onStart();
    };
    utterance.onend = () => {
      this.isSpeechActive = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      this.isSpeechActive = false;
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  // 11. Speak Individual Choice
  public speakChoice(letter: string, text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.stopSpeech();

    if (this.settings.muted) return;

    const script = `Choice ${letter}: ${text}`;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.95;
    utterance.pitch = 1.04;
    utterance.volume = this.getEffectiveSfxVolume();

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('US') || v.name.includes('Samantha'))
    ) || voices.find((v) => v.lang.startsWith('en')) || null;

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    this.activeUtterance = utterance;

    utterance.onend = () => {
      this.activeUtterance = null;
    };
    utterance.onerror = () => {
      this.activeUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  // 12. Play Teacher's Custom Voice Recording
  public playCustomVoiceRecording(
    url: string,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === 'undefined') return;
    this.stopSpeech();

    if (this.settings.muted) return;

    try {
      const audio = new Audio(url);
      audio.volume = this.getEffectiveSfxVolume();
      this.currentVoiceAudio = audio;
      this.isSpeechActive = true;

      audio.onplay = () => {
        this.isSpeechActive = true;
        if (onStart) onStart();
      };

      const handleEnd = () => {
        this.isSpeechActive = false;
        this.currentVoiceAudio = null;
        if (onEnd) onEnd();
      };

      audio.onended = handleEnd;
      audio.onerror = (e) => {
        console.warn('Voice recording audio failed to play:', e);
        handleEnd();
      };

      audio.play().catch((err) => {
        console.warn('Auto-playback prevented or failed:', err);
        handleEnd();
      });
    } catch (err) {
      console.warn('Failed to load voice audio:', err);
      this.isSpeechActive = false;
      if (onEnd) onEnd();
    }
  }

  // 12. Stop All Active Speech & Audio
  public stopSpeech() {
    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.pause();
      this.currentVoiceAudio = null;
    }
    this.isSpeechActive = false;
  }

  // 13. Resume or Replay Current Question Narration
  public resumeQuestionNarration() {
    if (this.lastQuestionNarrationParams) {
      const p = this.lastQuestionNarrationParams;
      this.speakQuestionNarration(p.sentence, p.targetWord, p.choices, p.onStart, p.onEnd);
    }
  }

  // 14. Clear Stored Narration
  public clearLastNarration() {
    this.lastQuestionNarrationParams = null;
  }

  // 11. Interactive Character Selection Voice
  public speakCharacterVoice(slug: string) {
    if (typeof window === 'undefined') return;
    if (this.settings.muted) return;

    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0) return;

    try {
      this.stopSpeech();

      const audioConfig: Record<
        string,
        { file: string; playbackRate: number }
      > = {
        'learner-girl': {
          file: '/assets/audio/voice_learner_girl.mp3',
          playbackRate: 1.0,
        },
        'learner-boy': {
          file: '/assets/audio/voice_learner_boy.mp3',
          playbackRate: 1.0,
        },
        'quest-boy': {
          file: '/assets/audio/voice_learner_boy.mp3',
          playbackRate: 1.0,
        },
        'scholar-girl': {
          file: '/assets/audio/voice_school_girl.mp3',
          playbackRate: 1.0,
        },
        'scholar-boy': {
          file: '/assets/audio/voice_school_boy.mp3',
          playbackRate: 1.0,
        },
        'morena-girl': {
          file: '/assets/audio/voice_sporty_girl.mp3',
          playbackRate: 1.0,
        },
        'explorer-boy': {
          file: '/assets/audio/voice_explorer_boy.mp3',
          playbackRate: 1.0,
        },
        'moreno-boy': {
          file: '/assets/audio/voice_explorer_boy.mp3',
          playbackRate: 1.0,
        },
      };

      const cfg = audioConfig[slug] || audioConfig['learner-girl'];
      const audio = new Audio(cfg.file);
      audio.volume = vol;

      (audio as any).preservesPitch = false;
      (audio as any).mozPreservesPitch = false;
      (audio as any).webkitPreservesPitch = false;
      audio.playbackRate = cfg.playbackRate;

      this.currentVoiceAudio = audio;
      audio.play().catch((err) => {
        console.warn('Character voice playback error:', err);
      });
    } catch (e) {
      console.warn('Character voice error:', e);
    }
  }
}

export const soundManager = new SoundManager();
