<?php

namespace App\Policies;

use App\Models\Question;
use App\Models\User;

// Phase 2 — Policy enforcement (rules-and-validation §6)
class QuestionPolicy
{
    public function view(User $user, Question $question): bool
    {
        return (int) $user->id === (int) $question->map->teacher_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Question $question): bool
    {
        return (int) $user->id === (int) $question->map->teacher_id;
    }

    public function delete(User $user, Question $question): bool
    {
        return (int) $user->id === (int) $question->map->teacher_id;
    }
}
