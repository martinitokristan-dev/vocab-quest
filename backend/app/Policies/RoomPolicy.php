<?php

namespace App\Policies;

use App\Models\Room;
use App\Models\User;

// Phase 2 — Policy enforcement (rules-and-validation §6)
class RoomPolicy
{
    public function view(User $user, Room $room): bool
    {
        return (int) $user->id === (int) $room->teacher_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Room $room): bool
    {
        return (int) $user->id === (int) $room->teacher_id;
    }

    public function delete(User $user, Room $room): bool
    {
        return (int) $user->id === (int) $room->teacher_id;
    }
}
