import { NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (now > record.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * In-memory sliding window rate limiter.
 * Returns { success, remaining } — call early in your route handler.
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || now > record.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}

/** Convenience: returns a 429 response if rate-limited, or null if OK. */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs?: number
): NextResponse | null {
  const { success, remaining } = rateLimit(identifier, limit, windowMs);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((windowMs ?? 60_000) / 1000)) },
      }
    );
  }
  // Attach remaining header info (caller can use or ignore)
  void remaining;
  return null;
}
