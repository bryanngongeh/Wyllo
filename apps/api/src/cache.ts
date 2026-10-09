import { createClient } from 'redis';

export interface ApiCache {
  getOrLoad<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T>;
  check(): Promise<void>;
  close(): Promise<void>;
}

class MemoryCache implements ApiCache {
  private readonly values = new Map<string, { expiresAt: number; value: string }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  async getOrLoad<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expiresAt > Date.now()) return JSON.parse(cached.value) as T;
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const promise = load().then((value) => {
      const encoded = JSON.stringify(value);
      if (Buffer.byteLength(encoded) <= 1_000_000) this.values.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, value: encoded });
      return value;
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  async check() {}
  async close() { this.values.clear(); this.inFlight.clear(); }
}

export async function createApiCache(redisUrl?: string): Promise<ApiCache> {
  if (!redisUrl) return new MemoryCache();
  const client = createClient({ url: redisUrl });
  client.on('error', () => undefined);
  await client.connect();
  const inFlight = new Map<string, Promise<unknown>>();
  return {
    async getOrLoad<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
      try {
        const cached = await client.get(key);
        if (cached) return JSON.parse(cached) as T;
      } catch {
        return load();
      }
      const pending = inFlight.get(key) as Promise<T> | undefined;
      if (pending) return pending;
      const promise = load().then(async (value) => {
        const encoded = JSON.stringify(value);
        if (Buffer.byteLength(encoded) <= 1_000_000) {
          try { await client.set(key, encoded, { EX: ttlSeconds }); } catch { /* cache failures do not fail public reads */ }
        }
        return value;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    },
    async check() { await client.ping(); },
    async close() { inFlight.clear(); if (client.isOpen) await client.quit(); }
  };
}