<?php

namespace App\Http\Controllers;

use App\Http\Resources\QuestionResource;
use App\Models\Map;
use App\Models\Question;
use App\Services\Vocabulary\VocabularyCacheService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

// Phase 3 — Question Controller (architecture.md §6)
class QuestionController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly VocabularyCacheService $vocabCache
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
            'order_index'               => ['required', 'integer', 'min:1'],
            'sentence'                  => ['required', 'string'],
            'highlighted_word'          => ['required', 'string'],
            'image_url'                 => ['nullable', 'string'],
            'image'                     => ['nullable', 'image', 'max:5120'], // 5MB max
            'image_file'                => ['nullable', 'image', 'max:5120'],
            'image_cloudinary_public_id' => ['nullable', 'string'],
            'answers'                   => ['required', 'array', 'min:2', 'max:4'],
            'answers.*.text'            => ['required', 'string'],
            'answers.*.is_correct'      => ['required', 'boolean'],
        ]);

        // Handle uploaded file if present
        $imageUrl = $validated['image_url'] ?? null;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('questions', 'public');
            $imageUrl = asset('storage/' . $path);
        } elseif ($request->hasFile('image_file')) {
            $path = $request->file('image_file')->store('questions', 'public');
            $imageUrl = asset('storage/' . $path);
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
            'image_cloudinary_public_id' => $validated['image_cloudinary_public_id'] ?? null,
            'has_context_highlight'      => true,
            'has_image'                  => ! empty($imageUrl),
        ]);

        foreach ($validated['answers'] as $ans) {
            $question->answers()->create($ans);
        }

        // Update map question count
        $map->update(['question_count' => $map->questions()->count()]);

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
            'answers'                    => ['sometimes', 'required', 'array', 'min:2', 'max:4'],
            'answers.*.text'             => ['required', 'string'],
            'answers.*.is_correct'       => ['required', 'boolean'],
        ]);

        $imageUrl = $validated['image_url'] ?? $question->image_url;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('questions', 'public');
            $imageUrl = asset('storage/' . $path);
        } elseif ($request->hasFile('image_file')) {
            $path = $request->file('image_file')->store('questions', 'public');
            $imageUrl = asset('storage/' . $path);
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
            'has_image'                  => ! empty($imageUrl),
        ]);

        $this->vocabCache->getOrTriggerAudio($word);

        $question->load('answers');

        return response()->json(['data' => new QuestionResource($question)]);
    }

    public function destroy(Question $question): JsonResponse
    {
        $this->authorize('delete', $question);

        $map = $question->map;
        $question->delete();

        $map->update(['question_count' => $map->questions()->count()]);

        return response()->json(null, 204);
    }
}
