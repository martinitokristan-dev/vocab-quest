<?php

// Phase 5 — Student Gameplay & Question Delivery Feature Tests
use App\Models\Answer;
use App\Models\GameSession;
use App\Models\Map;
use App\Models\Question;
use App\Models\Room;
use App\Models\User;
use App\Models\Vocabulary;
use App\Models\VocabularyAudio;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function setupGameRoom(): array
{
    $teacher = User::factory()->create();

    $map1 = Map::factory()->published()->create(['teacher_id' => $teacher->id, 'order_index' => 1]);
    $map2 = Map::factory()->published()->create(['teacher_id' => $teacher->id, 'order_index' => 2]);

    $word1 = 'exhausted';
    $v1    = Vocabulary::create(['word' => $word1]);
    VocabularyAudio::factory()->approved()->create(['vocabulary_id' => $v1->id]);

    $q1 = Question::factory()->create([
        'map_id'           => $map1->id,
        'order_index'      => 1,
        'sentence'         => 'The student felt exhausted.',
        'highlighted_word' => $word1,
    ]);
    $a1_correct = Answer::factory()->create(['question_id' => $q1->id, 'is_correct' => true, 'text' => 'Tired']);
    $a1_wrong   = Answer::factory()->create(['question_id' => $q1->id, 'is_correct' => false, 'text' => 'Happy']);

    $room = Room::factory()->create([
        'teacher_id'     => $teacher->id,
        'current_map_id' => $map1->id,
        'pin'            => '123456',
        'status'         => 'waiting',
    ]);

    return compact('teacher', 'map1', 'map2', 'q1', 'a1_correct', 'a1_wrong', 'room');
}

test('student can join room with valid PIN', function () {
    $env = setupGameRoom();

    $res = $this->postJson('/api/game/join', [
        'pin'         => '123456',
        'player_name' => 'Alex',
        'avatar_slug' => 'wizard',
    ]);

    $res->assertCreated()
        ->assertJsonStructure(['token', 'player' => ['name', 'avatar_slug']]);

    $this->assertDatabaseHas('game_sessions', [
        'room_id'     => $env['room']->id,
        'player_name' => 'Alex',
    ]);
});

test('student join fails with non-existent PIN (422)', function () {
    $this->postJson('/api/game/join', [
        'pin'         => '999999',
        'player_name' => 'Alex',
        'avatar_slug' => 'wizard',
    ])->assertStatus(422)->assertJsonValidationErrors(['pin']);
});

test('student join is blocked when room status is in_progress (422)', function () {
    $env = setupGameRoom();
    $env['room']->update(['status' => 'in_progress']);

    $this->postJson('/api/game/join', [
        'pin'         => '123456',
        'player_name' => 'Alex',
        'avatar_slug' => 'wizard',
    ])->assertStatus(422)->assertJsonValidationErrors(['pin']);
});

test('student join is blocked when room status is closed (422)', function () {
    $env = setupGameRoom();
    $env['room']->update(['status' => 'closed']);

    $this->postJson('/api/game/join', [
        'pin'         => '123456',
        'player_name' => 'Alex',
        'avatar_slug' => 'wizard',
    ])->assertStatus(422)->assertJsonValidationErrors(['pin']);
});

test('student can fetch current question and answers array hides is_correct', function () {
    $env     = setupGameRoom();
    $session = GameSession::factory()->create([
        'room_id'        => $env['room']->id,
        'current_map_id' => $env['map1']->id,
    ]);

    $res = $this->withHeader('X-Game-Session-Token', $session->token)
        ->getJson('/api/game/question');

    $res->assertOk()
        ->assertJsonPath('data.question.id', $env['q1']->id);

    $answers = $res->json('data.question.answers');
    expect($answers)->toHaveCount(2);
    expect($answers[0])->not->toHaveKey('is_correct');
});

test('unauthenticated request to game question returns 401', function () {
    $this->getJson('/api/game/question')
        ->assertStatus(401);
});

test('student can submit correct answer and gain score', function () {
    $env     = setupGameRoom();
    $session = GameSession::factory()->create([
        'room_id'        => $env['room']->id,
        'current_map_id' => $env['map1']->id,
        'score'          => 0,
    ]);

    $res = $this->withHeader('X-Game-Session-Token', $session->token)
        ->postJson('/api/game/answer', [
            'question_id' => $env['q1']->id,
            'answer_id'   => $env['a1_correct']->id,
        ]);

    $res->assertOk()
        ->assertJsonPath('is_correct', true)
        ->assertJsonPath('score', 1);

    expect($session->fresh()->score)->toBe(1);
});

test('submitting duplicate answer for same question returns 422', function () {
    $env     = setupGameRoom();
    $session = GameSession::factory()->create([
        'room_id'        => $env['room']->id,
        'current_map_id' => $env['map1']->id,
    ]);

    $this->withHeader('X-Game-Session-Token', $session->token)
        ->postJson('/api/game/answer', [
            'question_id' => $env['q1']->id,
            'answer_id'   => $env['a1_correct']->id,
        ])->assertOk();

    // Second attempt on same question
    $this->withHeader('X-Game-Session-Token', $session->token)
        ->postJson('/api/game/answer', [
            'question_id' => $env['q1']->id,
            'answer_id'   => $env['a1_correct']->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['question_id']);
});

test('student completes map 1 and automatically advances to map 2 then finishes game', function () {
    $env     = setupGameRoom();
    $session = GameSession::factory()->create([
        'room_id'        => $env['room']->id,
        'current_map_id' => $env['map1']->id,
    ]);

    // Answer Q1 on Map 1
    $this->withHeader('X-Game-Session-Token', $session->token)
        ->postJson('/api/game/answer', [
            'question_id' => $env['q1']->id,
            'answer_id'   => $env['a1_correct']->id,
        ]);

    // Fetch next question — since Map 1 has no more questions, auto advances to Map 2 (which has 0 questions -> completes game)
    $res = $this->withHeader('X-Game-Session-Token', $session->token)
        ->getJson('/api/game/question');

    $res->assertOk()
        ->assertJsonPath('is_completed', true);

    expect($session->fresh()->is_completed)->toBeTrue();
});

test('student can view room scoreboard', function () {
    $env     = setupGameRoom();
    $session = GameSession::factory()->create(['room_id' => $env['room']->id, 'score' => 5]);

    $this->withHeader('X-Game-Session-Token', $session->token)
        ->getJson('/api/game/scoreboard')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});
