# FE-V1-008 implementation summary

## Summary

Implemented the dedicated shipment Overview page, note editing, monitoring
actions, run progress and soft deletion. Local frontend and real-backend detail
checks pass. The work was partitioned into four focused commits after explicit
approval.

The frontend worktree was clean at entry. Backend source was inspected and built,
but no backend source was changed. Its pre-existing untracked `sample.txt` was
left untouched. Dependencies FE-V1-006 and BE-V1-001 were confirmed from actual
frontend actions/list code, backend controllers/projections, and verification evidence.

## Changes Made

- Replaced the detail placeholder with the approved non-sticky identity/action
  header and separate Tracking, Monitoring, Latest lookup & run, and Notes sections.
  Preserved validated list return URLs, public UUID routes, nullable fields,
  date-only values and America/New_York timestamps. History remains absent.
- Added notes-only PATCH and soft DELETE adapters with existing Zod/Axios transport.
  Notes use React Hook Form, save/cancel, null clearing, draft isolation, detected
  concurrent-edit choices, navigation blocking and native unload warnings.
  Saves refetch authoritative records rather than installing stale mutation responses.
- Reused per-shipment commands and eligibility rules. Retained exact manual runs
  alongside later scheduled runs, deduplicated identical IDs, and polled only
  displayed active runs every 15 seconds while visible. Terminal/inaccessible runs
  stop periodic polling. Unknown diagnostic codes never render raw values.
- Added detail invalidation for run events and scheduled cache-driven live-status
  notifications through TanStack Query to avoid updates during React rendering.
- Added disposable real-backend fixtures/tests and a targeted API-port override.
  Existing MUI, Router/Query, React Hook Form, Zod, Axios and Day.js cover the feature;
  no dependency, lockfile, API contract or database migration changed.

## Files Changed

All paths below are relative to the frontend repository root.

| File | Review purpose |
| --- | --- |
| `src/routes/shipments.$shipmentId.tsx` | Compose the implemented page while preserving UUID validation and safe return state. |
| `src/features/shipments/index.ts` | Export the detail feature page. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Detail reads, separated state sections, action header, missing/stale states and deletion. |
| `src/features/shipments/pages/placeholder-page.tsx` | Removed obsolete placeholder; recoverable from Git. |
| `src/features/shipments/notes-section.tsx` | Draft ownership, validation, save/cancel, conflict choices and navigation protection. |
| `src/features/shipments/run-panel.tsx` | Display/query exact runs, per-shipment attempt outcomes and bounded active polling. |
| `src/features/shipments/detail-model.ts` | Shared monitoring labels, note comparison, URL validation, diagnostics and polling policy. |
| `src/features/shipments/detail-model.test.ts` | Contract, normalization, safe-link, unknown-code and polling tests. |
| `src/features/shipments/api.ts` | Detail/run reads, notes-only PATCH and soft DELETE. |
| `src/features/shipments/schemas.ts` | Public run/attempt response schema and run type. |
| `src/features/shipments/actions.ts` | Optional accepted-run and missing-record callbacks for existing shared mutations. |
| `src/features/shipments/shipment-grid.tsx` | Reuse the same monitoring label as detail. |
| `src/features/tracking-updates/query-refresh.ts` | Run events also invalidate details displaying latest-run projections. |
| `src/features/tracking-updates/live-updates.ts` | Defer cache-driven status notifications through Query's scheduler. |
| `src/features/tracking-updates/live-updates.test.ts` | Regression coverage for deferred notifications, detail invalidation and 404 recovery. |
| `e2e/shipment-detail.spec.ts` | Eleven scenarios on desktop/mobile, including conflict/save races, dirty navigation, run polling and dark/long-content layout. |
| `e2e/shipments.spec.ts` | List-to-detail fixtures and assertions now target the implemented page. |
| `e2e-backend/shipment-detail.spec.ts` | Real API/SSE/PostgreSQL acceptance through direct access and the mobile Vite proxy. |
| `scripts/shipment-detail-fixtures.mjs` | Disposable database run-state fixtures; no carrier I/O. |
| `scripts/auth-backend.mjs` | Seed detail fixtures/account; configurable test API port and safe failure codes. |
| `playwright.backend.config.ts` | Match the isolated API health/proxy origin to the optional test port. |
| `README.md` | Implemented feature behavior and isolated detail test instructions. |
| `docs/v1/README.md` | FE-V1-008 status and evidence link. |
| `docs/v1/architecture.md` | Document detail invalidation from run events. |
| `docs/v1/decisions.md` | Record approved interview and dependency decisions. |
| `docs/v1/ui-spec.md` | Record the agreed layout, conflict, delete and run behavior. |
| `docs/v1/verification.md` | Detail test coverage and real-backend scope. |
| `docs/v1/tickets/README.md` | Ticket index implementation status. |
| `docs/v1/tickets/FE-V1-008-shipment-details.md` | Completion status, History boundary and evidence link. |
| `docs/v1/implementation-summary/FE-V1-008-implementation-summary.md` | Review-ready evidence and commit proposal. |

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm run ci` | Passed format, lint, Knip, 112 Vitest tests, production build/typechecks, and all 66 desktop/mobile Chromium cases, including 22 detail cases. |
| `pnpm --dir ../grd-dashboard-be build` | Passed; compiled backend used by the isolated harness. |
| `VITE_API_ORIGIN=http://localhost:3018 pnpm build` | Passed; preview artifact configured for the isolated API. |
| `FE_TEST_API_PORT=3018 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/shipment-detail.spec.ts` | Passed both direct-API and mobile-proxy scenarios against real migrations/PostgreSQL/HTTP/SSE; no React update-during-render warnings after the fix. |
| `pnpm exec vitest run src/features/shipments/detail-model.test.ts` | Passed all 15 tests after final diagnostic hardening, including inherited object-property names as unknown codes. |
| `pnpm exec biome check src/features/shipments/detail-model.ts src/features/shipments/detail-model.test.ts` | Passed after final diagnostic hardening. |
| `pnpm build` | Passed after final hardening; normal API origin restored. |
| `git diff --check` | Passed; final source/test/documentation diff reviewed against the clean starting worktree. |
| Desktop/mobile visual inspection | Inspected light desktop/mobile and dark mobile screenshots, including 255-character reference and 500-character notes, without horizontal overflow. Generated images are temporary `/tmp/grd-detail-*.png` artifacts. |
| Local service reachability | Final `curl -sS --max-time 3 -o /dev/null -w '%{http_code}'` checks on `http://localhost:5173` and `http://localhost:3000/api/v1/health/live` both return HTTP 200. The frontend and isolated manual-test backend are left running. |
| Markdown relative-link check | Read-only Node check of all nine changed Markdown documents: no missing relative targets. |

