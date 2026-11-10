<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

// architecture.md §4 + §9 Phase 1 — Map Model
class Map extends Model
{
    use HasFactory;

    /**
     * Questions (= map levels) per kingdom. The teacher portal cannot add more, and the game
     * plays only the first MAX_QUESTIONS by order_index (older kingdoms may still hold more).
     * Keep in sync with LEVELS_PER_KINGDOM in frontend-game (ModernWorldMap.ts, mapFlowController.ts)
     * and MAX_QUESTIONS_PER_KINGDOM in frontend-portal (QuestionsPage.tsx).
     */
    public const MAX_QUESTIONS = 25;

    protected $fillable = [
        'teacher_id',
        'order_index',
        'title',
        'background_url',
        'background_cloudinary_public_id',
        'question_count',
        'published',
    ];

    protected $casts = [
        'order_index'    => 'integer',
        'question_count' => 'integer',
        'published'      => 'boolean',
    ];

    public function getQuestionCountAttribute(): int
    {
        if ($this->relationLoaded('questions')) {
            return $this->questions->count();
        }
        if (isset($this->attributes['questions_count'])) {
            return (int) $this->attributes['questions_count'];
        }
        return $this->questions()->count();
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function character(): HasOne
    {
        return $this->hasOne(MapCharacter::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('order_index');
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class, 'current_map_id');
    }

    public function studentAnswers(): HasMany
    {
        return $this->hasMany(StudentAnswer::class);
    }
}
