import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../services/notify.js";

export const interactionsRouter = Router();
interactionsRouter.use(requireAuth);

const idParam = z.uuid();

async function postOwner(postId: string) {
  const { rows } = await query("select user_id from posts where post_id = $1", [postId]);
  return rows[0]?.user_id as string | undefined;
}
const usernameOf = async (userId: string) =>
  (await query("select username from users where user_id = $1", [userId])).rows[0].username as string;

// POST /api/v1/posts/:id/like — composite PK prevents duplicates; a trigger maintains likes_count
interactionsRouter.post("/:id/like", async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid post id" });
  const owner = await postOwner(id.data);
  if (!owner) return res.status(404).json({ error: "Post not found" });

  const ins = await query(
    "insert into likes (user_id, post_id) values ($1, $2) on conflict do nothing returning 1",
    [req.userId, id.data],
  );
  if (ins.rowCount) {
    await notify(owner, req.userId, { type: "like", fromUsername: await usernameOf(req.userId), postId: id.data });
  }
  res.status(204).end();
});

// DELETE /api/v1/posts/:id/like
interactionsRouter.delete("/:id/like", async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid post id" });
  await query("delete from likes where user_id = $1 and post_id = $2", [req.userId, id.data]);
  res.status(204).end();
});

// GET /api/v1/posts/:id/comments
interactionsRouter.get("/:id/comments", async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid post id" });
  const { rows } = await query(
    `select c.comment_id as id, c.comment_text as text, c.created_at as "createdAt", u.username
       from comments c join users u on u.user_id = c.user_id
      where c.post_id = $1 order by c.created_at asc limit 100`,
    [id.data],
  );
  res.json({ comments: rows });
});

// POST /api/v1/posts/:id/comments
interactionsRouter.post("/:id/comments", async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  const body = z.object({ text: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: "Comment must be 1-500 characters" });
  const owner = await postOwner(id.data);
  if (!owner) return res.status(404).json({ error: "Post not found" });

  const { rows } = await query(
    `insert into comments (post_id, user_id, comment_text) values ($1, $2, $3)
     returning comment_id as id, comment_text as text, created_at as "createdAt"`,
    [id.data, req.userId, body.data.text],
  );
  const username = await usernameOf(req.userId);
  await notify(owner, req.userId, { type: "comment", fromUsername: username, postId: id.data });
  res.status(201).json({ comment: { ...rows[0], username } });
});
