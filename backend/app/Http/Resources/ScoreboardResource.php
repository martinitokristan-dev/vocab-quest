<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScoreboardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'player_name'  => $this->player_name,
            'avatar_slug'  => $this->avatar_slug,
            'score'        => $this->score,
            'is_completed' => $this->is_completed,
        ];
    }
}
