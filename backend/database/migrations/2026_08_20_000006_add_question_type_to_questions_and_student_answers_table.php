<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            if (!Schema::hasColumn('questions', 'question_type')) {
                $table->string('question_type', 30)->default('multiple_choice')->after('order_index');
            }
        });

        Schema::table('student_answers', function (Blueprint $table) {
            if (Schema::hasColumn('student_answers', 'answer_id')) {
                $table->foreignId('answer_id')->nullable()->change();
            }
            if (!Schema::hasColumn('student_answers', 'typed_answer')) {
                $table->string('typed_answer')->nullable()->after('answer_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            if (Schema::hasColumn('questions', 'question_type')) {
                $table->dropColumn('question_type');
            }
        });

        Schema::table('student_answers', function (Blueprint $table) {
            if (Schema::hasColumn('student_answers', 'typed_answer')) {
                $table->dropColumn('typed_answer');
            }
        });
    }
};
