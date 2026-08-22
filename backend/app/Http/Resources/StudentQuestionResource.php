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

        $isIdentification = ($this->question_type ?? 'multiple_choice') === 'identification';

        return [
            'id'                        => $this->id,
            'order_index'               => $this->order_index,
            'question_type'             => $this->question_type ?? 'multiple_choice',
            'sentence'                  => $this->sentence,
            'highlighted_word'          => $this->highlighted_word,
            'audio_url'                 => $this->voice_audio_url ?? $approvedAudio?->url,
            'voice_audio_url'           => $this->voice_audio_url,
            'voice_video_url'           => $this->voice_video_url,
            'voice_media_type'          => $this->voice_media_type ?? 'none',
            'image_url'                 => $this->image_url,
            'answers'                   => $isIdentification ? [] : $this->answers->map(fn ($ans) => [
                'id'   => $ans->id,
                'text' => $ans->text,
                // 'is_correct' is strictly omitted to prevent cheating
            ]),
        ];
    }
}
