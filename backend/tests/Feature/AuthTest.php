<?php

// Phase 2 — Teacher Auth Feature Tests
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('teacher can register account', function () {
    $res = $this->postJson('/api/auth/register', [
        'name'     => 'Teacher Santos',
        'email'    => 'teacher@school.edu',
        'password' => 'password123',
    ]);

    $res->assertCreated()
        ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

    $this->assertDatabaseHas('users', ['email' => 'teacher@school.edu']);
});

test('teacher registration fails with duplicate email', function () {
    User::factory()->create(['email' => 'teacher@school.edu']);

    $this->postJson('/api/auth/register', [
        'name'     => 'Teacher Santos',
        'email'    => 'teacher@school.edu',
        'password' => 'password123',
    ])->assertStatus(422)->assertJsonValidationErrors(['email']);
});

test('teacher can login with valid credentials', function () {
    $user = User::factory()->create([
        'email'    => 'teacher@school.edu',
        'password' => bcrypt('password123'),
    ]);

    $this->postJson('/api/auth/login', [
        'email'    => 'teacher@school.edu',
        'password' => 'password123',
    ])->assertOk()->assertJsonStructure(['token', 'user']);
});

test('teacher login fails with wrong password', function () {
    User::factory()->create([
        'email'    => 'teacher@school.edu',
        'password' => bcrypt('password123'),
    ]);

    $this->postJson('/api/auth/login', [
        'email'    => 'teacher@school.edu',
        'password' => 'wrongpassword',
    ])->assertStatus(422)->assertJsonValidationErrors(['email']);
});

test('authenticated teacher can fetch current profile (me)', function () {
    $teacher = User::factory()->create();

    $this->actingAs($teacher)
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('user.email', $teacher->email);
});

test('authenticated teacher can logout', function () {
    $teacher = User::factory()->create();
    $token   = $teacher->createToken('test_token')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/auth/logout')
        ->assertOk();

    expect($teacher->tokens()->count())->toBe(0);
});
