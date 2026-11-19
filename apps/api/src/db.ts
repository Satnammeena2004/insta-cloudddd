import pg from "pg";
import { env } from "./env.js";

const local = /@(localhost|127\.0\.0\.1|postgres)[:/]/.test(env.DATABASE_URL);

// Mirrors the guide's pool settings (pool_size=5, max_overflow=10 -> max 15).
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30_000,
  ssl: local ? undefined : { rejectUnauthorized: false },
});

export const query = <T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) =>
  pool.query<T>(text, params);
