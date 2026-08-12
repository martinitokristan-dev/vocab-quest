<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// Phase 2 — Auth (architecture.md §9 Phase 2)
class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public endpoint
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
