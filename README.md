# Momento

Momento is a full-stack photo sharing and social networking application inspired by Instagram.
It allows users to create an account, upload photos, follow people, view feeds, like posts,
add comments, search hashtags, and receive live activity notifications.

The project combines a Next.js website, an Express REST API, a background worker, PostgreSQL,
Redis, cloud image storage, authentication, real-time messaging, monitoring, Docker, and hosted
cloud services.

## Presentation Summary

**What the application does**

- Users register and log in.
- Users create photo posts with captions and hashtags.
- Users follow and unfollow other accounts.
- Users view a personalized feed and explore public posts.
- Users like posts and write comments.
- Users receive live notifications for likes, comments, and follows.
- The system processes image transformations and feed updates outside the main API request.

**How the parts work together**

1. The Next.js browser application sends requests to the Express API.
2. Supabase Auth registers users and creates secure JWT access and refresh tokens.
3. The API reads and writes application data in a Supabase PostgreSQL database.
4. Redis stores cached feeds, counts, rate-limit records, logout blacklists, jobs, and notifications.
5. Cloudinary stores uploaded images and provides optimized image delivery.
6. BullMQ sends slow or repeatable work to a separate background worker.
7. WebSockets deliver live notifications to connected users.

## Technology and Tools

| Tool or technology | Where it is used | Why it is used |
|---|---|---|
| **Next.js 16** | `apps/web` | Provides App Router routing and builds the React browser application. |
| **React 19** | `apps/web` | Creates interactive UI components such as post cards, forms, and activity panels. |
| **TypeScript** | Web and API | Adds static types and catches code errors during development and builds. |
| **Tailwind CSS 4** | `apps/web` | Provides reusable utility classes for layout and styling. |
| **Node.js 22** | API and worker | Runs the JavaScript/TypeScript server applications. |
| **Express 5** | `apps/api` | Handles REST API routes and middleware. |
| **Zod** | API | Validates incoming registration, post, comment, follow, and other request data. |
| **Supabase Auth** | Authentication | Handles password hashing, login sessions, JWT access tokens, and refresh tokens. |
| **Supabase PostgreSQL** | Main database | Stores users, posts, follows, likes, comments, and hashtags. |
| **Upstash Redis** | Cache, queues, and messaging | Provides feed caching, rate limiting, token blacklists, BullMQ jobs, and Pub/Sub notifications. |
| **BullMQ** | Background jobs | Runs image processing, feed fan-out, and welcome emails asynchronously. |
| **Cloudinary** | Photo storage | Receives direct browser uploads and serves optimized or transformed images. |
| **WebSockets (`ws`)** | Real-time communication | Sends live notification events to an open browser connection. |
| **Resend** | Welcome email | Sends welcome emails when registration includes the optional email configuration. |
| **Sentry** | Error monitoring | Reports API and worker exceptions when `SENTRY_DSN` is configured. |
| **Prometheus client** | API metrics | Exposes application metrics at `GET /metrics`. |
| **Docker and Docker Compose** | Local deployment | Runs the API, worker, web application, and optional local Redis in containers. |

## Project Structure

```text
momento/
├── apps/
│   ├── web/                    # Next.js browser application
│   │   ├── app/                # Pages and routes
│   │   ├── components/         # Reusable React interface components
│   │   └── lib/                # API, authentication, types, and utility helpers
│   └── api/                    # Express API and background worker
│       └── src/
│           ├── routes/         # Authentication, users, posts, feed, and interactions
│           ├── middleware/     # JWT authentication, rate limiting, and metrics
│           ├── services/       # Feed, post, email, and notification logic
│           ├── workers/        # BullMQ background job handlers
│           ├── app.ts          # API gateway and route configuration
│           ├── realtime.ts     # WebSocket notification gateway
│           └── queue.ts        # Background job definitions
├── supabase/
│   └── migrations/             # PostgreSQL tables, indexes, triggers, and security settings
├── docker-compose.yml          # Container configuration
├── .env.example                # Example environment variables
└── SETUP.md                    # Detailed setup and deployment guide
```

## System Architecture

```text
Browser / Next.js
       │
       │ HTTP REST requests
       ▼
Express API
       │
       ├──────── Supabase Auth ───── JWT login and registration
       │
       ├──────── PostgreSQL ───────── Users, posts, follows, likes, comments
       │
       ├──────── Redis
       │          ├─ Feed and count caches
       │          ├─ Rate limiting
       │          ├─ Logout blacklist
       │          ├─ BullMQ job queue
       │          └─ Notification Pub/Sub
       │
       ├──────── BullMQ Worker
       │          ├─ Image renditions
       │          ├─ Feed fan-out
       │          └─ Welcome email
       │
       ├──────── Cloudinary ───────── Image upload and CDN
       │
       └──────── WebSocket ────────── Live browser notifications
```