Unit V8 coverage from the full run: 70.77% lines, 68.59% statements, 53.63%
branches and 60.4% functions. Browser-tested detail components are not instrumented
by Vitest coverage; no coverage threshold was introduced.

Initial browser failures involved synthetic history entries, clicks during dialog
exit transitions, toast overlap and a canceled reload waiting for a load event.
Tests now use real app links and wait for the relevant UI lifecycle. The first
backend fixture startup needed explicit PostgreSQL enum casts. Development testing
then exposed synchronous live-status notification during render; the scheduler fix
has a unit regression and a development-console assertion in the backend suite.

Not run: the entire older real-backend suite, hosted GitHub CI, local Gitleaks
(binary unavailable), production-domain checks, worker execution or external
carrier requests. Run-state integration fixtures are seeded database states;
the accepted-already-terminal 202 race and polling transitions use deterministic
browser fixtures. Vite still reports the existing large shipment chunk warning;
the build succeeds. The Router CLI also emits its existing circular-dependency warning.

## Review Notes

- Concurrent note detection is best effort. The API has no conditional-save token;
  a change not yet received by the browser can still race a save. Drafts remain in
  memory only and disappear on confirmed discard/session loss.
- Known tracking survives lookup failures. Snapshot time, lookup completion and
  attempt time remain distinct; whole-run success/counts never imply delivery or
  a count specific to this shipment.
- Only displayed run queries poll; live run events invalidate active detail reads
  because the event carries a run UUID but no shipment UUID. Inactive entries are
  invalidated without background fetches. Terminal transitions also reconcile the
  shipment projection in case a shipment event was missed.
- Delete confirmation identifies the reference and any draft loss. Confirmed
  missing records replace the form with recovery UI; successful deletion removes
  detail/history cache entries before returning to the saved list URL.
- API port override is intentionally documented for the new targeted detail
  suite; older backend test files still assume port 3000. Disposable test services
  stopped after verification. The earlier developer services were reachable at
  entry but absent at the final check; no stop command was issued against them.
  Started `node scripts/auth-backend.mjs` (session 29568) and
  `pnpm dev --host localhost` (session 66389) for manual testing, then confirmed
  both return HTTP 200. The retained backend uses a new disposable database and
  no worker. Test login: `frontend-details@example.test` / `details fixture password`.
  Stop the harness with Ctrl-C to remove its disposable database.

## Remaining Issues

No incomplete FE-V1-008 implementation item. Verification limits are listed above.
History is FE-V1-009; tracking-change alerts/review state are FE-V1-011. Guaranteed
server-side concurrent-edit prevention would require a separately scoped API change.
Hosted CI, secret scanning, push, merge, tagging and deployment remain pending.

## Suggested Review Order

1. `detail-model.ts`, `schemas.ts`, `api.ts` and contract tests.
2. `notes-section.tsx`, `run-panel.tsx`, detail page and shared mutations.
3. Live registration/notification changes and browser regression tests.
4. Isolated backend fixtures/tests, then decisions and verification documents.

## Approved commit partition

1. `fix(live): FE-V1-008 defer cache-driven status notifications`
   - Files: `src/features/tracking-updates/live-updates.ts`,
     `src/features/tracking-updates/query-refresh.ts` and
     `src/features/tracking-updates/live-updates.test.ts`.
   - Behavior: avoid React updates during run-query rendering using Query's scheduler
     and keep shipment detail projections current when runs change.
2. `feat(shipments): FE-V1-008 implement shipment details and note protection`
   - Files: all eleven listed changed/new/deleted files under
     `src/features/shipments`; `src/routes/shipments.$shipmentId.tsx`;
     `e2e/shipment-detail.spec.ts`; `e2e/shipments.spec.ts`.
   - Behavior: the approved detail UI, notes, actions, run feedback and deletion,
     with deterministic unit/browser regression coverage.
3. `test(shipments): FE-V1-008 verify detail flows against the real API`
   - Files: `e2e-backend/shipment-detail.spec.ts`, `scripts/shipment-detail-fixtures.mjs`,
     `scripts/auth-backend.mjs`, `playwright.backend.config.ts`.
   - Behavior: isolated real-backend acceptance and configurable detail-test API port.
4. `docs(shipments): FE-V1-008 record detail decisions and verification`
   - Files: `README.md` and the eight listed changed/new documents under `docs/v1`.
   - Behavior: reconcile feature status, approved decisions, tests and handoff evidence.

The commits were created locally on `feature/dashboard-v1`. No push, merge, tag or
deployment has been performed.
