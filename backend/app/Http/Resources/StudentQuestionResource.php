<?php

namespace App\Http\Resources;

use App\Models\VocabularyAudio;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// rules-and-validation §4: Hides 'is_correct' field from choices array
class StudentQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $approvedAudio = VocabularyAudio::whereHas('vocabulary', function ($q) {
            $q->where('word', strtolower($this->highlighted_word));
        })->where('status', 'approved')->latest()->first();

        return [
            'id'                        => $this->id,
            'sentence'                  => $this->sentence,
            'highlighted_word'          => $this->highlighted_word,
            'audio_url'                 => $approvedAudio?->url,
            'image_url'                 => $this->image_url,
            'answers'                   => $this->answers->map(fn ($ans) => [
                'id'   => $ans->id,
                'text' => $ans->text,
                // 'is_correct' is strictly omitted to prevent cheating
            ]),
        ];
    }
}
