<?php

namespace App\Providers;

use App\Contracts\Services\CloudinaryAudioContract;
use App\Contracts\Services\TextToSpeechContract;
use App\Services\Audio\ElevenLabsTextToSpeechService;
use App\Services\Audio\FreeWebTextToSpeechService;
use App\Services\Audio\StubTextToSpeechService;
use App\Services\Audio\VoiceRSSTextToSpeechService;
use App\Services\Cloudinary\CloudinaryService;
use App\Services\Cloudinary\StubCloudinaryService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // ── TTS binding ─────────────────────────────────────────────────────────
        $this->app->bind(TextToSpeechContract::class, function () {
            return match (config('tts.provider', 'free_web')) {
                'elevenlabs' => new ElevenLabsTextToSpeechService(
                    apiKey:  config('tts.elevenlabs.api_key', ''),
                    voiceId: config('tts.elevenlabs.voice_id', '21m00Tcm4TlvDq8ikWAM'),
                ),
                'voicerss' => new VoiceRSSTextToSpeechService(
                    apiKey: config('tts.voicerss.api_key', ''),
                ),
                'stub' => new StubTextToSpeechService(),
                default => new FreeWebTextToSpeechService(),
            };
        });

        // ── Cloudinary binding ───────────────────────────────────────────────────
        $this->app->bind(CloudinaryAudioContract::class, function () {
            $cloudName = config('services.cloudinary.cloud_name');
            $apiKey    = config('services.cloudinary.api_key');
            $apiSecret = config('services.cloudinary.api_secret');
            $preset    = config('services.cloudinary.upload_preset');

            if (!empty($cloudName) && !empty($apiKey) && !empty($apiSecret)) {
                return new CloudinaryService(
                    cloudName: $cloudName,
                    apiKey:    $apiKey,
                    apiSecret: $apiSecret,
                    preset:    $preset
                );
            }

            return new StubCloudinaryService();
        });
    }

    public function boot(): void
    {
        //
    }
}
