<?php

namespace App\Contracts\Services;

// Phase 4 — Cloudinary Storage Contract (architecture.md §9 Phase 4)
interface CloudinaryAudioContract
{
    public function uploadAudio(string $audioContents, string $publicId): array;

    public function uploadFile(\Illuminate\Http\UploadedFile|string $file, string $folder = 'questions', string $resourceType = 'auto'): array;

    public function deleteFile(string $publicId, string $resourceType = 'auto'): bool;
}
