<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 — character_audios table
// Mascot sound effects (correct/wrong), uploaded once — not weekly content
// Separate from map_characters which holds the visual states
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_audios', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['correct', 'wrong']);
            $table->string('url');
            $table->string('cloudinary_public_id');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_audios');
    }
};
