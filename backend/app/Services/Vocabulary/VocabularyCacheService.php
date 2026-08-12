<?php

namespace App\Services\Vocabulary;

use App\Jobs\GenerateVocabularyAudio;
use App\Models\Vocabulary;
use App\Models\VocabularyAudio;

// Phase 4 — Vocabulary Audio Caching Service (architecture.md §3, rules-and-validation §1)
class VocabularyCacheService
{
    /**
     * Check if an APPROVED audio clip exists for the target word.
     * If MISS (missing or rejected): queue background TTS generation job.
     */
    public function getOrTriggerAudio(string $word): ?VocabularyAudio
    {
        $normalizedWord = strtolower(trim($word));

        $vocab = Vocabulary::firstOrCreate(['word' => $normalizedWord]);

        $approvedAudio = VocabularyAudio::where('vocabulary_id', $vocab->id)
            ->where('status', 'approved')
            ->latest()
            ->first();

        if ($approvedAudio) {
            return $approvedAudio;
        }

        // Cache MISS — queue background synthesis job if not already pending
        $hasPending = VocabularyAudio::where('vocabulary_id', $vocab->id)
            ->where('status', 'pending_review')
            ->exists();

        if (! $hasPending) {
            GenerateVocabularyAudio::dispatch($vocab);

            \Log::info('tts_generation_queued', [
                'vocabulary_id' => $vocab->id,
                'word'          => $vocab->word,
            ]);
        }

        return null;
    }
}
