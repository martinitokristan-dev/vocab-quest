<?php

namespace App\Contracts\Services;

// Phase 4 — TTS Pipeline (architecture.md §9 Phase 4)
interface TextToSpeechContract
{
    public function generate(string $word, string $language = 'en-US'): string;
}
