// Minimal token store. Tokens come from the API's /auth endpoints (Supabase Auth underneath).
// Note: localStorage is fine for a prototype; move the refresh token to an HttpOnly cookie for production.
const KEY = "instacloud.session";
export const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export type Session = { accessToken: string; refreshToken: string; expiresAt: number };

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
export const setSession = (s: Session) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(KEY);

let refreshing: Promise<Session | null> | null = null;

async function refresh(s: Session): Promise<Session | null> {
  refreshing ??= fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const { session } = await r.json();
      setSession(session);
      return session as Session;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** Returns a non-expired access token, refreshing it if it expires within 60 seconds. */
export async function getValidToken(): Promise<string | null> {
  let s = getSession();
  if (!s) return null;
  if (s.expiresAt * 1000 - Date.now() < 60_000) s = await refresh(s);
  if (!s) clearSession();
  return s?.accessToken ?? null;
}
