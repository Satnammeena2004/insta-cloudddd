"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_URL, setSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, username }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      if (body.session) {
        setSession(body.session);
        router.replace("/");
      } else {
        setNotice("Check your email to confirm your account, then log in.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>InstaCloud</h1>
      <p className="muted">{mode === "login" ? "Log in to your account." : "Create an account."}</p>
      <form className="stack" onSubmit={submit}>
        {mode === "register" && (
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} pattern="[a-zA-Z0-9_.]{3,30}" title="3-30 letters, numbers, _ or ." required />
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        {error && <p className="error">{error}</p>}
        {notice && <p className="muted">{notice}</p>}
        <button disabled={busy}>{mode === "login" ? "Log in" : "Create account"}</button>
        <button type="button" className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
        </button>
      </form>
    </main>
  );
}
