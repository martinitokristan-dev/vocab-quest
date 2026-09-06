/**
 * Mock data for testing
 * 
 * This file contains mock data objects that match the application's
 * data structures for use in tests.
 */

/**
 * Mock question data for testing
 */
export const mockQuestion = {
  id: 1,
  map_id: 1,
  order_index: 1,
  question_type: 'multiple_choice' as const,
  sentence: 'The cat sat on the mat.',
  highlighted_word: 'mat',
  context_clue: '',
  image_url: 'https://example.com/image.jpg',
  voice_audio_url: '',
  voice_video_url: '',
  voice_media_type: 'none' as const,
  answers: [
    { id: 1, text: 'A flat piece of material', is_correct: true },
    { id: 2, text: 'A pet animal', is_correct: false },
    { id: 3, text: 'A type of clothing', is_correct: false },
    { id: 4, text: 'A building', is_correct: false },
  ],
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

/**
 * Mock identification question for testing
 */
export const mockIdentificationQuestion = {
  id: 2,
  map_id: 2,
  order_index: 1,
  question_type: 'identification' as const,
  sentence: 'The dog barked loudly.',
  highlighted_word: 'barked',
  context_clue: 'Made a loud sound',
  image_url: '',
  voice_audio_url: '',
  voice_video_url: '',
  voice_media_type: 'none' as const,
  answers: [{ id: 5, text: 'barked', is_correct: true }],
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

/**
 * Mock map data for testing
 */
export const mockMap = {
  id: 1,
  kingdom_number: 1,
  stage_number: 1,
  title: 'EPCES Adventure Entrance',
  questions_count: 3,
  is_published: true,
  teacher_id: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

/**
 * Mock answer data for testing
 */
export const mockAnswer = {
  text: 'Sample answer',
  is_correct: true,
};

/**
 * Creates a list of mock answers
 * 
 * @param count - Number of answers to create
 * @param correctIndex - Index of the correct answer (default: 0)
 * @returns Array of mock answer objects
 */
export function createMockAnswers(count: number = 4, correctIndex: number = 0) {
  return Array.from({ length: count }, (_, index) => ({
    text: `Answer ${index + 1}`,
    is_correct: index === correctIndex,
  }));
}

/**
 * Creates a mock question with custom properties
 * 
 * @param overrides - Properties to override in the mock question
 * @returns A mock question object
 */
export function createMockQuestion(overrides: Record<string, any> = {}) {
  return {
    ...mockQuestion,
    ...overrides,
  };
}

/**
 * Creates a list of mock questions
 * 
 * @param count - Number of questions to create
 * @returns Array of mock question objects
 */
export function createMockQuestions(count: number = 3) {
  return Array.from({ length: count }, (_, index) => ({
    ...mockQuestion,
    id: index + 1,
    order_index: index + 1,
    sentence: `This is question ${index + 1}.`,
  }));
}
