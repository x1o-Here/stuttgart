# apps/server for Cloud Run. Build from the repo root (it needs packages/shared):
#   gcloud builds submit --config apps/server/cloudbuild.yaml .
#
# Targets:
#   (default) runtime — the API server, production dependencies only
#   tools            — everything incl. Prisma CLI, migrations and scripts; used by
#                      Cloud Run Jobs for `prisma migrate deploy` and the Firestore import

FROM node:24-slim AS build
WORKDIR /app

# Workspace manifests first, so dependency installs are cached between builds.
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @stuttgart/server --workspace @stuttgart/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/server apps/server
# prisma.config.ts reads DATABASE_URL even for `prisma generate`; the real one comes at runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build -w @stuttgart/shared && \
    DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build -w @stuttgart/server

FROM build AS tools
ENV NODE_ENV=production
WORKDIR /app/apps/server
# The import writes its report to migration-logs/; the job runs as the non-root "node" user.
RUN mkdir -p migration-logs backups && chown node:node migration-logs backups
USER node

FROM build AS prune
RUN npm prune --omit=dev --workspace @stuttgart/server --workspace @stuttgart/shared --include-workspace-root

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prune /app/node_modules node_modules
COPY --from=prune /app/package.json ./
COPY --from=prune /app/packages/shared/package.json packages/shared/
COPY --from=prune /app/packages/shared/dist packages/shared/dist
COPY --from=prune /app/apps/server/package.json apps/server/
COPY --from=prune /app/apps/server/dist apps/server/dist
WORKDIR /app/apps/server
USER node
CMD ["node", "dist/main.js"]
