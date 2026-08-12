<?php

namespace App\Http\Controllers;

use App\Actions\GetRoomResultsAction;
use App\Models\Room;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

// Phase 6 — Teacher Room Results & Analytics Controller (architecture.md §6)
class RoomResultsController extends Controller
{
    use AuthorizesRequests;

    public function show(Room $room, GetRoomResultsAction $action): JsonResponse
    {
        $this->authorize('view', $room);

        $results = $action->execute($room);

        return response()->json(['data' => $results]);
    }
}
