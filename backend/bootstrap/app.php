<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'game.session' => \App\Http\Middleware\EnsureGameSession::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function (\Illuminate\Http\Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                $prev = $e->getPrevious();
                if ($prev instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
                    $modelName = class_basename($prev->getModel());
                    return response()->json([
                        'message' => "The requested {$modelName} was not found or has already been deleted.",
                    ], 404);
                }
            }
        });
        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                $modelName = class_basename($e->getModel());
                return response()->json([
                    'message' => "The requested {$modelName} was not found or has already been deleted.",
                ], 404);
            }
        });
    })->create();
