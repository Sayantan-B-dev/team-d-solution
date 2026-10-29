type Bucket = {
  windowStart: number;
  current: number;
  previous: number;
};

const globalForLimit = globalThis as unknown as {
  dlinkitRateBuckets?: Map<string, Bucket>;
  dlinkitRateSweep?: number;
};

const buckets = (globalForLimit.dlinkitRateBuckets ??= new Map<string, Bucket>());

const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  /** Epoch milliseconds when the current window resets. */
  resetAt: number;
  /** Ready-to-send rate limit headers, including retry-after when blocked. */
  headers: Record<string, string>;
};

function buildHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
  retryAfter: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(Math.ceil(resetAt / 1000)),
  };

  if (retryAfter > 0) {
    headers["retry-after"] = String(retryAfter);
  }

  return headers;
}

/**
 * Weighted two-window rate limiter. It smooths the burst that a plain fixed
 * window allows at the boundary without storing every request timestamp.
 * Process-local: on Vercel each instance keeps its own counters.
 *
 * Headers are returned with the result so callers never need a second import.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const elapsed = now - windowStart;

  sweep(now);

  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { windowStart, current: 0, previous: 0 };
    buckets.set(key, bucket);
    evictIfNeeded();
  } else if (bucket.windowStart !== windowStart) {
    // Only carry the old count forward when the previous window is adjacent.
    bucket.previous = bucket.windowStart + windowMs === windowStart ? bucket.current : 0;
    bucket.current = 0;
    bucket.windowStart = windowStart;
  }

  const weighted = bucket.previous * (1 - elapsed / windowMs) + bucket.current;
  const resetAt = windowStart + windowMs;

  if (weighted >= limit) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfter,
      resetAt,
      headers: buildHeaders(limit, 0, resetAt, retryAfter),
    };
  }

  bucket.current += 1;
  const remaining = Math.max(0, Math.floor(limit - (weighted + 1)));

  return {
    ok: true,
    limit,
    remaining,
    retryAfter: 0,
    resetAt,
    headers: buildHeaders(limit, remaining, resetAt, 0),
  };
}

function sweep(now: number) {
  if (now - (globalForLimit.dlinkitRateSweep ?? 0) < SWEEP_INTERVAL_MS) return;

  // Window lengths are at most a day, so 25 hours is safely stale.
  const staleBefore = now - 25 * 60 * 60 * 1000;
  for (const [key, bucket] of buckets) {
    if (bucket.windowStart < staleBefore) buckets.delete(key);
  }

  globalForLimit.dlinkitRateSweep = now;
}

function evictIfNeeded() {
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (!oldest) return;
    buckets.delete(oldest);
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}
