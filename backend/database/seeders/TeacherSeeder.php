<?php

namespace Database\Seeders;

use App\Models\FeedbackAudio;
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
                'background_url'                 => '/assets/kingdom_epces.jpg',
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
                'title'                          => 'Bayan ng Prosperidad',
                'question_count'                 => 5,
                'published'                      => true,
                'background_url'                 => '/assets/kingdom_bayan.jpg',
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
                'title'                          => 'Provincial Capitol',
                'question_count'                 => 5,
                'published'                      => true,
                'background_url'                 => '/assets/kingdom_capitol.jpg',
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

        // 6. Seed Questions for Map 1 (EPCES - 3 Questions)
        $q1 = Question::updateOrCreate(
            ['map_id' => $map1->id, 'order_index' => 1],
            [
                'sentence'              => 'The student felt exhausted after studying all night.',
                'highlighted_word'      => 'exhausted',
                'image_url'             => 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
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
                'sentence'              => 'The brave knight stood before the dragon.',
                'highlighted_word'      => 'brave',
                'image_url'             => 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
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
                'sentence'              => 'The team felt triumphant after winning the game.',
                'highlighted_word'      => 'triumphant',
                'image_url'             => 'https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q3->answers()->delete();
        $q3->answers()->createMany([
            ['text' => 'Victorious', 'is_correct' => true],
            ['text' => 'Defeated',   'is_correct' => false],
            ['text' => 'Angry',      'is_correct' => false],
        ]);

        // 7. Seed Questions for Map 2 (Bayan ng Prosperidad - 5 Questions)
        $q4 = Question::updateOrCreate(
            ['map_id' => $map2->id, 'order_index' => 1],
            [
                'sentence'              => 'The diligent student organized all her study notes neatly.',
                'highlighted_word'      => 'diligent',
                'image_url'             => 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q4->answers()->delete();
        $q4->answers()->createMany([
            ['text' => 'Hardworking and attentive', 'is_correct' => true],
            ['text' => 'Lazy and careless',         'is_correct' => false],
            ['text' => 'Forgetful',                 'is_correct' => false],
        ]);

        $q5 = Question::updateOrCreate(
            ['map_id' => $map2->id, 'order_index' => 2],
            [
                'sentence'              => 'The town fiesta was filled with vibrant and colorful decorations.',
                'highlighted_word'      => 'vibrant',
                'image_url'             => 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q5->answers()->delete();
        $q5->answers()->createMany([
            ['text' => 'Bright and lively', 'is_correct' => true],
            ['text' => 'Dull and gloomy',   'is_correct' => false],
            ['text' => 'Silent and dark',   'is_correct' => false],
        ]);

        $q6 = Question::updateOrCreate(
            ['map_id' => $map2->id, 'order_index' => 3],
            [
                'sentence'              => 'The ancient tree stood in the town square for hundreds of years.',
                'highlighted_word'      => 'ancient',
                'image_url'             => 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q6->answers()->delete();
        $q6->answers()->createMany([
            ['text' => 'Extremely old', 'is_correct' => true],
            ['text' => 'Brand new',     'is_correct' => false],
            ['text' => 'Tiny and weak', 'is_correct' => false],
        ]);

        $q7 = Question::updateOrCreate(
            ['map_id' => $map2->id, 'order_index' => 4],
            [
                'sentence'              => 'The curious boy examined the mysterious footprint in the soil.',
                'highlighted_word'      => 'curious',
                'image_url'             => 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q7->answers()->delete();
        $q7->answers()->createMany([
            ['text' => 'Eager to investigate', 'is_correct' => true],
            ['text' => 'Uninterested',         'is_correct' => false],
            ['text' => 'Sleepy',               'is_correct' => false],
        ]);

        $q8 = Question::updateOrCreate(
            ['map_id' => $map2->id, 'order_index' => 5],
            [
                'sentence'              => 'The sunrise over the river created a peaceful morning view.',
                'highlighted_word'      => 'peaceful',
                'image_url'             => 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q8->answers()->delete();
        $q8->answers()->createMany([
            ['text' => 'Calm and serene', 'is_correct' => true],
            ['text' => 'Chaotic and loud', 'is_correct' => false],
            ['text' => 'Dangerous',        'is_correct' => false],
        ]);

        // 8. Seed Questions for Map 3 (Provincial Capitol - 5 Questions)
        $q9 = Question::updateOrCreate(
            ['map_id' => $map3->id, 'order_index' => 1],
            [
                'sentence'              => 'The majestic capitol building stood tall on the hilltop.',
                'highlighted_word'      => 'majestic',
                'image_url'             => 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q9->answers()->delete();
        $q9->answers()->createMany([
            ['text' => 'Grand and impressive', 'is_correct' => true],
            ['text' => 'Hidden and small',     'is_correct' => false],
            ['text' => 'Ordinary',             'is_correct' => false],
        ]);

        $q10 = Question::updateOrCreate(
            ['map_id' => $map3->id, 'order_index' => 2],
            [
                'sentence'              => 'The museum preserved historic artifacts from long ago.',
                'highlighted_word'      => 'historic',
                'image_url'             => 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q10->answers()->delete();
        $q10->answers()->createMany([
            ['text' => 'Important in history', 'is_correct' => true],
            ['text' => 'Futuristic',           'is_correct' => false],
            ['text' => 'Unimportant',          'is_correct' => false],
        ]);

        $q11 = Question::updateOrCreate(
            ['map_id' => $map3->id, 'order_index' => 3],
            [
                'sentence'              => 'The young inventor shared a brilliant idea with the class.',
                'highlighted_word'      => 'brilliant',
                'image_url'             => 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q11->answers()->delete();
        $q11->answers()->createMany([
            ['text' => 'Exceptionally clever', 'is_correct' => true],
            ['text' => 'Foolish',              'is_correct' => false],
            ['text' => 'Common',               'is_correct' => false],
        ]);

        $q12 = Question::updateOrCreate(
            ['map_id' => $map3->id, 'order_index' => 4],
            [
                'sentence'              => 'The choir sang in harmonious melody that touched everyone.',
                'highlighted_word'      => 'harmonious',
                'image_url'             => 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q12->answers()->delete();
        $q12->answers()->createMany([
            ['text' => 'Pleasantly agreeable and tuneful', 'is_correct' => true],
            ['text' => 'Harsh and screeching',             'is_correct' => false],
            ['text' => 'Completely silent',                'is_correct' => false],
        ]);

        $q13 = Question::updateOrCreate(
            ['map_id' => $map3->id, 'order_index' => 5],
            [
                'sentence'              => 'The flourishing trade made the province prosperous and thriving.',
                'highlighted_word'      => 'prosperous',
                'image_url'             => 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
                'has_context_highlight' => true,
                'has_image'             => true,
            ]
        );
        $q13->answers()->delete();
        $q13->answers()->createMany([
            ['text' => 'Successful and thriving', 'is_correct' => true],
            ['text' => 'Poor and struggling',      'is_correct' => false],
            ['text' => 'Inactive',                 'is_correct' => false],
        ]);

        // 9. Seed Active Game Room with PIN 123456
        Room::updateOrCreate(
            ['teacher_id' => $teacher->id, 'pin' => '123456'],
            [
                'name'           => 'Grade 5 — Section Alpha',
                'status'         => 'waiting',
                'current_map_id' => $map1->id,
            ]
        );

        // 10. Seed Default Teacher Voice Praise & Cheer-Up Clips
        $praisePhrases = [
            'Fantastic job! That is the correct answer!',
            'Excellent work! You are a true vocabulary champion!',
            'Outstanding! You found the exact meaning!',
            'Superb! Keep conquering the quest!',
        ];

        foreach ($praisePhrases as $p) {
            FeedbackAudio::updateOrCreate(
                ['phrase' => $p, 'type' => 'praise'],
                [
                    'audio_url' => 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
                    'is_active' => true,
                ]
            );
        }

        $cheerUpPhrases = [
            "Good try! Don't give up, give it another shot!",
            'Almost there! Listen closely and choose the best meaning.',
            'That is okay! Think about the clue and try again.',
        ];

        foreach ($cheerUpPhrases as $c) {
            FeedbackAudio::updateOrCreate(
                ['phrase' => $c, 'type' => 'cheer_up'],
                [
                    'audio_url' => 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
                    'is_active' => true,
                ]
            );
        }
    }
}
