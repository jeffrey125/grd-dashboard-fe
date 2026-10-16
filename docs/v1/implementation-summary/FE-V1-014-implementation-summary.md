# FE-V1-014 — Integration Readiness Implementation Summary

## Summary

FE-V1-014 is implemented as a LAN-only release path for the dashboard. The frontend is packaged as a Caddy image, the backend API and worker use the existing backend image, and PostgreSQL is provisioned in a fresh Docker Compose stack. Caddy serves the SPA and same-origin `/api/v1/*` traffic over HTTPS using its internal CA. The release is built locally, transferred as Docker image archives, and started manually on `debian-vm`; no public registry or hosted deployment is introduced.

## Changes Made

- Added a reproducible frontend Docker build with a strict `.dockerignore` and Caddy runtime image.
- Added `docker-compose.lan.yml` with PostgreSQL, one-shot migration, API, frontend/Caddy, and an opt-in single-replica worker profile.
- Added `.env.lan.example` and `scripts/prepare-lan-env.ts` to generate a mode-600 release environment without copying backend secrets into the image context.
- Added Caddy LAN HTTPS configuration, same-origin API routing, SPA fallback, security headers, health endpoint, and explicit client-CA trust instructions.
- Added the manual LAN deployment runbook covering local acceptance, image archive transfer, remote startup, CA export, bootstrap, worker activation, backups, and rollback.
- Hardened the real-backend Playwright harness with dedicated fixture identities and exact per-run Testcontainer handoff so the backend's per-email throttle and concurrent runs do not interfere.
- Fixed the carrier editor focus/reconciliation race so a held server refresh cannot discard a user's in-progress selection; added a deterministic regression scenario.
- Recorded the LAN deployment decision, deferred public-hosting decisions, verification evidence, and ticket status in the v1 documentation.
- Added an explicit HTTP-only LAN override for trusted isolated networks that cannot install the Caddy root CA; HTTPS remains the default and recommended mode.

## Files Changed

- `Dockerfile`, `.dockerignore`, `Caddyfile`, `docker-compose.lan.yml`, `.env.lan.example` — release images and LAN Compose topology.
- `scripts/prepare-lan-env.ts` — safe release environment generation.
- `package.json`, `tsconfig.node.json`, `knip.json`, `README.md`, `.gitignore` — build, test, and documentation entry points.
- `test/container/runtime.test.ts` — disposable Compose lifecycle and runtime-isolation checks.
- `Caddyfile.http`, `docker-compose.lan-http.yml`, `.env.lan-http.example`, `test/container/http-runtime.test.ts` — opt-in HTTP-only release path and isolation checks.
- `scripts/auth-backend.mjs`, `e2e-backend/*.spec.ts`, `e2e/carriers.spec.ts` — deterministic backend fixtures and regression coverage.
- `src/features/carriers/carrier-editor.tsx` — dirty-editor reconciliation fix.
- `docs/v1/README.md`, `docs/v1/architecture.md`, `docs/v1/decisions.md`, `docs/v1/verification.md`, `docs/v1/lan-deployment.md`, `docs/v1/tickets/*` — release decisions, runbook, and ticket records.

## Verification

- `pnpm test:acceptance` — **PASS**. This ran:
  - 174 unit tests with coverage at approximately 61.55% statements, 46.31% branches, 54.84% functions, and 63.66% lines.
  - 126 ordinary Playwright browser checks across desktop and mobile projects.
  - 20 real-backend Playwright scenarios against a disposable PostgreSQL-backed backend.
  - 4 container checks covering image builds, fresh-database Compose startup, HTTPS/API/SPA behavior, migration/seed counts, worker opt-in behavior, Caddy CA generation, published-port isolation, and runtime filesystem isolation.
