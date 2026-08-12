<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 + §5a — student_answers table
// rules-and-validation §4a:
//   - Single source of truth for both student scoreboard AND teacher dashboard
//   - is_correct written once, server-side, at submit time (never recomputed from client input)
//   - unique(game_session_id, question_id): prevents duplicate answer submissions (409 on re-submit)
// rules-and-validation §5:
//   - Score derived: SELECT COUNT(*) WHERE is_correct = true; no mutable running total stored
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained('game_sessions')->cascadeOnDelete();
            $table->foreignId('map_id')->constrained('maps')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->unsignedSmallInteger('question_index_in_map')->nullable();
            $table->foreignId('answer_id')->constrained('answers')->cascadeOnDelete();
            $table->boolean('is_correct');
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();

            // Prevents re-submission for the same question in the same session (rules-and-validation §4)
            $table->unique(['game_session_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_answers');
    }
};
