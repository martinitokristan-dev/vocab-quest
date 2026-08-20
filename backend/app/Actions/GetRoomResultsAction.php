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

        // 3. Aggregate question accuracy breakdown
        $questionBreakdown = StudentAnswer::whereHas('gameSession', function ($q) use ($room) {
            $q->where('room_id', $room->id);
        })
            ->with(['question'])
            ->get()
            ->groupBy('question_id')
            ->map(function ($answers) {
                $total = $answers->count();
                $correct = $answers->where('is_correct', true)->count();
                $firstAnswer = $answers->first();

                return [
                    'question_id'         => $firstAnswer->question_id,
                    'sentence'            => $firstAnswer->question?->sentence,
                    'highlighted_word'    => $firstAnswer->question?->highlighted_word,
                    'total_attempts'      => $total,
                    'correct_count'       => $correct,
                    'wrong_count'         => $total - $correct,
                    'accuracy_percentage' => $total > 0 ? round(($correct / $total) * 100, 1) : 0,
                ];
            })
            ->values();

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
