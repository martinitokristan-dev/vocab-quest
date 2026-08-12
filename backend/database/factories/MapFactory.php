<?php

namespace Database\Factories;

use App\Models\Map;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class MapFactory extends Factory
{
    protected $model = Map::class;

    public function definition(): array
    {
        return [
            'teacher_id'     => User::factory(),
            'order_index'    => 1,
            'title'          => 'Test Map',
            'background_url' => 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            'question_count' => 1,
            'published'      => false,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'published' => true,
        ]);
    }
}
