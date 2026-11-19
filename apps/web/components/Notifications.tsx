"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, getValidToken } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";
import { Bell } from "lucide-react";

const text = (n: AppNotification) =>
  n.type === "like" ? `${n.fromUsername} liked your post`
  : n.type === "comment" ? `${n.fromUsername} commented on your post`
  : `${n.fromUsername} started following you`;

/** Live notifications over WebSocket (server side: Redis Pub/Sub). Reconnects automatically. */
export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let ws: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout>;

    async function connect() {
      const token = await getValidToken();
      if (!token || !alive.current) return;
      ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
      ws.onmessage = (e) => {
        const n = JSON.parse(e.data);
        if (n.type === "ready") return;
        setItems((prev) => [n, ...prev].slice(0, 20));
        setUnread((c) => c + 1);
      };
      ws.onclose = () => { if (alive.current) timer = setTimeout(connect, 3000); };
    }
    connect();
    return () => { alive.current = false; clearTimeout(timer); ws?.close(); };
  }, []);

  return (
    <div className="bell">
      <button className="ghost" aria-label="Notifications" onClick={() => { setOpen(!open); setUnread(0); }}>
        <Bell size={16} />{unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          {items.length === 0 ? <p className="muted">Nothing new yet.</p> : items.map((n, i) => <p key={i}>{text(n)}</p>)}
        </div>
      )}
    </div>
  );
}
