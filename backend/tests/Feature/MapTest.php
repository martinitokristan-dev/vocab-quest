<?php

// Phase 2 — Map CRUD Feature Tests
use App\Models\Map;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('teacher can list their own maps', function () {
    $teacher = User::factory()->create();
    Map::factory()->count(3)->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->getJson('/api/maps')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('teacher can create a map (201)', function () {
    $teacher = User::factory()->create();

    $this->actingAs($teacher)
        ->postJson('/api/maps', [
            'title'       => 'EPCES Cavern Entrance',
            'order_index' => 1,
        ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'EPCES Cavern Entrance');
});

test('map creation fails without title (422)', function () {
    $teacher = User::factory()->create();

    $this->actingAs($teacher)
        ->postJson('/api/maps', ['order_index' => 1])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['title']);
});

test('map creation fails with invalid order_index (422)', function () {
    $teacher = User::factory()->create();

    $this->actingAs($teacher)
        ->postJson('/api/maps', ['title' => 'Test Map', 'order_index' => 0])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['order_index']);
});

test('unauthenticated request to create map returns 401', function () {
    $this->postJson('/api/maps', ['title' => 'Test Map', 'order_index' => 1])
        ->assertStatus(401);
});

test('teacher can view their own map', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->getJson("/api/maps/{$map->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $map->id);
});

test('teacher cannot view another teacher\'s map (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->getJson("/api/maps/{$otherMap->id}")
        ->assertStatus(403);
});

test('teacher can update their own map', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id, 'title' => 'Old Title']);

    $this->actingAs($teacher)
        ->putJson("/api/maps/{$map->id}", ['title' => 'New Title'])
        ->assertOk()
        ->assertJsonPath('data.title', 'New Title');
});

test('teacher cannot update another teacher\'s map (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->putJson("/api/maps/{$otherMap->id}", ['title' => 'Hacked Title'])
        ->assertStatus(403);
});

test('teacher can delete their own map', function () {
    $teacher = User::factory()->create();
    $map     = Map::factory()->create(['teacher_id' => $teacher->id]);

    $this->actingAs($teacher)
        ->deleteJson("/api/maps/{$map->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('maps', ['id' => $map->id]);
});

test('teacher cannot delete another teacher\'s map (403)', function () {
    $teacher  = User::factory()->create();
    $other    = User::factory()->create();
    $otherMap = Map::factory()->create(['teacher_id' => $other->id]);

    $this->actingAs($teacher)
        ->deleteJson("/api/maps/{$otherMap->id}")
        ->assertStatus(403);
});
