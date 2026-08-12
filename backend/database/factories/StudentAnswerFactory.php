<?php

namespace Database\Factories;

use App\Models\Answer;
use App\Models\GameSession;
use App\Models\Map;
use App\Models\Question;
use App\Models\StudentAnswer;
use Illuminate\Database\Eloquent\Factories\Factory;

class StudentAnswerFactory extends Factory
{
    protected $model = StudentAnswer::class;

    public function definition(): array
    {
        return [
            'game_session_id' => GameSession::factory(),
            'map_id'          => Map::factory(),
            'question_id'     => Question::factory(),
            'answer_id'       => Answer::factory(),
            'is_correct'      => true,
        ];
    }
}
