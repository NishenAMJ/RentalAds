# API image. Build from the repository root:  docker build -f apps/api/Dockerfile -t rentalhub-api .
FROM node:24-bookworm-slim AS base
# Prisma needs OpenSSL; corepack provides the pnpm version pinned in package.json.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /repo

FROM base AS build
# Manifests first, so a source-only change does not reinstall every dependency.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm db:generate && pnpm --filter api build

FROM build AS runtime
ENV NODE_ENV=production
EXPOSE 3001
# Apply any new migrations, then start. Safe to repeat: already-applied migrations are skipped.
CMD ["sh", "-c", "pnpm --filter db exec prisma migrate deploy && node apps/api/dist/main.js"]
