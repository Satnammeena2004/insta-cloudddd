import { query } from "../db.js";
import { redis, safe } from "../redis.js";

export const FEED_MAX = 200; // posts kept per user
export const PAGE_SIZE = 20;
export const feedKey = (userId: string) => `feed:user:${userId}`;
const FEED_TTL_SECONDS = 7 * 24 * 3600;

// Only push into feeds that are already cached; otherwise the next read rebuilds from Postgres.
// (Pushing into a missing key would create a partial feed that looks like a complete cache hit.)
const PUSH_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
  redis.call('ZREMRANGEBYRANK', KEYS[1], 0, -(tonumber(ARGV[3]) + 1))
  return 1
end
return 0`;

export async function pushToFeeds(userIds: string[], postId: string, scoreMs: number) {
  if (!userIds.length) return;
  const pipe = redis.pipeline();
  for (const id of userIds) pipe.eval(PUSH_LUA, 1, feedKey(id), postId, scoreMs, FEED_MAX);
  await pipe.exec();
}

export const invalidateFeed = (userId: string) => safe(() => redis.del(feedKey(userId)), 0);

/** Cache miss path: posts from every other account, then refill the ZSET. */
export async function rebuildFeed(userId: string) {
  const { rows } = await query<{ post_id: string; ms: string }>(
    `select p.post_id, (extract(epoch from p.created_at) * 1000)::bigint as ms
       from posts p
      where p.user_id <> $1
      order by p.created_at desc limit ${FEED_MAX}`,
    [userId],
  );
  if (rows.length) {
    const key = feedKey(userId);
    const args = rows.flatMap((r) => [Number(r.ms), r.post_id]);
    await safe(
      () => redis.multi().del(key).zadd(key, ...args).expire(key, FEED_TTL_SECONDS).exec(),
      null,
    );
  }
  return rows.map((r) => ({ id: r.post_id, score: Number(r.ms) }));
}

export async function readFeed(userId: string, cursor?: number) {
  const key = feedKey(userId);
  const max = cursor === undefined ? "+inf" : `(${cursor}`;
  const flat = await safe(
    () => redis.zrevrangebyscore(key, max, "-inf", "WITHSCORES", "LIMIT", 0, PAGE_SIZE),
    [] as string[],
  );

  let items: { id: string; score: number }[] = [];
  for (let i = 0; i < flat.length; i += 2) items.push({ id: flat[i]!, score: Number(flat[i + 1]) });
  let source: "cache" | "db" = "cache";

  if (!items.length && cursor === undefined) {
    source = "db";
    items = (await rebuildFeed(userId)).slice(0, PAGE_SIZE);
  }

  if (items.length) {
    const ids = items.map((item) => item.id);
    const { rows } = await query<{ post_id: string }>(
      `select post_id from posts where post_id = any($1::uuid[]) and user_id <> $2`,
      [ids, userId],
    );
    const allowed = new Set(rows.map((row) => row.post_id));
    items = items.filter((item) => allowed.has(item.id));
  }

  // Recover old caches created before own-post filtering or by stale workers.
  if (!items.length && cursor === undefined) {
    source = "db";
    await invalidateFeed(userId);
    items = (await rebuildFeed(userId)).slice(0, PAGE_SIZE);
  }

  const nextCursor = items.length === PAGE_SIZE ? items[items.length - 1]!.score : null;
  return { ids: items.map((i) => i.id), nextCursor, source };
}
