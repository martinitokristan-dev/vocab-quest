<?php

namespace App\Http\Controllers;

use App\Contracts\Services\CloudinaryAudioContract;
use App\Models\FeedbackAudio;
use App\Models\Map;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FeedbackAudioController extends Controller
{
    public function __construct(
        private readonly CloudinaryAudioContract $cloudinaryService
    ) {}

    public function index(): JsonResponse
    {
        $audios = FeedbackAudio::with('map:id,title,order_index')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($a) {
                if (str_starts_with($a->audio_url, '/storage/')) {
                    $a->audio_url = asset(ltrim($a->audio_url, '/'));
                }
                return $a;
            });

        return response()->json([
            'data'     => $audios,
            'praise'   => $audios->where('type', 'praise')->values(),
            'cheer_up' => $audios->where('type', 'cheer_up')->values(),
        ]);
    }

    public function activeClips(): JsonResponse
    {
        $audios = FeedbackAudio::with('map:id,title,order_index')
            ->where('is_active', true)
            ->get()
            ->map(function ($a) {
                if (str_starts_with($a->audio_url, '/storage/')) {
                    $a->audio_url = asset(ltrim($a->audio_url, '/'));
                }
                return $a;
            });

        return response()->json([
            'praise'   => $audios->where('type', 'praise')->values(),
            'cheer_up' => $audios->where('type', 'cheer_up')->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type'       => ['required', 'in:praise,cheer_up'],
            'phrase'     => ['required', 'string', 'max:255'],
            'audio_file' => ['nullable', 'file'],           // no size or MIME restriction
            'audio_url'  => ['nullable', 'string', 'max:1000'],
            'map_id'     => ['nullable', 'integer', 'exists:maps,id'],
        ]);

        $audioUrl = $validated['audio_url'] ?? null;

        if ($request->hasFile('audio_file')) {
            $file   = $request->file('audio_file');
            $upload = $this->cloudinaryService->uploadFile($file, 'feedback_audios', 'video');
            $audioUrl = $upload['url'];
        }

        if (! $audioUrl) {
            return response()->json(['message' => 'Please provide an audio recording or audio file.'], 422);
        }

        $feedbackAudio = FeedbackAudio::create([
            'type'     => $validated['type'],
            'phrase'   => $validated['phrase'],
            'audio_url'=> $audioUrl,
            'is_active'=> true,
            'map_id'   => $validated['map_id'] ?? null,
        ]);

        $feedbackAudio->load('map:id,title,order_index');

        return response()->json([
            'message' => 'Feedback voiceover saved successfully!',
            'data'    => $feedbackAudio,
        ], 201);
    }

    public function toggle(int $id): JsonResponse
    {
        $audio = FeedbackAudio::findOrFail($id);
        $audio->is_active = ! $audio->is_active;
        $audio->save();

        return response()->json([
            'message' => 'Audio status updated.',
            'data'    => $audio,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $audio = FeedbackAudio::findOrFail($id);

        if (str_starts_with($audio->audio_url, '/storage/')) {
            $relativePath = str_replace('/storage/', '', $audio->audio_url);
            Storage::disk('public')->delete($relativePath);
        }

        $audio->delete();

        return response()->json(['message' => 'Feedback audio deleted successfully.']);
    }
}
