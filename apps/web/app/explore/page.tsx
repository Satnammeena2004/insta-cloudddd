"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";
import Link from "next/link";

export default function ExplorePage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const load = useCallback(async () => {
    try {
      const { posts: discovered } = await api<{ posts: Post[] }>("/posts/explore");
      setPosts(discovered);
    } catch {
      setPosts([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <section className="feed">
        <div className="page-heading"><div><p className="eyebrow">Discover</p><h1>Explore</h1></div></div>
        <p className="muted explore-copy">Find inspiration and new moments from the people in your community.</p>
        {posts === null ? (
          <p className="muted">Loading…</p>
        ) : !posts.length ? (
          <p className="muted">Nothing to explore yet.</p>
        ) : (
          <div className="explore-grid">
            {posts.map((post) => (
              <Link href={`/u/${post.author.username}`} key={post.id} className="explore-grid-item" aria-label={`View ${post.author.username}'s post`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.thumbUrl || post.imageUrl} alt={post.caption || `Photo by ${post.author.username}`} />
                <div className="explore-overlay">
                  <span>♥ {post.likesCount}</span>
                  <span>● {post.commentsCount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
