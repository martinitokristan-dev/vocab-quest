<?php

namespace App\Http\Controllers;

use App\Actions\GetRoomResultsAction;
use App\Models\Room;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

// Phase 6 — Teacher Room Results & Analytics Controller (architecture.md §6)
// Optimized: results cached for 3s to handle 10+ teacher tabs polling simultaneously
class RoomResultsController extends Controller
{
    use AuthorizesRequests;

    public function show(Room $room, GetRoomResultsAction $action): JsonResponse
    {
        $this->authorize('view', $room);

        // Cache results for 1 second per room for near real-time updates
        // Busted by RoomController on reset/close and GameSessionController on join
        $results = Cache::remember("room_results_{$room->id}", 1, fn () => $action->execute($room));

        return response()->json(['data' => $results]);
    }
}
