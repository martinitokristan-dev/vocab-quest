<?php

namespace Database\Factories;

use App\Models\Map;
use App\Models\MapCharacter;
use Illuminate\Database\Eloquent\Factories\Factory;

class MapCharacterFactory extends Factory
{
    protected $model = MapCharacter::class;

    public function definition(): array
    {
        return [
            'map_id'      => Map::factory(),
            'name'        => 'Hero Guide',
            'idle_url'    => 'https://res.cloudinary.com/demo/image/upload/idle.png',
            'correct_url' => 'https://res.cloudinary.com/demo/image/upload/correct.png',
            'wrong_url'   => 'https://res.cloudinary.com/demo/image/upload/wrong.png',
        ];
    }
}
