import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";

// Applies supabase/migrations/*.sql in order, once each. Run: npm run db:migrate
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../supabase/migrations");

await pool.query("create table if not exists _migrations (name text primary key, applied_at timestamptz default now())");
const done = new Set((await pool.query("select name from _migrations")).rows.map((r) => r.name));

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  console.log("applying", file);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    await client.query("insert into _migrations (name) values ($1)", [file]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
console.log("migrations up to date");
await pool.end();
