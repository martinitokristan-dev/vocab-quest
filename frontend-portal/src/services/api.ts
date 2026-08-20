// API Client Service for Teacher Portal (architecture.md Â§7)

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  return `${BACKEND_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface MapData {
  id: number;
  title: string;
  order_index: number;
  published: boolean;
  question_count: number;
  background_url?: string | null;
  background_cloudinary_public_id?: string | null;
  character?: {
    id: number;
    name: string;
    idle_url?: string;
    correct_url?: string;
    wrong_url?: string;
  } | null;
  questions?: QuestionData[];
}

export interface QuestionData {
  id: number;
  map_id: number;
  order_index: number;
  sentence: string;
  highlighted_word: string;
  image_url?: string | null;
  voice_audio_url?: string | null;
  voice_video_url?: string | null;
  voice_media_type?: 'audio' | 'video' | 'none';
  has_context_highlight: boolean;
  has_image: boolean;
  answers: {
    id: number;
    text: string;
    is_correct: boolean;
  }[];
}

export interface RoomData {
  id: number;
  name: string;
  pin: string;
  status: 'waiting' | 'in_progress' | 'paused' | 'closed';
  max_students?: number;
  active_students_count?: number;
  students_count?: number;
  current_map_id?: number | null;
  created_at: string;
}

export interface VocabularyAudioItem {
  id: number;
  word: string;
  approved_audio?: {
    id: number;
    url: string;
    status: string;
    updated_at: string;
  } | null;
  pending_audio?: {
    id: number;
    url: string;
    status: string;
    updated_at: string;
  } | null;
  pending_count: number;
  rejected_count: number;
}

export interface FeedbackAudioItem {
  id: number;
  type: 'praise' | 'cheer_up';
  phrase: string;
  audio_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackAudioResponse {
  data: FeedbackAudioItem[];
  praise: FeedbackAudioItem[];
  cheer_up: FeedbackAudioItem[];
}

export interface RoomResultsData {
  room: RoomData;
  mode?: 'live' | 'historical';
  students: {
    id: number;
    player_name: string;
    avatar_slug: string;
    score: number;
    stars?: number;
    is_completed?: boolean;
    questions_answered: number;
    correct_answers?: number;
    current_question_number?: number;
    current_map_title?: string;
    current_map_order?: number;
    map_total_questions?: number;
    total_game_questions?: number;
    progress_percentage?: number;
    completed_at?: string | null;
  }[];
  summary?: {
    total_students: number;
    completed_students: number;
    class_average_score: number;
  };
  question_breakdown?: {
    question_id: number;
    map_id?: number;
    sentence: string;
    highlighted_word: string;
    total_attempts: number;
    correct_count: number;
    wrong_count: number;
    accuracy_percentage: number;
  }[];
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('teacher_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If 401 Unauthorized, clear stale token
      if (response.status === 401) {
        localStorage.removeItem('teacher_token');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
      const errorMessage = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : 'Request failed');
      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // â”€â”€ Auth API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async register(payload: { name: string; email: string; password: string; password_confirmation: string }) {
    return this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async login(payload: { email: string; password: string }) {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async logout() {
    return this.request<{ message: string }>('/auth/logout', { method: 'POST' });
  }

  async me() {
    return this.request<User>('/auth/me');
  }

  // â”€â”€ Maps API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getMaps() {
    return this.request<{ data: MapData[] }>('/maps');
  }

  async createMap(payload: { title: string; order_index: number; background_url?: string; background_image?: File | null }) {
    if (payload.background_image) {
      const formData = new FormData();
      formData.append('title', payload.title);
      formData.append('order_index', String(payload.order_index));
      formData.append('background_image', payload.background_image);
      if (payload.background_url) formData.append('background_url', payload.background_url);

      const token = this.getToken();
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/maps`, { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create map');
      return data;
    }

    return this.request<{ data: MapData }>('/maps', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMap(id: number) {
    return this.request<{ data: MapData }>(`/maps/${id}`);
  }

  async updateMap(id: number, payload: Partial<MapData> & { background_image?: File | null }) {
    if (payload.background_image) {
      const formData = new FormData();
      if (payload.title) formData.append('title', payload.title);
      if (payload.order_index !== undefined) formData.append('order_index', String(payload.order_index));
      formData.append('background_image', payload.background_image);
      if (payload.background_url) formData.append('background_url', payload.background_url);
      formData.append('_method', 'PUT');

      const token = this.getToken();
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/maps/${id}`, { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update map');
      return data;
    }

    return this.request<{ data: MapData }>(`/maps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteMap(id: number) {
    return this.request<{ message: string }>(`/maps/${id}`, { method: 'DELETE' });
  }

  async publishMap(id: number) {
    return this.request<{ data: MapData }>(`/maps/${id}/publish`, { method: 'POST' });
  }

  async saveMapCharacter(payload: {
    map_id: number;
    name: string;
    idle_url?: string;
    correct_url?: string;
    wrong_url?: string;
  }) {
    return this.request('/maps/character', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // â”€â”€ Questions API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getQuestions(mapId: number) {
    return this.request<{ data: QuestionData[] }>(`/maps/${mapId}/questions`);
  }

  async createQuestion(mapId: number, payload: {
    order_index: number;
    sentence: string;
    highlighted_word: string;
    has_context_highlight?: boolean;
    has_image?: boolean;
    image_url?: string;
    image_file?: File | null;
    voice_audio_file?: File | Blob | null;
    voice_video_file?: File | Blob | null;
    voice_audio_url?: string;
    voice_video_url?: string;
    voice_media_type?: 'audio' | 'video' | 'none';
    answers: { text: string; is_correct: boolean }[];
  }) {
    const hasFiles = payload.image_file || payload.voice_audio_file || payload.voice_video_file;
    if (hasFiles) {
      const formData = new FormData();
      formData.append('order_index', String(payload.order_index));
      formData.append('sentence', payload.sentence);
      formData.append('highlighted_word', payload.highlighted_word);
      formData.append('has_context_highlight', payload.has_context_highlight ? '1' : '0');
      formData.append('has_image', (payload.image_file || payload.image_url) ? '1' : '0');
      if (payload.image_file) formData.append('image_file', payload.image_file);
      if (payload.image_url) formData.append('image_url', payload.image_url);

      if (payload.voice_audio_file) {
        formData.append('voice_audio_file', payload.voice_audio_file, 'voiceover.webm');
      }
      if (payload.voice_audio_url) formData.append('voice_audio_url', payload.voice_audio_url);

      if (payload.voice_video_file) {
        formData.append('voice_video_file', payload.voice_video_file, 'voiceover.mp4');
      }
      if (payload.voice_video_url) formData.append('voice_video_url', payload.voice_video_url);

      if (payload.voice_media_type) formData.append('voice_media_type', payload.voice_media_type);

      formData.append('answers', JSON.stringify(payload.answers));

      const token = this.getToken();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/maps/${mapId}/questions`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : 'Request failed');
        const error: any = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    }

    return this.request<{ data: QuestionData }>(`/maps/${mapId}/questions`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, map_id: mapId }),
    });
  }

  async updateQuestion(id: number, payload: Partial<Omit<QuestionData, 'answers'>> & {
    answers?: { id?: number; text: string; is_correct: boolean }[];
    image_file?: File | null;
    voice_audio_file?: File | Blob | null;
    voice_video_file?: File | Blob | null;
  }) {
    const hasFiles = payload.image_file || payload.voice_audio_file || payload.voice_video_file;
    if (hasFiles) {
      const formData = new FormData();
      if (payload.order_index !== undefined) formData.append('order_index', String(payload.order_index));
      if (payload.sentence !== undefined) formData.append('sentence', payload.sentence);
      if (payload.highlighted_word !== undefined) formData.append('highlighted_word', payload.highlighted_word);
      if (payload.image_file) formData.append('image_file', payload.image_file);
      if (payload.image_url !== undefined) formData.append('image_url', payload.image_url || '');

      if (payload.voice_audio_file) {
        formData.append('voice_audio_file', payload.voice_audio_file, 'voiceover.webm');
      }
      if (payload.voice_audio_url !== undefined) formData.append('voice_audio_url', payload.voice_audio_url || '');

      if (payload.voice_video_file) {
        formData.append('voice_video_file', payload.voice_video_file, 'voiceover.mp4');
      }
      if (payload.voice_video_url !== undefined) formData.append('voice_video_url', payload.voice_video_url || '');

      if (payload.voice_media_type !== undefined) formData.append('voice_media_type', payload.voice_media_type);
      if (payload.answers) formData.append('answers', JSON.stringify(payload.answers));

      // Laravel needs POST with _method=PUT for multipart/form-data
      formData.append('_method', 'PUT');

      const token = this.getToken();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : 'Request failed');
        const error: any = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    }

    return this.request<{ data: QuestionData }>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteQuestion(id: number) {
    return this.request<{ message: string }>(`/questions/${id}`, { method: 'DELETE' });
  }

  // â”€â”€ Vocabulary Audio API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getVocabularyAudios() {
    return this.request<{ data: VocabularyAudioItem[] }>('/vocabulary-audios');
  }

  async approveAudio(audioId: number) {
    return this.request(`/vocabulary-audios/${audioId}/approve`, { method: 'POST' });
  }

  async rejectAudio(audioId: number) {
    return this.request(`/vocabulary-audios/${audioId}/reject`, { method: 'POST' });
  }

  async regenerateAudio(vocabId: number) {
    return this.request(`/vocabularies/${vocabId}/regenerate`, { method: 'POST' });
  }

  async uploadAudio(vocabId: number, audioFile: File) {
    const formData = new FormData();
    formData.append('audio_file', audioFile);

    const token = this.getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/vocabularies/${vocabId}/upload-audio`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      const errorMessage = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : 'Upload failed');
      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  // â”€â”€ Rooms API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getRooms() {
    return this.request<{ data: RoomData[] }>('/rooms');
  }

  async createRoom(payload?: { name?: string; max_students?: number; current_map_id?: number } | string) {
    const body = typeof payload === 'string' ? { name: payload } : payload || {};
    return this.request<{ data: RoomData }>('/rooms', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async startRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/start`, { method: 'POST' });
  }

  async pauseRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/pause`, { method: 'POST' });
  }

  async resumeRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/resume`, { method: 'POST' });
  }

  async closeRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/close`, { method: 'POST' });
  }

  async resetRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/reset`, { method: 'POST' });
  }

  async deleteRoom(id: number) {
    return this.request<{ message: string }>(`/rooms/${id}`, { method: 'DELETE' });
  }

  async getRoomResults(id: number) {
    return this.request<RoomResultsData>(`/rooms/${id}/results`);
  }

  // ── Feedback Praise & Cheer-Up Voiceover API ──
  async getFeedbackAudios() {
    return this.request<FeedbackAudioResponse>('/feedback-audios');
  }

  async uploadFeedbackAudio(payload: {
    type: 'praise' | 'cheer_up';
    phrase: string;
    audio_file?: File | Blob | null;
    audio_url?: string;
  }) {
    if (payload.audio_file) {
      const formData = new FormData();
      formData.append('type', payload.type);
      formData.append('phrase', payload.phrase);
      formData.append('audio_file', payload.audio_file, 'feedback_voice.webm');

      const token = this.getToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/feedback-audios`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }
      return data;
    } else {
      return this.request<{ message: string; data: FeedbackAudioItem }>('/feedback-audios', {
        method: 'POST',
        body: JSON.stringify({
          type: payload.type,
          phrase: payload.phrase,
          audio_url: payload.audio_url,
        }),
      });
    }
  }

  async toggleFeedbackAudio(id: number) {
    return this.request<{ message: string; data: FeedbackAudioItem }>(`/feedback-audios/${id}/toggle`, {
      method: 'POST',
    });
  }

  async deleteFeedbackAudio(id: number) {
    return this.request<{ message: string }>(`/feedback-audios/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
