<?php

namespace App\Http\Controllers;

use App\Http\Resources\RoomResource;
use App\Models\Map;
use App\Models\Room;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// Phase 5 — Room Controller (architecture.md §6)
class RoomController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $rooms = Room::where('teacher_id', $request->user()->id)
            ->with(['currentMap'])
            ->latest()
            ->get();

        return response()->json(['data' => RoomResource::collection($rooms)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_map_id' => ['required', 'exists:maps,id'],
            'name'           => ['nullable', 'string', 'max:255'],
        ]);

        $map = Map::findOrFail($validated['current_map_id']);
        $this->authorize('view', $map);

        // Map must be published before starting a room
        if (! $map->published) {
            throw ValidationException::withMessages([
                'current_map_id' => ['Cannot create a room for an unpublished map. Please publish the map first.'],
            ]);
        }

        // Generate unique 6-digit PIN
        do {
            $pin = sprintf('%06d', mt_rand(100000, 999999));
        } while (Room::where('pin', $pin)->whereIn('status', ['waiting', 'in_progress'])->exists());

        $room = Room::create([
            'teacher_id'     => $request->user()->id,
            'current_map_id' => $map->id,
            'pin'            => $pin,
            'name'           => $validated['name'] ?? "Room #{$pin}",
            'status'         => 'waiting',
        ]);

        return response()->json(['data' => new RoomResource($room)], 201);
    }

    public function show(Room $room): JsonResponse
    {
        $this->authorize('view', $room);

        $room->load(['currentMap', 'gameSessions']);

        return response()->json(['data' => new RoomResource($room)]);
    }

    public function start(Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        if ($room->status !== 'waiting') {
            throw ValidationException::withMessages([
                'status' => ["Cannot start room with status '{$room->status}'. Room must be in 'waiting' status."],
            ]);
        }

        $room->update(['status' => 'in_progress']);

        return response()->json([
            'message' => 'Room session started. Students can now play.',
            'data'    => new RoomResource($room),
        ]);
    }

    public function close(Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        if ($room->status === 'closed') {
            throw ValidationException::withMessages([
                'status' => ['Room is already closed.'],
            ]);
        }

        $room->update(['status' => 'closed']);

        return response()->json([
            'message' => 'Room closed.',
            'data'    => new RoomResource($room),
        ]);
    }
}
