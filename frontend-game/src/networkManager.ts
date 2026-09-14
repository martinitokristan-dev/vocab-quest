export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkManager {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<NetworkStatusListener> = new Set();
  private heartbeatTimer: number | null = null;
  private isChecking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleBrowserOnline());
      window.addEventListener('offline', () => this.handleBrowserOffline());
    }
  }

  public get isOnline(): boolean {
    return this.online;
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify current status
    listener(this.online);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.online);
      } catch (err) {
        console.error('Error in network status listener:', err);
      }
    }
  }

  public setOnline(status: boolean) {
    if (this.online === status) return;
    this.online = status;
    this.notify();

    if (!this.online) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  private handleBrowserOnline() {
    // Browser says online, but verify with an actual ping to be 100% certain server is reachable
    void this.checkConnectionNow();
  }

  private handleBrowserOffline() {
    this.setOnline(false);
  }

  public reportRequestFailure(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const isNetworkErr =
      error instanceof TypeError ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Network request failed') ||
      msg.includes('net::ERR_') ||
      msg.includes('AbortError');

    if (isNetworkErr || !navigator.onLine) {
      this.setOnline(false);
    }
  }

  public async checkConnectionNow(): Promise<boolean> {
    if (this.isChecking) return this.online;
    this.isChecking = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Ping lightweight status endpoint with cache buster
      const res = await fetch(`${API_BASE_URL}/game/status?_ping=${Date.now()}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      // Any HTTP response (even 401 unauth) proves internet & server are reachable!
      const reachable = res.status < 500;
      this.setOnline(reachable);
      return reachable;
    } catch {
      this.setOnline(false);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      void this.checkConnectionNow();
    }, 2500);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const networkManager = new NetworkManager();
