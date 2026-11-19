import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { userIdFromToken } from "./middleware/auth.js";
import { createSubscriber } from "./redis.js";

/** WebSocket gateway: Redis Pub/Sub `notifications:user:{id}` -> the user's open sockets. */
export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const sockets = new Map<string, Set<WebSocket>>();

  const sub = createSubscriber();
  sub.psubscribe("notifications:user:*").catch((e) => console.error("[ws] subscribe failed", e.message));
  sub.on("pmessage", (_pattern, channel, message) => {
    const userId = channel.slice("notifications:user:".length);
    sockets.get(userId)?.forEach((ws) => ws.readyState === WebSocket.OPEN && ws.send(message));
  });

  wss.on("connection", async (ws, req) => {
    const token = new URL(req.url ?? "", "http://x").searchParams.get("token");
    const userId = token ? await userIdFromToken(token) : null;
    if (!userId) return ws.close(4401, "unauthorized");

    if (!sockets.has(userId)) sockets.set(userId, new Set());
    sockets.get(userId)!.add(ws);
    ws.on("close", () => {
      sockets.get(userId)?.delete(ws);
      if (!sockets.get(userId)?.size) sockets.delete(userId);
    });
    ws.send(JSON.stringify({ type: "ready" }));
  });

  const heartbeat = setInterval(() => wss.clients.forEach((c) => c.ping()), 30_000);
  wss.on("close", () => clearInterval(heartbeat));
  return wss;
}
