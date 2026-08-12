<?php

// Phase 3 — Publish Gate Feature Tests (architecture.md §3, rules-and-validation §2)
// A map can ONLY be published if ALL publish criteria pass.
// Detailed 422 payload returned naming the exact missing requirements.

use App\Models\Answer;
use App\Models\Map;
use App\Models\MapCharacter;
use App\Models\Question;
use App\Models\User;
use App\Models\Vocabulary;
use App\Models\VocabularyAudio;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function createPublishableMap(): array
{
    $teacher = \App\Models\User::factory()->create();
    $map     = \App\Models\Map::factory()->create([
        'teacher_id'     => $teacher->id,
        'published'      => false,
        'background_url' => 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    ]);

    $character = \App\Models\MapCharacter::factory()->create([
        'map_id'      => $map->id,
        'name'        => 'Hero Character',
        'idle_url'    => 'https://res.cloudinary.com/demo/image/upload/idle.png',
        'correct_url' => 'https://res.cloudinary.com/demo/image/upload/correct.png',
        'wrong_url'   => 'https://res.cloudinary.com/demo/image/upload/wrong.png',
    ]);

    $word  = 'exhausted';
    $vocab = \App\Models\Vocabulary::create(['word' => $word]);
    \App\Models\VocabularyAudio::factory()->approved()->create(['vocabulary_id' => $vocab->id]);

    $question = \App\Models\Question::factory()->create([
        'map_id'           => $map->id,
        'order_index'      => 1,
        'sentence'         => 'The student felt exhausted after studying.',
        'highlighted_word' => $word,
    ]);

    \App\Models\Answer::factory()->create(['question_id' => $question->id, 'is_correct' => true, 'text' => 'Very tired']);
    \App\Models\Answer::factory()->create(['question_id' => $question->id, 'is_correct' => false, 'text' => 'Very happy']);

    return compact('teacher', 'map', 'character', 'vocab', 'question');
}

test('teacher can publish a fully valid map', function () {
    $env = createPublishableMap();

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertOk()
        ->assertJsonPath('data.published', true);

    expect($env['map']->fresh()->published)->toBeTrue();
});

test('publish gate 422 names missing background image', function () {
    $env = createPublishableMap();
    $env['map']->update(['background_url' => null, 'background_cloudinary_public_id' => null]);

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['background_url']);
});

test('publish gate 422 names missing map character', function () {
    $env = createPublishableMap();
    $env['character']->delete();

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['character']);
});

test('publish gate 422 names missing character expression image', function () {
    $env = createPublishableMap();
    $env['character']->update(['correct_url' => null]);

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['character.correct_url']);
});

test('publish gate 422 names that map has no questions', function () {
    $env = createPublishableMap();
    $env['question']->delete();

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['questions']);
});

test('publish gate 422 names question with no correct answer', function () {
    $env = createPublishableMap();

    /** @var Question $q */
    $q = $env['question'];
    $q->answers()->update(['is_correct' => false]);

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['questions.0.correct_answer']);
});

test('publish gate 422 names question with no approved audio', function () {
    $env = createPublishableMap();
    VocabularyAudio::query()->delete(); // clear approved audio

    $this->actingAs($env['teacher'])
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['questions.0.approved_audio']);
});

test('teacher cannot publish another teacher\'s map (403)', function () {
    $env      = createPublishableMap();
    $intruder = User::factory()->create();

    $this->actingAs($intruder)
        ->postJson("/api/maps/{$env['map']->id}/publish")
        ->assertStatus(403);
});
