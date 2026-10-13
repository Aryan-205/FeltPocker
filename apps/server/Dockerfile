# Game server image. Build from the repo root:
#   docker build -f apps/server/Dockerfile -t felt-server .
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/engine/package.json packages/engine/
RUN pnpm install --frozen-lockfile --prod --filter @felt/server...

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app ./
COPY packages/engine/src packages/engine/src
COPY apps/server/src apps/server/src
COPY apps/server/tsconfig.json apps/server/
COPY tsconfig.base.json ./
USER node
WORKDIR /app/apps/server
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
# tsx runs the TypeScript directly; SIGTERM reaches node so tables cash out cleanly.
CMD ["node", "--import", "tsx", "src/index.ts"]
