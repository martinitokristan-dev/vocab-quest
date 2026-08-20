<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameQuestionController;
use App\Http\Controllers\GameSessionController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\QuestionController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomResultsController;
use App\Http\Controllers\FeedbackAudioController;
use App\Http\Controllers\VocabularyAudioController;
use Illuminate\Support\Facades\Route;

// Health check endpoint — monitored by UptimeRobot or Betterstack every 3 min to prevent Render spin-down
Route::get('/ping', fn () => response()->json(['status' => 'ok', 'ts' => now()->toISOString()]));

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Phase 2 & Phase 3 — Teacher Map Management
    Route::get('/maps', [MapController::class, 'index']);
    Route::post('/maps', [MapController::class, 'store']);
    Route::get('/maps/{map}', [MapController::class, 'show']);
    Route::put('/maps/{map}', [MapController::class, 'update']);
    Route::delete('/maps/{map}', [MapController::class, 'destroy']);
    Route::post('/maps/{map}/publish', [MapController::class, 'publish']);

    // Phase 3 — Question Management
    Route::get('/maps/{map}/questions', [QuestionController::class, 'index']);
    Route::post('/maps/{map}/questions', [QuestionController::class, 'store']);
    Route::get('/questions/{question}', [QuestionController::class, 'show']);
    Route::put('/questions/{question}', [QuestionController::class, 'update']);
    Route::post('/questions/{question}', [QuestionController::class, 'update']);
    Route::delete('/questions/{question}', [QuestionController::class, 'destroy']);

    // Phase 4 — Vocabulary Audio Review Flow
    Route::get('/audio/vocabulary', [VocabularyAudioController::class, 'index']);
    Route::get('/vocabulary-audios', [VocabularyAudioController::class, 'index']);
    Route::get('/vocabulary/audio/pending', [VocabularyAudioController::class, 'index']);

    Route::get('/audio/vocabulary/{vocabularyAudio}', [VocabularyAudioController::class, 'show']);
    Route::get('/vocabulary-audios/{vocabularyAudio}', [VocabularyAudioController::class, 'show']);

    Route::post('/audio/vocabulary/{vocabularyAudio}/approve', [VocabularyAudioController::class, 'approve']);
    Route::post('/vocabulary-audios/{vocabularyAudio}/approve', [VocabularyAudioController::class, 'approve']);
    Route::post('/vocabulary/audio/{vocabularyAudio}/approve', [VocabularyAudioController::class, 'approve']);

    Route::post('/audio/vocabulary/{vocabularyAudio}/reject', [VocabularyAudioController::class, 'reject']);
    Route::post('/vocabulary-audios/{vocabularyAudio}/reject', [VocabularyAudioController::class, 'reject']);
    Route::post('/vocabulary/audio/{vocabularyAudio}/reject', [VocabularyAudioController::class, 'reject']);

    Route::post('/audio/vocabulary/{vocabulary}/regenerate', [VocabularyAudioController::class, 'regenerate']);
    Route::post('/vocabularies/{vocabulary}/regenerate', [VocabularyAudioController::class, 'regenerate']);

    Route::post('/audio/vocabulary/{vocabulary}/upload', [VocabularyAudioController::class, 'upload']);
    Route::post('/vocabularies/{vocabulary}/upload-audio', [VocabularyAudioController::class, 'upload']);

    // Phase 5 — Room Management
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::post('/rooms', [RoomController::class, 'store']);
    Route::get('/rooms/{room}', [RoomController::class, 'show']);
    Route::post('/rooms/{room}/start', [RoomController::class, 'start']);
    Route::post('/rooms/{room}/pause', [RoomController::class, 'pause']);
    Route::post('/rooms/{room}/resume', [RoomController::class, 'resume']);
    Route::post('/rooms/{room}/close', [RoomController::class, 'close']);
    Route::post('/rooms/{room}/reset', [RoomController::class, 'reset']);
    Route::delete('/rooms/{room}', [RoomController::class, 'destroy']);

    // Phase 6 — Teacher Room Results & Live Scoreboard
    Route::get('/rooms/{room}/results', [RoomResultsController::class, 'show']);

    // Teacher Praise & Cheer-Up Voiceover Studio
    Route::get('/feedback-audios', [FeedbackAudioController::class, 'index']);
    Route::post('/feedback-audios', [FeedbackAudioController::class, 'store']);
    Route::post('/feedback-audios/{id}/toggle', [FeedbackAudioController::class, 'toggle']);
    Route::delete('/feedback-audios/{id}', [FeedbackAudioController::class, 'destroy']);
});

// Phase 5 — Student Game PIN Join
Route::post('/game/join', [GameSessionController::class, 'join']);
Route::get('/game/feedback-audios', [FeedbackAudioController::class, 'activeClips']);

// Phase 5 — Protected Student Game Endpoints (game.session middleware)
Route::middleware('game.session')->group(function () {
    Route::get('/game/question', [GameQuestionController::class, 'show']);
    Route::get('/game/status', [GameQuestionController::class, 'status']);
    Route::post('/game/answer', [GameQuestionController::class, 'answer']);
    Route::get('/game/scoreboard', [GameSessionController::class, 'scoreboard']);
});
