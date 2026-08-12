<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 + §6 — vocabulary_audios table
// rules-and-validation §1: status lifecycle = pending_review → approved | rejected
// Only approved audio is served to students; rejected audio is excluded from cache lookups
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vocabulary_audios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vocabulary_id')->constrained('vocabularies')->cascadeOnDelete();
            $table->string('url');
            $table->string('cloudinary_public_id');
            $table->enum('status', ['pending_review', 'approved', 'rejected'])->default('pending_review');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vocabulary_audios');
    }
};
