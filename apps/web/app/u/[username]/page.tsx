"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PostList from "@/components/PostList";
import { api, ApiError } from "@/lib/api";
import type { Post } from "@/lib/types";

type Profile = {
  user: { id: string; username: string; bio: string; isFollowing: boolean; isMe: boolean };
  counts: { followers: number; following: number; posts: number };
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, list] = await Promise.all([
        api<Profile>(`/users/${username}`),
        api<{ posts: Post[] }>(`/users/${username}/posts`),
      ]);
      setProfile(p);
      setPosts(list.posts);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "No user with that name." : "Could not load profile.");
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    await api(`/users/${profile.user.id}/follow`, { method: profile.user.isFollowing ? "DELETE" : "POST" });
    load();
  }

  return (
    <AppShell>
      {error && <p className="error">{error}</p>}
      {profile && (
        <section className="profile">
          <h1>{profile.user.username}</h1>
          {profile.user.bio && <p>{profile.user.bio}</p>}
          <p className="muted">{profile.counts.posts} posts · {profile.counts.followers} followers · {profile.counts.following} following</p>
          {!profile.user.isMe && (
            <button className={profile.user.isFollowing ? "ghost" : ""} onClick={toggleFollow}>
              {profile.user.isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
        </section>
      )}
      {!error && <PostList posts={posts} empty="No posts yet." />}
    </AppShell>
  );
}
