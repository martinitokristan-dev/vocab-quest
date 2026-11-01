<?php

namespace App\Http\Middleware;

use App\Models\GameSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

// Phase 5 — Game Session Token Middleware (architecture.md §7, rules-and-validation §4)
class EnsureGameSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Game-Session-Token')
            ?? $request->bearerToken()
            ?? $request->input('token');

        if (! $token) {
            return response()->json([
                'message' => 'Unauthenticated student game session. X-Game-Session-Token header missing.',
            ], 401);
        }

        // Only the session row. currentMap / room are loaded by the endpoints that use them, so the
        // 2.5 s status poll costs 1 query instead of 3 (fewer TiDB request units on the free tier).
        $session = GameSession::where('token', $token)->first();

        if (! $session) {
            return response()->json([
                'message' => 'Invalid or expired student game session token.',
            ], 401);
        }

        // Record heartbeat activity in cache for 20s (client polls every 2.5s)
        Cache::put("session_active_{$session->id}", now()->timestamp, 20);

        $request->attributes->set('game_session', $session);

        return $next($request);
    }
}
