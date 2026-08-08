# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the @workstream/api Fastify service.
# Built from the monorepo root so workspace deps (@workstream/contracts,
# /db, /domain, /cad) can be hoisted via pnpm. Resulting image runs the prebuilt
# JS on Node 22 with only production deps installed.

ARG NODE_VERSION=22.11.0
ARG PNPM_VERSION=9.15.4

# ---- builder ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

# Workspace manifest + lockfile first for caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json tsconfig.node.json turbo.json ./

# Manifests for every workspace the api depends on (transitively).
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/cad/package.json ./packages/cad/
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/

RUN pnpm install --frozen-lockfile --filter=@workstream/api...

# Copy sources after install so dep churn doesn't bust the install layer
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY packages/cad ./packages/cad
COPY packages/db ./packages/db
COPY packages/domain ./packages/domain

RUN pnpm --filter=@workstream/api... build

# ---- runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3001
ENV NODE_OPTIONS=--experimental-sqlite

# Bring across the workspace manifest + built artefacts
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./

COPY --from=builder /repo/apps/api/package.json ./apps/api/
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /repo/packages/cad/package.json ./packages/cad/
COPY --from=builder /repo/packages/cad/dist ./packages/cad/dist
COPY --from=builder /repo/packages/db/package.json ./packages/db/
COPY --from=builder /repo/packages/db/dist ./packages/db/dist
COPY --from=builder /repo/packages/domain/package.json ./packages/domain/
COPY --from=builder /repo/packages/domain/dist ./packages/domain/dist

RUN pnpm install --prod --frozen-lockfile --filter=@workstream/api...

RUN mkdir -p /repo/apps/api/data/uploads /repo/apps/api/data/outputs /repo/apps/api/data/photos /repo/apps/api/data/aerial

EXPOSE 3001

WORKDIR /repo/apps/api
CMD ["node", "dist/server.js"]
