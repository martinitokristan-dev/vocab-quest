<?php

namespace App\Http\Controllers;

use App\Contracts\Services\CloudinaryAudioContract;
use App\Http\Resources\QuestionResource;
use App\Models\Map;
use App\Models\Question;
use App\Services\Vocabulary\VocabularyCacheService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

// Phase 3 — Question Controller (architecture.md §6)
class QuestionController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly VocabularyCacheService $vocabCache,
        private readonly CloudinaryAudioContract $cloudinaryService
    ) {}

    public function index(Map $map): JsonResponse
    {
        $this->authorize('view', $map);

        $questions = $map->questions()->with('answers')->get();

        return response()->json(['data' => QuestionResource::collection($questions)]);
    }

    public function store(Request $request, Map $map): JsonResponse
    {
        $this->authorize('update', $map);

        // Support FormData JSON decoding for answers
        if (is_string($request->input('answers'))) {
            $decoded = json_decode($request->input('answers'), true);
            if (is_array($decoded)) {
                $request->merge(['answers' => $decoded]);
            }
        }

        $validated = $request->validate([
            'order_index'                => ['required', 'integer', 'min:1'],
            'sentence'                   => ['required', 'string'],
            'highlighted_word'           => ['required', 'string'],
            'image_url'                  => ['nullable', 'string'],
            'image'                      => ['nullable', 'image', 'max:5120'], // 5MB max
            'image_file'                 => ['nullable', 'image', 'max:5120'],
            'image_cloudinary_public_id' => ['nullable', 'string'],
            'voice_audio_url'            => ['nullable', 'string'],
            'voice_audio'                => ['nullable', 'file', 'max:25600'], // 25MB max
            'voice_audio_file'           => ['nullable', 'file', 'max:25600'],
            'voice_video_url'            => ['nullable', 'string'],
            'voice_video'                => ['nullable', 'file', 'max:51200'], // 50MB max
            'voice_video_file'           => ['nullable', 'file', 'max:51200'],
            'voice_media_type'           => ['nullable', 'string', 'in:audio,video,none'],
            'answers'                    => ['required', 'array', 'min:2', 'max:4'],
            'answers.*.text'             => ['required', 'string'],
            'answers.*.is_correct'       => ['required', 'boolean'],
        ]);

        // Handle uploaded image file if present
        $imageUrl = $validated['image_url'] ?? null;
        $imagePublicId = $validated['image_cloudinary_public_id'] ?? null;
        $imageFile = $request->file('image') ?? $request->file('image_file');
        if ($imageFile) {
            $upload = $this->cloudinaryService->uploadFile($imageFile, 'questions/images', 'image');
            $imageUrl = $upload['url'];
            $imagePublicId = $upload['public_id'];
        }

        // Handle uploaded voice audio file if present
        $voiceAudioUrl = $validated['voice_audio_url'] ?? null;
        $audioFile = $request->file('voice_audio') ?? $request->file('voice_audio_file');
        if ($audioFile) {
            $upload = $this->cloudinaryService->uploadFile($audioFile, 'questions/audio', 'video');
            $voiceAudioUrl = $upload['url'];
        }

        // Handle uploaded voice video file if present
        $voiceVideoUrl = $validated['voice_video_url'] ?? null;
        $videoFile = $request->file('voice_video') ?? $request->file('voice_video_file');
        if ($videoFile) {
            $upload = $this->cloudinaryService->uploadFile($videoFile, 'questions/video', 'video');
            $voiceVideoUrl = $upload['url'];
        }

        $voiceMediaType = $validated['voice_media_type'] ?? 'none';
        if ($voiceVideoUrl) {
            $voiceMediaType = 'video';
        } elseif ($voiceAudioUrl) {
            $voiceMediaType = 'audio';
        }

        // rules-and-validation §3: highlighted_word must exist inside sentence
        if (! str_contains(strtolower($validated['sentence']), strtolower($validated['highlighted_word']))) {
            throw ValidationException::withMessages([
                'highlighted_word' => ["The sentence must contain the highlighted word '{$validated['highlighted_word']}'."],
            ]);
        }

        // rules-and-validation §3: exactly ONE correct answer required
        $correctCount = collect($validated['answers'])->where('is_correct', true)->count();
        if ($correctCount !== 1) {
            throw ValidationException::withMessages([
                'answers' => ['Question must have exactly one correct answer choice.'],
            ]);
        }

        $question = $map->questions()->create([
            'order_index'                => $validated['order_index'],
            'sentence'                   => $validated['sentence'],
            'highlighted_word'           => strtolower($validated['highlighted_word']),
            'image_url'                  => $imageUrl,
            'image_cloudinary_public_id' => $imagePublicId,
            'voice_audio_url'            => $voiceAudioUrl,
            'voice_video_url'            => $voiceVideoUrl,
            'voice_media_type'           => $voiceMediaType,
            'has_context_highlight'      => true,
            'has_image'                  => ! empty($imageUrl),
        ]);

        foreach ($validated['answers'] as $ans) {
            $question->answers()->create($ans);
        }

        // Update map question count and clear in-memory questions cache
        $map->update(['question_count' => $map->questions()->count()]);
        Cache::forget("map_questions_{$map->id}");

        // Phase 4 — Auto-check vocabulary audio cache for highlighted word
        $this->vocabCache->getOrTriggerAudio(strtolower($validated['highlighted_word']));

        $question->load('answers');

        return response()->json(['data' => new QuestionResource($question)], 201);
    }

    public function show(Question $question): JsonResponse
    {
        $this->authorize('view', $question);

        $question->load('answers');

        return response()->json(['data' => new QuestionResource($question)]);
    }

    public function update(Request $request, Question $question): JsonResponse
    {
        $this->authorize('update', $question);

        if (is_string($request->input('answers'))) {
            $decoded = json_decode($request->input('answers'), true);
            if (is_array($decoded)) {
                $request->merge(['answers' => $decoded]);
            }
        }

        $validated = $request->validate([
            'order_index'                => ['sometimes', 'required', 'integer', 'min:1'],
            'sentence'                   => ['sometimes', 'required', 'string'],
            'highlighted_word'           => ['sometimes', 'required', 'string'],
            'image_url'                  => ['nullable', 'string'],
            'image'                      => ['nullable', 'image', 'max:5120'],
            'image_file'                 => ['nullable', 'image', 'max:5120'],
            'image_cloudinary_public_id' => ['nullable', 'string'],
            'voice_audio_url'            => ['nullable', 'string'],
            'voice_audio'                => ['nullable', 'file', 'max:25600'],
            'voice_audio_file'           => ['nullable', 'file', 'max:25600'],
            'voice_video_url'            => ['nullable', 'string'],
            'voice_video'                => ['nullable', 'file', 'max:51200'],
            'voice_video_file'           => ['nullable', 'file', 'max:51200'],
            'voice_media_type'           => ['nullable', 'string', 'in:audio,video,none'],
            'answers'                    => ['sometimes', 'required', 'array', 'min:2', 'max:4'],
            'answers.*.text'             => ['required', 'string'],
            'answers.*.is_correct'       => ['required', 'boolean'],
        ]);

        $imageUrl = $validated['image_url'] ?? $question->image_url;
        $imagePublicId = $validated['image_cloudinary_public_id'] ?? $question->image_cloudinary_public_id;
        $imageFile = $request->file('image') ?? $request->file('image_file');
        if ($imageFile) {
            $upload = $this->cloudinaryService->uploadFile($imageFile, 'questions/images', 'image');
            $imageUrl = $upload['url'];
            $imagePublicId = $upload['public_id'];
        }

        $voiceAudioUrl = array_key_exists('voice_audio_url', $validated) ? $validated['voice_audio_url'] : $question->voice_audio_url;
        $audioFile = $request->file('voice_audio') ?? $request->file('voice_audio_file');
        if ($audioFile) {
            $upload = $this->cloudinaryService->uploadFile($audioFile, 'questions/audio', 'video');
            $voiceAudioUrl = $upload['url'];
        }

        $voiceVideoUrl = array_key_exists('voice_video_url', $validated) ? $validated['voice_video_url'] : $question->voice_video_url;
        $videoFile = $request->file('voice_video') ?? $request->file('voice_video_file');
        if ($videoFile) {
            $upload = $this->cloudinaryService->uploadFile($videoFile, 'questions/video', 'video');
            $voiceVideoUrl = $upload['url'];
        }

        $voiceMediaType = $validated['voice_media_type'] ?? $question->voice_media_type;
        if ($voiceVideoUrl) {
            $voiceMediaType = 'video';
        } elseif ($voiceAudioUrl) {
            $voiceMediaType = 'audio';
        } elseif (! $voiceAudioUrl && ! $voiceVideoUrl) {
            $voiceMediaType = 'none';
        }

        $sentence = $validated['sentence'] ?? $question->sentence;
        $word     = isset($validated['highlighted_word']) ? strtolower($validated['highlighted_word']) : $question->highlighted_word;

        if (! str_contains(strtolower($sentence), $word)) {
            throw ValidationException::withMessages([
                'highlighted_word' => ["The sentence must contain the highlighted word '{$word}'."],
            ]);
        }

        if (isset($validated['answers'])) {
            $correctCount = collect($validated['answers'])->where('is_correct', true)->count();
            if ($correctCount !== 1) {
                throw ValidationException::withMessages([
                    'answers' => ['Question must have exactly one correct answer choice.'],
                ]);
            }

            $question->answers()->delete();
            foreach ($validated['answers'] as $ans) {
                $question->answers()->create($ans);
            }
        }

        $question->update([
            'order_index'                => $validated['order_index'] ?? $question->order_index,
            'sentence'                   => $sentence,
            'highlighted_word'           => $word,
            'image_url'                  => $imageUrl,
            'image_cloudinary_public_id' => $validated['image_cloudinary_public_id'] ?? $question->image_cloudinary_public_id,
            'voice_audio_url'            => $voiceAudioUrl,
            'voice_video_url'            => $voiceVideoUrl,
            'voice_media_type'           => $voiceMediaType,
            'has_image'                  => ! empty($imageUrl),
        ]);

        $this->vocabCache->getOrTriggerAudio($word);
        Cache::forget("map_questions_{$question->map_id}");

        $question->load('answers');

        return response()->json(['data' => new QuestionResource($question)]);
    }

    public function destroy(Question $question): JsonResponse
    {
        $this->authorize('delete', $question);

        $map = $question->map;
        $question->delete();

        $map->update(['question_count' => $map->questions()->count()]);
        Cache::forget("map_questions_{$map->id}");

        return response()->json(null, 204);
    }
}
