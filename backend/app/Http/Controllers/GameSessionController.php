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

        $existingSession = GameSession::where('room_id', $room->id)
            ->where('player_name', $validated['player_name'])
            ->first();

        if ($existingSession) {
            $authHeader = $request->header('Authorization');
            $providedToken = $request->header('X-Game-Session-Token')
                ?? ($authHeader ? str_replace('Bearer ', '', $authHeader) : null);
            $isSameToken = $providedToken && $providedToken === $existingSession->token;
            $isInWaitingLobby = $room->status === 'waiting';
            $isCompleted = (bool) $existingSession->is_completed;
            $isSessionActive = Cache::has("session_active_{$existingSession->id}");

            // Reconnection / name reuse is allowed if:
            // 1. Pupil has the same token (reconnecting from same device/browser)
            // 2. Room is in waiting lobby (game hasn't started or was reset)
            // 3. Pupil previously completed their game (playing again / restart)
            // 4. Player is not actively playing in this room (tab closed / disconnected / reset)
            if ($isSameToken || $isInWaitingLobby || $isCompleted || ! $isSessionActive) {
                // If reconnecting from same browser session, keep token to avoid race conditions with in-flight requests
                $newToken = ($isSameToken && ! empty($existingSession->token)) ? $existingSession->token : Str::random(60);
                $isResetting = $isCompleted || $isInWaitingLobby || (! $isSameToken && ! $isSessionActive);

                $existingSession->update([
                    'avatar_slug'    => $validated['avatar_slug'],
                    'token'          => $newToken,
                    'is_completed'   => false,
                    'score'          => $isResetting ? 0 : $existingSession->score,
                    'current_map_id' => $isResetting ? $room->current_map_id : $existingSession->current_map_id,
                ]);

                if ($isResetting) {
                    $existingSession->studentAnswers()->delete();
                }

                Cache::forget("room_results_{$room->id}");
                Cache::put("session_active_{$existingSession->id}", now()->timestamp, 20);

                return response()->json([
                    'message' => 'Successfully joined game session.',
                    'token'   => $newToken,
                    'player'  => [
                        'name'        => $existingSession->player_name,
                        'avatar_slug' => $existingSession->avatar_slug,
                    ],
                ], 200);
            }

            throw ValidationException::withMessages([
                'player_name' => ['This name is currently active in this room. Please use a different name.'],
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
                'player_name' => ['This name is currently active in this room. Please use a different name.'],
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
