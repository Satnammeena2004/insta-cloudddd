# Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @insta/web --include-workspace-root=false
COPY apps/web apps/web

# NEXT_PUBLIC_* values are baked into the browser bundle at build time.
ARG API_PUBLIC_URL=http://localhost:4000
ENV API_PUBLIC_URL=$API_PUBLIC_URL
RUN npm run build -w @insta/web

FROM node:24-alpine AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /repo
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
