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

        if ($map->questions()->count() >= 5) {
            throw ValidationException::withMessages([
                'questions' => ['Limit reached: Each kingdom stage can only have a maximum of 5 questions.'],
            ]);
        }

        // Support FormData JSON decoding for answers
        if (is_string($request->input('answers'))) {
            $decoded = json_decode($request->input('answers'), true);
            if (is_array($decoded)) {
                $request->merge(['answers' => $decoded]);
            }
        }

        $questionType = $request->input('question_type', 'multiple_choice');

        $validated = $request->validate([
            'order_index'                => ['required', 'integer', 'min:1'],
            'question_type'              => ['nullable', 'string', 'in:multiple_choice,identification'],
            'sentence'                   => ['required', 'string'],
            'highlighted_word'           => ['required', 'string'],
            'context_clue'               => ['nullable', 'string'],
            'image_url'                  => ['nullable', 'string'],
            'image'                      => ['nullable', 'file'],           // no size/type limit — Cloudinary handles storage
            'image_file'                 => ['nullable', 'file'],
            'image_cloudinary_public_id' => ['nullable', 'string'],
            'voice_audio_url'            => ['nullable', 'string'],
            'voice_audio'                => ['nullable', 'file'],            // no size limit
            'voice_audio_file'           => ['nullable', 'file'],
            'voice_video_url'            => ['nullable', 'string'],
            'voice_video'                => ['nullable', 'file'],            // no size limit
            'voice_video_file'           => ['nullable', 'file'],
            'voice_media_type'           => ['nullable', 'string', 'in:audio,video,none'],
            'answers'                    => [$questionType === 'identification' ? 'nullable' : 'required', 'array', $questionType === 'identification' ? 'min:1' : 'min:2', 'max:4'],
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

        // Strict 1-voiceover validation: cannot have both audio and video
        if (! empty($voiceAudioUrl) && ! empty($voiceVideoUrl)) {
            throw ValidationException::withMessages([
                'voiceover' => ['Only 1 voiceover is allowed per question (either audio or video).'],
            ]);
        }

        $voiceMediaType = 'none';
        if ($voiceVideoUrl) {
            $voiceMediaType = 'video';
            $voiceAudioUrl = null;
        } elseif ($voiceAudioUrl) {
            $voiceMediaType = 'audio';
            $voiceVideoUrl = null;
        }

        // rules-and-validation §3: highlighted_word must exist inside sentence
        if (! str_contains(strtolower($validated['sentence']), strtolower($validated['highlighted_word']))) {
            throw ValidationException::withMessages([
                'highlighted_word' => ["The sentence must contain the highlighted word '{$validated['highlighted_word']}'."],
            ]);
        }

        $answersList = $validated['answers'] ?? [];
        if ($questionType === 'identification') {
            if (empty($answersList)) {
                $answersList = [
                    ['text' => strtolower($validated['highlighted_word']), 'is_correct' => true],
                ];
            } else {
                $answersList = array_map(fn ($a) => ['text' => $a['text'], 'is_correct' => true], $answersList);
            }
        } else {
            // rules-and-validation §3: exactly ONE correct answer required
            $correctCount = collect($answersList)->where('is_correct', true)->count();
            if ($correctCount !== 1) {
                throw ValidationException::withMessages([
                    'answers' => ['Multiple choice questions must have exactly one correct answer choice.'],
                ]);
            }
        }

        $question = $map->questions()->create([
            'order_index'                => $validated['order_index'],
            'question_type'              => $questionType,
            'sentence'                   => $validated['sentence'],
            'highlighted_word'           => strtolower($validated['highlighted_word']),
            'context_clue'               => $validated['context_clue'] ?? null,
            'image_url'                  => $imageUrl,
            'image_cloudinary_public_id' => $imagePublicId,
            'voice_audio_url'            => $voiceAudioUrl,
            'voice_video_url'            => $voiceVideoUrl,
            'voice_media_type'           => $voiceMediaType,
            'has_context_highlight'      => true,
            'has_image'                  => ! empty($imageUrl),
        ]);

        foreach ($answersList as $ans) {
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

        $questionType = $request->input('question_type', $question->question_type ?? 'multiple_choice');

        $validated = $request->validate([
            'order_index'                => ['sometimes', 'required', 'integer', 'min:1'],
            'question_type'              => ['nullable', 'string', 'in:multiple_choice,identification'],
            'sentence'                   => ['sometimes', 'required', 'string'],
            'highlighted_word'           => ['sometimes', 'required', 'string'],
            'context_clue'               => ['nullable', 'string'],
            'image_url'                  => ['nullable', 'string'],
            'image'                      => ['nullable', 'file'],           // no size/type limit
            'image_file'                 => ['nullable', 'file'],
            'image_cloudinary_public_id' => ['nullable', 'string'],
            'voice_audio_url'            => ['nullable', 'string'],
            'voice_audio'                => ['nullable', 'file'],
            'voice_audio_file'           => ['nullable', 'file'],
            'voice_video_url'            => ['nullable', 'string'],
            'voice_video'                => ['nullable', 'file'],
            'voice_video_file'           => ['nullable', 'file'],
            'voice_media_type'           => ['nullable', 'string', 'in:audio,video,none'],
            'answers'                    => ['sometimes', 'required', 'array', $questionType === 'identification' ? 'min:1' : 'min:2', 'max:4'],
            'answers.*.text'             => ['required', 'string'],
            'answers.*.is_correct'       => ['required', 'boolean'],
        ]);

        $imageUrl = array_key_exists('image_url', $validated)
            ? ($validated['image_url'] ?: null)
            : $question->image_url;
        $imagePublicId = $validated['image_cloudinary_public_id'] ?? $question->image_cloudinary_public_id;
        $imageFile = $request->file('image') ?? $request->file('image_file');
        if ($imageFile) {
            $upload = $this->cloudinaryService->uploadFile($imageFile, 'questions/images', 'image');
            $imageUrl = $upload['url'];
            $imagePublicId = $upload['public_id'];
        }
        if (empty($imageUrl)) {
            $imagePublicId = null;
        }

        $voiceAudioUrl = array_key_exists('voice_audio_url', $validated)
            ? ($validated['voice_audio_url'] ?: null)
            : $question->voice_audio_url;
        $audioFile = $request->file('voice_audio') ?? $request->file('voice_audio_file');
        if ($audioFile) {
            $upload = $this->cloudinaryService->uploadFile($audioFile, 'questions/audio', 'video');
            $voiceAudioUrl = $upload['url'];
            // Auto-replace: clear video if new audio uploaded
            $voiceVideoUrl = null;
        }

        $voiceVideoUrl = array_key_exists('voice_video_url', $validated)
            ? ($validated['voice_video_url'] ?: null)
            : (isset($voiceVideoUrl) ? $voiceVideoUrl : $question->voice_video_url);
        $videoFile = $request->file('voice_video') ?? $request->file('voice_video_file');
        if ($videoFile) {
            $upload = $this->cloudinaryService->uploadFile($videoFile, 'questions/video', 'video');
            $voiceVideoUrl = $upload['url'];
            // Auto-replace: clear audio if new video uploaded
            $voiceAudioUrl = null;
        }

        // Strict 1-voiceover validation: if client attempts to keep or send both
        if (! empty($voiceAudioUrl) && ! empty($voiceVideoUrl)) {
            throw ValidationException::withMessages([
                'voiceover' => ['Only 1 voiceover is allowed per question (either audio or video). Please delete one.'],
            ]);
        }

        if ($voiceVideoUrl) {
            $voiceMediaType = 'video';
            $voiceAudioUrl = null;
        } elseif ($voiceAudioUrl) {
            $voiceMediaType = 'audio';
            $voiceVideoUrl = null;
        } else {
            $voiceMediaType = 'none';
            $voiceAudioUrl = null;
            $voiceVideoUrl = null;
        }

        $sentence = $validated['sentence'] ?? $question->sentence;
        $word     = isset($validated['highlighted_word']) ? strtolower($validated['highlighted_word']) : $question->highlighted_word;

        if (! str_contains(strtolower($sentence), $word)) {
            throw ValidationException::withMessages([
                'highlighted_word' => ["The sentence must contain the highlighted word '{$word}'."],
            ]);
        }

        if (isset($validated['answers'])) {
            $answersList = $validated['answers'];
            if ($questionType === 'identification') {
                $answersList = array_map(fn ($a) => ['text' => $a['text'], 'is_correct' => true], $answersList);
            } else {
                $correctCount = collect($answersList)->where('is_correct', true)->count();
                if ($correctCount !== 1) {
                    throw ValidationException::withMessages([
                        'answers' => ['Question must have exactly one correct answer choice.'],
                    ]);
                }
            }

            $question->answers()->delete();
            foreach ($answersList as $ans) {
                $question->answers()->create($ans);
            }
        }

        $question->update([
            'order_index'                => $validated['order_index'] ?? $question->order_index,
            'question_type'              => $questionType,
            'sentence'                   => $sentence,
            'highlighted_word'           => $word,
            'context_clue'               => array_key_exists('context_clue', $validated) ? $validated['context_clue'] : $question->context_clue,
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

        // Auto-cleanup uploaded Cloudinary media to keep free storage clean
        if (! empty($question->image_cloudinary_public_id)) {
            try {
                $this->cloudinaryService->deleteFile($question->image_cloudinary_public_id, 'image');
            } catch (\Throwable) {}
        }

        $map = $question->map;
        $question->delete();

        $map->update(['question_count' => $map->questions()->count()]);
        Cache::forget("map_questions_{$map->id}");

        return response()->json(null, 204);
    }
}
