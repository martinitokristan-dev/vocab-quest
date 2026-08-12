<?php

namespace App\Services\Audio;

use App\Contracts\Services\TextToSpeechContract;
use Illuminate\Support\Facades\Http;
use Throwable;

// Phase 4 — VoiceRSS TTS Service (with automatic free web fallback)
class VoiceRSSTextToSpeechService implements TextToSpeechContract
{
    public function __construct(
        private string $apiKey
    ) {}

    public function generate(string $word, string $language = 'en-US'): string
    {
        if (! empty($this->apiKey)) {
            try {
                $response = Http::get('https://api.voicerss.org/', [
                    'key' => $this->apiKey,
                    'hl'  => strtolower($language),
                    'src' => $word,
                    'c'   => 'mp3',
                    'f'   => '44khz_16bit_stereo',
                ]);

                if ($response->successful() && ! str_starts_with($response->body(), 'ERROR:')) {
                    return $response->body();
                }

                \Log::warning('voicerss_tts_failed_fallback', [
                    'body' => $response->body(),
                    'word' => $word,
                ]);
            } catch (Throwable $e) {
                \Log::warning('voicerss_tts_exception_fallback', [
                    'word'  => $word,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return (new FreeWebTextToSpeechService())->generate($word, $language);
    }
}
