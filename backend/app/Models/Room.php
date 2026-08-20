<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// architecture.md §4 — Room model
class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'teacher_id',
        'current_map_id',
        'pin',
        'name',
        'status',
        'max_students',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function currentMap(): BelongsTo
    {
        return $this->belongsTo(Map::class, 'current_map_id');
    }

    public function gameSessions(): HasMany
    {
        return $this->hasMany(GameSession::class);
    }
}
