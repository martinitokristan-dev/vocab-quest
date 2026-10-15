<?php

namespace Database\Seeders;

use App\Models\GameSession;
use App\Models\Map;
use App\Models\MapCharacter;
use App\Models\Question;
use App\Models\Room;
use App\Models\StudentAnswer;
use App\Models\User;
use App\Models\Vocabulary;
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

        // 2. Create Map 1 (EPCES - 40 Questions)
        $map1 = Map::updateOrCreate(
            ['teacher_id' => $teacher->id, 'order_index' => 1],
            [
                'title'                          => 'EPCES Adventure Entrance',
                'question_count'                 => 40,
                'published'                      => true,
                'background_url'                 => null,
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

        // 3. Create Map 2 (Bayan ng Prosperidad - 40 Questions)
        $map2 = Map::updateOrCreate(
            ['teacher_id' => $teacher->id, 'order_index' => 2],
            [
                'title'                          => 'Bayan ng Prosperidad',
                'question_count'                 => 40,
                'published'                      => true,
                'background_url'                 => null,
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

        // 4. Create Map 3 (Provincial Capitol - 40 Questions)
        $map3 = Map::updateOrCreate(
            ['teacher_id' => $teacher->id, 'order_index' => 3],
            [
                'title'                          => 'Provincial Capitol',
                'question_count'                 => 40,
                'published'                      => true,
                'background_url'                 => null,
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

        // Clear previous student answers and active sessions so manual test starts cleanly
        StudentAnswer::query()->delete();
        GameSession::query()->delete();

        // ── Map 1 Questions (EPCES: Easy Round, Pictures + Yellow Highlight, No Underlines, 3 Questions) ──
        $map1Questions = [
            ['word' => 'exhausted', 'sentence' => 'The student felt exhausted after studying all night for the test.', 'correct' => 'Very tired', 'wrong' => ['Very happy', 'Very scared', 'Full of energy']],
            ['word' => 'brave', 'sentence' => 'The brave knight stood boldly before the roaring dragon.', 'correct' => 'Courageous', 'wrong' => ['Cowardly', 'Silent', 'Fearful']],
            ['word' => 'triumphant', 'sentence' => 'The team felt triumphant after winning the championship game.', 'correct' => 'Victorious', 'wrong' => ['Defeated', 'Angry', 'Disappointed']],
        ];

        // ── Map 2 Questions (Bayan ng Prosperidad: Average Round, Pictures + Yellow Highlight + Underlined Clues, 3 Questions) ──
        $map2Questions = [
            ['word' => 'diligent', 'clue' => 'organized all her study notes neatly', 'sentence' => 'The diligent student organized all her study notes neatly every single evening.', 'correct' => 'Hardworking and attentive', 'wrong' => ['Lazy and careless', 'Forgetful', 'Easily distracted']],
            ['word' => 'vibrant', 'clue' => 'colorful decorations and joyful music', 'sentence' => 'The town fiesta was vibrant with colorful decorations and joyful music echoing in the streets.', 'correct' => 'Bright and lively', 'wrong' => ['Dull and gloomy', 'Silent and dark', 'Pale and faded']],
            ['word' => 'ancient', 'clue' => 'stood in the plaza for hundreds of years', 'sentence' => 'The ancient balete tree stood in the plaza for hundreds of years before the town was founded.', 'correct' => 'Extremely old', 'wrong' => ['Brand new', 'Tiny and weak', 'Modern and young']],
        ];

        // ── Map 3 Questions (Provincial Capitol: Pictures + Yellow Highlight + Underlined Clues, 3 Questions) ──
        $map3Questions = [
            ['word' => 'majestic', 'clue' => 'stood tall on the hilltop', 'sentence' => 'The majestic capitol building stood tall on the hilltop overlooking the province.', 'correct' => 'Grand and impressive', 'wrong' => ['Hidden and small', 'Ordinary and plain', 'Flimsy']],
            ['word' => 'historic', 'clue' => 'founding of Agusan del Sur', 'sentence' => 'The museum preserved historic artifacts from the founding of Agusan del Sur.', 'correct' => 'Important in history', 'wrong' => ['Futuristic', 'Unimportant', 'Fictional']],
            ['word' => 'brilliant', 'clue' => 'solved the municipality water shortage', 'sentence' => 'The young engineer presented a brilliant blueprint that solved the municipality water shortage.', 'correct' => 'Exceptionally clever', 'wrong' => ['Foolish', 'Common', 'Unoriginal']],
        ];

        // Helper to seed questions for a map
        $seedMap = function (Map $map, array $questionsList, bool $hasImages = false) {
            $map->questions()->delete();

            foreach ($questionsList as $i => $qData) {
                Vocabulary::firstOrCreate(['word' => $qData['word']]);

                $q = Question::create([
                    'map_id'                => $map->id,
                    'order_index'           => $i + 1,
                    'sentence'              => $qData['sentence'],
                    'highlighted_word'      => $qData['word'],
                    'context_clue'          => $qData['clue'] ?? null,
                    'image_url'             => $hasImages ? 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800' : null,
                    'has_context_highlight' => true,
                    'has_image'             => $hasImages,
                    'question_type'         => 'multiple_choice',
                ]);

                $answers = [
                    ['text' => $qData['correct'], 'is_correct' => true],
                    ['text' => $qData['wrong'][0], 'is_correct' => false],
                    ['text' => $qData['wrong'][1], 'is_correct' => false],
                    ['text' => $qData['wrong'][2], 'is_correct' => false],
                ];
                $q->answers()->createMany($answers);
            }
        };

        // Seed 3 questions per kingdom for fast manual testing
        $seedMap($map1, $map1Questions, true);
        $seedMap($map2, $map2Questions, true);
        $seedMap($map3, $map3Questions, true);

        // 9. Seed Active Game Room with PIN 123456
        Room::updateOrCreate(
            ['teacher_id' => $teacher->id, 'pin' => '123456'],
            [
                'name'           => 'Grade 5 — Section Alpha',
                'status'         => 'in_progress',
                'current_map_id' => $map1->id,
            ]
        );

        // Dynamically sync question counts for all maps based on actual seeded questions (3 each)
        foreach (Map::all() as $m) {
            $m->update(['question_count' => $m->questions()->count()]);
        }
    }
}
