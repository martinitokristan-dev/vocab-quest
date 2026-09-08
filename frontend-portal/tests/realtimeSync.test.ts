import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { broadcastSync, subscribeSync, type SyncMessage } from '../src/utils/realtimeSync';
import { api, type FeedbackAudioItem, type FeedbackAudioResponse } from '../src/services/api';

describe('Real-Time Cross-Tab Sync (Zero Polling, Zero RAM Overhead)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    api.invalidateCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('broadcastSync & subscribeSync', () => {
    it('should broadcast FEEDBACK_AUDIO_CHANGED to subscribers', async () => {
      const receivedMessages: SyncMessage[] = [];
      const unsubscribe = subscribeSync((msg) => {
        receivedMessages.push(msg);
      });

      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ type: 'FEEDBACK_AUDIO_CHANGED' });

      unsubscribe();
    });

    it('should broadcast QUESTION_CHANGED with mapId to subscribers', async () => {
      const receivedMessages: SyncMessage[] = [];
      const unsubscribe = subscribeSync((msg) => {
        receivedMessages.push(msg);
      });

      broadcastSync({ type: 'QUESTION_CHANGED', mapId: 2 });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ type: 'QUESTION_CHANGED', mapId: 2 });

      unsubscribe();
    });

    it('should broadcast to multiple subscribers simultaneously (Teacher + Game tabs)', async () => {
      const teacherReceived: SyncMessage[] = [];
      const gameTab1Received: SyncMessage[] = [];
      const gameTab2Received: SyncMessage[] = [];

      const unsubTeacher = subscribeSync((msg) => teacherReceived.push(msg));
      const unsubGame1 = subscribeSync((msg) => gameTab1Received.push(msg));
      const unsubGame2 = subscribeSync((msg) => gameTab2Received.push(msg));

      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });

      expect(teacherReceived).toHaveLength(1);
      expect(gameTab1Received).toHaveLength(1);
      expect(gameTab2Received).toHaveLength(1);

      unsubTeacher();
      unsubGame1();
      unsubGame2();
    });

    it('should stop receiving messages after unsubscribe is called', async () => {
      const received: SyncMessage[] = [];
      const unsubscribe = subscribeSync((msg) => received.push(msg));

      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
      expect(received).toHaveLength(1);

      unsubscribe();

      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
      expect(received).toHaveLength(1); // unchanged
    });
  });

  describe('API Cache Bypassing for Realtime Fetching', () => {
    it('should cache getFeedbackAudios by default, and bypass cache when skipCache=true', async () => {
      const mockInitialResponse: FeedbackAudioResponse = {
        data: [
          {
            id: 1,
            type: 'praise',
            phrase: 'Magaling!',
            audio_url: '/audio/magaling.mp3',
            is_active: true,
            map_id: null,
            created_at: '2026-09-09T00:00:00Z',
            updated_at: '2026-09-09T00:00:00Z',
          },
        ],
      };

      const mockUpdatedResponse: FeedbackAudioResponse = {
        data: [
          ...mockInitialResponse.data,
          {
            id: 2,
            type: 'praise',
            phrase: 'Napakahusay!',
            audio_url: '/audio/napakahusay.mp3',
            is_active: true,
            map_id: null,
            created_at: '2026-09-09T00:01:00Z',
            updated_at: '2026-09-09T00:01:00Z',
          },
        ],
      };

      let fetchCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        fetchCount++;
        const data = fetchCount === 1 ? mockInitialResponse : mockUpdatedResponse;
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // 1. Initial fetch: hits network (fetchCount = 1)
      const res1 = await api.getFeedbackAudios();
      expect(res1.data).toHaveLength(1);
      expect(fetchCount).toBe(1);

      // 2. Second fetch without skipCache: uses memory cache (fetchCount stays 1)
      const res2 = await api.getFeedbackAudios();
      expect(res2.data).toHaveLength(1);
      expect(fetchCount).toBe(1);

      // 3. Third fetch with skipCache = true (authoritative real-time sync): bypasses cache (fetchCount = 2)
      const res3 = await api.getFeedbackAudios(true);
      expect(res3.data).toHaveLength(2);
      expect(res3.data[1].phrase).toBe('Napakahusay!');
      expect(fetchCount).toBe(2);
    });

    it('should bypass cache when getQuestions is called with skipCache=true', async () => {
      let fetchCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        fetchCount++;
        const data = {
          data: [
            {
              id: 101,
              map_id: 1,
              order_index: 0,
              sentence: 'The test question sentence',
              highlighted_word: 'question',
              has_context_highlight: false,
              has_image: false,
              answers: [],
            },
          ],
        };
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // 1. First fetch: hits network
      await api.getQuestions(1);
      expect(fetchCount).toBe(1);

      // 2. Second fetch without skipCache: cached
      await api.getQuestions(1);
      expect(fetchCount).toBe(1);

      // 3. Silent refresh with skipCache = true: hits network
      await api.getQuestions(1, true);
      expect(fetchCount).toBe(2);
    });
  });

  describe('Mock API End-to-End Sync Flow: Teacher Upload -> Broadcast -> Game Tab Refresh', () => {
    it('should simulate teacher saving feedback audio and game tab updating without page reload', async () => {
      // In-memory mock database
      const mockDb: FeedbackAudioItem[] = [
        {
          id: 1,
          type: 'praise',
          phrase: 'Mahusay!',
          audio_url: 'https://res.cloudinary.com/demo/video/upload/v1/praise1.mp3',
          is_active: true,
          map_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Mock server fetch handler
      vi.spyOn(global, 'fetch').mockImplementation(async (url: any, options: any) => {
        const urlStr = String(url);
        const method = options?.method || 'GET';

        // GET /feedback-audios
        if (urlStr.includes('/feedback-audios') && method === 'GET') {
          return new Response(JSON.stringify({ data: [...mockDb] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // POST /feedback-audios
        if (urlStr.includes('/feedback-audios') && method === 'POST') {
          const newItem: FeedbackAudioItem = {
            id: 2,
            type: 'cheer_up',
            phrase: 'Kaya mo yan!',
            audio_url: 'https://res.cloudinary.com/demo/video/upload/v1/cheer2.mp3',
            is_active: true,
            map_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          mockDb.push(newItem);
          return new Response(JSON.stringify({ message: 'Uploaded successfully', data: newItem }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ message: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // --- 1. Game client state simulation ---
      let gameClientAudioList: FeedbackAudioItem[] = [];
      const gameClientFetch = async () => {
        const res = await api.getFeedbackAudios(true);
        gameClientAudioList = res.data;
      };

      // Game boots up and loads audios once
      await gameClientFetch();
      expect(gameClientAudioList).toHaveLength(1);
      expect(gameClientAudioList[0].phrase).toBe('Mahusay!');

      // Game registers real-time sync listener (0 timers, 0 RAM overhead)
      const unsubGame = subscribeSync(async (msg) => {
        if (msg.type === 'FEEDBACK_AUDIO_CHANGED') {
          await gameClientFetch();
        }
      });

      // --- 2. Teacher uploads new feedback audio in Teacher Portal ---
      const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
      await api.uploadFeedbackAudio({
        type: 'cheer_up',
        phrase: 'Kaya mo yan!',
        audio_file: mockAudioBlob,
      });

      // Teacher portal broadcasts the real-time event
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });

      // Wait for async gameClientFetch to resolve
      await vi.waitFor(() => {
        expect(gameClientAudioList).toHaveLength(2);
      });

      // --- 4. Teacher toggles audio active status ---
      mockDb[0].is_active = false;
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
      await vi.waitFor(() => {
        expect(gameClientAudioList[0].is_active).toBe(false);
      });

      // --- 5. Teacher deletes feedback audio ---
      mockDb.splice(0, 1);
      broadcastSync({ type: 'FEEDBACK_AUDIO_CHANGED' });
      await vi.waitFor(() => {
        expect(gameClientAudioList).toHaveLength(1);
        expect(gameClientAudioList[0].id).toBe(2);
      });

      unsubGame();
    });

    it('should simulate teacher editing a question and subscriber re-fetching without reload', async () => {
      let mockQuestions = [
        {
          id: 50,
          map_id: 1,
          order_index: 0,
          sentence: 'Original sentence without clue',
          highlighted_word: 'clue',
          context_clue: null,
          has_context_highlight: false,
          has_image: false,
          answers: [],
        },
      ];

      vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/maps/1/questions')) {
          return new Response(JSON.stringify({ data: mockQuestions }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ message: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      let currentQuestions: any[] = [];
      const fetchQuestions = async () => {
        const res = await api.getQuestions(1, true);
        currentQuestions = res.data;
      };

      await fetchQuestions();
      expect(currentQuestions[0].sentence).toBe('Original sentence without clue');

      // Subscribe to real-time question sync
      const unsub = subscribeSync(async (msg) => {
        if (msg.type === 'QUESTION_CHANGED' && (msg.mapId === 1 || !msg.mapId)) {
          await fetchQuestions();
        }
      });

      // Teacher edits the question with voiceover/sentence
      mockQuestions = [
        {
          ...mockQuestions[0],
          sentence: 'Updated sentence with voiceover and context clue',
          context_clue: 'helpful context clue',
        },
      ];

      // Broadcast change
      broadcastSync({ type: 'QUESTION_CHANGED', mapId: 1 });

      await vi.waitFor(() => {
        expect(currentQuestions[0].sentence).toBe('Updated sentence with voiceover and context clue');
        expect(currentQuestions[0].context_clue).toBe('helpful context clue');
      });

      unsub();
    });
  });
});
