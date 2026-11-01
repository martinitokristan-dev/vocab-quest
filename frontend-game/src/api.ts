import { networkManager } from './networkManager';
import { optimizeImageUrl } from './utils/cloudinaryImage';

const RAW_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000').trim();
export const BACKEND_ORIGIN = RAW_URL.replace(/\/api\/?$/, '');
export const API_BASE_URL = RAW_URL.endsWith('/api') ? RAW_URL : `${BACKEND_ORIGIN}/api`;

export interface JoinGameResponse {
  message: string;
  token: string;
  is_reconnect?: boolean;
  room_status?: string;
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
      question_type?: 'multiple_choice' | 'identification';
      sentence: string;
      highlighted_word: string;
      context_clue?: string | null;
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
    current_attempt?: {
      attempts: number;
      wrong_answer_ids?: number[];
      last_answer_id?: number | null;
      typed_answer?: string | null;
    } | null;
    is_paused?: boolean;
    room_status?: string;
  };
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  score: number;
  message: string;
  attempts?: number;
  wrong_answer_ids?: number[];
}

export interface GameStatusResponse {
  is_paused: boolean;
  is_completed: boolean;
  room_status: string;
  score: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isSessionAuthError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 401;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('401') ||
    msg.includes('Unauthenticated') ||
    msg.includes('Invalid or expired student game session')
  );
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

  clearSession(pin?: string) {
    this.token = null;
    localStorage.removeItem('student_session_token');
    localStorage.removeItem('student_player_name');
    localStorage.removeItem('student_avatar_slug');
    localStorage.removeItem('student_pin');
    this.clearLastScreen(pin);
  }

  saveLastScreen(screen: string, pin?: string) {
    if (screen === 'question' || screen === 'world_map') {
      localStorage.setItem('student_last_screen', screen);
      if (pin) {
        localStorage.setItem(`student_last_screen_${pin}`, screen);
      }
    }
  }

  getLastScreen(pin?: string): 'question' | 'world_map' | null {
    if (pin) {
      const pinSaved = localStorage.getItem(`student_last_screen_${pin}`);
      if (pinSaved === 'question' || pinSaved === 'world_map') return pinSaved;
    }
    const saved = localStorage.getItem('student_last_screen');
    return saved === 'question' || saved === 'world_map' ? saved : null;
  }

  saveLastPlayerName(pin: string, name: string): void {
    if (pin && name) {
      localStorage.setItem(`student_name_${pin}`, name);
    }
  }

  getLastPlayerName(pin: string): string {
    return localStorage.getItem(`student_name_${pin}`) || '';
  }

  clearLastScreen(pin?: string) {
    localStorage.removeItem('student_last_screen');
    if (pin) {
      localStorage.removeItem(`student_last_screen_${pin}`);
    }
    const currentPin = localStorage.getItem('student_pin');
    if (currentPin) {
      localStorage.removeItem(`student_last_screen_${currentPin}`);
    }
  }

  async ping(): Promise<boolean> {
    return networkManager.checkConnectionNow();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Game-Session-Token'] = token;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (fetchErr: unknown) {
      networkManager.reportRequestFailure(fetchErr);
      throw fetchErr;
    }

    if (!networkManager.isOnline) {
      networkManager.setOnline(true);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.errors) {
          errorMessage = Object.values(errorData.errors).flat().join(', ');
        }
      } catch {
        const errorText = await response.text().catch(() => '');
        if (errorText) errorMessage = errorText;
      }
      console.error(`API Error ${response.status} for ${endpoint}:`, errorMessage);

      if (response.status === 401) {
        this.clearToken();
        throw new ApiError(errorMessage || 'Unauthorized', 401);
      }

      if (response.status >= 502 && response.status <= 504) {
        networkManager.setOnline(false);
      }

      throw new Error(errorMessage);
    }

    return response.json();
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
    const res = await this.request<CurrentQuestionResponse>(`/game/question?_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    // Ask Cloudinary for a resized, compressed copy of the picture (see optimizeImageUrl).
    const question = res?.data?.question;
    if (question?.image_url) question.image_url = optimizeImageUrl(question.image_url);
    return res;
  }

  async getGameStatus(): Promise<GameStatusResponse> {
    return this.request<GameStatusResponse>('/game/status');
  }

  async submitAnswer(
    questionId: number,
    answerId?: number | null,
    stars: number = 3,
    typedAnswer?: string | null,
    attempts?: number
  ): Promise<SubmitAnswerResponse> {
    return this.request<SubmitAnswerResponse>('/game/answer', {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        answer_id: answerId || undefined,
        typed_answer: typedAnswer || undefined,
        stars,
        attempts,
      }),
    });
  }

  async getFeedbackAudios(): Promise<{
    praise: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean; map_id: number | null }>;
    cheer_up: Array<{ id: number; phrase: string; audio_url: string; is_active: boolean; map_id: number | null }>;
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/game/feedback-audios?_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) return { praise: [], cheer_up: [] };
      return res.json();
    } catch {
      return { praise: [], cheer_up: [] };
    }
  }
}

export const gameApi = new StudentGameApiClient();
