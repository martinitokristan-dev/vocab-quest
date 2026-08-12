<?php

namespace App\Services\Cloudinary;

use App\Contracts\Services\CloudinaryAudioContract;
use Cloudinary\Cloudinary;
use Cloudinary\Configuration\Configuration;
use RuntimeException;

// Phase 4 — Real Cloudinary implementation for production uploads
class CloudinaryService implements CloudinaryAudioContract
{
    private Cloudinary $cloudinary;
    private string $preset;

    public function __construct(
        string $cloudName,
        string $apiKey,
        string $apiSecret,
        string $preset = 'vocab_audio'
    ) {
        $this->preset = $preset;

        Configuration::instance([
            'cloud' => [
                'cloud_name' => $cloudName,
                'api_key'    => $apiKey,
                'api_secret' => $apiSecret,
            ],
            'url' => ['secure' => true],
        ]);

        $this->cloudinary = new Cloudinary();
    }

    public function uploadAudio(string $audioContents, string $publicId): array
    {
        // Write to a temp file because Cloudinary SDK requires a file path
        $tmpFile = tempnam(sys_get_temp_dir(), 'vocab_audio_') . '.mp3';
        file_put_contents($tmpFile, $audioContents);

        try {
            $result = $this->cloudinary->uploadApi()->upload($tmpFile, [
                'resource_type' => 'video', // Cloudinary uses "video" for audio files
                'public_id'     => $publicId,
                'upload_preset' => $this->preset,
                'overwrite'     => true,
            ]);

            return [
                'url'       => $result['secure_url'],
                'public_id' => $result['public_id'],
            ];
        } catch (\Throwable $e) {
            throw new RuntimeException("Cloudinary upload failed: {$e->getMessage()}");
        } finally {
            @unlink($tmpFile);
        }
    }
}
