<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 — map_characters table (1:1 with maps)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('map_id')->unique()->constrained('maps')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('idle_cloudinary_public_id')->nullable();
            $table->string('idle_url')->nullable();
            $table->string('correct_cloudinary_public_id')->nullable();
            $table->string('correct_url')->nullable();
            $table->string('wrong_cloudinary_public_id')->nullable();
            $table->string('wrong_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_characters');
    }
};
