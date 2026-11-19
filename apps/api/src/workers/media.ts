import { Worker } from "bullmq";
import { cloudinary, FEED_T, THUMB_T } from "../cloudinary.js";
import { query } from "../db.js";
import { JOBS, QUEUE_NAME, type NewPostJob, type WelcomeEmailJob } from "../queue.js";
import { createBullConnection } from "../redis.js";
import { pushToFeeds } from "../services/feed.js";
import { sendWelcomeEmail } from "../services/mailer.js";
import { Sentry } from "../sentry.js";

/** Step 2 of the guide: pre-generate thumbnail + feed renditions (EXIF/GPS stripped). */
async function transformImage(publicId: string) {
  try {
    await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      eager: [{ raw_transformation: THUMB_T }, { raw_transformation: FEED_T }],
      eager_async: true,
    });
  } catch (e) {
    // Non-fatal: renditions are also generated lazily on first request.
    console.warn("[worker] cloudinary eager transform skipped:", (e as Error).message);
  }
}

/** Step 3 of the guide: fan-out the post id into every follower's cached feed. */
async function fanOut(job: NewPostJob) {
  let last = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { rows } = await query<{ follower_id: string }>(
      `select follower_id from follows where following_id = $1 and follower_id > $2 order by follower_id limit 1000`,
      [job.userId, last],
    );
    if (!rows.length) break;
    await pushToFeeds(rows.map((r) => r.follower_id), job.postId, job.createdAtMs);
    last = rows[rows.length - 1]!.follower_id;
  }
}

export function startWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case JOBS.NEW_POST_UPLOADED: {
          const data = job.data as NewPostJob;
          await transformImage(data.publicId);
          await fanOut(data);
          return;
        }
        case JOBS.SEND_WELCOME_EMAIL: {
          const data = job.data as WelcomeEmailJob;
          return sendWelcomeEmail(data.to, data.username);
        }
        default:
          console.warn("[worker] unknown job", job.name);
      }
    },
    { connection: createBullConnection(), concurrency: 5, drainDelay: 30 },
  );

  worker.on("completed", (job) => console.log(`[worker] ${job.name} ${job.id} done`));
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${job?.name} ${job?.id} failed:`, err.message);
    Sentry.captureException(err);
  });
  console.log("[worker] listening on queue", QUEUE_NAME);
  return worker;
}
