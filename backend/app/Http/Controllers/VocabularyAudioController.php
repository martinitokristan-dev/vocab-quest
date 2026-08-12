<?php

namespace App\Http\Controllers;

use App\Models\Vocabulary;
use App\Models\VocabularyAudio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// Phase 4 — Vocabulary audio review & upload flow (architecture.md §6, rules-and-validation §1)
class VocabularyAudioController extends Controller
{
    /**
     * List all vocabulary words with their audio status.
     * Useful for the teacher portal's "Audio Review" dashboard.
     */
    public function index(Request $request): JsonResponse
    {
        $items = Vocabulary::with(['audios' => fn ($q) => $q->latest()])
            ->orderBy('word')
            ->get()
            ->map(function (Vocabulary $vocab) {
                $approved = $vocab->approvedAudio()->latest()->first();
                $pending  = $vocab->audios()->where('status', 'pending_review')->latest()->first();

                return [
                    'id'             => $vocab->id,
                    'word'           => $vocab->word,
                    'approved_audio' => $approved ? [
                        'id'         => $approved->id,
                        'url'        => $approved->url,
                        'status'     => $approved->status,
                        'updated_at' => $approved->updated_at,
                    ] : null,
                    'pending_audio'  => $pending ? [
                        'id'         => $pending->id,
                        'url'        => $pending->url,
                        'status'     => $pending->status,
                        'updated_at' => $pending->updated_at,
                    ] : null,
                    'pending_count'  => $vocab->audios()->where('status', 'pending_review')->count(),
                    'rejected_count' => $vocab->audios()->where('status', 'rejected')->count(),
                ];
            });

        return response()->json(['data' => $items]);
    }

    /**
     * Show a single vocabulary audio (with its URL for playback).
     */
    public function show(VocabularyAudio $vocabularyAudio): JsonResponse
    {
        return response()->json([
            'data' => [
                'id'                   => $vocabularyAudio->id,
                'vocabulary_id'        => $vocabularyAudio->vocabulary_id,
                'word'                 => $vocabularyAudio->vocabulary->word,
                'url'                  => $vocabularyAudio->url,
                'cloudinary_public_id' => $vocabularyAudio->cloudinary_public_id,
                'status'               => $vocabularyAudio->status,
                'updated_at'           => $vocabularyAudio->updated_at,
            ],
        ]);
    }

    /**
     * Approve a pending_review audio.
     */
    public function approve(VocabularyAudio $vocabularyAudio): JsonResponse
    {
        if ($vocabularyAudio->status === 'approved') {
            return response()->json(['message' => 'Audio is already approved.']);
        }

        if ($vocabularyAudio->status === 'rejected') {
            throw ValidationException::withMessages([
                'status' => ['Rejected audio cannot be approved. Generate new audio instead.'],
            ]);
        }

        $vocabularyAudio->update(['status' => 'approved']);

        return response()->json([
            'message' => 'Audio approved. It will now be served to students.',
            'data'    => ['id' => $vocabularyAudio->id, 'status' => $vocabularyAudio->status],
        ]);
    }

    /**
     * Reject a pending_review audio.
     */
    public function reject(VocabularyAudio $vocabularyAudio): JsonResponse
    {
        if ($vocabularyAudio->status === 'rejected') {
            return response()->json(['message' => 'Audio is already rejected.']);
        }

        if ($vocabularyAudio->status === 'approved') {
            throw ValidationException::withMessages([
                'status' => ['Approved audio cannot be rejected directly. Approve a newer version first.'],
            ]);
        }

        $vocabularyAudio->update(['status' => 'rejected']);

        \Log::info('tts_audio_rejected', [
            'vocabulary_id' => $vocabularyAudio->vocabulary_id,
            'audio_id'      => $vocabularyAudio->id,
        ]);

        return response()->json([
            'message' => 'Audio rejected. New audio will be generated next time this word is used.',
            'data'    => ['id' => $vocabularyAudio->id, 'status' => $vocabularyAudio->status],
        ]);
    }

    /**
     * Manually trigger audio re-generation for a vocabulary word via configured TTS.
     */
    public function regenerate(Vocabulary $vocabulary): JsonResponse
    {
        \App\Jobs\GenerateVocabularyAudio::dispatch($vocabulary);

        \Log::info('tts_generation', [
            'word'          => $vocabulary->word,
            'vocabulary_id' => $vocabulary->id,
            'trigger'       => 'manual_regenerate',
        ]);

        return response()->json([
            'message' => 'Audio re-generation queued. Check back shortly for the new audio to review.',
        ]);
    }

    /**
     * Upload a custom MP3/WAV audio file for a vocabulary word.
     */
    public function upload(Vocabulary $vocabulary, Request $request): JsonResponse
    {
        $request->validate([
            'audio_file' => ['required', 'file', 'mimes:mp3,wav,ogg,m4a,aac', 'max:10240'],
        ]);

        $file = $request->file('audio_file');
        $path = $file->store('vocabulary_audio', 'public');
        $url  = asset('storage/' . $path);

        $audio = VocabularyAudio::create([
            'vocabulary_id' => $vocabulary->id,
            'url'           => $url,
            'status'        => 'approved',
        ]);

        return response()->json([
            'message' => 'Custom audio file uploaded and approved successfully.',
            'data'    => $audio,
        ], 201);
    }
}
