# Supports both monorepo builds and standalone builds with apps/api as the context.
FROM node:24-alpine AS build
WORKDIR /repo
COPY . .
RUN if [ -f apps/api/package.json ]; then \
      npm ci --workspace @insta/api --include-workspace-root=false && \
      npm run build -w @insta/api && cp -a apps/api/dist app-dist; \
    else \
      npm install && npm run build && cp -a dist app-dist; \
    fi

FROM node:24-alpine AS run
ENV NODE_ENV=production
WORKDIR /repo
COPY . .
RUN if [ -f apps/api/package.json ]; then \
      npm ci --omit=dev --workspace @insta/api --include-workspace-root=false; \
    else \
      npm install --omit=dev; \
    fi
COPY --from=build /repo/app-dist app-dist
USER node
EXPOSE 4000
CMD ["node", "app-dist/index.js"]
