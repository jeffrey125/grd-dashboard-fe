# FE-V1-005 implementation summary

## Summary

Implemented in `grd-dashboard-fe` on 2026-10-16. One authenticated native SSE
connection now feeds a tested, feature-registered TanStack Query refresh
coordinator. Local checks passed. Runtime and real-backend verification changes
are committed as `e0e257d` and `9ef8a07`; this documentation is the third approved
commit. No merge, push, tag or deployment performed.
The user approved the design and existing-library approach after the grilling
interview. Native EventSource, TanStack Query, Zod and MUI require no new dependency.

## Changes Made

- App-owned stream lifecycle starts listeners before protected query consumers
  mount, survives navigation and the notification generation reset, and closes
  immediately on auth teardown. Restricted sessions never open a connection.
- Validate resync, heartbeat, shipment, run and precise tracking events. Feature
  query metadata selects relevant list/count/overview/detail/history/run targets.
  Inactive caches become stale without background reads. A 100 ms window and one
  dirty bit per query guarantee a trailing fetch after events during an initial
  or background request; no cancellation storm or replay assumption is used.
- Known data survives refresh failures. Confirmed shipment/history 404s clear
  retained data and expose the missing error, with optional active-route recovery.
  One shell warning appears after two seconds and stays until resync/authoritative
  recovery succeeds. Session-check outages retain the established locked screen.
- Carrier registration supports 30-second visible-focus freshness checks and
  explicit post-edit invalidation. Reconnect bypasses the age threshold. Native
  reconnect handles connecting streams; closed streams use backed-off auth checks
  and recreation. A 45-second watchdog detects stalled streams.
- Typed event subscriptions are available for FE-V1-011. Existing placeholder
  pages stay placeholders; query consumers and detail navigation come with their
  feature tickets. No tracking sound/toasts/highlights or backend source changes.

## Files Changed

### Runtime and deterministic tests

| File | Review purpose |
| --- | --- |
| `src/features/tracking-updates/events.ts` | Zod event boundary and typed event union. |
| `src/features/tracking-updates/query-refresh.ts` | Query registration, target selection, burst/in-flight reconciliation, carrier freshness and deleted-data cleanup. |
| `src/features/tracking-updates/live-updates.ts` | Stream ownership, recovery, timers, stale state and subscriptions. |
| `src/features/tracking-updates/context.tsx` | Shared live context and non-repeating MUI stale banner. |
| `src/features/tracking-updates/index.ts` | Explicit public feature exports. |
| `src/features/tracking-updates/live-updates.test.ts` | Twelve deterministic synchronization/lifecycle tests. |
| `src/app/live-session.tsx` | Connect auth cleanup/status to the stream and gate protected mounts until listeners attach. |
| `src/app/live-session.test.tsx` | StrictMode subscription ordering, restriction, revocation and account isolation. |
| `src/app/live-login.test.tsx` | Regression for unnecessary post-login reconnect caused by transient UI reset. |
| `src/app/providers.tsx` | Keep stream ownership outside generation-keyed transient UI. |
| `src/features/auth/session-boundary.tsx` | Render live state in the protected shell. |
| `src/features/auth/session.ts` | Update resource-cleanup ownership comment. |

### Browser verification

| File | Review purpose |
| --- | --- |
| `e2e/live-fixture.ts` | Test-only controllable event transport with connection counters. |
| `e2e/live.spec.ts` | Desktop/mobile navigation, stale banner, recovery and locked-session behavior. |
| `e2e/auth.spec.ts` | Install isolated SSE fixture alongside existing auth interception. |
| `e2e/smoke.spec.ts` | Install isolated SSE fixture while retaining unexpected-request checks. |
| `e2e-backend/live.spec.ts` | Real cookie/native SSE event delivery, reconnect, deletion and revocation on direct/proxied API paths. |

### Contracts and completion evidence

| File | Review purpose |
| --- | --- |
| `README.md` | Implemented stream behavior and feature registration entry point. |
| `docs/v1/architecture.md` | Registration/lifecycle contracts and future-consumer constraints. |
| `docs/v1/decisions.md` | Approved FE-V1-005 interview choices and dependency decision. |
| `docs/v1/verification.md` | Deterministic versus real-backend evidence boundaries. |
| `docs/v1/README.md` | Ticket implementation status and evidence link. |
| `docs/v1/tickets/README.md` | Ticket implementation status and evidence link. |
| `docs/v1/tickets/FE-V1-005-live-synchronization.md` | Implemented status; consume the now-existing precise tracking event. |
| `docs/v1/implementation-summary/FE-V1-005-implementation-summary.md` | This handoff, verification record and commit proposal. |

## Verification

Final successful checks:

