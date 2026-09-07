<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First, remove duplicate player_name entries in the same room
        // Keep the most recent one (highest id)
        $duplicates = DB::table('game_sessions')
            ->select('room_id', 'player_name', DB::raw('MAX(id) as keep_id'))
            ->groupBy('room_id', 'player_name')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            DB::table('game_sessions')
                ->where('room_id', $duplicate->room_id)
                ->where('player_name', $duplicate->player_name)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
        }

        // Now add the unique constraint
        Schema::table('game_sessions', function (Blueprint $table) {
            $table->unique(['room_id', 'player_name']);
        });
    }

    public function down(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            $table->dropUnique(['room_id', 'player_name']);
        });
    }
};
