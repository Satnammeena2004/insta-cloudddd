"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import type { Post } from "@/lib/types";
import { Grid3X3, Bookmark, UserRound, Settings, ChevronDown } from "lucide-react";
import Link from "next/link";

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
        <section className="profile-view">
          <header className="profile-header">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">{profile.user.username.slice(0, 1).toUpperCase()}</div>
            </div>
            <div className="profile-details">
              <div className="profile-title-row">
                <h1>{profile.user.username}</h1>
                {profile.user.isMe ? (
                  <>
                    <button className="profile-action secondary">Edit profile</button>
                    <button className="profile-action icon-only" aria-label="Profile settings"><Settings size={20} /></button>
                  </>
                ) : (
                  <>
                    <button className={profile.user.isFollowing ? "profile-action secondary" : "profile-action"} onClick={toggleFollow}>
                      {profile.user.isFollowing ? "Following" : "Follow"}
                    </button>
                    <button className="profile-action secondary">Message</button>
                    <button className="profile-action icon-only" aria-label="More options"><ChevronDown size={18} /></button>
                  </>
                )}
              </div>
              <div className="profile-stats">
                <span><strong>{profile.counts.posts}</strong> posts</span>
                <span><strong>{profile.counts.followers}</strong> followers</span>
                <span><strong>{profile.counts.following}</strong> following</span>
              </div>
              <div className="profile-bio">
                <strong>{profile.user.username}</strong>
                {profile.user.bio ? <p>{profile.user.bio}</p> : <p>Sharing moments and new perspectives.</p>}
              </div>
            </div>
          </header>

          {/* <div className="profile-highlights" aria-label="Profile highlights">
            {["Local", "Gallery", "Preserve", "Gear"].map((name) => (
              <button key={name} className="highlight">
                <span>{name.slice(0, 1)}</span>
                <strong>{name}</strong>
              </button>
            ))}
          </div> */}

          <div className="profile-tabs">
            <button className="active" aria-label="Posts"><Grid3X3 size={14} /><span>Posts</span></button>
            <button aria-label="Saved"><Bookmark size={14} /><span>Saved</span></button>
            <button aria-label="Tagged"><UserRound size={14} /><span>Tagged</span></button>
          </div>
        </section>
      )}
      {!error && (
        <section className="profile-grid">
          {posts === null ? (
            <p className="muted">Loading…</p>
          ) : !posts.length ? (
            <div className="profile-empty"><Grid3X3 size={34} /><h2>No posts yet</h2><p>Photos shared by {username} will appear here.</p></div>
          ) : (
            posts.map((post) => (
              <Link href={`/u/${post.author.username}`} key={post.id} className="profile-grid-item" aria-label={post.caption || "View post"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.thumbUrl || post.imageUrl} alt={post.caption || `Photo by ${post.author.username}`} />
                <div className="grid-overlay">
                  <span>♥ {post.likesCount}</span>
                  <span>● {post.commentsCount}</span>
                </div>
              </Link>
            ))
          )}
        </section>
      )}
    </AppShell>
  );
}
