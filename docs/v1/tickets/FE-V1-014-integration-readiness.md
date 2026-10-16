# FE-V1-014: Verify the rebuilt dashboard against the real backend

## Status

Implemented with local acceptance and a fresh LAN rollout on `debian-vm`.
The worker remains intentionally stopped until interactive Admin bootstrap and
carrier/provider confirmation are complete.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Demonstrate that the complete v1 dashboard matches approved behavior and implemented backend contracts, and provide a runnable local handoff.

## Required reading

- [verification.md](../verification.md)
- [api-contracts.md](../api-contracts.md)
- [ui-spec.md](../ui-spec.md)
- [agent-workflow.md](../agent-workflow.md)
- [source-evidence.md](../source-evidence.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Run the full acceptance matrix against an authorized disposable local backend/database/account setup, with controlled carrier fixtures instead of production provider calls.
- Complete Playwright paths for auth, overview, paginated shipments, creation, notes/actions/history, route-scoped alerts, review state, and Admin pages.
- Verify race, reconnect, deletion, session revocation, timezone/DST, date-only, responsive, keyboard, light/dark, and favicon behavior.
- Audit CI quality/build/secret-scan/browser gates, document real-backend CI access if authorized, and keep any unavailable verification explicit.
- Review final API docs and planning statuses against actual code, record summaries, and start/reuse both frontend and backend for manual testing.

## Acceptance criteria

- Every acceptance-matrix group has evidence or a named unresolved blocker; missing integration cannot be presented as a fully passing release gate.
- All required code gates pass and production assets contain no secrets, mock runtime data, backend source, or unapproved production dependencies.
- Representative 1,000–10,000-record queries remain server-paginated; counts, filters, default created sort, and event refetches agree.
- Both servers are reachable at reported URLs and remain running where possible; startup/account/worker requirements are documented without exposing credentials.
- Docs distinguish implemented APIs from deferred work. The approved LAN-only
  manual deployment is documented; public hosting, registry publishing and
  automated deployment remain explicitly deferred.

## Verification

Run the exact implemented pnpm CI/check/build and browser commands, the opt-in real-backend suite, backend prerequisite suites where changed, and the manual matrix in verification.md. Record commands, results, fixture sizes, screenshots where useful, server URLs, and every unrun check.

## Review notes and completion

The user separately authorized the manual LAN deployment decisions recorded in
`decisions.md`. Propose coherent Conventional Commits and obtain final approval
before committing; tag only after the requested code is committed and merged into
main under the user release policy.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep public hosting, registry publishing, and automated deployment deferred.

## Homeserver evidence (2026-10-17)

- Release `20261017-01` was built locally, archived, checksum-verified, and
  loaded on `debian-vm`; the remote environment is `/home/jeff/app/grd-dashboard/.env`
  with mode 600.
- `db` and `api` are healthy, the one-shot `migrate` service exited successfully,
  and `frontend`/Caddy is healthy.
- `https://192.168.100.83/healthz` returned `ok`; the versioned API readiness
  endpoint reported application and database `up`; HTTP returned 308 and the
  `/shipments` deep link returned 200.
- The worker is not running. The Caddy root certificate was exported to
  `/home/jeff/app/grd-dashboard/grd-dashboard-root.crt` (SHA-256
  `85ec17d72be7812db0b386e3ea393d23a83318f549d7f564660fbc9ba94b50f6`) for
  manual LAN client trust installation.
