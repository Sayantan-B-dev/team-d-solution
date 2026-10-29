type Entry = {
  value: unknown;
  expiresAt: number;
};

const globalForData = globalThis as unknown as {
  dlinkitDataCache?: Map<string, Entry>;
};

const cache = (globalForData.dlinkitDataCache ??= new Map<string, Entry>());
const MAX_ENTRIES = 500;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = 5_000): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
