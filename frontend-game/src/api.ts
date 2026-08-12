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
  data?: {
    session: {
      score: number;
      is_completed: boolean;
    };
    map: {
      id: number;
      order_index: number;
      title: string;
    };
    question: {
      id: number;
      sentence: string;
      highlighted_word: string;
      image_url: string | null;
      audio_url: string | null;
      answers: AnswerChoice[];
    };
  };
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  score: number;
  message: string;
}

class StudentGameApiClient {
  private token: string | null = null;

  constructor() {
    this.token = sessionStorage.getItem('student_session_token');
  }

  setToken(token: string) {
    this.token = token;
    sessionStorage.setItem('student_session_token', token);
  }

  getToken() {
    return this.token || sessionStorage.getItem('student_session_token');
  }

  clearToken() {
    this.token = null;
    sessionStorage.removeItem('student_session_token');
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
      this.setToken(res.token);
    }

    return res;
  }

  async getCurrentQuestion(): Promise<CurrentQuestionResponse> {
    return this.request<CurrentQuestionResponse>('/game/question');
  }

  async submitAnswer(questionId: number, answerId: number): Promise<SubmitAnswerResponse> {
    return this.request<SubmitAnswerResponse>('/game/answer', {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        answer_id: answerId,
      }),
    });
  }
}

export const gameApi = new StudentGameApiClient();
