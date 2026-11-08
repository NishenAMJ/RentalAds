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

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=node:node /repo/packages/db/package.json ./packages/db/package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/packages/db/prisma ./packages/db/prisma
RUN CI=true corepack pnpm install --prod --filter . --filter api... --filter db --frozen-lockfile
EXPOSE 3001
# Apply any new migrations, then start. Safe to repeat: already-applied migrations are skipped.
USER node
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema packages/db/prisma/schema.prisma && node apps/api/dist/main.js"]
