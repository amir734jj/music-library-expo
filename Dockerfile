# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /workspace

COPY . .
RUN --mount=type=secret,id=npm_token \
  NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" npm install --workspaces --include-workspace-root

RUN npm run build --workspace @music-library/core \
    && npm run export:web --workspace @music-library/client \
    && npm run build --workspace @music-library/api \
    && npm prune --omit=dev --workspaces --include-workspace-root \
    && mkdir -p /release/api /release/core \
    && cp -R node_modules /release/node_modules \
    && cp api/package.json /release/api/package.json \
    && cp -R api/dist /release/api/dist \
    && cp core/package.json /release/core/package.json \
    && cp -R core/dist /release/core/dist \
    && cp -R client/dist /release/api/public

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV TRENDING_CACHE_DIRECTORY=/data/trending-cache

COPY --from=build /release .

WORKDIR /app/api
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "dist/main.js"]