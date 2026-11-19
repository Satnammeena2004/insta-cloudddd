import { Queue } from "bullmq";
import { createBullConnection } from "./redis.js";

export const QUEUE_NAME = "instacloud-jobs";

export const JOBS = {
  NEW_POST_UPLOADED: "NEW_POST_UPLOADED",
  SEND_WELCOME_EMAIL: "SEND_WELCOME_EMAIL",
} as const;

export type NewPostJob = { postId: string; userId: string; publicId: string; createdAtMs: number };
export type WelcomeEmailJob = { to: string; username: string };

export const queue = new Queue(QUEUE_NAME, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const enqueueNewPost = (data: NewPostJob) => queue.add(JOBS.NEW_POST_UPLOADED, data);
export const enqueueWelcomeEmail = (data: WelcomeEmailJob) => queue.add(JOBS.SEND_WELCOME_EMAIL, data);
