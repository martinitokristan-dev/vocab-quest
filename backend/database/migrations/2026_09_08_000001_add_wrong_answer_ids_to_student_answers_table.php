<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_answers', function (Blueprint $table) {
            if (!Schema::hasColumn('student_answers', 'wrong_answer_ids')) {
                $table->json('wrong_answer_ids')->nullable()->after('attempts');
            }
        });
    }

    public function down(): void
    {
        Schema::table('student_answers', function (Blueprint $table) {
            if (Schema::hasColumn('student_answers', 'wrong_answer_ids')) {
                $table->dropColumn('wrong_answer_ids');
            }
        });
    }
};
