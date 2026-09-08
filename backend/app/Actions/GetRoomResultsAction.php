<?php

namespace App\Actions;

use App\Models\GameSession;
use App\Models\Question;
use App\Models\Room;
use App\Models\StudentAnswer;

// Phase 6 — High-Performance Teacher Historical & Live Room Analytics (architecture.md §3)
class GetRoomResultsAction
{
    public function execute(Room $room): array
    {
        $sessions = GameSession::where('room_id', $room->id)
            ->with(['currentMap'])
            ->orderByDesc('score')
            ->get();

        $totalPlayers = $sessions->count();
        $completedStudents = $sessions->where('is_completed', true)->count();
        $totalQuestionsInGame = Question::count();

        // 1. Batch query all student answers for the entire room in 1 query
        $allAnswers = StudentAnswer::whereIn('game_session_id', $sessions->pluck('id'))
            ->get();

        $answersBySession = $allAnswers->groupBy('game_session_id');

        // 2. Batch query all map questions for active stages in 1 query (Zero N+1)
        $activeMapIds = $sessions->pluck('current_map_id')->filter()->unique();
        $mapQuestions = Question::whereIn('map_id', $activeMapIds)
            ->orderBy('order_index')
            ->get()
            ->groupBy('map_id');

        $mapQuestionCounts = $mapQuestions->map->count();

        // 3. Aggregate question accuracy breakdown ascending by Stage/Map and question order (Q1 through Q15)
        $allQuestions = Question::with('map')
            ->get()
            ->sortBy([
                fn ($a, $b) => ($a->map?->order_index ?? 0) <=> ($b->map?->order_index ?? 0),
                fn ($a, $b) => $a->order_index <=> $b->order_index,
            ])
            ->values();
        $answersByQuestion = $allAnswers->groupBy('question_id');
        
        $questionBreakdown = $allQuestions->map(function ($question, $qIndex) use ($answersByQuestion) {
            $answers = $answersByQuestion->get($question->id, collect());
            
            $totalStudents = $answers->count();
            $totalAttempts = (int) $answers->sum(fn ($a) => (int) ($a->attempts ?: 1));
            if ($totalAttempts === 0 && $totalStudents > 0) {
                $totalAttempts = $totalStudents;
            }

            // 1st attempt correct (attempts == 1 and is_correct == true)
            $firstAttemptCorrect = $answers->filter(fn ($a) => (bool) $a->is_correct && ((int) ($a->attempts ?: 1) === 1))->count();
            // 1st attempt wrong (students who took 2 or more attempts, meaning 1st attempt failed)
            $firstAttemptWrong = $totalStudents - $firstAttemptCorrect;

            // 2nd attempt correct (attempts == 2)
            $secondAttemptCount = $answers->filter(fn ($a) => (bool) $a->is_correct && ((int) ($a->attempts ?: 1) === 2))->count();

            // 3rd+ attempt correct (attempts >= 3)
            $thirdAttemptCount = $answers->filter(fn ($a) => (bool) $a->is_correct && ((int) ($a->attempts ?: 1) >= 3))->count();

            // Percentages based on students who answered this question
            $firstAttemptPercentage = $totalStudents > 0 ? round(($firstAttemptCorrect / $totalStudents) * 100, 1) : 0;
            $secondAttemptPercentage = $totalStudents > 0 ? round(($secondAttemptCount / $totalStudents) * 100, 1) : 0;
            $thirdAttemptPercentage = $totalStudents > 0 ? round(($thirdAttemptCount / $totalStudents) * 100, 1) : 0;

            return [
                'question_id'              => $question->id,
                'question_number'          => $qIndex + 1,
                'map_id'                   => $question->map_id,
                'map_order'                => $question->map?->order_index ?? 1,
                'map_title'                => $question->map?->title ?? 'Stage',
                'order_index'              => $question->order_index,
                'sentence'                 => $question->sentence,
                'highlighted_word'         => $question->highlighted_word,
                'total_attempts'           => $totalAttempts,
                'total_students'           => $totalStudents,
                'correct_count'            => $firstAttemptCorrect,
                'wrong_count'              => $firstAttemptWrong,
                'first_attempt_count'      => $firstAttemptCorrect,
                'first_attempt_wrong'      => $firstAttemptWrong,
                'first_attempt_percentage' => $firstAttemptPercentage,
                'second_attempt_count'     => $secondAttemptCount,
                'second_attempt_percentage'=> $secondAttemptPercentage,
                'third_attempt_count'      => $thirdAttemptCount,
                'third_attempt_percentage' => $thirdAttemptPercentage,
                'accuracy_percentage'      => $firstAttemptPercentage,
            ];
        })->values();

        // 4. Map students with in-memory collection resolution (No DB queries in loop)
        $studentsList = $sessions->map(function ($s) use ($answersBySession, $mapQuestions, $mapQuestionCounts, $totalQuestionsInGame) {
            $sessionAnswers = $answersBySession->get($s->id, collect());
            $correctAnswers = $sessionAnswers->where('is_correct', true);
            $correctCount = $correctAnswers->count();
            $totalAnswered = $sessionAnswers->count();
            $mapQuestionCount = $mapQuestionCounts->get($s->current_map_id, 5);
            $currentQNum = $s->is_completed ? $mapQuestionCount : min($correctCount + 1, max(1, $mapQuestionCount));

            $totalStars = (int) $correctAnswers->sum('stars');
            if ($totalStars === 0 && $correctCount > 0) {
                $totalStars = max($s->score, $correctCount * 3);
            } else if ($totalStars < $correctCount) {
                $totalStars = $correctCount * 3;
            }

            $currentQuestion = null;
            if (! $s->is_completed && $s->current_map_id) {
                $answeredIds = $sessionAnswers->where('map_id', $s->current_map_id)->where('is_correct', true)->pluck('question_id');
                $stageQuestions = $mapQuestions->get($s->current_map_id, collect());
                $currentQuestion = $stageQuestions->first(fn ($q) => ! $answeredIds->contains($q->id));
            }

            return [
                'id'                      => $s->id,
                'player_name'             => $s->player_name,
                'avatar_slug'             => $s->avatar_slug,
                'score'                   => $totalStars,
                'stars'                   => $totalStars,
                'is_completed'            => (bool) $s->is_completed,
                'questions_answered'      => $totalAnswered,
                'correct_answers'         => $correctCount,
                'current_question_number' => $currentQuestion?->order_index ?? $currentQNum,
                'current_word'            => $currentQuestion?->highlighted_word ?? '',
                'current_sentence'        => $currentQuestion?->sentence ?? '',
                'current_map_title'       => $s->currentMap?->title ?? 'Stage 1',
                'current_map_order'       => $s->currentMap?->order_index ?? 1,
                'map_total_questions'     => $mapQuestionCount,
                'total_game_questions'    => $totalQuestionsInGame,
                'progress_percentage'     => $s->is_completed
                    ? 100
                    : ($totalQuestionsInGame > 0 ? min(100, round(($correctCount / $totalQuestionsInGame) * 100)) : 0),
            ];
        });

        $averageScore = $totalPlayers > 0 ? round($studentsList->avg('stars'), 1) : 0;

        return [
            'room' => [
                'id'                    => $room->id,
                'name'                  => $room->name,
                'pin'                   => $room->pin,
                'status'                => $room->status,
                'max_students'          => $room->max_students ?? 40,
                'active_students_count' => $totalPlayers,
                'created_at'            => $room->created_at,
            ],
            'summary' => [
                'total_students'       => $totalPlayers,
                'completed_students'   => $completedStudents,
                'class_average_score'  => $averageScore,
                'total_players'        => $totalPlayers,
                'average_score'        => $averageScore,
            ],
            'students'           => $studentsList,
            'leaderboard'        => $studentsList,
            'question_breakdown' => $questionBreakdown,
        ];
    }
}
