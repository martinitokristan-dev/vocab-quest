<?php

namespace App\Services\Cloudinary;

use App\Contracts\Services\CloudinaryAudioContract;
use Illuminate\Http\UploadedFile;
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

    public function uploadFile(UploadedFile|string $file, string $folder = 'questions', string $resourceType = 'auto'): array
    {
        if (is_string($file)) {
            return [
                'url'       => $file,
                'public_id' => basename($file),
            ];
        }

        $path = $file->store($folder, 'public');

        return [
            'url'       => asset('storage/' . $path),
            'public_id' => $path,
        ];
    }
}
