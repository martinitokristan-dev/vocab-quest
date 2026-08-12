<?php

// Phase 4 — TTS config (mapped from .env entries set in .env.example / README)
return [

    /*
    |--------------------------------------------------------------------------
    | TTS Provider
    |--------------------------------------------------------------------------
    | Options: 'stub' | 'elevenlabs' | 'voicerss' | 'google'
    | Set TTS_PROVIDER in your .env file
    */
    'provider' => env('TTS_PROVIDER', 'stub'),

    /*
    |--------------------------------------------------------------------------
    | Language / Locale
    |--------------------------------------------------------------------------
    | BCP-47 language tag, e.g. 'en-US', 'fil-PH'
    */
    'language' => env('TTS_LANGUAGE', 'en-US'),

    /*
    |--------------------------------------------------------------------------
    | ElevenLabs Configuration
    |--------------------------------------------------------------------------
    */
    'elevenlabs' => [
        'api_key'  => env('ELEVENLABS_API_KEY', ''),
        'voice_id' => env('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),
    ],

    /*
    |--------------------------------------------------------------------------
    | VoiceRSS Configuration
    |--------------------------------------------------------------------------
    */
    'voicerss' => [
        'api_key' => env('VOICERSS_API_KEY', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | Google Cloud TTS Configuration
    |--------------------------------------------------------------------------
    */
    'google' => [
        'api_key' => env('GOOGLE_TTS_API_KEY', ''),
    ],
];
