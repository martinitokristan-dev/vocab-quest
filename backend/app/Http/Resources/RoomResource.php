<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'teacher_id'     => $this->teacher_id,
            'current_map_id' => $this->current_map_id,
            'pin'            => $this->pin,
            'name'           => $this->name,
            'status'                => $this->status,
            'max_students'          => $this->max_students ?? 40,
            'active_students_count' => $this->gameSessions()->count(),
            'students_count'        => $this->gameSessions()->count(),
            'current_map'           => $this->whenLoaded('currentMap'),
            'created_at'     => $this->created_at,
            'updated_at'     => $this->updated_at,
        ];
    }
}
