"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";
import Notifications from "./Notifications";
import { Search, Sparkles } from "lucide-react";

/** Auth guard + header for signed-in pages. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!getSession()) return void router.replace("/login");
    api<{ user: { username: string } }>("/auth/me").then((d) => setMe(d.user.username)).catch(() => {});
  }, [router]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  return (
    <main>
      <header className="bar">
        <Link href="/" className="brand"><span className="brand-mark"><Sparkles size={16} /></span>InstaCloud</Link>
        <form onSubmit={(e) => { e.preventDefault(); if (search.trim()) router.push(`/u/${search.trim()}`); }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 13, top: 12, color: "var(--muted)" }} />
            <input style={{ paddingLeft: 38 }} placeholder="Find a user" aria-label="Find a user" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </form>
        <nav>
          {me && <Link href={`/u/${me}`}>{me}</Link>}
          <Notifications />
          <button className="ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      {children}
    </main>
  );
}
