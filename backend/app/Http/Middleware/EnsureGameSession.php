<?php

namespace App\Http\Middleware;

use App\Models\GameSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

// Phase 5 — Game Session Token Middleware (architecture.md §7, rules-and-validation §4)
// Optimized: token→session cached for 5 min to eliminate DB hit on every student poll
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

        // Cache token → session for 5 minutes (300s)
        // Reduces 12,000+ DB queries/min to near-zero at 500 concurrent students
        $sessionData = Cache::remember("game_token_{$token}", 300, function () use ($token) {
            $session = GameSession::where('token', $token)->first();
            return $session ? $session->toArray() : null;
        });

        if (! $sessionData) {
            return response()->json([
                'message' => 'Invalid or expired student game session token.',
            ], 401);
        }

        // Hydrate the Eloquent model from cached array (no extra DB hit)
        $session = (new GameSession())->forceFill($sessionData);
        $session->exists = true;

        $request->attributes->set('game_session', $session);

        return $next($request);
    }
}
