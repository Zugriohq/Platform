# syntax=docker/dockerfile:1.7
# Zugrio API — private validation alpha.
# Build from the repository root (workspace packages are needed):
#   docker buildx build --platform linux/arm64 -f apps/api/Dockerfile -t zugrio-api .
# node:22-bookworm-slim is a multi-arch image (linux/amd64 + linux/arm64 for OCI Ampere A1).

ARG NODE_IMAGE=node:22-bookworm-slim
ARG PNPM_VERSION=9.15.4

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
# No install-time or runtime telemetry from dependencies (scarf, Prisma checkpoint).
ENV CI=true \
    SCARF_ANALYTICS=false \
    CHECKPOINT_DISABLE=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/decision-core/package.json packages/decision-core/
COPY packages/alpha-api-contract/package.json packages/alpha-api-contract/
COPY apps/api/package.json apps/api/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@zugrio/api..."
COPY packages/decision-core packages/decision-core
COPY packages/alpha-api-contract packages/alpha-api-contract
COPY apps/api apps/api
RUN pnpm --filter @zugrio/decision-core build \
 && pnpm --filter @zugrio/alpha-api-contract build \
 && pnpm --filter @zugrio/api build

FROM base AS prod-deps
# Production dependencies only. `prisma` is a runtime dependency because the image also
# runs `prisma migrate deploy` (see infra/oci/docker-compose.yml, service `migrate`).
RUN pnpm install --frozen-lockfile --prod --filter "@zugrio/api..."

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    SCARF_ANALYTICS=false \
    CHECKPOINT_DISABLE=1 \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=root:root /repo /app
COPY --from=build /repo/packages/decision-core/dist packages/decision-core/dist
COPY --from=build /repo/packages/alpha-api-contract/dist packages/alpha-api-contract/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
WORKDIR /app/apps/api
# Application files stay root-owned and read-only to the runtime user.
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
