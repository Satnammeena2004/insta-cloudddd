"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PostList from "@/components/PostList";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    api<{ posts: Post[] }>(`/posts/tag/${encodeURIComponent(tag)}`).then((d) => setPosts(d.posts)).catch(() => setPosts([]));
  }, [tag]);

  return (
    <AppShell>
      <h1>#{tag}</h1>
      <PostList posts={posts} empty="No posts with this tag yet." />
    </AppShell>
  );
}
