export interface DialogueSlide {
  speaker: string;
  titleBadge: string;
  text: string;
  characterImage?: string;
  /**
   * Label of the green button on the LAST slide (closes the dialogue). Other slides have no
   * forward button: the teacher's voice turns them, and SKIP jumps to the last slide.
   */
  buttonText?: string;
  /** Icon for that button (an Icons key in icons.ts). */
  buttonIcon?: 'arrowRight' | 'flag' | 'landmark' | 'trophy';
  audioUrl?: string;
  /**
   * Seconds into audioUrl where this slide's part starts, for one recording read over several slides.
   * When set, the dialogue moves to the next slide by itself once the voice reaches that slide's part
   * (or, on the last slide of the recording, when the recording ends). See main.ts renderDialogueOverlay.
   */
  audioStart?: number;
}

export interface KingdomDialogue {
  kingdomId: number;
  kingdomName: string;
  slides: DialogueSlide[];
}

/** Teacher Annabelle's recording for Provincial Capitol slides 1-3 (file name has spaces, so encoded). */
const CAPITOL_SLIDES_1_TO_3_AUDIO = encodeURI('/assets/audio/Kingdom 4 1-3 Slides.aac');

/** Teacher Lovely's recording for Bayan ng Prosperidad slides 1-2 (file name has spaces, so encoded). */
const BAYAN_SLIDES_1_TO_2_AUDIO = encodeURI('/assets/audio/Bayan slides 1-2.aac');

// Script from the client (Nov 2026): one slide per paragraph. Keep each slide's text short
// (about 350 characters at most): the dialogue card does not scroll.

export const GLOBAL_INTRO_DIALOGUE: KingdomDialogue = {
  kingdomId: 0,
  kingdomName: 'Vocab Quest',
  slides: [
    {
      speaker: 'Teacher Yanna',
      titleBadge: 'WELCOME, BRAVE LEARNER!',
      text: 'Welcome, brave learner! Are you ready for an exciting vocabulary adventure? Explore three amazing kingdoms, discover the meanings of words, and collect golden stars along the way! Look carefully, use the clues, and do your best in every quest. Let your English Academic Vocabulary adventure begin!',
      characterImage: '/assets/guide/teacher_yellow_guide_1.png',
      // Teacher's recording "Kingdom 1.mp4" (slide 1 only): audio track copied out of the video
      // and the silence at the start/end trimmed (scratch/mp4-to-aac.mjs), 26 s.
      audioUrl: encodeURI('/assets/audio/Welcome slide 1.aac'),
      // audioStart makes the dialogue turn to slide 2 by itself when this recording ends.
      audioStart: 0,
    },
    {
      speaker: 'Teacher Yanna',
      titleBadge: 'HOW TO BEGIN',
      text: 'Tap EPCES Kingdom on the map to begin your quest. Complete each level to earn golden stars and unlock the next challenge. Good luck, {playerName}!',
      characterImage: '/assets/guide/teacher_yellow_guide_2.png',
      buttonText: 'CONTINUE',
      buttonIcon: 'arrowRight',
      audioUrl: '/assets/audio/second-guide-tangaro.mp3',
    },
  ],
};

