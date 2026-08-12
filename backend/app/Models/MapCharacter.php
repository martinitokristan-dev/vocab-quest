<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// architecture.md §4 — MapCharacter model
class MapCharacter extends Model
{
    use HasFactory;

    protected $fillable = [
        'map_id',
        'name',
        'idle_url',
        'idle_cloudinary_public_id',
        'correct_url',
        'correct_cloudinary_public_id',
        'wrong_url',
        'wrong_cloudinary_public_id',
    ];

    public function map(): BelongsTo
    {
        return $this->belongsTo(Map::class);
    }

    public function characterAudios(): HasMany
    {
        return $this->hasMany(CharacterAudio::class);
    }
}
