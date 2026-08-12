<?php

namespace App\Actions;

use App\Models\Map;
use App\Models\VocabularyAudio;
use Illuminate\Validation\ValidationException;

// Phase 3 — Publish Gate Action (architecture.md §3, rules-and-validation §2)
// A map can ONLY be published if ALL publish criteria pass:
// 1. Background image present (background_url)
// 2. Character assigned to map (character)
// 3. All character expressions present (idle_url, correct_url, wrong_url)
// 4. Map contains >= 1 question
// 5. Every question has exactly 1 correct answer choice
// 6. Every question's highlighted word has APPROVED vocabulary audio
class PublishMapAction
{
    public function execute(Map $map): Map
    {
        $map->load(['character', 'questions.answers']);

        $errors = [];

        // Rule 1: Background image present
        if (empty($map->background_url)) {
            $errors['background_url'] = ['Map requires a background image before publishing.'];
        }

        // Rule 2 & 3: Character and all 3 expression images present
        if (! $map->character) {
            $errors['character'] = ['Map requires a character assigned to it before publishing.'];
        } else {
            if (empty($map->character->idle_url)) {
                $errors['character.idle_url'] = ['Character idle expression image is missing.'];
            }
            if (empty($map->character->correct_url)) {
                $errors['character.correct_url'] = ['Character correct expression image is missing.'];
            }
            if (empty($map->character->wrong_url)) {
                $errors['character.wrong_url'] = ['Character wrong expression image is missing.'];
            }
        }

        // Rule 4: At least 1 question
        if ($map->questions->isEmpty()) {
            $errors['questions'] = ['Map must contain at least one question before publishing.'];
        }

        // Rule 5 & 6: Check every question's answers and approved audio
        foreach ($map->questions as $index => $question) {
            $correctAnswers = $question->answers->where('is_correct', true)->count();
            if ($correctAnswers !== 1) {
                $errors["questions.{$index}.correct_answer"] = [
                    "Question #{$question->order_index} must have exactly one correct answer choice.",
                ];
            }

            $hasApprovedAudio = VocabularyAudio::whereHas('vocabulary', function ($q) use ($question) {
                $q->where('word', strtolower($question->highlighted_word));
            })->where('status', 'approved')->exists();

            if (! $hasApprovedAudio) {
                $errors["questions.{$index}.approved_audio"] = [
                    "Question #{$question->order_index} highlighted word '{$question->highlighted_word}' requires approved TTS audio before publishing.",
                ];
            }
        }

        if (! empty($errors)) {
            throw ValidationException::withMessages($errors);
        }

        $map->update(['published' => true]);

        return $map->fresh();
    }
}
