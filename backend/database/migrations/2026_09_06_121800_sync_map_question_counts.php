<?php

use App\Models\Map;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Recalculate and synchronize question_count for all existing maps
        $maps = DB::table('maps')->get();
        foreach ($maps as $map) {
            $count = DB::table('questions')->where('map_id', $map->id)->count();
            DB::table('maps')->where('id', $map->id)->update(['question_count' => $count]);
        }
    }

    public function down(): void
    {
        // Non-destructive, no-op on down
    }
};
