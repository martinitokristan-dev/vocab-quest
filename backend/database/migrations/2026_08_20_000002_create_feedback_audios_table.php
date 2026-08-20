<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_audios', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['praise', 'cheer_up'])->default('praise');
            $table->string('phrase');
            $table->string('audio_url');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_audios');
    }
};
