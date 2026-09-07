<?php

namespace App\Http\Controllers;

use App\Http\Resources\ScoreboardResource;
use App\Models\GameSession;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

// Phase 5 — Student Game Session Controller (architecture.md §6, rules-and-validation §4)
class GameSessionController extends Controller
{
    public function join(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pin'         => ['required', 'string', 'size:6'],
            'player_name' => ['required', 'string', 'max:50'],
            'avatar_slug' => ['required', 'string', 'max:50'],
        ]);

        $room = Room::where('pin', $validated['pin'])->first();

        if (! $room) {
            throw ValidationException::withMessages([
                'pin' => ['Room not found with the provided 6-digit PIN.'],
            ]);
        }

        if (! in_array($room->status, ['waiting', 'in_progress'])) {
            $readableStatus = match ($room->status) {
                'in_progress' => 'In Progress',
                'paused'      => 'Paused',
                'closed'      => 'Closed',
                default       => ucfirst(str_replace('_', ' ', $room->status)),
            };

            throw ValidationException::withMessages([
                'pin' => ["Cannot join because this room is already {$readableStatus}. Ask your teacher to open a new session."],
            ]);
        }

        $currentCount = $room->gameSessions()->count();
        $maxStudents = $room->max_students ?? 40;
        if ($currentCount >= $maxStudents) {
            throw ValidationException::withMessages([
                'pin' => ["Room is full ({$currentCount}/{$maxStudents} pupils). Ask your teacher to increase capacity or open another room."],
            ]);
        }

        try {
            $session = GameSession::create([
                'room_id'        => $room->id,
                'current_map_id' => $room->current_map_id,
                'player_name'    => $validated['player_name'],
                'avatar_slug'    => $validated['avatar_slug'],
                'token'          => Str::random(60),
                'score'          => 0,
                'is_completed'   => false,
            ]);

            // Invalidate room results cache so teacher sees student immediately
            Cache::forget("room_results_{$room->id}");

            return response()->json([
                'message' => 'Successfully joined game session.',
                'token'   => $session->token,
                'player'  => [
                    'name'        => $session->player_name,
                    'avatar_slug' => $session->avatar_slug,
                ],
            ], 201);
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            throw ValidationException::withMessages([
                'player_name' => ['This name is already taken in this room. Please use a different name.'],
            ]);
        }
    }

    public function scoreboard(Request $request): JsonResponse
    {
        /** @var GameSession $session */
        $session = $request->attributes->get('game_session');

        $leaderboard = GameSession::where('room_id', $session->room_id)
            ->orderByDesc('score')
            ->orderBy('created_at')
            ->take(10)
            ->get();

        return response()->json(['data' => ScoreboardResource::collection($leaderboard)]);
    }
}
