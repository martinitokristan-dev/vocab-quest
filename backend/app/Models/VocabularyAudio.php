<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// architecture.md §4 — VocabularyAudio model
class VocabularyAudio extends Model
{
    use HasFactory;

    protected $table = 'vocabulary_audios';

    protected $fillable = [
        'vocabulary_id',
        'url',
        'cloudinary_public_id',
        'status',
    ];

    public function vocabulary(): BelongsTo
    {
        return $this->belongsTo(Vocabulary::class);
    }
}
