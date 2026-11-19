import type { NextFunction, Request, Response } from "express";
import { redis, safe } from "../redis.js";

/** Fixed-window limiter in Redis: key ratelimit:{scope}:{ip}:{minute}, INCR + EXPIRE 60. */
export function rateLimit(scope: string, max: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `ratelimit:${scope}:${req.ip}:${minute}`;
    const count = await safe(async () => {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, 60);
      return n;
    }, 0); // fail open if Redis is down

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count));
    if (count > max) {
      res.setHeader("Retry-After", 60);
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}
