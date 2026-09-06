<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add nullable map_id FK to feedback_audios.
     * NULL  → audio plays globally in all kingdoms.
     * 1/2/3 → audio only plays when the student is in that specific kingdom/map.
     */
    public function up(): void
    {
        Schema::table('feedback_audios', function (Blueprint $table) {
            $table->foreignId('map_id')
                ->nullable()
                ->after('is_active')
                ->constrained('maps')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('feedback_audios', function (Blueprint $table) {
            $table->dropForeign(['map_id']);
            $table->dropColumn('map_id');
        });
    }
};
