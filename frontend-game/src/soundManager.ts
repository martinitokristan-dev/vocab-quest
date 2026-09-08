// Audio & Sound Effects Manager using Web Audio API + Pre-recorded Teacher Audios

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

  private currentVoiceAudio: HTMLMediaElement | null = null;
  private bgmGain: GainNode | null = null;
  private isSpeechActive: boolean = false;
  private speakingListeners: Array<(isSpeaking: boolean) => void> = [];
  private wasPlayingBeforePause: boolean = false;

  public onSpeakingStateChange(cb: (isSpeaking: boolean) => void) {
    this.speakingListeners.push(cb);
  }

  public notifySpeakingState(isSpeaking: boolean) {
    this.isSpeechActive = isSpeaking;
    this.speakingListeners.forEach((cb) => {
      try {
        cb(isSpeaking);
      } catch (e) {}
    });
  }

  constructor() {
    this.loadSettings();

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
    return this.isSpeechActive || (Boolean(this.currentVoiceAudio) && !this.currentVoiceAudio?.paused);
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

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(vol * 0.45, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {}
  }

  // 2. Button Hover
  public playHover() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(740, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(vol * 0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  // 3. Correct Answer Jingle
  public playSuccess() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      chord.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.07);

        gain.gain.setValueAtTime(vol * 0.35, this.ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.07 + 0.32);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + i * 0.07);
        osc.stop(this.ctx.currentTime + i * 0.07 + 0.32);
      });
    } catch (e) {}
  }

  // 4. Incorrect Answer Thud
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
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.22);

      gain.gain.setValueAtTime(vol * 0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    } catch (e) {}
  }

  // 4b. Kingdom entry whoosh
  public playWhoosh() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume() * 0.5;
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(680, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(vol * 0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // 4b. Realistic metallic padlock unlock: mechanical latch snap + spring ring + golden chime
  public playPadlockUnlock() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const t0 = this.ctx.currentTime;

      // 1. Crisp mechanical latch click (dual rapid transient snap)
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snapOsc.type = 'sawtooth';
      snapOsc.frequency.setValueAtTime(1600, t0);
      snapOsc.frequency.exponentialRampToValueAtTime(450, t0 + 0.045);
      snapGain.gain.setValueAtTime(vol * 0.5, t0);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
      snapOsc.connect(snapGain);
      snapGain.connect(this.ctx.destination);
      snapOsc.start(t0);
      snapOsc.stop(t0 + 0.045);

      // 2. Metallic spring ring (resonant shackle release ping)
      const springOsc = this.ctx.createOscillator();
      const springGain = this.ctx.createGain();
      springOsc.type = 'triangle';
      springOsc.frequency.setValueAtTime(980, t0 + 0.03);
      springOsc.frequency.exponentialRampToValueAtTime(840, t0 + 0.22);
      springGain.gain.setValueAtTime(vol * 0.4, t0 + 0.03);
      springGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      springOsc.connect(springGain);
      springGain.connect(this.ctx.destination);
      springOsc.start(t0 + 0.03);
      springOsc.stop(t0 + 0.22);

      // 3. Bright golden chime / celebratory jingle (C6 -> E6 -> G6)
      const notes = [1046.5, 1318.5, 1567.98];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const chimeOsc = this.ctx.createOscillator();
        const chimeGain = this.ctx.createGain();
        const startT = t0 + 0.08 + idx * 0.06;
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq, startT);
        chimeGain.gain.setValueAtTime(vol * 0.32, startT);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, startT + 0.35);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(this.ctx.destination);
        chimeOsc.start(startT);
        chimeOsc.stop(startT + 0.35);
      });
    } catch (e) {}
  }

  // 4c. Sequential star pop chime
  public playStar(starIndex: number) {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const freqs = [523.25, 659.25, 783.99];
      const freq = freqs[Math.min(starIndex - 1, 2)] ?? 783.99;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(vol * 0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.28);
    } catch (e) {}
  }

  // 5. Walking / Map Step Sound
  public playStep() {
    try {
      this.initContext();
      if (!this.ctx || this.settings.muted) return;
      const vol = this.getEffectiveSfxVolume();
      if (vol <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(vol * 0.28, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }

  // 6. Vocabulary Audio Pronunciation (Audio File URL)
  public playVocabAudio(url: string) {
    this.stopSpeech();

    if (this.settings.muted || !url) return;

    this.currentVoiceAudio = new Audio(url);
    this.currentVoiceAudio.volume = this.getEffectiveSfxVolume();
    this.currentVoiceAudio.play().catch((err) => {
      console.log('Audio playback prevented:', err);
    });
  }

  // 8. Play Question Narration Voice Recording (Triggers Teacher Mouth-Sync)
  // Supports all audio and video formats (mp3, wav, mp4, webm) playing ONLY audio with zero visual display
  public playCustomVoiceRecording(
    url: string,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (typeof window === 'undefined') return;
    this.stopSpeech();

    if (this.settings.muted || !url) {
      if (onEnd) onEnd();
      return;
    }

    try {
      // Use standard HTMLAudioElement for all audio formats and MP4/WebM video tracks.
      // Audio elements decode the audio track directly without invoking video decoder pipelines
      // or being blocked by strict browser unmuted-video autoplay restrictions.
      const media = new Audio();
      media.preload = 'auto';
      media.src = url;
      media.volume = this.getEffectiveSfxVolume();
      this.currentVoiceAudio = media;

      let hasFinished = false;
      const handleEnd = () => {
        if (hasFinished) return;
        hasFinished = true;
        this.notifySpeakingState(false);
        this.currentVoiceAudio = null;
        if (onEnd) onEnd();
      };

      media.onplay = () => {
        this.notifySpeakingState(true);
        if (onStart) onStart();
      };

      media.onended = handleEnd;
      media.onerror = (e) => {
        console.warn('Voice recording audio failed to load/play:', e);
        handleEnd();
      };

      media.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Voice playback prevented or failed:', err);
        }
        handleEnd();
      });
    } catch (err) {
      console.warn('Failed to load voice audio:', err);
      this.notifySpeakingState(false);
      if (onEnd) onEnd();
    }
  }

  // 8.1 Play Feedback Cheer/Praise Audio (Maintains Reaction Pose without triggering mouth loop)
  public playFeedbackAudio(url: string, onEnd?: () => void) {
    if (typeof window === 'undefined') return;
    this.stopSpeech();

    if (this.settings.muted || !url) {
      if (onEnd) onEnd();
      return;
    }

    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.volume = this.getEffectiveSfxVolume();
      this.currentVoiceAudio = audio;

      audio.onended = () => {
        this.currentVoiceAudio = null;
        if (onEnd) onEnd();
      };
      audio.onerror = () => {
        this.currentVoiceAudio = null;
        if (onEnd) onEnd();
      };
      audio.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Feedback audio playback failed:', err);
        }
        this.currentVoiceAudio = null;
        if (onEnd) onEnd();
      });
    } catch (err) {
      console.warn('Failed to play feedback audio:', err);
      if (onEnd) onEnd();
    }
  }

  // 9. Stop All Active Voice Audio
  public stopSpeech() {
    if (this.currentVoiceAudio) {
      try {
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.removeAttribute('src');
        this.currentVoiceAudio.load();
      } catch (e) {}
      this.currentVoiceAudio = null;
    }
    this.notifySpeakingState(false);
  }

  // 10. Pause All Audio (for teacher pause)
  public pauseAll() {
    if (this.currentVoiceAudio && !this.currentVoiceAudio.paused) {
      this.wasPlayingBeforePause = true;
      this.currentVoiceAudio.pause();
    } else {
      this.wasPlayingBeforePause = false;
    }
    
    // Also suspend AudioContext to stop all sound effects
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  // 11. Resume All Audio (for teacher resume)
  public resumeAll() {
    // Resume AudioContext for sound effects
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    
    // Resume voice audio if it was playing
    if (this.currentVoiceAudio && this.wasPlayingBeforePause) {
      this.currentVoiceAudio.play().catch(() => {});
    }
  }

  // 9. Play Character Voice (Avatar Selection)
  public speakCharacterVoice(slug: string) {
    if (typeof window === 'undefined') return;
    this.stopSpeech();

    if (this.settings.muted) return;

    try {
      const vol = this.getEffectiveSfxVolume();
      const audioConfig: Record<string, { file: string; playbackRate: number }> = {
        'learner-girl': {
          file: '/assets/audio/voice_learner_girl.mp3',
          playbackRate: 1.0,
        },
        'learner-boy': {
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
        'moreno-boy': {
          file: '/assets/audio/voice_explorer_boy.mp3',
          playbackRate: 1.0,
        },
        'explorer-boy': {
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
        // AbortError is expected when audio is interrupted by stopSpeech()
        if (err.name !== 'AbortError') {
          console.warn('Character voice playback error:', err);
        }
        this.currentVoiceAudio = null;
      });
    } catch (e) {
      console.warn('Character voice error:', e);
      this.currentVoiceAudio = null;
    }
  }
}

export const soundManager = new SoundManager();
