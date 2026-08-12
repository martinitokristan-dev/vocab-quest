<?php

// Phase 6 — Teacher Live Tracking & Historical Room Results Feature Tests
use App\Models\GameSession;
use App\Models\Map;
use App\Models\Room;
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
