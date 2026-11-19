import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { readFeed } from "../services/feed.js";
import { postsByIds } from "../services/posts.js";

export const feedRouter = Router();
feedRouter.use(requireAuth);

// GET /api/v1/feed?cursor=<score> — Redis ZSET first, Postgres JOIN on cache miss
feedRouter.get("/", async (req, res) => {
  const raw = req.query.cursor ? Number(req.query.cursor) : undefined;
  const cursor = raw !== undefined && Number.isFinite(raw) ? raw : undefined;
  const { ids, nextCursor, source } = await readFeed(req.userId, cursor);
  res.setHeader("X-Feed-Source", source);
  res.json({ posts: await postsByIds(ids, req.userId), nextCursor });
});
