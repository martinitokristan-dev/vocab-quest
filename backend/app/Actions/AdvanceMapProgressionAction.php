<?php

namespace App\Actions;

use App\Models\GameSession;
use App\Models\Map;

// Phase 5 — Auto Map Progression Action (architecture.md §3, rules-and-validation §4)
class AdvanceMapProgressionAction
{
    public function execute(GameSession $session): GameSession
    {
        $currentMap = $session->currentMap;

        $nextMap = Map::where('teacher_id', $currentMap->teacher_id)
            ->where('published', true)
            ->where('order_index', '>', $currentMap->order_index)
            ->orderBy('order_index')
            ->first();

        if (! $nextMap) {
            $session->update(['is_completed' => true]);
        } else {
            $session->update(['current_map_id' => $nextMap->id]);
        }

        return $session->fresh();
    }
}
