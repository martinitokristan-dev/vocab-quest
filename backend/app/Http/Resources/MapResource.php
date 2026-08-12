<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MapResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                             => $this->id,
            'teacher_id'                     => $this->teacher_id,
            'order_index'                    => $this->order_index,
            'title'                          => $this->title,
            'background_url'                 => $this->background_url,
            'background_cloudinary_public_id' => $this->background_cloudinary_public_id,
            'question_count'                 => $this->question_count,
            'published'                      => $this->published,
            'character'                      => $this->whenLoaded('character'),
            'questions'                      => QuestionResource::collection($this->whenLoaded('questions')),
            'created_at'                     => $this->created_at,
            'updated_at'                     => $this->updated_at,
        ];
    }
}
