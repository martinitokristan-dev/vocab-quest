<?php

namespace App\Policies;

use App\Models\Map;
use App\Models\User;

// Phase 2 — Policy enforcement (rules-and-validation §6)
// Only the map owner (teacher_id) can view, update, delete, or publish the map.
class MapPolicy
{
    public function view(User $user, Map $map): bool
    {
        return (int) $user->id === (int) $map->teacher_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Map $map): bool
    {
        return (int) $user->id === (int) $map->teacher_id;
    }

    public function delete(User $user, Map $map): bool
    {
        return (int) $user->id === (int) $map->teacher_id;
    }
}
