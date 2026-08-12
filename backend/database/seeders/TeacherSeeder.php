<?php

namespace Database\Seeders;

use App\Models\Map;
use App\Models\MapCharacter;
use App\Models\Question;
use App\Models\Room;
use App\Models\User;
use App\Models\Vocabulary;
use App\Models\VocabularyAudio;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TeacherSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create Default Teacher Account
        $teacher = User::updateOrCreate(
            ['email' => 'teacher@school.edu'],
            [
                'name'     => 'Teacher Santos',
                'password' => Hash::make('password'),
            ]
        );

        // 2. Create Map 1 (3 Questions)
        $map1 = Map::updateOrCreate(
            ['teacher_id' => $teacher->id, 'order_index' => 1],
            [
                'title'                          => 'EPCES Adventure Entrance',
                'question_count'                 => 3,
                'published'                      => true,
                'background_url'                 => 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800',
                'background_cloudinary_public_id' => 'map_bg_1',
            ]
        );

        MapCharacter::updateOrCreate(
            ['map_id' => $map1->id],
            [
                'name'        => 'Aria the Guide',
                'idle_url'    => 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200',
                'correct_url' => 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200',
                'wrong_url'   => 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200',
            ]
        );

        // 3. Create Map 2 (5 Questions)
        $map2 = Map::updateOrCreate(
            ['teacher_id' => $teacher->id, 'order_index' => 2],
            [
                'title'                          => 'Vocabulary Cavern',
                'question_count'                 => 5,
                'published'                      => true,
                'background_url'                 => 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800',
                'background_cloudinary_public_id' => 'map_bg_2',
            ]
        );

        MapCharacter::updateOrCreate(
            ['map_id' => $map2->id],
            [
                'name'        => 'Garrick the Warrior',
                'idle_url'    => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                'correct_url' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                'wrong_url'   => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
            ]
        );

        // 4. Create Map 3 (5 Questions)
        $map3 = Map::updateOrCreate(
            ['teacher_id' => $teacher->id, 'order_index' => 3],
            [
                'title'                          => 'Master Citadel',
                'question_count'                 => 5,
                'published'                      => true,
                'background_url'                 => 'https://images.unsplash.com/photo-1519074069444-1ba4eff56022?w=800',
                'background_cloudinary_public_id' => 'map_bg_3',
            ]
        );

        MapCharacter::updateOrCreate(
            ['map_id' => $map3->id],
            [
                'name'        => 'Ignis the Dragon Knight',
                'idle_url'    => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
                'correct_url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
                'wrong_url'   => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
            ]
        );

        // 5. Seed Vocabulary & Approved Audio
        $words = ['exhausted', 'brave', 'triumphant', 'legendary', 'perseverent'];
        foreach ($words as $word) {
            $vocab = Vocabulary::firstOrCreate(['word' => $word]);
            VocabularyAudio::firstOrCreate(
                ['vocabulary_id' => $vocab->id, 'status' => 'approved'],
                [
                    'url'                  => 'https://res.cloudinary.com/demo/video/upload/sample.mp3',
                    'cloudinary_public_id' => "vocab_audio/{$word}",
                ]
            );
        }

        // 6. Seed Questions for Map 1
        $q1 = Question::updateOrCreate(
            ['map_id' => $map1->id, 'order_index' => 1],
            [
                'sentence'             => 'The student felt exhausted after studying all night.',
                'highlighted_word'     => 'exhausted',
                'has_context_highlight' => true,
                'has_image'            => false,
            ]
        );
        $q1->answers()->delete();
        $q1->answers()->createMany([
            ['text' => 'Very tired',  'is_correct' => true],
            ['text' => 'Very happy',  'is_correct' => false],
            ['text' => 'Very scared', 'is_correct' => false],
        ]);

        $q2 = Question::updateOrCreate(
            ['map_id' => $map1->id, 'order_index' => 2],
            [
                'sentence'             => 'The brave knight stood before the dragon.',
                'highlighted_word'     => 'brave',
                'has_context_highlight' => true,
                'has_image'            => false,
            ]
        );
        $q2->answers()->delete();
        $q2->answers()->createMany([
            ['text' => 'Courageous', 'is_correct' => true],
            ['text' => 'Cowardly',   'is_correct' => false],
            ['text' => 'Silent',     'is_correct' => false],
        ]);

        $q3 = Question::updateOrCreate(
            ['map_id' => $map1->id, 'order_index' => 3],
            [
                'sentence'             => 'The team felt triumphant after winning the game.',
                'highlighted_word'     => 'triumphant',
                'has_context_highlight' => true,
                'has_image'            => false,
            ]
        );
        $q3->answers()->delete();
        $q3->answers()->createMany([
            ['text' => 'Victorious', 'is_correct' => true],
            ['text' => 'Defeated',   'is_correct' => false],
            ['text' => 'Angry',      'is_correct' => false],
        ]);

        // 7. Seed Active Game Room with PIN 123456
        Room::updateOrCreate(
            ['teacher_id' => $teacher->id, 'pin' => '123456'],
            [
                'name'           => 'Grade 5 — Section Alpha',
                'status'         => 'waiting',
                'current_map_id' => $map1->id,
            ]
        );
    }
}
