<?php

namespace App\Services\Audio;

use App\Contracts\Services\TextToSpeechContract;
use App\Services\Audio\ElevenLabsTextToSpeechService;
use App\Services\Audio\StubTextToSpeechService;
use App\Services\Audio\VoiceRSSTextToSpeechService;

// Phase 4 — Factory helper: resolves the configured TTS implementation
class TextToSpeechService
{
    public static function make(): TextToSpeechContract
    {
        return match (config('tts.provider', 'stub')) {
            'elevenlabs' => new ElevenLabsTextToSpeechService(
                apiKey:  config('tts.elevenlabs.api_key', ''),
                voiceId: config('tts.elevenlabs.voice_id', '21m00Tcm4TlvDq8ikWAM'),
            ),
            'voicerss' => new VoiceRSSTextToSpeechService(
                apiKey: config('tts.voicerss.api_key', ''),
            ),
            default => new StubTextToSpeechService(),
        };
    }
}
