import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// Load the monorepo-root .env (local dev). In Docker/cloud, real env vars are injected.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env"), quiet: true });

// Treat empty strings (e.g. `SENTRY_DSN=`) as "not set".
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  TRUST_PROXY: z.string().default("false"), // set to "1" behind Render / Cloud Run / NGINX

  // Required services
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z
    .url()
    .refine(
      (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
      "REDIS_URL must use redis:// or rediss://",
    ),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Optional services (features switch on when the key is present)
  SENTRY_DSN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("InstaCloud <onboarding@resend.dev>"),
  METRICS_TOKEN: z.string().optional(),

  // Run the background worker inside the API process (single free-tier container)
  INLINE_WORKER: bool,
});

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error("Invalid environment. Copy .env.example to .env and fill it in:\n");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