- `pnpm exec playwright test e2e/carriers.spec.ts --repeat-each=3` — **PASS**, 42 checks; confirms the carrier editor race regression is stable.
- `pnpm format:check` — **PASS**.
- `pnpm lint` — **PASS**.
- `pnpm typecheck` — **PASS** for application, Node scripts, and e2e TypeScript configs.
- `pnpm knip` — **PASS**.
- `pnpm test:container:http` — **PASS**. Builds the HTTP Caddy image, starts a disposable PostgreSQL/API/frontend stack, verifies health/API/SPA routing, confirms no 443 bindings, and confirms the worker remains absent.
- Gitleaks 8.30.1 git-history scan and working-tree directory scan — **PASS**, no leaks detected.
- `git diff --check` — **PASS**.

The image archive build and LAN transfer are intentionally a separate manual release step. Public hosting, registry publishing, and Pi data migration remain out of scope for this ticket.

HTTP-only follow-up (2026-10-17): the opt-in override is intentionally insecure.
It sends credentials and session cookies in cleartext, uses development cookie
settings, and is suitable only for a trusted isolated LAN. The homeserver should
use the existing HTTPS Compose file unless every approved client can accept that
tradeoff.

Current HTTP rollout evidence (2026-10-17): release `20261017-02` is loaded on
`debian-vm` with archive SHA-256
`a9066dab0fec7b13ea13804548d14e9d2904d5c33a4ca11ed4b7d910e33a9430` and the
existing PostgreSQL volume preserved. HTTP `/healthz` and
API readiness returned `200`, the protected shipments route returned `401`, the
`/shipments/example` deep link returned `200`, port 443 was unreachable, and the
worker remained absent. The remote database contains one active Admin still
requiring the first-login password change. Because this was a profile switch on
an initialized volume, the prior DB/auth secrets were retained rather than using
the generator's fresh values.

Homeserver deployment evidence (2026-10-17): release `20261017-01` was loaded on
`debian-vm` at `/home/jeff/app/grd-dashboard`; the mode-600 remote environment is
`.env`. `db` and `api` are healthy, `migrate` exited 0, and frontend/Caddy is
healthy. The deployed checks returned HTTPS `/healthz` `ok`, API readiness with
application/database `up`, HTTP 308, and SPA deep-link 200. The worker is absent
by design. The exported Caddy root certificate is
`/home/jeff/app/grd-dashboard/grd-dashboard-root.crt` with SHA-256
`85ec17d72be7812db0b386e3ea393d23a83318f549d7f564660fbc9ba94b50f6`.
Using the copied certificate at `/tmp/grd-dashboard-20261017-01-root.crt`, local
`curl --cacert` checks also returned `ok` and API readiness `up` without disabling
TLS verification.

## Review Notes

- The frontend container shares the API network namespace so only the API publishes LAN ports; Caddy reaches the API over loopback while the API remains unexposed on port 3000.
- `AUTH_TRUST_PROXY=loopback` is intentionally narrow because only the local Caddy hop is trusted.
- The database is fresh by design. The migration service is one-shot and the worker is not started until the administrator completes bootstrap and provider configuration.
- Caddy's `tls internal` mode is appropriate for a private IP/LAN endpoint, but clients must trust the exported Caddy root certificate. Caddy documents both its automatic HTTPS behavior and the `tls internal`/local-CA flow in its [official HTTPS documentation](https://caddyserver.com/docs/automatic-https) and [TLS directive documentation](https://caddyserver.com/docs/caddyfile/directives/tls).
- The Compose health dependencies follow Docker's documented `service_healthy` startup ordering model: [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).

## Remaining Issues

- The remote worker remains intentionally stopped until the operator enters the first-admin bootstrap credentials and confirms carrier/provider configuration.
- Each client that uses the HTTPS IP must install the exported Caddy root certificate; this is a manual LAN trust step.
- No hosted CI, public DNS/certificate, registry publication, automated backup, or automatic deployment was added.
- Existing Raspberry Pi data is not migrated; the selected release starts with a fresh PostgreSQL database.

## Suggested Review Order

1. `docker-compose.lan.yml`, `Dockerfile`, and `Caddyfile`.
2. `scripts/prepare-lan-env.ts` and the container runtime test.
3. `src/features/carriers/carrier-editor.tsx` and the carrier regression test.
4. `scripts/auth-backend.mjs` and the remaining real-backend fixture updates.
5. `docs/v1/lan-deployment.md` and the v1 decision/verification records.
