export interface DialogueSlide {
  speaker: string;
  titleBadge: string;
  text: string;
  characterImage?: string;
  buttonText: string;
}

export interface KingdomDialogue {
  kingdomId: number;
  kingdomName: string;
  slides: DialogueSlide[];
}

export const GLOBAL_INTRO_DIALOGUE: KingdomDialogue = {
  kingdomId: 0,
  kingdomName: 'Vocab Quest',
  slides: [
    {
      speaker: 'Guide',
      titleBadge: 'WELCOME, BRAVE LEARNER!',
      text: 'Welcome, brave learner! Your vocabulary adventure will take you through three exciting kingdoms, each with a different level of challenge. Read carefully, use the clues, and do your best!',
      buttonText: 'NEXT ▶',
    },
    {
      speaker: 'Guide',
      titleBadge: 'HOW TO BEGIN',
      text: 'Tap EPCES Kingdom on the map to begin your quest. Complete each level to earn golden stars and unlock the next challenge. Good luck, {playerName}!',
      buttonText: 'LET\'S GO! ⚔️',
    },
  ],
};

export const KINGDOM_DIALOGUES: Record<number, KingdomDialogue> = {
  1: {
    kingdomId: 1,
    kingdomName: 'EPCES Kingdom',
    slides: [
      {
        speaker: 'Teacher Faith',
        titleBadge: 'WELCOME TO EPCES KINGDOM — EASY ROUND!',
        text: 'Welcome to EPCES Kingdom, the Easy Round! In level 1 to 5, you will see a picture that represents the box word. Look at the picture, read the sentence carefully, and choose the correct answer from the choices.',
        characterImage: '/assets/guide/F2.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Teacher Faith',
        titleBadge: 'GET READY!',
        text: 'Take your time and enjoy the first step of your vocabulary adventure! Good luck, {playerName}!',
        characterImage: '/assets/guide/F8.png',
        buttonText: 'START QUEST ⚔️',
      },
    ],
  },
  2: {
    kingdomId: 2,
    kingdomName: 'Bayan ng Prosperidad',
    slides: [
      {
        speaker: 'Teacher Gevina',
        titleBadge: 'BAYAN NG PROSPERIDAD — AVERAGE ROUND!',
        text: 'Welcome to Bayan ng Prosperidad Municipal Kingdom, the Average Round! This time, in level 6-10 there will be no picture to guide you, but the context clues - a hint will be underlined. Read the sentence carefully, look for the clues, and use them to figure out the meaning of the box word. Then, choose the best answer from the choices.',
        characterImage: '/assets/guide/G2.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Teacher Gevina',
        titleBadge: 'STAY FOCUSED!',
        text: 'You are getting closer! Stay focused, think carefully, and believe in yourself, {playerName}!',
        characterImage: '/assets/guide/G8.png',
        buttonText: 'ENTER BAYAN 🏛️',
      },
    ],
  },
  3: {
    kingdomId: 3,
    kingdomName: 'Agusan del Sur Provincial Capitol',
    slides: [
      {
        speaker: 'Principal Flores',
        titleBadge: 'PROVINCIAL CAPITOL — DIFFICULT ROUND!',
        text: 'Welcome to Agusan del Sur Provincial Capitol Kingdom! This is the Difficult Round in the quest. In level 11-15, you will be reading a short story. Then, read each meaning. Look at the sentence marked with the [number]. Find the word in that sentence that matches the meaning. Then, type the word you found.',
        characterImage: '/assets/guide/teacher_yellow_pose1.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Principal Flores',
        titleBadge: 'FINAL CHALLENGE!',
        text: 'Goodluck, {playerName}! You can do this!',
        characterImage: '/assets/guide/teacher_yellow_pose2.png',
        buttonText: 'BEGIN FINAL QUEST 🏆',
      },
    ],
  },
};
