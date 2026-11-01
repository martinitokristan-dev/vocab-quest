<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Conditional GET for the JSON API (same pattern as Tala-Salitaan). Every successful JSON GET
 * gets an ETag (hash of the body). When the browser sends it back in If-None-Match and nothing
 * changed, the answer is an empty 304, so the teacher's 3 s results poll and repeated reads cost
 * almost no bandwidth on Render. "private, no-cache" = the browser may keep the copy but must
 * ask again before reusing it, so data is never stale.
 */
class EtagResponses
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethod('GET') || $response->getStatusCode() !== 200) {
            return $response;
        }
        if (! str_contains((string) $response->headers->get('Content-Type'), 'json')) {
            return $response;
        }

        $etag = '"'.hash('xxh128', (string) $response->getContent()).'"';
        $response->headers->set('ETag', $etag);
        $response->headers->set('Cache-Control', 'private, no-cache');

        // The proxy on Render gzips responses and turns the ETag into a weak one (W/"..."), and the
        // browser sends that weak form back: compare without the W/ prefix (weak comparison).
        $sent = array_map(
            fn ($t) => preg_replace('#^W/#', '', trim($t)),
            explode(',', (string) $request->headers->get('If-None-Match'))
        );
        if (in_array($etag, $sent, true)) {
            $response->setNotModified();
        }

        return $response;
    }
}
