<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('voice_audio_url')->nullable()->after('image_cloudinary_public_id');
            $table->string('voice_video_url')->nullable()->after('voice_audio_url');
            $table->string('voice_media_type', 20)->default('none')->after('voice_video_url');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn(['voice_audio_url', 'voice_video_url', 'voice_media_type']);
        });
    }
};
