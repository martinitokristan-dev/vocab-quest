import { vi } from 'vitest';

/**
 * Creates a mock file object for testing file uploads
 * 
 * @param name - The filename
 * @param size - File size in bytes
 * @param type - MIME type
 * @returns A File object suitable for testing
 * 
 * @example
 * ```ts
 * const imageFile = createMockFile('test.jpg', 1024, 'image/jpeg');
 * ```
 */
export function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const blob = new Blob(['a'.repeat(size)], { type });
  return new File([blob], name, { type });
}

/**
 * Creates a mock Blob object for testing audio/video recording
 * 
 * @param size - Blob size in bytes
 * @param type - MIME type
 * @returns A Blob object suitable for testing
 * 
 * @example
 * ```ts
 * const audioBlob = createMockBlob(2048, 'audio/webm');
 * ```
 */
export function createMockBlob(size: number, type: string): Blob {
  return new Blob(['a'.repeat(size)], { type });
}

/**
 * Waits for a specified amount of time
 * Useful for testing time-dependent behavior
 * 
 * @param ms - Milliseconds to wait
 * @returns A promise that resolves after the specified time
 * 
 * @example
 * ```ts
 * await wait(1000); // Wait 1 second
 * ```
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Advances timers and flushes all pending promises
 * Useful when testing code that uses setTimeout/setInterval
 * 
 * @param ms - Milliseconds to advance
 * 
 * @example
 * ```ts
 * vi.useFakeTimers();
 * // ... code that uses setTimeout
 * await advanceTimersByTime(1000);
 * vi.useRealTimers();
 * ```
 */
export async function advanceTimersByTime(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await Promise.resolve(); // Flush pending promises
}

/**
 * Mock localStorage for testing
 */
export const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

/**
 * Mock sessionStorage for testing
 */
export const mockSessionStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

/**
 * Replaces the global localStorage with a mock version
 * Call this in your test setup to mock localStorage
 * 
 * @example
 * ```ts
 * beforeEach(() => {
 *   setupMockStorage();
 * });
 * ```
 */
export function setupMockStorage(): void {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  });
}

/**
 * Creates a spy on console methods to suppress logs during tests
 * 
 * @param methods - Array of console methods to suppress
 * @returns Cleanup function to restore console
 * 
 * @example
 * ```ts
 * const restore = suppressConsole(['error', 'warn']);
 * // ... test code that would normally log errors
 * restore();
 * ```
 */
export function suppressConsole(
  methods: Array<'log' | 'warn' | 'error' | 'info' | 'debug'> = ['error', 'warn']
): () => void {
  const spies = methods.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));

  return () => {
    spies.forEach((spy) => spy.mockRestore());
  };
}
