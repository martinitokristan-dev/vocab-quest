<?php

namespace App\Http\Controllers;

use App\Actions\PublishMapAction;
use App\Http\Resources\MapResource;
use App\Models\Map;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// Phase 2 & Phase 3 — Map Controller (architecture.md §6)
class MapController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $maps = Map::where('teacher_id', $request->user()->id)
            ->with(['character', 'questions'])
            ->orderBy('order_index')
            ->get();

        return response()->json(['data' => MapResource::collection($maps)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'                          => ['required', 'string', 'max:255'],
            'order_index'                    => ['required', 'integer', 'min:1'],
            'background_url'                 => ['nullable', 'string'],
            'background_image'               => ['nullable', 'image', 'max:5120'],
            'image_file'                     => ['nullable', 'image', 'max:5120'],
            'background_cloudinary_public_id' => ['nullable', 'string'],
        ]);

        $bgUrl = $validated['background_url'] ?? null;
        if ($request->hasFile('background_image')) {
            $path = $request->file('background_image')->store('maps', 'public');
            $bgUrl = asset('storage/' . $path);
        } elseif ($request->hasFile('image_file')) {
            $path = $request->file('image_file')->store('maps', 'public');
            $bgUrl = asset('storage/' . $path);
        }

        $map = Map::create([
            'title'                          => $validated['title'],
            'order_index'                    => $validated['order_index'],
            'background_url'                 => $bgUrl,
            'background_cloudinary_public_id' => $validated['background_cloudinary_public_id'] ?? null,
            'teacher_id'                     => $request->user()->id,
            'question_count'                 => 0,
            'published'                      => false,
        ]);

        return response()->json(['data' => new MapResource($map)], 201);
    }

    public function show(Map $map): JsonResponse
    {
        $this->authorize('view', $map);

        $map->load(['character', 'questions.answers']);

        return response()->json(['data' => new MapResource($map)]);
    }

    public function update(Request $request, Map $map): JsonResponse
    {
        $this->authorize('update', $map);

        $validated = $request->validate([
            'title'                          => ['sometimes', 'required', 'string', 'max:255'],
            'order_index'                    => ['sometimes', 'required', 'integer', 'min:1'],
            'background_url'                 => ['nullable', 'string'],
            'background_image'               => ['nullable', 'image', 'max:5120'],
            'image_file'                     => ['nullable', 'image', 'max:5120'],
            'background_cloudinary_public_id' => ['nullable', 'string'],
        ]);

        $bgUrl = $validated['background_url'] ?? $map->background_url;
        if ($request->hasFile('background_image')) {
            $path = $request->file('background_image')->store('maps', 'public');
            $bgUrl = asset('storage/' . $path);
        } elseif ($request->hasFile('image_file')) {
            $path = $request->file('image_file')->store('maps', 'public');
            $bgUrl = asset('storage/' . $path);
        }

        $map->update([
            'title'                          => $validated['title'] ?? $map->title,
            'order_index'                    => $validated['order_index'] ?? $map->order_index,
            'background_url'                 => $bgUrl,
            'background_cloudinary_public_id' => $validated['background_cloudinary_public_id'] ?? $map->background_cloudinary_public_id,
        ]);

        $map->load(['character', 'questions']);

        return response()->json(['data' => new MapResource($map)]);
    }

    public function destroy(Map $map): JsonResponse
    {
        $this->authorize('delete', $map);

        $map->delete();

        return response()->json(null, 204);
    }

    /**
     * Phase 3 — Publish Gate
     * Executes PublishMapAction to validate and publish map.
     */
    public function publish(Map $map, PublishMapAction $action): JsonResponse
    {
        $this->authorize('update', $map);

        $publishedMap = $action->execute($map);

        return response()->json([
            'message' => 'Map published successfully.',
            'data'    => new MapResource($publishedMap),
        ]);
    }
}
