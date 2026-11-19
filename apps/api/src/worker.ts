import "./sentry.js";
import { startWorker } from "./workers/media.js";

const worker = startWorker();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await worker.close();
    process.exit(0);
  });
}
