<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 — maps table
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 100);
            $table->tinyInteger('order_index')->unsigned(); // 1=EPCES, 2=Prince Hypermart, 3=Naliyagan
            $table->boolean('published')->default(false);
            $table->tinyInteger('question_count')->unsigned(); // 3 or 5 per map design
            $table->string('background_cloudinary_public_id')->nullable();
            $table->string('background_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maps');
    }
};
