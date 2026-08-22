<?php

namespace App\Services\Cloudinary;

use App\Contracts\Services\CloudinaryAudioContract;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

// Phase 4 — High-Performance Cloudinary Signed REST API implementation (Zero heavy SDK dependencies)
class CloudinaryService implements CloudinaryAudioContract
{
    public function __construct(
        private readonly string $cloudName,
        private readonly string $apiKey,
        private readonly string $apiSecret,
        private readonly ?string $preset = null
    ) {}

    public function uploadAudio(string $audioContents, string $publicId): array
    {
        $timestamp = time();
        $params = [
            'public_id' => $publicId,
            'timestamp' => $timestamp,
        ];

        $signature = $this->generateSignature($params);

        $payload = array_merge($params, [
            'api_key'   => $this->apiKey,
            'signature' => $signature,
        ]);

        // Attempt upload using auto resource type
        $response = Http::timeout(30)
            ->attach('file', $audioContents, 'audio.mp3')
            ->post("https://api.cloudinary.com/v1_1/{$this->cloudName}/auto/upload", $payload);

        if ($response->successful()) {
            $data = $response->json();
            return [
                'url'       => $data['secure_url'] ?? $data['url'],
                'public_id' => $data['public_id'],
            ];
        }

        // Retry with raw resource type if auto fails
        $rawResponse = Http::timeout(30)
            ->attach('file', $audioContents, 'audio.mp3')
            ->post("https://api.cloudinary.com/v1_1/{$this->cloudName}/raw/upload", $payload);

        if ($rawResponse->successful()) {
            $data = $rawResponse->json();
            return [
                'url'       => $data['secure_url'] ?? $data['url'],
                'public_id' => $data['public_id'],
            ];
        }

        \Log::error("Cloudinary audio upload failed: " . $response->body());
        throw new RuntimeException("Cloudinary upload failed: " . $response->body());
    }

    public function uploadFile(UploadedFile|string $file, string $folder = 'questions', string $resourceType = 'auto'): array
    {
        $timestamp = time();
        $params = [
            'folder'    => $folder,
            'timestamp' => $timestamp,
        ];

        $signature = $this->generateSignature($params);

        $payload = array_merge($params, [
            'api_key'   => $this->apiKey,
            'signature' => $signature,
        ]);

        $fileContents = is_string($file) ? file_get_contents($file) : file_get_contents($file->getRealPath());
        $fileName = is_string($file) ? basename($file) : $file->getClientOriginalName();
        $resType = in_array($resourceType, ['image', 'video', 'raw', 'auto'], true) ? $resourceType : 'auto';

        $response = Http::timeout(45)
            ->attach('file', $fileContents, $fileName)
            ->post("https://api.cloudinary.com/v1_1/{$this->cloudName}/{$resType}/upload", $payload);

        if ($response->successful()) {
            $data = $response->json();
            return [
                'url'       => $data['secure_url'] ?? $data['url'],
                'public_id' => $data['public_id'],
            ];
        }

        \Log::error("Cloudinary file upload failed: " . $response->body());
        throw new RuntimeException("Cloudinary upload failed: " . $response->body());
    }

    public function deleteFile(string $publicId, string $resourceType = 'auto'): bool
    {
        if (empty($publicId)) return false;

        $timestamp = time();
        $params = [
            'public_id' => $publicId,
            'timestamp' => $timestamp,
        ];

        $signature = $this->generateSignature($params);
        $payload = array_merge($params, [
            'api_key'   => $this->apiKey,
            'signature' => $signature,
        ]);

        $resType = in_array($resourceType, ['image', 'video', 'raw', 'auto'], true) ? $resourceType : 'auto';

        $response = Http::timeout(15)
            ->post("https://api.cloudinary.com/v1_1/{$this->cloudName}/{$resType}/destroy", $payload);

        return $response->successful();
    }

    private function generateSignature(array $params): string
    {
        ksort($params);
        $signString = '';
        foreach ($params as $key => $value) {
            $signString .= ($signString === '' ? '' : '&') . "{$key}={$value}";
        }
        return sha1($signString . $this->apiSecret);
    }
}
