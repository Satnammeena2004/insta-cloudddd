import { Router } from "express";
import { z } from "zod";
import { isOwnCloudinaryUrl, signUpload, userFolder } from "../cloudinary.js";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { enqueueNewPost } from "../queue.js";
import { redis, safe } from "../redis.js";
import { extractHashtags, postsByIds, postsWhere } from "../services/posts.js";
import { countsKey } from "./users.js";

export const postsRouter = Router();
postsRouter.use(requireAuth);

// GET /api/v1/posts/upload-signature — step 1 of the direct-to-Cloudinary upload
postsRouter.get("/upload-signature", (req, res) => {
  res.json(signUpload(req.userId));
});

// GET /api/v1/posts/tag/:tag — GIN-indexed hashtag lookup
postsRouter.get("/tag/:tag", async (req, res) => {
  const tag = String(req.params.tag).toLowerCase();
  res.json({ posts: await postsWhere(req.userId, "p.hashtags @> array[$2]::text[]", [tag], 30) });
});

const createPost = z.object({
  imageUrl: z.url(),
  publicId: z.string().min(1),
  caption: z.string().max(2200).default(""),
});

// POST /api/v1/posts — step 5: lightweight JSON with the CDN URL + caption
postsRouter.post("/", async (req, res) => {
  const body = createPost.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: z.prettifyError(body.error) });
  const { imageUrl, publicId, caption } = body.data;

  if (!isOwnCloudinaryUrl(imageUrl) || !publicId.startsWith(`${userFolder(req.userId)}/`)) {
    return res.status(400).json({ error: "Image must be uploaded to your own Cloudinary folder" });
  }

  const { rows } = await query(
    `insert into posts (user_id, image_url, image_public_id, caption, hashtags)
     values ($1, $2, $3, $4, $5) returning post_id, (extract(epoch from created_at) * 1000)::bigint as ms`,
    [req.userId, imageUrl, publicId, caption, extractHashtags(caption)],
  );
  const { post_id, ms } = rows[0];

  await safe(() => redis.del(countsKey(req.userId)), 0);
  // Step 6: publish async event; the worker handles thumbnails + feed fan-out.
  await enqueueNewPost({ postId: post_id, userId: req.userId, publicId, createdAtMs: Number(ms) });

  const [post] = await postsByIds([post_id], req.userId);
  res.status(201).json({ post });
});

// GET /api/v1/posts/:id
postsRouter.get("/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid post id" });
  const [post] = await postsByIds([id.data], req.userId);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json({ post });
});

// DELETE /api/v1/posts/:id (own posts only)
postsRouter.delete("/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid post id" });
  const del = await query("delete from posts where post_id = $1 and user_id = $2", [id.data, req.userId]);
  if (!del.rowCount) return res.status(404).json({ error: "Post not found" });
  await safe(() => redis.del(countsKey(req.userId)), 0);
  res.status(204).end(); // stale ids in cached feeds are dropped during hydration
});
