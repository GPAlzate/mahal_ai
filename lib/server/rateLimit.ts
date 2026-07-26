import { NextRequest, NextResponse } from 'next/server';

/**
 * Best-effort in-process rate limiting.
 *
 * State lives in the instance's memory, so on serverless it is per-instance and
 * resets on cold start. That makes it a speed bump rather than a guarantee — it
 * is here to blunt share-code brute forcing and runaway spend on the AI/upload
 * endpoints. Move this to a shared store (Upstash/Redis) before relying on it.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Bound the map so a flood of distinct keys cannot grow it without limit.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * Identify the caller. Falls back to a shared bucket when no IP is available,
 * which fails closed (everyone shares one budget) rather than open.
 */
export function callerKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Consume one token from a caller's budget.
 *
 * @param key - Bucket identity, usually `${route}:${callerKey(request)}`
 * @param limit - Requests allowed per window
 * @param windowMs - Window length in milliseconds
 * @returns A 429 response when the budget is exhausted, otherwise null
 */
export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    sweep(now);
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  existing.count += 1;

  if (existing.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  return null;
}
