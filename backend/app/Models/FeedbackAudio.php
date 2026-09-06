<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackAudio extends Model
{
    use HasFactory;

    protected $table = 'feedback_audios';

    protected $fillable = [
        'type',
        'phrase',
        'audio_url',
        'is_active',
        'map_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'map_id'    => 'integer',
    ];

    /**
     * The kingdom/map this feedback audio is restricted to.
     * NULL means the clip plays globally across all kingdoms.
     */
    public function map(): BelongsTo
    {
        return $this->belongsTo(Map::class);
    }
}