| Command | Result |
| --- | --- |
| `pnpm check` | Passed formatting, lint/imports, all three TypeScript projects, Knip and 61 tests in 14 files. |
| `pnpm build` | Passed; produced the Vite artifact used by browser suites. Existing large-chunk warning remains (main chunk approximately 733 kB / 235 kB gzip). |
| `pnpm test:coverage` | Passed 61 tests; 90.49% overall line coverage, 97.93% for tracking-updates. Coverage is evidence, not a new percentage gate. |
| `pnpm exec playwright test` | Passed all 16 desktop/mobile browser tests against the built artifact. |
| `pnpm --dir ../grd-dashboard-be build` | Passed after approved access to the sibling generated `dist` directory. No backend source edits. |
| `pnpm exec playwright test --config playwright.backend.config.ts` | Passed all 4 real-backend scenarios (including existing auth coverage), with isolated PostgreSQL and no worker. |
| `git diff --check` | Passed. |
| `curl --fail --silent --show-error -o /dev/null -w 'Frontend HTTP %{http_code}\n' http://localhost:5173/` | HTTP 200. |
| `curl --fail --silent --show-error -w '\nBackend HTTP %{http_code}\n' http://localhost:3000/api/v1/health/ready` | HTTP 200; application and database up. |

Initial browser runs exposed two incorrect test selectors and an unnecessary
post-login stream recreation. Selectors were scoped to snackbar/main navigation;
stream ownership moved outside the keyed notification subtree, with a regression
test. Final real browser tests prove one created stream before intentional loss,
one active stream at peak, and a replacement after transport failure. The Vite
development proxy and direct production-build API origin both passed.

The sandbox prevented local server startup and the sibling build; the same
commands were rerun with approved escalation. Local fixture tests do not replace
production-origin CORS/cookie/proxy verification. GitHub-hosted CI and Gitleaks
were not run; Gitleaks is not installed here. The `pnpm run ci` wrapper was not
invoked as one command; its component format/lint/Knip/coverage/build/browser
gates were run successfully as listed above.

Manual testing servers are running and intentionally left available:
`pnpm dev` at http://localhost:5173 and `node scripts/auth-backend.mjs` at
http://localhost:3000/api/v1. The API uses a disposable fixture database and no
worker. Sign in with `frontend-staff@example.test` / `staff fixture password`
or the other test-only accounts documented in the root README. Stopping the
harness with Ctrl-C removes its disposable database; no existing developer data
was reset. The frontend can be stopped separately with Ctrl-C.

## Review Notes

The frontend worktree was clean before this task. All frontend changes listed
above belong to FE-V1-005. The backend's unrelated untracked `sample.txt` was not
modified. No dependency, lockfile, generated route tree, or backend source changed.
Final runtime/test changes and documentation diff were reviewed before staging.
The handoff preserves the distinction between tested synchronization
infrastructure and the still-ticketed business pages.

Feature queries must spread `liveQuery(...)`, pass Query's AbortSignal through
the API adapter, and avoid `staleTime: 'static'`. Future protected Router loaders
must honor the same readiness boundary before prefetching. Query cache metadata
keeps keys/shapes in the owning features without importing feature internals.
Use `carrierDependent: true` for projections containing carrier settings; the
carrier-focus policy applies per query's last successful refresh, not globally.

An old in-flight result can display briefly before its required follow-up. Failed
refreshes keep the warning rather than claiming synchronized data. On a full API
outage the existing auth policy clears sensitive cached content and locks the app.
Snapshot IDs are identities, and observedAt is not treated as an ordering cursor.
Positive tracking-event parsing is exercised deterministically; the real suite
checks notes-only silence and shipment/run delivery without starting a worker.

## Remaining Issues

No known blocker within FE-V1-005. The existing overview/shipment placeholders
have no production business queries to refresh; later feature tickets must use
the tested registration boundary and implement their own missing/deleted views.
Production deployment/CORS verification and hosted CI remain deferred. The
existing large bundle warning remains; Gitleaks was unavailable locally.

## Suggested Review Order

1. `events.ts` and `query-refresh.ts`, then deterministic synchronization tests.
2. `live-updates.ts`, `live-session.tsx`, provider composition and login regression.
3. Banner/context and deterministic browser scenarios.
4. Real-backend browser scenarios and verification evidence.
5. Registration contract, approved decisions and completion status.

## Approved commits

The user explicitly approved this three-commit partition. Pre-commit Biome checks
passed for both code/test commits.

1. `feat(live): FE-V1-005 coordinate authenticated SSE and query refresh`
   — Commit `e0e257d`.
   — All files in the runtime/deterministic-tests table and the four `e2e/` files.
   Implements synchronization, shell state and regression coverage as one coherent change.
2. `test(live): FE-V1-005 verify real backend event lifecycle`
   — Commit `9ef8a07`.
   — `e2e-backend/live.spec.ts`. Verifies both direct and proxied native SSE against
   the disposable real API/database.
3. `docs(live): FE-V1-005 record synchronization contract and verification`
   — All files in the contracts/completion-evidence table. Documents approved
   behavior, consumer integration and the actual verification result.

The third commit contains this completion record. All commits remain on
`feature/dashboard-v1`; merging or pushing was not authorized by commit approval.
