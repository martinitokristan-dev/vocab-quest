<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_answers', function (Blueprint $table) {
            $table->unsignedTinyInteger('stars')->default(3)->after('is_correct');
            $table->unsignedTinyInteger('attempts')->default(1)->after('stars');
        });
    }

    public function down(): void
    {
        Schema::table('student_answers', function (Blueprint $table) {
            $table->dropColumn(['stars', 'attempts']);
        });
    }
};
