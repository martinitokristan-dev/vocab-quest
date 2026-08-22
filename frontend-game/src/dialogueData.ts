export interface DialogueSlide {
  speaker: string;
  titleBadge: string;
  text: string;
  characterImage?: string; // If undefined, renders full-width narrative card (Kingdom 2)
  buttonText: string;
}

export interface KingdomDialogue {
  kingdomId: number;
  kingdomName: string;
  slides: DialogueSlide[];
}

export const KINGDOM_DIALOGUES: Record<number, KingdomDialogue> = {
  1: {
    kingdomId: 1,
    kingdomName: 'EPCES Kingdom',
    slides: [
      {
        speaker: 'Teacher Faith',
        titleBadge: 'WELCOME TO EPCES KINGDOM! (EASY LEVEL)',
        text: 'Mabuhay, {playerName}! Welcome to East Prosperidad Central Elementary School Kingdom. This is the Easy Level of your quest, and I will be your teacher on this vocabulary journey!',
        characterImage: '/assets/guide/teacher_blue_pose1.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Teacher Faith',
        titleBadge: 'EASY LEVEL INSTRUCTIONS',
        text: 'Read each sentence carefully and identify the correct meaning of the highlighted vocabulary word. Answer on your 1st attempt to earn 3 Golden Stars!',
        characterImage: '/assets/guide/teacher_blue_pose2.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Teacher Faith',
        titleBadge: 'GET READY!',
        text: 'You can listen to sentence audio by tapping the Replay button anytime. Tap START QUEST to begin Easy Question 1!',
        characterImage: '/assets/guide/teacher_blue_pose2.png',
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
        titleBadge: 'BAYAN NG PROSPERIDAD (MEDIUM LEVEL)',
        text: 'Mabuhay, {playerName}! You have crossed the river bridge and unlocked the Medium Level here in Bayan ng Prosperidad! The town plaza is bustling with exciting vocabulary challenges.',
        characterImage: '/assets/guide/G2.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Teacher Gevina',
        titleBadge: 'MEDIUM LEVEL CHALLENGE',
        text: 'Solve all 5 medium level questions along the Bridge Promenade, Municipal Plaza, and Playground to unlock the road to the Provincial Capitol!',
        characterImage: '/assets/guide/G8.png',
        buttonText: 'ENTER BAYAN 🏛️',
      },
    ],
  },
  3: {
    kingdomId: 3,
    kingdomName: 'Provincial Capitol',
    slides: [
      {
        speaker: 'Principal Flores',
        titleBadge: 'PROVINCIAL CAPITOL (DIFFICULT LEVEL)',
        text: 'Mabuhay, {playerName}! Congratulations on reaching the highest peak of Prosperidad. I am Principal Flores, welcoming you to the Difficult Level at the Capitol grounds.',
        characterImage: '/assets/guide/teacher_yellow_pose1.png',
        buttonText: 'NEXT ▶',
      },
      {
        speaker: 'Principal Flores',
        titleBadge: 'DIFFICULT LEVEL MASTERY',
        text: 'This is the Difficult Level test of your vocabulary mastery! Focus your mind, choose wisely, and conquer the final challenge. Best of luck, Champion!',
        characterImage: '/assets/guide/teacher_yellow_pose2.png',
        buttonText: 'BEGIN FINAL QUEST 🏆',
      },
    ],
  },
};
