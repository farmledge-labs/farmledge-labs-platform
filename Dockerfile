# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build for the farmledge monorepo API.
#
# Build context: repo root  (docker build -f Dockerfile .)
# The context must include:
#   package*.json, tsconfig.base.json
#   apps/api/       — Express API source
#   packages/shared/ — workspace package (path-aliased by tsconfig)
#
# @farmledge/shared is a workspace package resolved by npm workspaces — no
# special handling needed; npm ci at the root installs everything.
# @stellar/stellar-sdk is a regular npm package, not a local path dependency.
#
# Alpine + Prisma note:
#   Prisma's query engine for linux-musl requires openssl3 and the correct
#   binary target in schema.prisma:
#     binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install all deps + build ────────────────────────────────────────
FROM node:20-alpine AS build

# openssl3 is required by the Prisma query engine on Alpine (musl libc)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifests first so Docker cache is reused when sources change
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

# Copy sources
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared package first (api's tsconfig path-aliases to its src)
RUN npm run build --workspace=packages/shared

# Generate the Prisma client (requires the schema + openssl)
RUN npm run db:generate --workspace=apps/api

# Compile the API
RUN npm run build --workspace=apps/api

# ── Stage 2: production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production

# openssl3 is needed at runtime by the Prisma query engine binary
RUN apk add --no-cache openssl

ENV NODE_ENV=production
WORKDIR /app

# Copy manifests for production-only npm install
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artefacts from build stage
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist        apps/api/dist

# Copy Prisma schema + migrations (needed for `prisma migrate deploy`)
COPY --from=build /app/apps/api/prisma apps/api/prisma

# Copy Prisma generated client (the query engine binary lives here)
COPY --from=build /app/node_modules/.prisma           node_modules/.prisma
COPY --from=build /app/apps/api/node_modules/.prisma  apps/api/node_modules/.prisma 2>/dev/null || true

# Non-root user for least-privilege execution
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# Run migrations then start the server.
# `npx prisma migrate deploy` is idempotent and safe to run on every container start.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/apps/api/src/server.js"]
