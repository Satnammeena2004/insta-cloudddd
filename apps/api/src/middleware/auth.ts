import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";
import { redis, safe } from "../redis.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
      token: string;
    }
  }
}

/** Fresh, stateless Supabase client per call (never share auth state between users). */
export const authClient = () =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const blacklistKey = (token: string) => `jwt:blacklist:${sha(token)}`;

/** Resolve a Supabase access token to a user id (blacklist check + 60s Redis cache). */
export async function userIdFromToken(token: string): Promise<string | null> {
  const hash = sha(token);
  if (await safe(() => redis.exists(`jwt:blacklist:${hash}`), 0)) return null;

  const cached = await safe(() => redis.get(`auth:${hash}`), null);
  if (cached) return cached;

  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) return null;
  await safe(() => redis.set(`auth:${hash}`, data.user.id, "EX", 60), null);
  return data.user.id;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  const userId = await userIdFromToken(token);
  if (!userId) return res.status(401).json({ error: "Invalid or expired token" });
  req.userId = userId;
  req.token = token;
  next();
}
