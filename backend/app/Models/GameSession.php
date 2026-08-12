<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// architecture.md §4 — GameSession model
class GameSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_id',
        'current_map_id',
        'player_name',
        'avatar_slug',
        'token',
        'score',
        'is_completed',
    ];

    protected $casts = [
        'score'        => 'integer',
        'is_completed' => 'boolean',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function currentMap(): BelongsTo
    {
        return $this->belongsTo(Map::class, 'current_map_id');
    }

    public function studentAnswers(): HasMany
    {
        return $this->hasMany(StudentAnswer::class);
    }
}
