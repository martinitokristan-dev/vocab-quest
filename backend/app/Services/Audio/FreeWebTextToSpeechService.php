<?php

namespace App\Services\Audio;

use App\Contracts\Services\TextToSpeechContract;
use Illuminate\Support\Facades\Http;
use Throwable;

// Phase 4 — Free Web TTS Service (100% Free - 0 API keys required, uses Google Translate TTS endpoint)
class FreeWebTextToSpeechService implements TextToSpeechContract
{
    public function generate(string $word, string $language = 'en-US'): string
    {
        $lang = explode('-', $language)[0] ?? 'en';
        $encodedWord = urlencode($word);
        $url = "https://translate.google.com/translate_tts?ie=UTF-8&q={$encodedWord}&tl={$lang}&client=tw-ob";

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            ])->get($url);

            if ($response->successful() && strlen($response->body()) > 100) {
                return $response->body();
            }
        } catch (Throwable $e) {
            \Log::warning('free_web_tts_fallback', ['word' => $word, 'error' => $e->getMessage()]);
        }

        return (new StubTextToSpeechService())->generate($word, $language);
    }
}
