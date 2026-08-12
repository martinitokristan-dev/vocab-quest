<?php

namespace App\Actions;

use App\Models\GameSession;
use App\Models\Room;
use App\Models\StudentAnswer;

// Phase 6 — Teacher Historical & Live Room Analytics (architecture.md §3)
class GetRoomResultsAction
{
    public function execute(Room $room): array
    {
        $sessions = GameSession::where('room_id', $room->id)
            ->orderByDesc('score')
            ->get();

        $totalPlayers = $sessions->count();
        $averageScore = $totalPlayers > 0 ? round($sessions->avg('score'), 1) : 0;

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
                    'question_id'      => $firstAnswer->question_id,
                    'sentence'         => $firstAnswer->question?->sentence,
                    'highlighted_word' => $firstAnswer->question?->highlighted_word,
                    'total_attempts'   => $total,
                    'correct_count'    => $correct,
                    'accuracy_percentage' => $total > 0 ? round(($correct / $total) * 100, 1) : 0,
                ];
            })
            ->values();

        return [
            'room' => [
                'id'         => $room->id,
                'name'       => $room->name,
                'pin'        => $room->pin,
                'status'     => $room->status,
                'created_at' => $room->created_at,
            ],
            'summary' => [
                'total_players' => $totalPlayers,
                'average_score' => $averageScore,
            ],
            'leaderboard' => $sessions->map(fn ($s) => [
                'id'           => $s->id,
                'player_name'  => $s->player_name,
                'avatar_slug'  => $s->avatar_slug,
                'score'        => $s->score,
                'is_completed' => $s->is_completed,
            ]),
            'question_breakdown' => $questionBreakdown,
        ];
    }
}
