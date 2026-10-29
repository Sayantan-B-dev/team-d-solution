export type RedirectCacheEntry = {
  url: string;
  expiresAt: number | null;
  cachedUntil: number;
};

const globalForCache = globalThis as unknown as {
  dlinkitRedirectCache?: Map<string, RedirectCacheEntry>;
};

const cache = (globalForCache.dlinkitRedirectCache ??= new Map<string, RedirectCacheEntry>());

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;

export function getCachedRedirect(code: string, now = Date.now()): RedirectCacheEntry | null {
  const entry = cache.get(code);
  if (!entry || entry.cachedUntil <= now) {
    if (entry) cache.delete(code);
    return null;
  }

  // Refresh recency so a hot link is not evicted as if it were cold.
  cache.delete(code);
  cache.set(code, entry);
  return entry;
}

export function cacheRedirect(code: string, url: string, expiresAt: number | null): RedirectCacheEntry {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  const entry: RedirectCacheEntry = {
    url,
    expiresAt,
    cachedUntil: Date.now() + CACHE_TTL_MS,
  };
  cache.set(code, entry);
  return entry;
}

export function invalidateRedirect(code: string): void {
  cache.delete(code);
}