## Main Features

### 1. Authentication

- Supabase Auth creates the user account and securely handles passwords.
- The API exposes register, login, refresh, logout, and current-user endpoints.
- A short-lived access token is sent to API requests in the `Authorization: Bearer` header.
- A refresh token is used to request a new access token.
- Logout stores the access token in a Redis blacklist until the token expires.
- The browser stores session tokens in `localStorage` for the current implementation.

For the public-user layer, the migration creates a matching row in `public.users` automatically
when Supabase Auth creates a new account.

### 2. Profiles and Social Graph

- Users can search accounts by username.
- A user can view another account's profile and post count.
- Follow and unfollow actions create or remove rows in the `follows` table.
- A composite primary key prevents duplicate follow relationships.
- The database prevents a user from following themselves.
- Redis caches follower, following, and post counts for five minutes.

### 3. Photo Upload

The upload process is intentionally split into several steps:

1. The browser requests a signed upload payload from the API.
2. The browser uploads the image directly to Cloudinary.
3. Cloudinary returns a secure image URL and public ID.
4. The browser sends the image URL, public ID, and caption to the API.
5. The API validates that the image belongs to the user's Cloudinary folder.
6. The API saves the post and extracts hashtags beginning with `#`.
7. A BullMQ job is created for background processing.

This direct upload design is efficient because the API server does not receive and temporarily
store the original image file.

### 4. Background Worker

The API does not perform all slow work synchronously.

The BullMQ worker:

- creates optimized thumbnail and feed image renditions;
- removes a dependency on repeatedly creating the same renditions;
- adds the new post ID to the Redis feeds of followers;
- sends a welcome email when Resend is configured.

The worker and API use the same Redis queue. It can run as a separate process or be started
inside the API process by using `INLINE_WORKER=true`.

### 5. Feed and Redis Cache

Each user's feed is stored in Redis as a sorted set (`ZSET`). The post creation time is used as
the sorted-set score.

The cache flow is:

1. The browser requests `/api/v1/feed`.
2. Redis returns up to 20 post IDs if that feed is cached.
3. The API retrieves full post information from PostgreSQL.
4. If the Redis feed is missing, the database rebuild selects recent posts from every account
   other than the signed-in user.
5. The rebuilt feed is stored in Redis for seven days.
6. The response includes `X-Feed-Source: cache` or `X-Feed-Source: db`.

When a cached feed already exists, the background worker adds newly created posts to the feeds
of followers. The feed is paginated using a timestamp cursor. The response header is mainly
useful for demonstration and debugging.

### 6. Likes and Comments

- The `likes` table stores one like per user and post.
- PostgreSQL triggers automatically increase or decrease `likes_count`.
- Comments are limited to 500 characters.
- New likes and comments cause live notifications for the post owner.

### 7. Hashtags and Explore

- Hashtags are extracted from post captions.
- They are stored as an array in PostgreSQL.
- A GIN index makes hashtag searches faster.
- Users can open `/tags/[tag]` to find posts with that hashtag.
- The Explore page displays recent posts from other accounts.

### 8. Live Notifications

- Like, comment, and follow events publish a message to a Redis Pub/Sub channel.
- The channel belongs to the receiving user, for example `notifications:user:<userId>`.
- The Express WebSocket gateway subscribes to notification channels.
- A browser opens `/ws?token=<access-token>` and receives matching live events.
- The notification panel stores the latest 50 in-browser events and shows an unread badge.

Notifications are currently in-memory on the browser and are not persisted in PostgreSQL.

## Database Design

The migration creates five main tables:

| Table | Main purpose |
|---|---|
| `users` | Application profiles connected to Supabase Auth accounts |
| `posts` | Captions, Cloudinary image references, hashtags, and like counts |
| `follows` | Follower/following relationships |
| `likes` | Users who liked each post |
| `comments` | Text comments attached to posts |

Important database features:

- UUID primary keys identify users and posts.
- Foreign keys remove connected records when a user or post is deleted.
- Composite primary keys prevent duplicate follows and likes.
- B-Tree indexes speed up user, post, comment, and follow lookups.
- A GIN index speeds up hashtag array searches.
- A trigger keeps `posts.likes_count` synchronized.
- Row Level Security is enabled on application tables, with no public policies, so the direct
  PostgreSQL connection used by the Node API controls access.

