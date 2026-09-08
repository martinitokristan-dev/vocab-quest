import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock MediaStream
global.MediaStream = class MediaStream {
  getTracks() {
    return [{ stop: vi.fn(), kind: 'audio' }];
  }
} as any;

// Mock BroadcastChannel
global.BroadcastChannel = class BroadcastChannel {
  name: string;
  onmessage: ((event: any) => void) | null = null;
  private messageListeners = new Set<(event: any) => void>();
  static channels = new Map<string, Set<BroadcastChannel>>();

  constructor(name: string) {
    this.name = name;
    if (!BroadcastChannel.channels.has(name)) {
      BroadcastChannel.channels.set(name, new Set());
    }
    BroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: any) {
    const listeners = BroadcastChannel.channels.get(this.name);
    if (listeners) {
      listeners.forEach((ch) => {
        if (ch !== this) {
          const ev = { data: message };
          if (ch.onmessage) ch.onmessage(ev as any);
          ch.messageListeners.forEach((fn) => fn(ev as any));
        }
      });
    }
  }

  addEventListener(type: string, fn: (event: any) => void) {
    if (type === 'message') this.messageListeners.add(fn);
  }

  removeEventListener(type: string, fn: (event: any) => void) {
    if (type === 'message') this.messageListeners.delete(fn);
  }

  close() {
    BroadcastChannel.channels.get(this.name)?.delete(this);
  }
} as any;

// Mock MediaRecorder
global.MediaRecorder = class MediaRecorder {
  ondataavailable: ((event: any) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';

  constructor(public stream: MediaStream) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  static isTypeSupported(type: string): boolean {
    return true;
  }
} as any;

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [
        {
          stop: vi.fn(),
          kind: 'audio',
        },
      ],
    }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

// Mock Audio element
global.Audio = class Audio {
  public src: string = '';
  public volume: number = 1;
  public paused: boolean = true;
  public onended: (() => void) | null = null;
  public onpause: (() => void) | null = null;
  public onplay: (() => void) | null = null;

  constructor(src?: string) {
    if (src) this.src = src;
  }

  play() {
    this.paused = false;
    if (this.onplay) this.onplay();
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    if (this.onpause) this.onpause();
  }

  load() {}
} as any;
