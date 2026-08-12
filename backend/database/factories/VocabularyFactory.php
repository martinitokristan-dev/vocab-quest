<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class VocabularyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'word' => strtolower(trim(fake()->unique()->word())),
        ];
    }
}
