<?php

namespace App\Services\Cloudinary;

use App\Contracts\Services\CloudinaryAudioContract;
use Illuminate\Support\Facades\Storage;

// Phase 4 — Local dev Cloudinary / Local Storage stub implementation
class StubCloudinaryService implements CloudinaryAudioContract
{
    public function uploadAudio(string $audioContents, string $publicId): array
    {
        $safePublicId = str_replace(['/', '\\'], '_', $publicId);
        $filename     = "vocab_audio/{$safePublicId}.mp3";

        // Save actual MP3 bytes to local public storage so audio is real and playable in browser
        Storage::disk('public')->put($filename, $audioContents);

        return [
            'url'       => asset('storage/' . $filename),
            'public_id' => $publicId,
        ];
    }
}
