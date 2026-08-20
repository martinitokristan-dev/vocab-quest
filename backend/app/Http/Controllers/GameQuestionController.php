<?php

namespace App\Http\Controllers;

use App\Actions\AdvanceMapProgressionAction;
use App\Http\Resources\StudentQuestionResource;
use App\Models\Answer;
use App\Models\GameSession;
use App\Models\Question;
use App\Models\StudentAnswer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

// Phase 5 — High-Performance Student Gameplay Controller (RAM Caching & Zero-Lag)
class GameQuestionController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        /** @var GameSession $session */
        $session = $request->attributes->get('game_session');

        // Cache room status for 2 seconds — 500 students polling = 1 DB read per 2s not 500
        $roomStatus = Cache::remember("room_status_{$session->room_id}", 2, function () use ($session) {
            $room = $session->room()->first();
            return $room ? $room->status : 'closed';
        });

        return response()->json([
            'is_paused'    => $roomStatus === 'paused',
            'is_completed' => (bool) $session->is_completed,
            'room_status'  => $roomStatus,
            'score'        => $session->score,
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        /** @var GameSession $session */
        $session = $request->attributes->get('game_session');

        // Cache room status for 2 seconds per room
        $roomStatus = Cache::remember("room_status_{$session->room_id}", 2, function () use ($session) {
            $room = $session->room()->first();
            return $room ? $room->status : 'closed';
        });
        $isPaused = $roomStatus === 'paused';

        if ($session->is_completed) {
            return response()->json([
                'message'       => 'Session completed. No more questions available.',
                'is_completed'  => true,
                'total_correct' => $session->score,
                'is_paused'     => $isPaused,
                'room_status'   => $roomStatus,
            ]);
        }

        // Retrieve static stage questions from in-memory file cache (1ms response)
        $mapQuestions = Cache::remember("map_questions_{$session->current_map_id}", 3600, function () use ($session) {
            return Question::where('map_id', $session->current_map_id)
                ->with('answers')
                ->orderBy('order_index')
                ->get();
        });

        // Single query for all correct student answers across all maps in the session
        $allAnswers = StudentAnswer::where('game_session_id', $session->id)
            ->where('is_correct', true)
            ->with('question:id,map_id,order_index,highlighted_word')
            ->get();

        // Check against all answered question IDs so we never repeat a completed question
        $allAnsweredQuestionIds = $allAnswers->pluck('question_id');

        $nextQuestion = $mapQuestions->first(fn ($q) => ! $allAnsweredQuestionIds->contains($q->id));

        if (! $nextQuestion) {
            $advanceAction = app(AdvanceMapProgressionAction::class);
            $advancedSession = $advanceAction->execute($session);

            if ($advancedSession->is_completed) {
                return response()->json([
                    'message'       => 'Session completed. No more questions available.',
                    'is_completed'  => true,
                    'total_correct' => $advancedSession->score,
                    'is_paused'     => $isPaused,
                    'room_status'   => $roomStatus,
                ]);
            }

            $request->attributes->set('game_session', $advancedSession);
            return $this->show($request);
        }

        // Always sync score from actual sum of earned stars
        $actualScore = (int) $allAnswers->sum('stars');
        if ($session->score !== $actualScore) {
            $session->update(['score' => $actualScore]);
        }

        $completedQuestions = $allAnswers->map(fn ($sa) => [
            'question_id' => $sa->question_id,
            'map_id'      => $sa->question?->map_id ?? $sa->map_id,
            'order_index' => $sa->question?->order_index ?? 1,
            'word'        => $sa->question?->highlighted_word ?? '',
            'stars'       => $sa->stars ?? 3,
        ]);

        return response()->json([
            'data' => [
                'session'      => [
                    'score'        => $actualScore,
                    'is_completed' => false,
                ],
                'map'          => [
                    'id'                   => $session->currentMap->id,
                    'order_index'          => $session->currentMap->order_index,
                    'title'                => $session->currentMap->title,
                    'total_questions'      => $mapQuestions->count(),
                    'current_question_num' => $nextQuestion->order_index,
                ],
                'question'            => new StudentQuestionResource($nextQuestion),
                'completed_questions' => $completedQuestions,
                'is_paused'           => $isPaused,
                'room_status'         => $roomStatus,
            ],
        ]);
    }

    public function answer(Request $request): JsonResponse
    {
        /** @var GameSession $session */
        $session = $request->attributes->get('game_session');

        // Check if teacher has paused the session
        $room = $session->room;
        if ($room && $room->status === 'paused') {
            throw ValidationException::withMessages([
                'room' => ['Session is currently paused by the teacher.'],
            ]);
        }

        if ($session->is_completed) {
            throw ValidationException::withMessages([
                'game_session' => ['Session is already completed.'],
            ]);
        }

        $validated = $request->validate([
            'question_id' => ['required', 'exists:questions,id'],
            'answer_id'   => ['required', 'exists:answers,id'],
            'stars'       => ['nullable', 'integer', 'min:0', 'max:3'],
            'attempts'    => ['nullable', 'integer', 'min:1'],
        ]);

        $question = Question::findOrFail($validated['question_id']);
        $answer   = Answer::findOrFail($validated['answer_id']);

        // Idempotent: If student already completed this question, return success gracefully
        $alreadyCompleted = StudentAnswer::where('game_session_id', $session->id)
            ->where('question_id', $question->id)
            ->where('is_correct', true)
            ->exists();

        if ($alreadyCompleted) {
            return response()->json([
                'is_correct' => true,
                'score'      => $session->score,
                'message'    => 'Question already completed!',
            ]);
        }

        $isCorrect = $answer->is_correct;
        $starsAwarded = $isCorrect ? ($validated['stars'] ?? 1) : 0;
        $attemptsCount = $validated['attempts'] ?? 1;

        // Record or update student answer attempt with stars and attempts
        StudentAnswer::updateOrCreate(
            [
                'game_session_id' => $session->id,
                'question_id'     => $question->id,
            ],
            [
                'map_id'     => $question->map_id,
                'answer_id'  => $answer->id,
                'is_correct' => $isCorrect,
                'stars'      => $starsAwarded,
                'attempts'   => $attemptsCount,
            ]
        );

        // Recalculate total stars for session directly from sum of stars
        $totalSessionStars = (int) StudentAnswer::where('game_session_id', $session->id)
            ->where('is_correct', true)
            ->sum('stars');
        $session->update(['score' => $totalSessionStars]);

        return response()->json([
            'is_correct' => $isCorrect,
            'score'      => $totalSessionStars,
            'message'    => $isCorrect ? 'Correct answer!' : 'Incorrect answer. Try again!',
        ]);
    }
}
