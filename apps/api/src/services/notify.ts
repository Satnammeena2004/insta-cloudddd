import { redis, safe } from "../redis.js";

export type Notification = {
  type: "like" | "comment" | "follow";
  fromUsername: string;
  postId?: string;
  createdAt: string;
};

export const channelFor = (userId: string) => `notifications:user:${userId}`;

export function notify(toUserId: string, fromUserId: string, n: Omit<Notification, "createdAt">) {
  if (toUserId === fromUserId) return Promise.resolve(0); // don't notify yourself
  const payload: Notification = { ...n, createdAt: new Date().toISOString() };
  return safe(() => redis.publish(channelFor(toUserId), JSON.stringify(payload)), 0);
}
