<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FeedbackAudio extends Model
{
    use HasFactory;

    protected $table = 'feedback_audios';

    protected $fillable = [
        'type',
        'phrase',
        'audio_url',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
