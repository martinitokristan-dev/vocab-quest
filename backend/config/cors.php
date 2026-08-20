<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the "allowed_origins" to include both your local dev frontends
    | and your deployed Cloudflare Pages URLs.
    |
    | For production, set FRONTEND_ORIGINS in your backend .env on Render:
    |   FRONTEND_ORIGINS=https://your-portal.pages.dev,https://your-game.pages.dev
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => env('FRONTEND_ORIGINS')
        ? array_filter(array_map('trim', explode(',', env('FRONTEND_ORIGINS'))))
        : ['*'],

    'allowed_origins_patterns' => [
        '#^https://.*\.pages\.dev$#',
        '#^https://.*\.onrender\.com$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
