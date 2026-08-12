<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// architecture.md §4 — character_audios table
// Mascot sound effects (correct/wrong reaction sounds), uploaded once per game lifetime
// Separate from map_characters (which holds the visual states per map)
class CharacterAudio extends Model
{
    protected $fillable = [
        'type',
        'url',
        'cloudinary_public_id',
    ];
}
