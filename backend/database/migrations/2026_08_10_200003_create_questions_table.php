<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 — questions table
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('map_id')->constrained('maps')->cascadeOnDelete();
            $table->unsignedSmallInteger('order_index');
            $table->string('sentence', 300);
            $table->string('highlighted_word', 50);
            $table->string('image_url')->nullable();
            $table->string('image_cloudinary_public_id')->nullable();
            $table->boolean('has_context_highlight')->default(true);
            $table->boolean('has_image')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
