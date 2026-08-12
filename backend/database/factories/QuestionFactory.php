<?php

namespace Database\Factories;

use App\Models\Map;
use App\Models\Question;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionFactory extends Factory
{
    protected $model = Question::class;

    public function definition(): array
    {
        return [
            'map_id'                => Map::factory(),
            'order_index'           => 1,
            'sentence'              => 'The student felt exhausted after studying.',
            'highlighted_word'      => 'exhausted',
            'has_context_highlight' => true,
            'has_image'             => false,
        ];
    }
}
