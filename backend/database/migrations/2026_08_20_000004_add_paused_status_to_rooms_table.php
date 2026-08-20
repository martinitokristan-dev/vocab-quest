<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE rooms MODIFY COLUMN status ENUM('waiting', 'in_progress', 'paused', 'closed') NOT NULL DEFAULT 'waiting'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE rooms MODIFY COLUMN status ENUM('waiting', 'in_progress', 'closed') NOT NULL DEFAULT 'waiting'");
        }
    }
};
