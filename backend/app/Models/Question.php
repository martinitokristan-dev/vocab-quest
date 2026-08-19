<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// architecture.md §4 — Question model
class Question extends Model
{
    use HasFactory;

    protected $fillable = [
        'map_id',
        'order_index',
        'sentence',
        'highlighted_word',
        'image_url',
        'image_cloudinary_public_id',
        'has_context_highlight',
        'has_image',
        'voice_audio_url',
        'voice_video_url',
        'voice_media_type',
    ];

    protected $casts = [
        'order_index'           => 'integer',
        'has_context_highlight' => 'boolean',
        'has_image'             => 'boolean',
    ];

    public function map(): BelongsTo
    {
        return $this->belongsTo(Map::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }

    public function studentAnswers(): HasMany
    {
        return $this->hasMany(StudentAnswer::class);
    }
}
