<?php

namespace App\Jobs;

use App\Contracts\Services\CloudinaryAudioContract;
use App\Contracts\Services\TextToSpeechContract;
use App\Models\Vocabulary;
use App\Models\VocabularyAudio;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

// Phase 4 — Queued TTS Generation Job (architecture.md §3, rules-and-validation §1)
class GenerateVocabularyAudio implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Vocabulary $vocabulary
    ) {}

    public function handle(
        TextToSpeechContract $ttsService,
        CloudinaryAudioContract $cloudinaryService
    ): void {
        try {
            $rawAudio = $ttsService->generate($this->vocabulary->word, config('tts.language', 'en-US'));

            $uploadResult = $cloudinaryService->uploadAudio(
                $rawAudio,
                "vocab_audio/{$this->vocabulary->word}"
            );

            VocabularyAudio::create([
                'vocabulary_id'        => $this->vocabulary->id,
                'url'                  => $uploadResult['url'],
                'cloudinary_public_id' => $uploadResult['public_id'],
                'status'               => 'pending_review',
            ]);

            \Log::info('tts_audio_generated', [
                'vocabulary_id' => $this->vocabulary->id,
                'word'          => $this->vocabulary->word,
                'url'           => $uploadResult['url'],
            ]);
        } catch (Throwable $e) {
            \Log::error('tts_failure', [
                'vocabulary_id' => $this->vocabulary->id,
                'word'          => $this->vocabulary->word,
                'error'         => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
