import "./sentry.js"; // must load first
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { attachRealtime } from "./realtime.js";
import { startWorker } from "./workers/media.js";

const server = createServer(createApp());
attachRealtime(server);
if (env.INLINE_WORKER) startWorker();

server.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
