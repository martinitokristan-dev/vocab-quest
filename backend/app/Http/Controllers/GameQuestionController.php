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
use Illuminate\Validation\ValidationException;

// Phase 5 — Student Gameplay Controller (architecture.md §6, rules-and-validation §4 + §5)
class GameQuestionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var GameSession $session */
        $session = $request->attributes->get('game_session');

        if ($session->is_completed) {
            return response()->json([
                'message'       => 'Session completed. No more questions available.',
                'is_completed'  => true,
                'total_correct' => $session->score,
            ]);
        }

        // Get answered questions that were completed correctly on the student's current map
        $answeredIds = StudentAnswer::where('game_session_id', $session->id)
            ->where('map_id', $session->current_map_id)
            ->where('is_correct', true)
            ->pluck('question_id');

        $nextQuestion = Question::where('map_id', $session->current_map_id)
            ->whereNotIn('id', $answeredIds)
            ->orderBy('order_index')
            ->first();

        if (! $nextQuestion) {
            $advanceAction = app(AdvanceMapProgressionAction::class);
            $advancedSession = $advanceAction->execute($session);

            if ($advancedSession->is_completed) {
                return response()->json([
                    'message'       => 'Session completed. No more questions available.',
                    'is_completed'  => true,
                    'total_correct' => $advancedSession->score,
                ]);
            }

            // Update the request attribute to the fresh session before recursing
            $request->attributes->set('game_session', $advancedSession);

            return $this->show($request);
        }

        return response()->json([
            'data' => [
                'session'      => [
                    'score'        => $session->score,
                    'is_completed' => false,
                ],
                'map'          => [
                    'id'          => $session->currentMap->id,
                    'order_index' => $session->currentMap->order_index,
                    'title'       => $session->currentMap->title,
                ],
                'question'     => new StudentQuestionResource($nextQuestion),
            ],
        ]);
    }

    public function answer(Request $request): JsonResponse
    {
        /** @var GameSession $session */
        $session = $request->attributes->get('game_session');

        if ($session->is_completed) {
            throw ValidationException::withMessages([
                'game_session' => ['Session is already completed.'],
            ]);
        }

        $validated = $request->validate([
            'question_id' => ['required', 'exists:questions,id'],
            'answer_id'   => ['required', 'exists:answers,id'],
        ]);

        $question = Question::findOrFail($validated['question_id']);
        $answer   = Answer::findOrFail($validated['answer_id']);

        // rules-and-validation §5: Prevent duplicate answers once correctly completed
        $alreadyCompleted = StudentAnswer::where('game_session_id', $session->id)
            ->where('question_id', $question->id)
            ->where('is_correct', true)
            ->exists();

        if ($alreadyCompleted) {
            throw ValidationException::withMessages([
                'question_id' => ['You have already submitted a correct answer for this question.'],
            ]);
        }

        $isCorrect = $answer->is_correct;

        // Record or update student answer attempt
        StudentAnswer::updateOrCreate(
            [
                'game_session_id' => $session->id,
                'question_id'     => $question->id,
            ],
            [
                'map_id'     => $session->current_map_id,
                'answer_id'  => $answer->id,
                'is_correct' => $isCorrect,
            ]
        );

        // Increment score if correct
        if ($isCorrect) {
            $session->increment('score');
        }

        return response()->json([
            'is_correct' => $isCorrect,
            'score'      => $session->fresh()->score,
            'message'    => $isCorrect ? 'Correct answer!' : 'Incorrect answer. Try again!',
        ]);
    }
}
