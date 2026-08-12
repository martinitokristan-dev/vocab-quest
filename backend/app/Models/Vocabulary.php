<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

// architecture.md §4 — Vocabulary model
class Vocabulary extends Model
{
    use HasFactory;

    protected $table = 'vocabularies';

    protected $fillable = [
        'word',
    ];

    public function audios(): HasMany
    {
        return $this->hasMany(VocabularyAudio::class);
    }

    public function approvedAudio(): HasOne
    {
        return $this->hasOne(VocabularyAudio::class)->where('status', 'approved');
    }
}
