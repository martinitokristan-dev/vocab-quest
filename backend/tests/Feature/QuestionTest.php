<?php

// Phase 3 — Question CRUD & Highlight Rules Feature Tests
use App\Models\Answer;
use App\Models\Map;
use App\Models\Question;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('teacher can create a question on their own map (201)', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$map->id}/questions", [
            'order_index'      => 1,
            'sentence'         => 'The brave student answered the vocabulary question.',
            'highlighted_word' => 'brave',
            'answers'          => [
                ['text' => 'Courageous', 'is_correct' => true],
                ['text' => 'Cowardly',   'is_correct' => false],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.highlighted_word', 'brave');
});

test('question creation fails when sentence does not contain highlighted_word (422)', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$map->id}/questions", [
            'order_index'      => 1,
            'sentence'         => 'The student answered the question.',
            'highlighted_word' => 'exhausted',
            'answers'          => [
                ['text' => 'Tired', 'is_correct' => true],
                ['text' => 'Happy', 'is_correct' => false],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['highlighted_word']);
});

test('question creation fails with zero correct answers (422)', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$map->id}/questions", [
            'order_index'      => 1,
            'sentence'         => 'The brave student.',
            'highlighted_word' => 'brave',
            'answers'          => [
                ['text' => 'Courageous', 'is_correct' => false],
                ['text' => 'Cowardly',   'is_correct' => false],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['answers']);
});

test('question creation fails with two correct answers (422)', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$map->id}/questions", [
            'order_index'      => 1,
            'sentence'         => 'The brave student.',
            'highlighted_word' => 'brave',
            'answers'          => [
                ['text' => 'Courageous', 'is_correct' => true],
                ['text' => 'Heroic',     'is_correct' => true],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['answers']);
});

test('question creation fails with only one answer (422)', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$map->id}/questions", [
            'order_index'      => 1,
            'sentence'         => 'The brave student.',
            'highlighted_word' => 'brave',
            'answers'          => [
                ['text' => 'Courageous', 'is_correct' => true],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['answers']);
});

test('teacher cannot add question to another teacher\'s map (422)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$otherMap->id}/questions", [
            'order_index'      => 1,
            'sentence'         => 'The brave student.',
            'highlighted_word' => 'brave',
            'answers'          => [
                ['text' => 'Courageous', 'is_correct' => true],
                ['text' => 'Cowardly',   'is_correct' => false],
            ],
        ])
        ->assertStatus(403);
});

test('teacher can view their own question', function () {
    $teacher  = User::factory()->create();
    $map      = Map::factory()->create(['teacher_id' => $teacher->id]);
    $question = Question::factory()->create(['map_id' => $map->id]);

    $this->actingAs($teacher)
        ->getJson("/api/questions/{$question->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $question->id);
});

test('teacher cannot view another teacher\'s question (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);
    $question = Question::factory()->create(['map_id' => $otherMap->id]);

    $this->actingAs($teacher)
        ->getJson("/api/questions/{$question->id}")
        ->assertStatus(403);
});

test('teacher can delete their own question', function () {
    $teacher  = User::factory()->create();
    $map      = Map::factory()->create(['teacher_id' => $teacher->id]);
    $question = Question::factory()->create(['map_id' => $map->id]);

    $this->actingAs($teacher)
        ->deleteJson("/api/questions/{$question->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('questions', ['id' => $question->id]);
});

test('teacher cannot delete another teacher\'s question (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);
    $question = Question::factory()->create(['map_id' => $otherMap->id]);

    $this->actingAs($teacher)
        ->deleteJson("/api/questions/{$question->id}")
        ->assertStatus(403);
});

test('deleting a non-existent or already-deleted question returns friendly 404 json', function () {
    $teacher = User::factory()->create();

    $this->actingAs($teacher)
        ->deleteJson('/api/questions/999999')
        ->assertStatus(404)
        ->assertJson([
            'message' => 'The requested Question was not found or has already been deleted.',
        ]);
});

test('question creation fails when map already has 5 questions (422)', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    for ($i = 1; $i <= 5; $i++) {
        Question::factory()->create(['map_id' => $map->id, 'order_index' => $i]);
    }

    $this->actingAs($teacher)
        ->postJson("/api/maps/{$map->id}/questions", [
            'order_index'      => 6,
            'sentence'         => 'The extra question.',
            'highlighted_word' => 'extra',
            'answers'          => [
                ['text' => 'More', 'is_correct' => true],
                ['text' => 'Less', 'is_correct' => false],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['questions']);
});

