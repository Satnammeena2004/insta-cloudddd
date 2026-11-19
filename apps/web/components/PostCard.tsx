"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Comment, Post } from "@/lib/types";
import { Heart, MessageCircle } from "lucide-react";
import { motion } from "motion/react";

function Caption({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, i) =>
        part.startsWith("#") ? <Link key={i} href={`/tags/${part.slice(1).toLowerCase()}`}>{part}</Link> : part,
      )}
    </>
  );
}

export default function PostCard({ post: initial }: { post: Post }) {
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");

  async function toggleLike() {
    const liked = !post.likedByMe;
    setPost({ ...post, likedByMe: liked, likesCount: post.likesCount + (liked ? 1 : -1) }); // optimistic
    await api(`/posts/${post.id}/like`, { method: liked ? "POST" : "DELETE" }).catch(() => setPost(post));
  }

  async function toggleComments() {
    if (comments) return setComments(null);
    setComments((await api<{ comments: Comment[] }>(`/posts/${post.id}/comments`)).comments);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const { comment } = await api<{ comment: Comment }>(`/posts/${post.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    setComments([...(comments ?? []), comment]);
    setPost({ ...post, commentsCount: post.commentsCount + 1 });
    setText("");
  }

  return (
    <motion.article className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
      <div className="meta"><span className="avatar">{post.author.username.slice(0, 1).toUpperCase()}</span><Link href={`/u/${post.author.username}`}>{post.author.username}</Link></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.imageUrl} alt={post.caption || `Photo by ${post.author.username}`} />
      <div className="body">
        <div className="actions">
          <button className={post.likedByMe ? "" : "ghost"} onClick={toggleLike} aria-pressed={post.likedByMe}>
            <Heart size={15} fill={post.likedByMe ? "currentColor" : "none"} /> {post.likesCount}
          </button>
          <button className="ghost" onClick={toggleComments}><MessageCircle size={15} /> {post.commentsCount}</button>
        </div>
        {post.caption && <p><Caption text={post.caption} /></p>}
        {comments && (
          <div className="comments">
            {comments.map((c) => <p key={c.id}><strong>{c.username}</strong> {c.text}</p>)}
            <form onSubmit={addComment} className="inline">
              <input placeholder="Add a comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} required />
              <button>Post</button>
            </form>
          </div>
        )}
      </div>
    </motion.article>
  );
}
