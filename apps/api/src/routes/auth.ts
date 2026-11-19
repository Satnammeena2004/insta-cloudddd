import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { authClient, blacklistKey, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { enqueueWelcomeEmail } from "../queue.js";
import { redis, safe } from "../redis.js";
import { env } from "../env.js";

export const authRouter = Router();
authRouter.use(rateLimit("auth", 10)); // stricter than the global 60/min

const credentials = z.object({ email: z.email(), password: z.string().min(8).max(72) });
const registerBody = credentials.extend({ username: z.string().regex(/^[a-zA-Z0-9_.]{3,30}$/, "3-30 letters, numbers, _ or .") });

const sessionDto = (s: any) => ({
  accessToken: s.access_token as string,
  refreshToken: s.refresh_token as string,
  expiresAt: s.expires_at as number,
});

// POST /api/v1/auth/register — Supabase Auth hashes the password (bcrypt) and issues JWTs.
authRouter.post("/register", async (req, res) => {
  const body = registerBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: z.prettifyError(body.error) });
  const { email, password, username } = body.data;

  const taken = await query("select 1 from users where lower(username) = lower($1)", [username]);
  if (taken.rowCount) return res.status(409).json({ error: "Username is already taken" });

  const { data, error } = await authClient().auth.signUp({ email, password, options: { data: { username } } });
  if (error) return res.status(400).json({ error: error.message });

  await enqueueWelcomeEmail({ to: email, username }).catch((e) => console.error("[queue]", e.message));
  res.status(201).json({
    session: data.session ? sessionDto(data.session) : null,
    confirmationRequired: !data.session, // true when "Confirm email" is enabled in Supabase
  });
});

// POST /api/v1/auth/login
authRouter.post("/login", async (req, res) => {
  const body = credentials.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Valid email and password required" });
  const { data, error } = await authClient().auth.signInWithPassword(body.data);
  if (error || !data.session) return res.status(401).json({ error: error?.message ?? "Login failed" });
  res.json({ session: sessionDto(data.session) });
});

// POST /api/v1/auth/refresh — short-lived access token, long-lived refresh token
authRouter.post("/refresh", async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "refreshToken required" });
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: body.data.refreshToken });
  if (error || !data.session) return res.status(401).json({ error: "Refresh token invalid or expired" });
  res.json({ session: sessionDto(data.session) });
});

// POST /api/v1/auth/logout — blacklist the access token in Redis until it expires
authRouter.post("/logout", requireAuth, async (req, res) => {
  const exp = JSON.parse(Buffer.from(req.token.split(".")[1]!, "base64url").toString()).exp as number;
  const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
  await safe(() => redis.set(blacklistKey(req.token), "1", "EX", ttl), null);
  // Best effort: also revoke the Supabase session server-side.
  await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${req.token}` },
  }).catch(() => {});
  res.status(204).end();
});

// GET /api/v1/auth/me
authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await query(
    "select user_id as id, username, email, bio, profile_pic_url as \"avatarUrl\" from users where user_id = $1",
    [req.userId],
  );
  if (!rows[0]) return res.status(404).json({ error: "Profile not found" });
  res.json({ user: rows[0] });
});
