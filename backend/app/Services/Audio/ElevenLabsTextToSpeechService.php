<?php

namespace App\Services\Audio;

use App\Contracts\Services\TextToSpeechContract;
use Illuminate\Support\Facades\Http;
use Throwable;

// Phase 4 — ElevenLabs TTS Service (100% Free Tier - 10k chars/mo, with automatic free web fallback)
class ElevenLabsTextToSpeechService implements TextToSpeechContract
{
    public function __construct(
        private string $apiKey,
        private string $voiceId = '21m00Tcm4TlvDq8ikWAM' // Default voice: Rachel
    ) {}

    public function generate(string $word, string $language = 'en-US'): string
    {
        if (! empty($this->apiKey)) {
            try {
                $response = Http::withHeaders([
                    'xi-api-key'   => $this->apiKey,
                    'Content-Type' => 'application/json',
                    'Accept'       => 'audio/mpeg',
                ])->post("https://api.elevenlabs.io/v1/text-to-speech/{$this->voiceId}", [
                    'text'           => $word,
                    'model_id'       => 'eleven_flash_v2_5',
                    'voice_settings' => [
                        'stability'        => 0.5,
                        'similarity_boost' => 0.75,
                    ],
                ]);

                if ($response->successful() && strlen($response->body()) > 100) {
                    return $response->body();
                }

                \Log::warning('elevenlabs_tts_failed_fallback', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                    'word'   => $word,
                ]);
            } catch (Throwable $e) {
                \Log::warning('elevenlabs_tts_exception_fallback', [
                    'word'  => $word,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Automatic fallback to free web TTS
        return (new FreeWebTextToSpeechService())->generate($word, $language);
    }
}
