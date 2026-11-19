# Build from the repo root:  docker build -f apps/api/Dockerfile .
# One image runs the API, the background worker, and the DB migration (different CMD).
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @insta/api --include-workspace-root=false
COPY apps/api apps/api
RUN npm run build -w @insta/api

FROM node:24-alpine AS run
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @insta/api --include-workspace-root=false
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY supabase supabase
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
