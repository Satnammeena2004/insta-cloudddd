# InstaCloud

Instagram-style photo network on a cloud-native stack: **Next.js** web, **Node.js (Express)** API,
**BullMQ** background worker, **Supabase** (Postgres + Auth), **Upstash Redis**, **Cloudinary**.

For the complete local and Docker setup, third-party account instructions,
environment configuration, and deployment checklist, see
[SETUP.md](./SETUP.md).

```
apps/web      Next.js 16 (App Router): login, feed, upload, profiles, hashtags, live alerts
apps/api      Express 5 + TypeScript
  src/routes      auth, users (social graph), posts, interactions (likes/comments), feed
  src/middleware  JWT auth + blacklist, Redis rate limiter (60/min), Prometheus metrics
  src/services    feed cache (Redis ZSET), notifications (Pub/Sub), posts, mailer
  src/workers     BullMQ worker: image renditions, feed fan-out, welcome email
  src/realtime.ts WebSocket gateway for live notifications
supabase/migrations   SQL schema (tables, GIN + B-Tree indexes, triggers)
```

## 1. Create the accounts (all free tiers) and fill `.env`

```bash
cp .env.example .env
```

| Service | What to copy into `.env` |
|---|---|
| **Supabase** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the *Transaction pooler* string as `DATABASE_URL` |
| **Upstash Redis** | the `rediss://...` TCP URL as `REDIS_URL` |
| **Cloudinary** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Resend (optional) | `RESEND_API_KEY` for welcome emails |
| Sentry (optional) | `SENTRY_DSN` |

In Supabase, turn off **Authentication → Providers → Email → Confirm email** to sign up and log in instantly while testing.

## 2. Run

```bash
npm install
npm run db:migrate     # creates tables in Supabase (safe to re-run)
npm run dev            # API :4000, worker, web :3000
```

Open http://localhost:3000, register two accounts (use a second browser or a private window), follow each other, and post.

**Or with Docker:** `docker compose up --build` (runs migration, API, worker and web).

## How the guide maps to this repo

| Guide | Here |
|---|---|
| API Gateway: CORS, rate limit 60/min, JWT check, routing | `app.ts`, `middleware/rateLimit.ts` (Redis `ratelimit:{scope}:{ip}:{minute}`), `middleware/auth.ts` |
| Auth service: bcrypt, access + refresh tokens | Supabase Auth does hashing and tokens; `routes/auth.ts` exposes register / login / refresh / logout / me. Logout puts the token in a Redis blacklist. |
| User and social graph | `routes/users.ts`; follower counts cached in Redis |
| Post and feed service | `routes/posts.ts`, `routes/feed.ts`; upload signature, hashtags (GIN index), Redis ZSET feed |
| Interactions and real-time | `routes/interactions.ts`; Redis Pub/Sub to WebSocket (`realtime.ts`) |
| Celery workers | **BullMQ** (the Node equivalent), `workers/media.ts`, Redis-backed |
| Cloudinary direct upload | Browser gets a signed payload, uploads straight to Cloudinary, then sends the URL to the API |
| Sentry, Grafana, Better Stack | `SENTRY_DSN`; `GET /metrics` (Prometheus format); `GET /health` for uptime pings |
| Resend email | welcome email job in the worker |
| `JWT_SECRET` | not needed: Supabase signs the JWTs |

## Flows

**Upload:** `GET /posts/upload-signature` → browser uploads to Cloudinary → `POST /posts {imageUrl, publicId, caption}` → row saved, hashtags extracted → `NEW_POST_UPLOADED` job → worker pre-generates renditions and pushes the post id into followers' Redis feeds.

**Feed:** `GET /feed` reads `feed:user:{id}` (ZSET, max 200). On a miss it runs the SQL JOIN of own and followed posts and refills the cache. The `X-Feed-Source` response header shows `cache` or `db`.

## API (all under `/api/v1`, Bearer token except auth)

| Method | Path |
|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` · GET `/auth/me` |
| GET | `/users?q=` · `/users/:username` · `/users/:username/posts` · PATCH `/users/me` |
| POST / DELETE | `/users/:id/follow` |
| GET | `/posts/upload-signature` · `/posts/tag/:tag` · `/posts/:id` · `/feed?cursor=` |
| POST / DELETE | `/posts` · `/posts/:id` |
| POST / DELETE | `/posts/:id/like` |
| GET / POST | `/posts/:id/comments` |
| WS | `/ws?token=` live notifications (like, comment, follow) |

## Deploying

- **API + worker:** build `apps/api/Dockerfile`. Run the API with the default command. Run the worker with `node apps/api/dist/worker.js`, or set `INLINE_WORKER=true` to run both in one free-tier container. Set `TRUST_PROXY=1` and `WEB_ORIGIN` to your web URL.
- **Web:** build `apps/web/Dockerfile` with build arg `API_PUBLIC_URL` set to your API's public URL (it is baked into the bundle). Or deploy `apps/web` to Vercel with env var `API_PUBLIC_URL`.
- **Migrations:** `npm run db:migrate` locally, or the `migrate` compose service.

## Notes

- Tables have Row Level Security enabled with no policies, so Supabase's public REST API cannot read them. Only the Node API (direct Postgres connection) can.
- Upstash free tier has a monthly command limit. The worker polls with `drainDelay: 30` to keep idle usage low.
- Tokens are kept in `localStorage` for simplicity. For production, move the refresh token to an HttpOnly cookie.
- Not included yet: web-side Sentry, avatars, profile editing UI, tests.
