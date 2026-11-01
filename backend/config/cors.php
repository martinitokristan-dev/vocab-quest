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

    // The browser may read the ETag (304 revalidation, see EtagResponses).
    'exposed_headers' => ['ETag'],

    // The game sends Authorization + X-Game-Session-Token, so every cross-origin request
    // (Cloudflare Pages -> Render) needs a preflight. Caching it for 2 h (Chrome's maximum)
    // removes one OPTIONS request per poll instead of sending OPTIONS + GET every 2.5 s.
    'max_age' => 7200,

    'supports_credentials' => false,

];
