<?php

namespace Database\Factories;

use App\Models\GameSession;
use App\Models\Map;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class GameSessionFactory extends Factory
{
    protected $model = GameSession::class;

    public function definition(): array
    {
        return [
            'room_id'        => Room::factory(),
            'current_map_id' => Map::factory(),
            'player_name'    => fake()->firstName(),
            'avatar_slug'    => 'wizard',
            'token'          => Str::random(40),
            'score'          => 0,
            'is_completed'   => false,
        ];
    }
}
