# Web image. Build from the repository root:  docker build -f apps/web/Dockerfile -t rentalhub-web .
# The NEXT_PUBLIC_* values are baked into the browser bundle, so they must be given at build time.
FROM node:24-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_ENABLE_ITEM_BOOKINGS=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL
    NEXT_PUBLIC_ENABLE_ITEM_BOOKINGS=$NEXT_PUBLIC_ENABLE_ITEM_BOOKINGS
RUN pnpm --filter web build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=node:node /repo/packages/db/package.json ./packages/db/package.json
COPY --from=build --chown=node:node /repo/apps/web/.next ./apps/web/.next
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /repo/apps/web/next.config.* ./apps/web/
RUN CI=true corepack pnpm install --prod --filter web --frozen-lockfile \
  && chown -R node:node /repo
EXPOSE 3000
USER node
CMD ["pnpm", "--filter", "web", "start"]
