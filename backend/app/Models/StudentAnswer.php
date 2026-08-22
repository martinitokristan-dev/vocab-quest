<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// architecture.md §4 — StudentAnswer model
class StudentAnswer extends Model
{
    use HasFactory;

    protected $fillable = [
        'game_session_id',
        'map_id',
        'question_id',
        'answer_id',
        'typed_answer',
        'is_correct',
        'stars',
        'attempts',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
        'stars'      => 'integer',
        'attempts'   => 'integer',
    ];

    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    public function map(): BelongsTo
    {
        return $this->belongsTo(Map::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function answer(): BelongsTo
    {
        return $this->belongsTo(Answer::class);
    }
}
