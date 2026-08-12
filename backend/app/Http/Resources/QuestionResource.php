<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                        => $this->id,
            'map_id'                    => $this->map_id,
            'order_index'               => $this->order_index,
            'sentence'                  => $this->sentence,
            'highlighted_word'          => $this->highlighted_word,
            'image_url'                 => $this->image_url,
            'image_cloudinary_public_id' => $this->image_cloudinary_public_id,
            'has_context_highlight'     => $this->has_context_highlight,
            'has_image'                 => $this->has_image,
            'answers'                   => $this->whenLoaded('answers'),
            'created_at'                => $this->created_at,
            'updated_at'                => $this->updated_at,
        ];
    }
}
