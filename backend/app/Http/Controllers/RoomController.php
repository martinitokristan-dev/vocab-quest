<?php

namespace App\Http\Controllers;

use App\Http\Resources\RoomResource;
use App\Models\Map;
use App\Models\Room;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
            'current_map_id' => ['nullable', 'exists:maps,id'],
            'name'           => ['nullable', 'string', 'max:255'],
            'max_students'   => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $mapId = $validated['current_map_id'] ?? null;
        if (! $mapId) {
            $map = Map::where('published', true)->orderBy('order_index', 'asc')->first()
                ?? Map::orderBy('order_index', 'asc')->first();
        } else {
            $map = Map::findOrFail($mapId);
        }

        if (! $map) {
            $map = Map::firstOrCreate(
                ['order_index' => 1],
                ['title' => 'EPCES Adventure Entrance', 'published' => true]
            );
        }

        // Generate unique 6-digit random PIN
        do {
            $pin = sprintf('%06d', mt_rand(100000, 999999));
        } while (Room::where('pin', $pin)->whereIn('status', ['waiting', 'in_progress'])->exists());

        $room = Room::create([
            'teacher_id'     => $request->user()->id,
            'current_map_id' => $map->id,
            'pin'            => $pin,
            'name'           => !empty($validated['name']) ? $validated['name'] : "Room #{$pin}",
            'status'         => 'waiting',
            'max_students'   => $validated['max_students'] ?? 40,
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
        Cache::forget("room_status_{$room->id}");
        Cache::forget("room_results_{$room->id}");

        return response()->json([
            'message' => 'Room session started. Students can now play.',
            'data'    => new RoomResource($room),
        ]);
    }

    public function pause(Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        if ($room->status !== 'in_progress') {
            throw ValidationException::withMessages([
                'status' => ["Cannot pause room with status '{$room->status}'. Room must be in_progress."],
            ]);
        }

        $room->update(['status' => 'paused']);
        Cache::forget("room_status_{$room->id}");
        Cache::forget("room_results_{$room->id}");

        return response()->json([
            'message' => 'Room session paused.',
            'data'    => new RoomResource($room),
        ]);
    }

    public function resume(Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        if ($room->status !== 'paused') {
            throw ValidationException::withMessages([
                'status' => ["Cannot resume room with status '{$room->status}'. Room must be paused."],
            ]);
        }

        $room->update(['status' => 'in_progress']);
        Cache::forget("room_status_{$room->id}");
        Cache::forget("room_results_{$room->id}");

        return response()->json([
            'message' => 'Room session resumed.',
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
        Cache::forget("room_status_{$room->id}");
        Cache::forget("room_results_{$room->id}");

        return response()->json([
            'message' => 'Room closed.',
            'data'    => new RoomResource($room),
        ]);
    }

    public function reset(Room $room): JsonResponse
    {
        $this->authorize('update', $room);

        $room->gameSessions()->delete();
        $room->update(['status' => 'waiting']);
        Cache::forget("room_status_{$room->id}");
        Cache::forget("room_results_{$room->id}");

        return response()->json([
            'message' => 'Room session reset.',
            'data'    => new RoomResource($room),
        ]);
    }

    public function destroy(Room $room): JsonResponse
    {
        $this->authorize('delete', $room);

        $room->gameSessions()->delete();
        $room->delete();

        return response()->json(['message' => 'Room deleted successfully.']);
    }
}
