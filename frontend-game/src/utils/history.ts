/**
 * History management utilities
 * Pure extraction from main.ts
 */

export interface HistoryItem {
  questionId: number;
  mapId?: number;
  orderIndex?: number;
  questionIndex?: number;
  word: string;
  isCorrect: boolean;
  stars: number;
  selectedAnswerId?: number;
  typedAnswer?: string;
  questionData?: any;
}

export interface CompletedQuestion {
  question_id: number;
  map_id?: number;
  order_index?: number;
  word?: string;
  stars?: number;
}

/**
 * Merge completed questions into existing history
 * @param existingHistory - Current history array
 * @param completedQuestions - Completed questions from API
 * @returns Merged history array
 */
export function mergeHistoryWithCompleted(
  existingHistory: HistoryItem[],
  completedQuestions: CompletedQuestion[]
): HistoryItem[] {
  const mergedHistory = [...existingHistory];
  
  if (completedQuestions && completedQuestions.length > 0) {
    completedQuestions.forEach((cq) => {
      const existingIdx = mergedHistory.findIndex((h) => h.questionId === cq.question_id);
      const starsCount = cq.stars ?? 3;
      
      if (existingIdx === -1) {
        mergedHistory.push({
          questionId: cq.question_id,
          mapId: cq.map_id,
          orderIndex: cq.order_index,
          questionIndex: cq.order_index,
          word: cq.word || '',
          isCorrect: true,
          stars: starsCount,
        });
      } else {
        mergedHistory[existingIdx] = {
          ...mergedHistory[existingIdx],
          mapId: cq.map_id,
          orderIndex: cq.order_index,
          questionIndex: cq.order_index,
          stars: starsCount,
        };
      }
    });
  }
  
  return mergedHistory;
}
