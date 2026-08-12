<?php

// Phase 2 & rules-and-validation §6 — Teacher Ownership Policy Isolation Tests
use App\Models\Map;
use App\Models\Question;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('teacher cannot view another teacher\'s map (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->getJson("/api/maps/{$otherMap->id}")
        ->assertStatus(403);
});

test('teacher cannot update another teacher\'s map (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->putJson("/api/maps/{$otherMap->id}", ['title' => 'Hacked Title'])
        ->assertStatus(403);
});

test('teacher cannot delete another teacher\'s map (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->deleteJson("/api/maps/{$otherMap->id}")
        ->assertStatus(403);
});

test('map owner can view their own map', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->getJson("/api/maps/{$map->id}")
        ->assertOk();
});

test('non-owner cannot view another teacher\'s map via Policy', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    expect($teacher->can('view', $otherMap))->toBeFalse();
});

test('teacher cannot view another teacher\'s room via Policy (403)', function () {
    $teacher   = User::factory()->create();
    $other     = User::factory()->create();
    $otherRoom = Room::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->getJson("/api/rooms/{$otherRoom->id}")
        ->assertStatus(403);
});

test('room owner has full access to their own room via Policy', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id]);

    expect($teacher->can('view', $room))->toBeTrue();
    expect($teacher->can('update', $room))->toBeTrue();
});

test('teacher cannot access another teacher\'s question via Policy', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);
    $question = Question::factory()->create(['map_id' => $otherMap->id]);

    expect($teacher->can('view', $question))->toBeFalse();
    expect($teacher->can('update', $question))->toBeFalse();
});

test('question owner has full access to their own question via Policy', function () {
    $teacher  = User::factory()->create();
    $map      = Map::factory()->create(['teacher_id' => $teacher->id]);
    $question = Question::factory()->create(['map_id' => $map->id]);

    expect($teacher->can('view', $question))->toBeTrue();
    expect($teacher->can('update', $question))->toBeTrue();
});

test('unauthenticated request to protected route returns 401', function () {
    $this->getJson('/api/maps')->assertStatus(401);
    $this->getJson('/api/rooms')->assertStatus(401);
});
