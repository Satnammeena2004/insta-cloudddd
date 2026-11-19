"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_URL, getValidToken } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";

const text = (n: AppNotification) =>
  n.type === "like" ? `${n.fromUsername} liked your post`
  : n.type === "comment" ? `${n.fromUsername} commented on your post`
  : `${n.fromUsername} started following you`;

type NotificationContextValue = {
  items: AppNotification[];
  unread: number;
  markRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue>({
  items: [],
  unread: 0,
  markRead: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const alive = useRef(true);
  const seen = useRef(new Set<string>());
  const markRead = useCallback(() => setUnread(0), []);

  useEffect(() => {
    alive.current = true;
    let ws: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout>;

    async function connect() {
      const token = await getValidToken();
      if (!token || !alive.current) return;
      ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
      ws.onmessage = (e) => {
        const message = JSON.parse(e.data) as Partial<AppNotification> & { type?: string };
        if (message.type !== "like" && message.type !== "comment" && message.type !== "follow") return;
        const n = message as AppNotification;
        const key = `${n.type}:${n.fromUsername}:${n.postId ?? ""}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        setItems((prev) => [n, ...prev].slice(0, 50));
        setUnread((count) => count + 1);
      };
      ws.onclose = () => { if (alive.current) timer = setTimeout(connect, 3000); };
    }
    connect();
    return () => { alive.current = false; clearTimeout(timer); ws?.close(); };
  }, []);

  return (
    <NotificationContext.Provider value={{ items, unread, markRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export default function Notifications() {
  const { unread } = useNotifications();
  return (
    <span className="notification-icon" aria-label={`${unread} unread notifications`}>
      <Bell size={19} />
      {unread > 0 && <span className="badge">{unread}</span>}
    </span>
  );
}

export function ActivityPanel() {
  const { items, markRead } = useNotifications();
  useEffect(() => { markRead(); }, [markRead]);

  return (
    <section className="activity-panel">
      <div className="activity-heading">
        <p className="eyebrow">Notifications</p>
        <h1>Activity</h1>
      </div>
      {items.length === 0 ? (
        <div className="activity-empty">
          <Heart size={28} />
          <h2>No new activity</h2>
          <p>Likes, comments, and new followers will appear here.</p>
        </div>
      ) : (
        <div className="activity-list">
          {items.map((n, i) => (
            <article className="activity-item" key={`${n.type}-${n.fromUsername}-${n.createdAt}-${i}`}>
              <span className="activity-item-icon">
                {n.type === "like" ? <Heart size={18} fill="currentColor" /> : n.type === "comment" ? <MessageCircle size={18} /> : <UserPlus size={18} />}
              </span>
              <div><strong>{n.fromUsername}</strong><span>{text(n).replace(n.fromUsername, "").trim()}</span><small>{new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
