# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the @construct/api Fastify service.
# Built from the monorepo root so workspace deps (@construct/contracts,
# /db, /domain) can be hoisted via pnpm. Resulting image runs the prebuilt
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
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/

RUN pnpm install --frozen-lockfile --filter=@construct/api...

# Copy sources after install so dep churn doesn't bust the install layer
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY packages/domain ./packages/domain

RUN pnpm --filter=@construct/api... build

# ---- runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3001

# Bring across the workspace manifest + built artefacts
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./

COPY --from=builder /repo/apps/api/package.json ./apps/api/
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /repo/packages/db/package.json ./packages/db/
COPY --from=builder /repo/packages/db/dist ./packages/db/dist
COPY --from=builder /repo/packages/domain/package.json ./packages/domain/
COPY --from=builder /repo/packages/domain/dist ./packages/domain/dist

RUN pnpm install --prod --frozen-lockfile --filter=@construct/api...

EXPOSE 3001

WORKDIR /repo/apps/api
CMD ["node", "dist/server.js"]
