import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Redis } from "ioredis";
import { config } from "./config";

/**
 * Redis holds short-lived state: login sessions, OAuth handshakes and rate-limit
 * counters. Works with a local Redis or Upstash (`rediss://` URL).
 */
export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
redis.on("error", (e) => console.error("redis error:", e.message));

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

// ── sessions ─────────────────────────────────────────────────
// Only a hash of the token is stored, so a Redis leak can't be replayed as logins.

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  await redis.set(`sess:${sha(token)}`, userId, "EX", SESSION_TTL);
  return token;
}

export async function resolveSession(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  return redis.get(`sess:${sha(token)}`);
}

export async function destroySession(token: string) {
  await redis.del(`sess:${sha(token)}`);
}

// ── one-time values (OAuth state) ────────────────────────────

export async function putOnce(key: string, value: object, ttlSec: number) {
  await redis.set(`once:${key}`, JSON.stringify(value), "EX", ttlSec);
}

export async function takeOnce<T>(key: string): Promise<T | null> {
  const v = await redis.getdel(`once:${key}`);
  return v ? (JSON.parse(v) as T) : null;
}

// ── rate limiting ────────────────────────────────────────────

/**
 * Fixed-window counter. Returns true if the call is allowed.
 * Fails open: if Redis is down, the game keeps working.
 */
export async function allow(key: string, max: number, windowSec: number): Promise<boolean> {
  const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  try {
    const res = await redis.multi().incr(k).expire(k, windowSec).exec();
    const n = Number(res?.[0]?.[1] ?? 0);
    return n <= max;
  } catch {
    return true;
  }
}

export class RateLimited extends Error {
  constructor(what = "Too many requests") {
    super(`${what}. Please wait a moment.`);
  }
}

export async function limit(key: string, max: number, windowSec: number, what?: string) {
  if (!(await allow(key, max, windowSec))) throw new RateLimited(what);
}

/** The visitor's IP, honouring the proxy in front of us only when configured to. */
export function clientIp(req: IncomingMessage): string {
  const h = req.headers;
  if (config.trustProxy === "cloudflare" && typeof h["cf-connecting-ip"] === "string") return h["cf-connecting-ip"];
  if (config.trustProxy === "true" && typeof h["x-forwarded-for"] === "string") return h["x-forwarded-for"].split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}
