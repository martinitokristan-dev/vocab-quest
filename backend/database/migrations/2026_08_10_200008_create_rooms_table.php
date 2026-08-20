<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// architecture.md §4 + §5a — rooms table
// rules-and-validation §3:
//   - name: required, 1-100 chars, defaults to "Room #{pin}" server-side if omitted
//   - pin: 6 digits, server-generated, unique among waiting/in_progress rooms only
//   - status: waiting → in_progress → closed
//   - room idle timeout: a waiting room with no activity auto-closes (handled in business layer)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 100);
            $table->char('pin', 6)->index();
            $table->enum('status', ['waiting', 'in_progress', 'paused', 'closed'])->default('waiting');
            $table->foreignId('current_map_id')->nullable()->constrained('maps')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
