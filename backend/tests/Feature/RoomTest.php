<?php

// Phase 5 — Room Lifecycle Feature Tests
use App\Models\Map;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('teacher can create a room with a server-generated PIN', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->published()->create(['teacher_id' => $teacher->id]);

    $res = $this->actingAs($teacher)
        ->postJson('/api/rooms', [
            'current_map_id' => $map->id,
            'name'           => 'Grade 5 Section Alpha',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.name', 'Grade 5 Section Alpha')
        ->assertJsonPath('data.status', 'waiting');

    expect($res->json('data.pin'))->toMatch('/^\d{6}$/');
});

test('room name defaults to "Room #{pin}" when omitted', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->published()->create(['teacher_id' => $teacher->id]);

    $res = $this->actingAs($teacher)
        ->postJson('/api/rooms', ['current_map_id' => $map->id]);

    $res->assertCreated();
    $pin = $res->json('data.pin');
    expect($res->json('data.name'))->toBe("Room #{$pin}");
});

test('room creation is blocked for unauthenticated requests (401)', function () {
    $this->postJson('/api/rooms', ['current_map_id' => 1])
        ->assertStatus(401);
});

test('teacher only sees their own rooms', function () {
    $teacher = User::factory()->create();
    $other   = User::factory()->create();

    Room::factory()->create(['teacher_id' => $teacher->id]);
    Room::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->getJson('/api/rooms')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('teacher can view their own room', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->getJson("/api/rooms/{$room->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $room->id);
});

test('teacher cannot view another teacher\'s room (403)', function () {
    $teacher   = User::factory()->create();
    $other     = User::factory()->create();
    $otherRoom = Room::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->getJson("/api/rooms/{$otherRoom->id}")
        ->assertStatus(403);
});

test('teacher can start a waiting room', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'status' => 'waiting']);

    $this->actingAs($teacher)
        ->postJson("/api/rooms/{$room->id}/start")
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress');
});

test('starting an already-started room returns 422', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'status' => 'in_progress']);

    $this->actingAs($teacher)
        ->postJson("/api/rooms/{$room->id}/start")
        ->assertStatus(422);
});

test('teacher can close a room', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'status' => 'in_progress']);

    $this->actingAs($teacher)
        ->postJson("/api/rooms/{$room->id}/close")
        ->assertOk()
        ->assertJsonPath('data.status', 'closed');
});

test('closing an already-closed room returns 422', function () {
    $teacher = User::factory()->create();
    $room    = Room::factory()->create(['teacher_id' => $teacher->id, 'status' => 'closed']);

    $this->actingAs($teacher)
        ->postJson("/api/rooms/{$room->id}/close")
        ->assertStatus(422);
});

test('teacher cannot start another teacher\'s room (403)', function () {
    $teacher   = User::factory()->create();
    $other     = User::factory()->create();
    $otherRoom = Room::factory()->create(['teacher_id' => $other->id, 'status' => 'waiting']);

    $this->actingAs($teacher)
        ->postJson("/api/rooms/{$otherRoom->id}/start")
        ->assertStatus(403);
});
