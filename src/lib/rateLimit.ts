import { NextRequest } from "next/server";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix timestamp in ms
  retryAfterSeconds: number;
};

// In-memory sliding window store: key -> array of request timestamps (ms)
const memoryStore = new Map<string, number[]>();

// Last cleanup timestamp
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000; // clean expired entries every 1 min

function cleanupMemoryStore(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, timestamps] of memoryStore.entries()) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, valid);
    }
  }
}

/**
 * Extracts the client's public IP address from standard reverse-proxy headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0].trim();
    if (ip) return ip;
  }

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Sliding-window rate limiter.
 * Supports Upstash Redis REST if credentials are provided in env,
 * otherwise runs a robust in-memory sliding window (zero-cost, zero-config).
 *
 * @param key Unique identifier (e.g. `chat:ip:1.2.3.4` or `chat:user:user_123`)
 * @param limit Maximum requests permitted in the window
 * @param windowSeconds Time window duration in seconds
 */
export async function rateLimit(
  key: string,
  limit: number = 30,
  windowSeconds: number = 600
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // 1. Try Upstash Redis if configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `ratelimit:${key}`;
      const clearBefore = now - windowMs;

      // Upstash REST Pipeline:
      // ZREMRANGEBYSCORE key 0 clearBefore
      // ZADD key now now
      // ZCARD key
      // EXPIRE key windowSeconds
      const pipelineUrl = `${upstashUrl}/pipeline`;
      const res = await fetch(pipelineUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["ZREMRANGEBYSCORE", redisKey, "0", String(clearBefore)],
          ["ZADD", redisKey, String(now), String(now)],
          ["ZCARD", redisKey],
          ["EXPIRE", redisKey, String(windowSeconds)],
        ]),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const results = (await res.json()) as Array<{ result: any }>;
        const count = typeof results[2]?.result === "number" ? results[2].result : 1;
        const remaining = Math.max(0, limit - count);
        const success = count <= limit;
        const reset = now + windowMs;
        const retryAfterSeconds = success ? 0 : windowSeconds;

        return { success, limit, remaining, reset, retryAfterSeconds };
      }
    } catch (err) {
      console.warn("[rateLimit] Upstash call failed, falling back to memory:", err);
    }
  }

  // 2. In-memory sliding window implementation
  cleanupMemoryStore(windowMs);

  const timestamps = memoryStore.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length < limit) {
    validTimestamps.push(now);
    memoryStore.set(key, validTimestamps);
    const remaining = limit - validTimestamps.length;
    return {
      success: true,
      limit,
      remaining,
      reset: now + windowMs,
      retryAfterSeconds: 0,
    };
  }

  // Limit exceeded
  const oldestInWindow = validTimestamps[0] || now;
  const reset = oldestInWindow + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - now) / 1000));

  return {
    success: false,
    limit,
    remaining: 0,
    reset,
    retryAfterSeconds,
  };
}
