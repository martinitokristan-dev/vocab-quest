// API Client Service for Teacher Portal (architecture.md Â§7)

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  status: 'waiting' | 'in_progress' | 'closed';
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

export interface RoomResultsData {
  room: RoomData;
  mode: 'live' | 'historical';
  students: {
    id: number;
    player_name: string;
    avatar_slug: string;
    current_map_id: number;
    questions_answered: number;
    score: number;
    completed_at?: string | null;
  }[];
  summary?: {
    total_students: number;
    completed_students: number;
    class_average_score: number;
  };
  question_breakdown?: {
    question_id: number;
    map_id: number;
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
    answers: { text: string; is_correct: boolean }[];
  }) {
    if (payload.image_file) {
      const formData = new FormData();
      formData.append('order_index', String(payload.order_index));
      formData.append('sentence', payload.sentence);
      formData.append('highlighted_word', payload.highlighted_word);
      formData.append('has_context_highlight', payload.has_context_highlight ? '1' : '0');
      formData.append('has_image', '1');
      formData.append('image_file', payload.image_file);
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

  async updateQuestion(id: number, payload: Partial<QuestionData>) {
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

  async createRoom(name?: string) {
    return this.request<{ data: RoomData }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async startRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/start`, { method: 'POST' });
  }

  async closeRoom(id: number) {
    return this.request<{ data: RoomData }>(`/rooms/${id}/close`, { method: 'POST' });
  }

  async getRoomResults(id: number) {
    return this.request<RoomResultsData>(`/rooms/${id}/results`);
  }
}

export const api = new ApiClient();
