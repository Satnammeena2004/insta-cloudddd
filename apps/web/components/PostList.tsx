import type { Post } from "@/lib/types";
import PostCard from "./PostCard";

export default function PostList({ posts, empty }: { posts: Post[] | null; empty: string }) {
  if (!posts) return <p className="muted">Loading…</p>;
  if (!posts.length) return <p className="muted">{empty}</p>;
  return <>{posts.map((p) => <PostCard key={p.id} post={p} />)}</>;
}
