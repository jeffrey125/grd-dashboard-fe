# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS build

WORKDIR /app
RUN npm install --global pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY index.html tsconfig.json tsconfig.node.json tsconfig.e2e.json tsr.config.json ./
COPY vite.config.ts vitest.config.ts playwright.config.ts playwright.backend.config.ts ./
COPY src ./src
COPY public ./public
COPY e2e ./e2e
COPY e2e-backend ./e2e-backend
COPY scripts ./scripts
COPY test ./test

ARG VITE_API_ORIGIN
RUN test -n "$VITE_API_ORIGIN"
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
RUN pnpm build

FROM caddy:2.11.7-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80 443 443/udp