export const KINGDOM_DIALOGUES: Record<number, KingdomDialogue> = {
  1: {
    kingdomId: 1,
    kingdomName: 'EPCES Kingdom',
    slides: [
      {
        speaker: 'Teacher Lovely',
        titleBadge: 'WELCOME TO EPCES KINGDOM!',
        text: 'Welcome to EPCES Kingdom! Your first vocabulary quest awaits! In this kingdom (level 1-25), each question includes a picture to help you understand the boxed word. Look closely at the picture, read the sentence carefully, and choose the correct answer from the choices provided.',
        characterImage: '/assets/guide/teacher_lovely_guide_3.png',
        // Teacher's recording "Welcome to epces kingdom.mp4" (slide 1 only): audio track copied out
        // of the video and the silence at the start trimmed (scratch/mp4-to-aac.mjs), 17.3 s.
        audioUrl: encodeURI('/assets/audio/EPCES slide 1.aac'),
        // audioStart makes the dialogue turn to slide 2 by itself when this recording ends.
        audioStart: 0,
      },
      {
        speaker: 'Teacher Lovely',
        titleBadge: 'GET READY!',
        text: 'Take your time and enjoy the first step of your academic vocabulary adventure!',
        characterImage: '/assets/guide/teacher_lovely_guide_4.png',
        buttonText: 'BEGIN QUEST',
        buttonIcon: 'flag',
        audioUrl: '/assets/audio/fourth-guide-almendras2.m4a',
      },
    ],
  },
  2: {
    kingdomId: 2,
    kingdomName: 'Bayan ng Prosperidad',
    slides: [
      {
        speaker: 'Teacher Lovely',
        titleBadge: 'WELCOME TO BAYAN NG PROSPERIDAD!',
        text: 'Welcome to Bayan ng Prosperidad Municipal Kingdom! Your vocabulary adventure continues here! In this kingdom 2 (level 1-25), you will see the pictures and now, you will also find underlined context clues in the sentences. These clues give you hints that can help you figure out the meaning of the boxed word.',
        characterImage: '/assets/guide/teacher_lovely_guide_5.png',
        // One recording (31.6 s, from the teacher's "Welcome to bayan ng prosperidad.mp4", silence at
        // the start trimmed with scratch/mp4-to-aac.mjs) reads slides 1-2 and turns the slides by itself
        // (main.ts). Slide 2 starts at the pause before "Look at the picture..." (19.42-19.70 s),
        // measured with scratch/pauses.mjs.
        audioUrl: BAYAN_SLIDES_1_TO_2_AUDIO,
        audioStart: 0,
      },
      {
        speaker: 'Teacher Lovely',
        titleBadge: 'HOW TO ANSWER',
        text: 'Look at the picture, read the sentence carefully, and pay attention to the underlined words. Think about how the clues help you understand the target word, then choose the best answer.',
        characterImage: '/assets/guide/teacher_lovely_guide_5.png',
        audioUrl: BAYAN_SLIDES_1_TO_2_AUDIO,
        audioStart: 19.45,
      },
      {
        speaker: 'Teacher Lovely',
        titleBadge: 'STAY FOCUSED!',
        text: 'You are getting closer! Stay focused, think carefully and believe in yourself!',
        characterImage: '/assets/guide/teacher_lovely_guide_6.png',
        buttonText: 'CONTINUE QUEST',
        buttonIcon: 'landmark',
        audioUrl: '/assets/audio/sixth-guide-almendras2.m4a',
      },
    ],
  },
  3: {
    kingdomId: 3,
    kingdomName: 'Agusan del Sur Provincial Capitol',
    slides: [
      {
        speaker: 'Teacher Annabelle',
        titleBadge: 'WELCOME TO THE PROVINCIAL CAPITOL!',
        text: 'Welcome to Agusan del Sur Provincial Capitol Kingdom! You have reached the final kingdom of your vocabulary adventure!',
        characterImage: '/assets/guide/teacher_annabelle_guide_7.png',
        // One recording (40.6 s) reads slides 1-3 and turns the slides by itself (main.ts).
        // Start times = the pauses before "In this kingdom..." (7.90-8.24 s) and
        // "Read each short story carefully." (25.90-26.22 s), measured with scratch/pauses.mjs.
        audioUrl: CAPITOL_SLIDES_1_TO_3_AUDIO,
        audioStart: 0,
      },
      {
        speaker: 'Teacher Annabelle',
        titleBadge: 'WHAT YOU WILL SEE',
        text: 'In this kingdom (level 1-25), you will find pictures, boxed target words, and underlined context clues within story-based sentences. The pictures will help you visualize the situation, while the underlined context clues will guide you in understanding the meaning of the target word.',
        characterImage: '/assets/guide/teacher_annabelle_guide_7.png',
        audioUrl: CAPITOL_SLIDES_1_TO_3_AUDIO,
        audioStart: 7.95,
      },
      {
        speaker: 'Teacher Annabelle',
        titleBadge: 'HOW TO ANSWER',
        text: 'Read each short story carefully. For every question, read the given meaning and choose the word from the choices that matches the meaning. Select the best answer based on the picture, the underlined context clues, and the short story.',
        characterImage: '/assets/guide/teacher_annabelle_guide_7.png',
        audioUrl: CAPITOL_SLIDES_1_TO_3_AUDIO,
        audioStart: 25.95,
      },
      {
        speaker: 'Teacher Annabelle',
        titleBadge: 'FINAL CHALLENGE!',
        text: 'Believe in yourself, enjoy the quest, and let your learning shine! You\'ve got this!',
        characterImage: '/assets/guide/teacher_annabelle_guide_8.png',
        buttonText: 'BEGIN FINAL QUEST',
        buttonIcon: 'trophy',
        audioUrl: encodeURI('/assets/audio/Last part slide 4.aac'),
      },
    ],
  },
};
