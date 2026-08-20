const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface JoinGameResponse {
  message: string;
  token: string;
  player: {
    name: string;
    avatar_slug: string;
  };
}

export interface AnswerChoice {
  id: number;
  text: string;
}

export interface CurrentQuestionResponse {
  message?: string;
  is_completed?: boolean;
  total_correct?: number;
  is_paused?: boolean;
  room_status?: string;
  data?: {
    session: {
      score: number;
      is_completed: boolean;
    };
    map: {
      id: number;
      order_index: number;
      title: string;
      total_questions?: number;
      current_question_num?: number;
    };
    question: {
      id: number;
      order_index?: number;
      sentence: string;
      highlighted_word: string;
      image_url: string | null;
      audio_url: string | null;
      voice_audio_url?: string | null;
      voice_video_url?: string | null;
      voice_media_type?: 'audio' | 'video' | 'none' | null;
      answers: AnswerChoice[];
    };
    completed_questions?: Array<{
      question_id: number;
      map_id: number;
      order_index: number;
      word: string;
    }>;
    is_paused?: boolean;
    room_status?: string;
  };
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  score: number;
  message: string;
}

export interface GameStatusResponse {
  is_paused: boolean;
  is_completed: boolean;
  room_status: string;
  score: number;
}

class StudentGameApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('student_session_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('student_session_token', token);
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('student_session_token');
  }

  saveSessionProfile(token: string, playerName: string, avatarSlug: string, pin: string) {
    this.setToken(token);
    localStorage.setItem('student_player_name', playerName);
    localStorage.setItem('student_avatar_slug', avatarSlug);
    localStorage.setItem('student_pin', pin);
  }

  getSessionProfile(): {
    token: string | null;
    playerName: string;
    avatarSlug: string;
    pin: string;
  } {
    return {
      token: this.getToken(),
      playerName: localStorage.getItem('student_player_name') || '',
      avatarSlug: localStorage.getItem('student_avatar_slug') || 'learner-girl',
      pin: localStorage.getItem('student_pin') || '',
    };
  }

  clearToken() {
    this.clearSession();
  }

  clearSession() {
    this.token = null;
    localStorage.removeItem('student_session_token');
    localStorage.removeItem('student_player_name');
    localStorage.removeItem('student_avatar_slug');
    localStorage.removeItem('student_pin');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.message || (data.errors ? Object.values(data.errors).flat().join(', ') : 'API request failed');
      throw new Error(errorMsg);
    }

    return data;
  }

  async joinRoom(pin: string, player_name: string, avatar_slug: string): Promise<JoinGameResponse> {
    const res = await this.request<JoinGameResponse>('/game/join', {
      method: 'POST',
      body: JSON.stringify({ pin, player_name, avatar_slug }),
    });

    if (res.token) {
      this.saveSessionProfile(res.token, player_name, avatar_slug, pin);
    }

    return res;
  }

  async getCurrentQuestion(): Promise<CurrentQuestionResponse> {
    return this.request<CurrentQuestionResponse>('/game/question');
  }

  async getGameStatus(): Promise<GameStatusResponse> {
    return this.request<GameStatusResponse>('/game/status');
  }

  async submitAnswer(questionId: number, answerId: number, stars: number = 3): Promise<SubmitAnswerResponse> {
    return this.request<SubmitAnswerResponse>('/game/answer', {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        answer_id: answerId,
        stars,
      }),
    });
  }

  async getFeedbackAudios(): Promise<{
    praise: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean }>;
    cheer_up: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean }>;
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/game/feedback-audios`);
      if (!res.ok) return { praise: [], cheer_up: [] };
      return res.json();
    } catch {
      return { praise: [], cheer_up: [] };
    }
  }
}

export const gameApi = new StudentGameApiClient();
