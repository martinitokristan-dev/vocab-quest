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

/**
 * Shown when the student only found the answer on the 4th (last) choice → 0 stars.
 * The answer is correct, so the tone stays positive, but it nudges them to try for stars next time.
 */
export const ZERO_STAR_PHRASES = [
  "You found it! Try to get it on your first try next time to earn stars!",
  "That's the one! Read the clue carefully next time and try to win some stars!",
  "Good job finishing! Try again on the next level and aim for three stars!",
  "You got there! Think before you tap next time, and the stars will come!",
];

export interface Avatar {
  slug: string;
  label: string;
  image: string;
}

export const AVATARS: Avatar[] = [
  // Pictures are renders of the 3D students (art3d/students.blend); the map shows the matching GLB.
  { slug: 'learner-girl', label: 'Learner Girl', image: '/assets/students/learner-girl.webp' },
  { slug: 'learner-boy', label: 'Learner Boy', image: '/assets/students/learner-boy.webp' },
  { slug: 'scholar-girl', label: 'School Girl', image: '/assets/students/scholar-girl.webp' },
  { slug: 'scholar-boy', label: 'School Boy', image: '/assets/students/scholar-boy.webp' },
  { slug: 'sporty-girl', label: 'Sporty Girl', image: '/assets/students/sporty-girl.webp' },
  { slug: 'explorer-boy', label: 'Explorer Boy', image: '/assets/students/explorer-boy.webp' },
];

/**
 * Get avatar object by slug
 * @param slug - Avatar slug identifier
 * @returns Avatar object or first avatar if not found
 */
export function getAvatarBySlug(slug: string): Avatar {
  if (slug === 'moreno-boy') slug = 'explorer-boy';
  if (slug === 'morena-girl') slug = 'sporty-girl';
  return AVATARS.find((a) => a.slug === slug) || AVATARS[0];
}
