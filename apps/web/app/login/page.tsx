"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_URL, setSession } from "@/lib/auth";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setNotice(null);
  }

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
    <main className="auth-page">
      <section className="auth-card">
        <aside className="auth-story">
          <div className="auth-brand"><span><Sparkles size={18} /></span>Momento</div>
          <div className="auth-story-copy">
            <p>Share your world</p>
            <h1>Moments feel closer here.</h1>
            <span>Follow the people you love and share the moments that matter.</span>
          </div>
          <div className="story-orbits" aria-hidden="true"><span /><span /><span /></div>
        </aside>

        <div className="auth-panel">
          <div className="auth-mobile-brand"><span><Sparkles size={16} /></span>Momento</div>
          <div className="auth-heading">
            <p>{mode === "login" ? "Welcome back" : "Join Momento"}</p>
            <h2>{mode === "login" ? "Log in to continue" : "Create your account"}</h2>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label className="auth-field">
                <span>Username</span>
                <div>
                  <UserRound size={18} />
                  <input placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} pattern="[a-zA-Z0-9_.]{3,30}" title="3-30 letters, numbers, _ or ." autoComplete="username" required />
                </div>
              </label>
            )}
            <label className="auth-field">
              <span>Email</span>
              <div>
                <Mail size={18} />
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div>
                <LockKeyhole size={18} />
                <input type={showPassword ? "text" : "password"} placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {mode === "register" && password && (
              <div className="password-strength" aria-label="Password strength">
                {[1, 2, 3].map((level) => <span key={level} className={password.length >= level * 4 ? "filled" : ""} />)}
                <small>{password.length < 8 ? "Use at least 8 characters" : "Strong password"}</small>
              </div>
            )}
            {error && <div className="auth-message error" role="alert">{error}</div>}
            {notice && <div className="auth-message success" role="status">{notice}</div>}

            <button className="auth-submit" disabled={busy}>
              <span>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</span>
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "New to Momento?" : "Already have an account?"}
            <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Create account" : "Log in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
