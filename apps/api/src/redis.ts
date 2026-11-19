import { Redis } from "ioredis";
import { env } from "./env.js";

/** Shared command connection (feed cache, rate limiting, blacklist, publish). */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
redis.on("error", (e) => console.error("[redis]", e.message));

/** Dedicated connection for Pub/Sub subscriptions (a subscribed client can't run other commands). */
export const createSubscriber = () => {
  const sub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  sub.on("error", (e) => console.error("[redis:sub]", e.message));
  return sub;
};

/** BullMQ requires maxRetriesPerRequest: null. */
export const createBullConnection = () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** Run a cache operation; never let a Redis outage take the API down. */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[redis] degraded:", (e as Error).message);
    return fallback;
  }
}