## API Security and Operations

The API includes several gateway-style protections:

- **Helmet:** adds recommended HTTP security headers.
- **CORS:** allows only configured web origins.
- **JWT middleware:** validates protected requests.
- **Redis rate limiting:** allows 60 requests per minute for the global API scope.
- **Auth rate limiting:** applies a stricter limit of 10 requests per minute to auth routes.
- **Zod validation:** rejects invalid or malformed request bodies.
- **Health endpoint:** `GET /health` supports uptime monitoring.
- **Prometheus metrics:** `GET /metrics` exposes runtime and HTTP metrics.
- **Sentry:** reports API and worker exceptions when configured.
- **Redis logout blacklist:** stops a logged-out access token from being reused before expiry.

## API Overview

All application routes use `/api/v1`.

| Area | Examples |
|---|---|
| Authentication | Register, login, refresh, logout, and current user |
| Users | Search, profile, update bio, follow, unfollow |
| Posts | Signed upload, create, read, delete, explore, hashtag search |
| Feed | Cached or database-backed feed with cursor pagination |
| Interactions | Like, unlike, read comments, add comments |
| Real-time | WebSocket connection at `/ws?token=<access-token>` |

## Running the Project

### Requirements

- Node.js 22 or newer
- npm
- A Supabase project
- An Upstash Redis database
- A Cloudinary account
- Docker, if using the container setup

Resend and Sentry are optional.

### 1. Create the environment file

```bash
cp .env.example .env
```

Configure at least:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
DATABASE_URL=
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
WEB_ORIGIN=http://localhost:3000
API_PUBLIC_URL=http://localhost:4000
```

Never commit `.env` or expose server secrets in browser code.

### 2. Install dependencies

```bash
npm install
```

### 3. Run the database migration

```bash
npm run db:migrate
```

### 4. Start the application

```bash
npm run dev
```

This starts:

- Web application: `http://localhost:3000`
- API: `http://localhost:4000`
- BullMQ worker: as a separate development process

### 5. Run with Docker

```bash
docker compose run --rm api node apps/api/dist/scripts/migrate.js
docker compose up --build
```

The Docker setup provides:

- API on port `4000`
- Worker as a separate container
- Web application on port `3000`
- Optional Redis container through the `local-redis` profile

## Suggested Presentation Demo

1. Open the login page and register an account.
2. Open a private browser window and register a second account.
3. Open a profile and follow the second account.
4. Create a photo post with a caption containing a hashtag.
5. Refresh or open the follower's feed and demonstrate the post.
6. Like the post and add a comment.
7. Open the Activity page and show the live notification.
8. Open the hashtag page and show that the post is searchable.

Useful points to explain during the demo:

- The browser never sends the image directly to the Express API.
- The API only receives the Cloudinary image URL and post metadata.
- Redis makes feeds and counts faster, while PostgreSQL remains the source of truth.
- Slow work is delegated to the BullMQ worker.
- WebSockets provide live notifications without refreshing the page.

## Deployment

- Deploy the Express API and BullMQ worker as Node.js applications or containers.
- Deploy the Next.js application to Vercel or as a Docker container.
- Set `API_PUBLIC_URL` to the public API URL.
- Set `WEB_ORIGIN` to the deployed web application's origin.
- Set `TRUST_PROXY=1` when deploying behind a trusted proxy or platform.
- Run migrations before or during deployment.
- Use hosted Supabase PostgreSQL, Upstash Redis, and Cloudinary for the cloud architecture.

For complete account setup, environment variables, Docker commands, and deployment details,
see [SETUP.md](./SETUP.md).

## Current Limitations

- Browser sessions use `localStorage`; refresh tokens should use secure HttpOnly cookies for
  a production deployment.
- Avatar support and profile editing UI are not complete.
- Notification history is not stored permanently.
- Automated tests are not included yet.
- Web-side Sentry integration is not configured, although API and worker reporting are.
- Email confirmation and welcome email delivery depend on provider configuration.

## Summary

Momento demonstrates how a modern photo-sharing application can use separate services for
different responsibilities:

- **Next.js** presents the interface.
- **Express** provides the application API.
- **Supabase** provides authentication and PostgreSQL storage.
- **Redis** provides caching, queues, limits, and real-time messaging.
- **Cloudinary** provides image storage and transformations.
- **BullMQ** performs work asynchronously.
- **WebSockets** deliver live activity updates.
- **Docker** makes the complete local environment reproducible.
