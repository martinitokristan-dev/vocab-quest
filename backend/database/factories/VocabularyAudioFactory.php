<?php

namespace Database\Factories;

use App\Models\Vocabulary;
use App\Models\VocabularyAudio;
use Illuminate\Database\Eloquent\Factories\Factory;

class VocabularyAudioFactory extends Factory
{
    protected $model = VocabularyAudio::class;

    public function definition(): array
    {
        return [
            'vocabulary_id'        => Vocabulary::factory(),
            'url'                  => 'https://res.cloudinary.com/demo/video/upload/sample.mp3',
            'cloudinary_public_id' => 'vocab_audio/sample',
            'status'               => 'pending_review',
        ];
    }

    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'approved',
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'rejected',
        ]);
    }
}
