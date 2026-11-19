import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { redis, safe } from "../redis.js";
import { invalidateFeed } from "../services/feed.js";
import { notify } from "../services/notify.js";
import { postsWhere } from "../services/posts.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

export const countsKey = (id: string) => `counts:user:${id}`;

async function getCounts(userId: string) {
  const cached = await safe(() => redis.get(countsKey(userId)), null);
  if (cached) return JSON.parse(cached) as { followers: number; following: number; posts: number };
  const { rows } = await query(
    `select (select count(*)::int from follows where following_id = $1) as followers,
            (select count(*)::int from follows where follower_id = $1) as following,
            (select count(*)::int from posts where user_id = $1) as posts`,
    [userId],
  );
  await safe(() => redis.set(countsKey(userId), JSON.stringify(rows[0]), "EX", 300), null);
  return rows[0] as { followers: number; following: number; posts: number };
}

// GET /api/v1/users?q=ali — username search
usersRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ users: [] });
  const { rows } = await query(
    `select user_id as id, username, profile_pic_url as "avatarUrl" from users
      where username ilike $1 order by username limit 10`,
    [`${q.replace(/[%_]/g, "")}%`],
  );
  res.json({ users: rows });
});

// PATCH /api/v1/users/me
usersRouter.patch("/me", async (req, res) => {
  const body = z.object({ bio: z.string().max(300) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "bio must be 300 characters or fewer" });
  await query("update users set bio = $1 where user_id = $2", [body.data.bio, req.userId]);
  res.status(204).end();
});

// GET /api/v1/users/:username
usersRouter.get("/:username", async (req, res) => {
  const { rows } = await query(
    `select user_id as id, username, bio, profile_pic_url as "avatarUrl",
            exists(select 1 from follows where follower_id = $2 and following_id = users.user_id) as "isFollowing"
       from users where lower(username) = lower($1)`,
    [req.params.username, req.userId],
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { ...user, isMe: user.id === req.userId }, counts: await getCounts(user.id) });
});

// GET /api/v1/users/:username/posts
usersRouter.get("/:username/posts", async (req, res) => {
  res.json({ posts: await postsWhere(req.userId, "lower(u.username) = lower($2)", [req.params.username], 30) });
});

// POST /api/v1/users/:id/follow
usersRouter.post("/:id/follow", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid user id" });
  if (id.data === req.userId) return res.status(400).json({ error: "You can't follow yourself" });

  const target = await query("select 1 from users where user_id = $1", [id.data]);
  if (!target.rowCount) return res.status(404).json({ error: "User not found" });

  const ins = await query(
    "insert into follows (follower_id, following_id) values ($1, $2) on conflict do nothing returning 1",
    [req.userId, id.data],
  );
  if (ins.rowCount) {
    // Rebuild the follower's feed from Postgres next read (includes the new followee's posts).
    await Promise.all([invalidateFeed(req.userId), safe(() => redis.del(countsKey(req.userId), countsKey(id.data)), 0)]);
    const me = await query("select username from users where user_id = $1", [req.userId]);
    await notify(id.data, req.userId, { type: "follow", fromUsername: me.rows[0].username });
  }
  res.status(204).end();
});

// DELETE /api/v1/users/:id/follow
usersRouter.delete("/:id/follow", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid user id" });
  await query("delete from follows where follower_id = $1 and following_id = $2", [req.userId, id.data]);
  await Promise.all([invalidateFeed(req.userId), safe(() => redis.del(countsKey(req.userId), countsKey(id.data)), 0)]);
  res.status(204).end();
});
