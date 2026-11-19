"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth";
import Notifications, { NotificationsProvider } from "./Notifications";
import { Compass, Heart, Home, LogOut, PlusSquare, Search, Sparkles, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

/** Auth guard + header for signed-in pages. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; avatarUrl: string | null }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!getSession()) return void router.replace("/login");
    api<{ user: { username: string } }>("/auth/me").then((d) => setMe(d.user.username)).catch(() => {});
  }, [router]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      setSearchOpen(false);
      return;
    }

    setSearching(true);
    setSearchOpen(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await api<{ users: Array<{ id: string; username: string; avatarUrl: string | null }> }>(
          `/users?q=${encodeURIComponent(query)}`,
        );
        setSearchResults(data.users);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  const accountHref = me ? `/u/${me}` : "/login";
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/create", label: "Create", icon: PlusSquare },
    { href: "/activity", label: "Activity", icon: Heart },
    { href: accountHref, label: "Profile", icon: UserRound },
  ];

  return (
    <NotificationsProvider>
    <main className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>InstaCloud</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href} className={pathname === href ? "active" : ""}>
              <Icon size={22} /> <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button className="sign-out ghost" onClick={signOut}><LogOut size={19} /> <span>Log out</span></button>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <Link href="/" className="mobile-brand brand"><span className="brand-mark"><Sparkles size={15} /></span>InstaCloud</Link>
          <form className="top-search" onSubmit={(e) => { e.preventDefault(); if (searchResults[0]) router.push(`/u/${searchResults[0].username}`); }}>
            <div className="search-field">
              <Search size={16} />
              <input placeholder="Search people" aria-label="Find a user" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {searchOpen && (
              <div className="search-results">
                {searching ? (
                  <div className="search-status">Searching…</div>
                ) : searchResults.length ? (
                  searchResults.map((user) => (
                    <Link
                      key={user.id}
                      href={`/u/${user.username}`}
                      className="search-result"
                      onClick={() => { setSearch(""); setSearchOpen(false); }}
                    >
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" />
                      ) : (
                        <span className="search-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
                      )}
                      <span><strong>{user.username}</strong><small>View profile</small></span>
                    </Link>
                  ))
                ) : (
                  <div className="search-status">No users found</div>
                )}
              </div>
            )}
          </form>
          <div className="top-actions">
            <Notifications />
            <Link href={accountHref} className="top-profile">{me ? me : "Profile"}</Link>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className={pathname === href ? "active" : ""} aria-label={label}><Icon size={22} /></Link>
        ))}
      </nav>
    </main>
    </NotificationsProvider>
  );
}
