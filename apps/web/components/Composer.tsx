"use client";

import { useState } from "react";
import { api, uploadToCloudinary } from "@/lib/api";
import type { Post } from "@/lib/types";
import { ImagePlus } from "lucide-react";

export default function Composer({ onCreated }: { onCreated: (p: Post) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const form = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const { imageUrl, publicId } = await uploadToCloudinary(file); // browser -> Cloudinary directly
      const { post } = await api<{ post: Post }>("/posts", { method: "POST", body: JSON.stringify({ imageUrl, publicId, caption }) });
      setFile(null);
      setCaption("");
      form.reset();
      onCreated(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="composer-title"><strong>Share something real</strong><ImagePlus size={20} color="var(--accent)" /></div>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
      <textarea placeholder="Write a caption. Add #hashtags" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} />
      {error && <p className="error">{error}</p>}
      <button disabled={busy || !file}>{busy ? "Posting…" : "Post photo"}</button>
    </form>
  );
}
