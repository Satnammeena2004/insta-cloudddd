import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { env } from "./env.js";
import { metricsHandler, metricsMiddleware } from "./middleware/metrics.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authRouter } from "./routes/auth.js";
import { feedRouter } from "./routes/feed.js";
import { interactionsRouter } from "./routes/interactions.js";
import { postsRouter } from "./routes/posts.js";
import { usersRouter } from "./routes/users.js";
import { Sentry } from "./sentry.js";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

export function createApp() {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY === "false" ? false : isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY));

  // --- Gateway layer: security headers, CORS, metrics, rate limiting ---
  app.use(helmet());
//@ts-ignore
  app.use(cors({ origin: process.env.WEB_ORIGIN.split(","), credentials: true }));
  app.use(metricsMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" })); // uptime monitors (Better Stack)
  app.get("/metrics", metricsHandler); // Prometheus / Grafana Cloud

  const v1 = express.Router();
  v1.use(rateLimit("global", 60)); // 60 req/min per IP
  v1.use("/auth", authRouter);
  v1.use("/users", usersRouter);
  v1.use("/feed", feedRouter);
  v1.use("/posts", interactionsRouter); // /:id/like, /:id/comments
  v1.use("/posts", postsRouter);
  app.use("/api/v1", v1);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  Sentry.setupExpressErrorHandler(app);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: "Invalid request" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
