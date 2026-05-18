# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @construct/web (Next.js 15, standalone output).
# Built from the monorepo root so the workspace dep @construct/contracts
# can be hoisted via pnpm.

ARG NODE_VERSION=22.11.0
ARG PNPM_VERSION=9.15.4

# ---- builder ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json tsconfig.node.json turbo.json ./

COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile --filter=@construct/web...

COPY apps/web ./apps/web
COPY packages/contracts ./packages/contracts

# contracts must be built first so Next can resolve its types
RUN pnpm --filter=@construct/contracts build
RUN pnpm --filter=@construct/web build

# ---- runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# Next standalone bundles every dependency at .next/standalone, so we don't
# need pnpm at runtime.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
# (no apps/web/public — Next.js doesn't require it and the dir doesn't exist)

EXPOSE 3002

CMD ["node", "apps/web/server.js"]
