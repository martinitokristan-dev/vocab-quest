<?php

namespace App\Http\Middleware;

use App\Models\GameSession;
use Closure;
use Illuminate\Http\Request;
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

        $session = GameSession::where('token', $token)->first();

        if (! $session) {
            return response()->json([
                'message' => 'Invalid or expired student game session token.',
            ], 401);
        }

        $request->attributes->set('game_session', $session);

        return $next($request);
    }
}
