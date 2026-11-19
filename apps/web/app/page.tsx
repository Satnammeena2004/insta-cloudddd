"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PostList from "@/components/PostList";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

type FeedResponse = { posts: Post[]; nextCursor: number | null };

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after?: number | null) => {
    try {
      const d = await api<FeedResponse>(`/feed${after ? `?cursor=${after}` : ""}`);
      setPosts((prev) => (after ? [...(prev ?? []), ...d.posts] : d.posts));
      setCursor(d.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feed");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <section className="feed">
        <div className="page-heading"><div><p className="eyebrow">Your feed</p><h1>Moments from your circle</h1></div><span className="feed-status">Following</span></div>
        {error && <p className="error">{error}</p>}
        <PostList posts={posts} empty="Your feed is empty. Post a photo or find people to follow." />
        {cursor && <button className="ghost wide" onClick={() => load(cursor)}>Load more</button>}
      </section>
    </AppShell>
  );
}
