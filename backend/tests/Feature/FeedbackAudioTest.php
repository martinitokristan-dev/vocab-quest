<?php

use App\Contracts\Services\CloudinaryAudioContract;
use App\Models\FeedbackAudio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $mockCloudinary = Mockery::mock(CloudinaryAudioContract::class);
    $mockCloudinary->shouldReceive('uploadFile')
        ->andReturn(['url' => 'https://res.cloudinary.com/test/video/upload/sample.mp4', 'public_id' => 'sample']);
    $this->app->instance(CloudinaryAudioContract::class, $mockCloudinary);
});

test('teacher can save feedback audio with mp4 video file', function () {
    $teacher = User::factory()->create();
    $file = UploadedFile::fake()->create('feedback_recording.mp4', 2048, 'video/mp4');

    $this->actingAs($teacher)
        ->postJson('/api/feedback-audios', [
            'type'       => 'praise',
            'phrase'     => 'Great job on this question!',
            'audio_file' => $file,
        ])
        ->assertCreated()
        ->assertJsonPath('data.phrase', 'Great job on this question!')
        ->assertJsonPath('data.type', 'praise');
});

test('teacher can save feedback audio with webm file', function () {
    $teacher = User::factory()->create();
    $file = UploadedFile::fake()->create('voice.webm', 1024, 'audio/webm');

    $this->actingAs($teacher)
        ->postJson('/api/feedback-audios', [
            'type'       => 'cheer_up',
            'phrase'     => 'Nice try! Try again!',
            'audio_file' => $file,
        ])
        ->assertCreated()
        ->assertJsonPath('data.phrase', 'Nice try! Try again!');
});

test('teacher can save feedback audio with mp3 file', function () {
    $teacher = User::factory()->create();
    $file = UploadedFile::fake()->create('cheer.mp3', 512, 'audio/mpeg');

    $this->actingAs($teacher)
        ->postJson('/api/feedback-audios', [
            'type'       => 'praise',
            'phrase'     => 'Excellent work!',
            'audio_file' => $file,
        ])
        ->assertCreated()
        ->assertJsonPath('data.phrase', 'Excellent work!');
});

test('game feedback audios endpoint returns active feedback clips', function () {
    FeedbackAudio::create([
        'type'      => 'praise',
        'phrase'    => 'Super star!',
        'audio_url' => 'https://res.cloudinary.com/test/praise.mp4',
        'is_active' => true,
    ]);

    $this->getJson('/api/game/feedback-audios')
        ->assertOk()
        ->assertJsonCount(1, 'praise')
        ->assertJsonPath('praise.0.phrase', 'Super star!');
});
