import { FEED_T, THUMB_T, transformUrl } from "../cloudinary.js";
import { query } from "../db.js";

export const extractHashtags = (caption: string) =>
  [...new Set([...caption.matchAll(/#([\p{L}\p{N}_]{1,50})/gu)].map((m) => m[1]!.toLowerCase()))];

const SELECT = `
  select p.post_id, p.image_url, p.caption, p.hashtags, p.likes_count, p.created_at,
         u.user_id as author_id, u.username, u.profile_pic_url,
         exists(select 1 from likes l where l.post_id = p.post_id and l.user_id = $1) as liked_by_me,
         (select count(*)::int from comments c where c.post_id = p.post_id) as comments_count
  from posts p join users u on u.user_id = p.user_id`;

export function serializePost(r: any) {
  return {
    id: r.post_id as string,
    imageUrl: transformUrl(r.image_url, FEED_T),
    thumbUrl: transformUrl(r.image_url, THUMB_T),
    caption: r.caption as string,
    hashtags: r.hashtags as string[],
    likesCount: r.likes_count as number,
    commentsCount: r.comments_count as number,
    likedByMe: r.liked_by_me as boolean,
    createdAt: r.created_at as string,
    author: { id: r.author_id as string, username: r.username as string, avatarUrl: r.profile_pic_url as string | null },
  };
}

/** Hydrate posts by id, preserving the given order (deleted posts are silently dropped). */
export async function postsByIds(ids: string[], viewerId: string) {
  if (!ids.length) return [];
  const { rows } = await query(`${SELECT} where p.post_id = any($2::uuid[])`, [viewerId, ids]);
  const byId = new Map(rows.map((r) => [r.post_id, r]));
  return ids.flatMap((id) => (byId.has(id) ? [serializePost(byId.get(id))] : []));
}

export async function postsWhere(viewerId: string, where: string, params: unknown[], limit = 30) {
  const { rows } = await query(
    `${SELECT} where ${where} order by p.created_at desc limit ${limit}`,
    [viewerId, ...params],
  );
  return rows.map(serializePost);
}
