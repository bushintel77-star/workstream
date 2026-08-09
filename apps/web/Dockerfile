# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @workstream/web (Next.js 15, standalone output).
# Built from the monorepo root so the workspace dep @workstream/contracts
# can be hoisted via pnpm.

ARG NODE_VERSION=22.11.0
ARG PNPM_VERSION=9.15.4
ARG NEXT_PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app
ARG NEXT_PUBLIC_BUILD_SHA=unknown

# ---- builder ---------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder

ARG PNPM_VERSION
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BUILD_SHA
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BUILD_SHA=$NEXT_PUBLIC_BUILD_SHA
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/* \
    && git config --global url."https://github.com/".insteadOf git@github.com:

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json tsconfig.node.json turbo.json ./

COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/

RUN pnpm install --frozen-lockfile --filter=@workstream/web...

COPY apps/web ./apps/web
COPY packages/contracts ./packages/contracts
COPY packages/domain ./packages/domain

# Workspace packages must be built before Next resolves them
RUN pnpm --filter=@workstream/contracts build
RUN pnpm --filter=@workstream/domain build
RUN pnpm --filter=@workstream/web build

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
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3002

CMD ["node", "apps/web/server.js"]
