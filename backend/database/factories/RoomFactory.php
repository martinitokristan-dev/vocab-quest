<?php

namespace Database\Factories;

use App\Models\Map;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoomFactory extends Factory
{
    protected $model = Room::class;

    public function definition(): array
    {
        return [
            'teacher_id'     => User::factory(),
            'current_map_id' => Map::factory(),
            'pin'            => (string) fake()->unique()->numberBetween(100000, 999999),
            'name'           => 'Classroom Test Room',
            'status'         => 'waiting',
        ];
    }
}
