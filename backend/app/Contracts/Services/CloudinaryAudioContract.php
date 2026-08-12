<?php

namespace App\Contracts\Services;

// Phase 4 — Cloudinary Storage Contract (architecture.md §9 Phase 4)
interface CloudinaryAudioContract
{
    public function uploadAudio(string $audioContents, string $publicId): array;
}
