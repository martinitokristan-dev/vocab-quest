/**
 * Game constants and utility functions
 * Pure extraction from main.ts
 */

export const PRAISE_PHRASES = [
  'Excellent work! You found the right meaning!',
  'Fantastic choice! That is correct!',
  'Brilliant job! You are a true vocabulary master!',
  'Outstanding! Perfect answer!',
  'Great job! Keep up the amazing learning!',
  'Superb! You nailed that vocabulary word!',
  'Wonderful! That is the exact definition!',
  'Spot on! Keep conquering the quest!',
];

export const TRY_AGAIN_PHRASES = [
  "Not quite, but don't give up! Try again.",
  "Good try! Listen to the question again and pick the best choice.",
  "That's okay! Review the options and give it another shot.",
  "Almost there! Listen closely and try another choice.",
];

export interface Avatar {
  slug: string;
  label: string;
  image: string;
}

export const AVATARS: Avatar[] = [
  { slug: 'learner-girl', label: 'Learner Girl', image: '/assets/mascot_girl.png' },
  { slug: 'learner-boy', label: 'Learner Boy', image: '/assets/mascot_boy.png' },
  { slug: 'scholar-girl', label: 'School Girl', image: '/assets/scholar_girl.png' },
  { slug: 'scholar-boy', label: 'School Boy', image: '/assets/scholar_boy.png' },
  { slug: 'morena-girl', label: 'Sporty Girl', image: '/assets/morena_girl.png' },
  { slug: 'explorer-boy', label: 'Explorer Boy', image: '/assets/moreno_boy.png' },
];

/**
 * Get avatar object by slug
 * @param slug - Avatar slug identifier
 * @returns Avatar object or first avatar if not found
 */
export function getAvatarBySlug(slug: string): Avatar {
  return AVATARS.find((a) => a.slug === slug) || AVATARS[0];
}
