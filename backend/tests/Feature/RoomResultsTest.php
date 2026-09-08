<?php

// Phase 6 — Teacher Live Tracking & Historical Room Results Feature Tests
use App\Models\GameSession;
use App\Models\Map;
use App\Models\Question;
use App\Models\Room;
use App\Models\StudentAnswer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('teacher can view live tracking for an active room', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->published()->create(['teacher_id' => $teacher->id]);
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'current_map_id' => $map->id, 'status' => 'in_progress']);

    GameSession::factory()->count(3)->create(['room_id' => $room->id]);

    $this->actingAs($teacher)
        ->getJson("/api/rooms/{$room->id}/results")
        ->assertOk()
        ->assertJsonPath('data.summary.total_players', 3);
});

test('teacher can view historical analysis and question breakdown when room is closed', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->published()->create(['teacher_id' => $teacher->id]);
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'current_map_id' => $map->id, 'status' => 'closed']);

    $this->actingAs($teacher)
        ->getJson("/api/rooms/{$room->id}/results")
        ->assertOk()
        ->assertJsonPath('data.room.status', 'closed');
});

test('teacher cannot view results for another teacher\'s room (403)', function () {
    $teacher   = User::factory()->create();
    $other     = User::factory()->create();
    $otherRoom = Room::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->getJson("/api/rooms/{$otherRoom->id}/results")
        ->assertStatus(403);
});

test('unauthenticated request to room results returns 401', function () {
    $this->getJson('/api/rooms/1/results')
        ->assertStatus(401);
});

test('question breakdown counts 1st attempt correct vs 1st attempt wrong and details 2nd and 3rd attempts', function () {
    $teacher = User::factory()->create();
    $map = Map::factory()->published()->create(['teacher_id' => $teacher->id]);
    $question = Question::factory()->create(['map_id' => $map->id, 'order_index' => 1]);
    $room = Room::factory()->create(['teacher_id' => $teacher->id, 'current_map_id' => $map->id, 'status' => 'in_progress']);

    // Session 1: solved on 1st attempt
    $s1 = GameSession::factory()->create(['room_id' => $room->id]);
    StudentAnswer::create([
        'game_session_id' => $s1->id,
        'question_id'     => $question->id,
        'map_id'          => $map->id,
        'is_correct'      => true,
        'attempts'        => 1,
        'stars'           => 3,
    ]);

    // Session 2: solved on 2nd attempt (wrong on 1st attempt)
    $s2 = GameSession::factory()->create(['room_id' => $room->id]);
    StudentAnswer::create([
        'game_session_id' => $s2->id,
        'question_id'     => $question->id,
        'map_id'          => $map->id,
        'is_correct'      => true,
        'attempts'        => 2,
        'stars'           => 2,
    ]);

    // Session 3: solved on 3rd attempt (wrong on 1st attempt)
    $s3 = GameSession::factory()->create(['room_id' => $room->id]);
    StudentAnswer::create([
        'game_session_id' => $s3->id,
        'question_id'     => $question->id,
        'map_id'          => $map->id,
        'is_correct'      => true,
        'attempts'        => 3,
        'stars'           => 1,
    ]);

    $res = $this->actingAs($teacher)
        ->getJson("/api/rooms/{$room->id}/results")
        ->assertOk();

    $breakdown = collect($res->json('data.question_breakdown'))->firstWhere('question_id', $question->id);

    expect($breakdown)->not->toBeNull();
    // 1 pupil solved on 1st try; 2 pupils failed on 1st try (retried on 2nd and 3rd)
    // Correct / Wrong must be 1 / 2 (it does NOT count 2nd and 3rd tries as 1st try correct!)
    expect($breakdown['correct_count'])->toBe(1);
    expect($breakdown['wrong_count'])->toBe(2);
    expect($breakdown['first_attempt_count'])->toBe(1);
    expect($breakdown['first_attempt_wrong'])->toBe(2);
    expect($breakdown['second_attempt_count'])->toBe(1);
    expect($breakdown['third_attempt_count'])->toBe(1);
    expect($breakdown['first_attempt_percentage'])->toBe(33.3);
    expect($breakdown['second_attempt_percentage'])->toBe(33.3);
    expect($breakdown['third_attempt_percentage'])->toBe(33.3);
    expect($breakdown['total_attempts'])->toBe(6);
    expect($breakdown['total_students'])->toBe(3);
});

test('question breakdown is sorted ascending in chronological game order from question 1 to 15 without shuffling', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'status' => 'in_progress']);

    $map1 = Map::factory()->create(['teacher_id' => $teacher->id, 'order_index' => 1]);
    $map2 = Map::factory()->create(['teacher_id' => $teacher->id, 'order_index' => 2]);

    $q1_1 = Question::factory()->create(['map_id' => $map1->id, 'order_index' => 1, 'highlighted_word' => 'word1']);
    $q1_2 = Question::factory()->create(['map_id' => $map1->id, 'order_index' => 2, 'highlighted_word' => 'word2']);
    $q2_1 = Question::factory()->create(['map_id' => $map2->id, 'order_index' => 1, 'highlighted_word' => 'word3']);
    $q2_2 = Question::factory()->create(['map_id' => $map2->id, 'order_index' => 2, 'highlighted_word' => 'word4']);

    $res = $this->actingAs($teacher)
        ->getJson("/api/rooms/{$room->id}/results")
        ->assertOk();

    $breakdown = $res->json('data.question_breakdown');
    $ids = array_column($breakdown, 'question_id');

    expect($ids)->toBe([$q1_1->id, $q1_2->id, $q2_1->id, $q2_2->id]);
    expect($breakdown[0]['question_number'])->toBe(1);
    expect($breakdown[1]['question_number'])->toBe(2);
    expect($breakdown[2]['question_number'])->toBe(3);
    expect($breakdown[3]['question_number'])->toBe(4);
});


