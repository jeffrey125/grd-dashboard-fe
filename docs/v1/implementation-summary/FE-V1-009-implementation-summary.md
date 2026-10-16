# FE-V1-009 implementation summary

## Summary

Implemented the shipment History tab in `grd-dashboard-fe`, from clean frontend
baseline `f5e6cfb` on `feature/dashboard-v1`. Staff can inspect real normalized
tracking observations with URL-owned navigation, pagination and safe comparisons.
FE-V1-008 and BE-V1-003 prerequisites were confirmed in source and recorded tests.
Local verification passes; staging and commits await explicit approval.

## Changes Made

- Added Overview/History tabs and validated `tab`, `page`, `pageSize` state while
  preserving `returnTo`. History fetches only while its valid tab is displayed.
  Defaults are Overview/page 1/25 observations, with 25/50/100 page sizes. Invalid
  values remain visible with explicit reset; valid pages beyond the end clamp
  using replace navigation after a successful response.
- Added a credentialed, cancellable history API adapter and shared snapshot schema.
  Reject malformed, mismatched, incomplete or duplicate-ID page envelopes.
  Cards render all normalized fields, public UUIDs and New York observation times;
  carrier dates stay date-only. Initial observation labels use position and total
  from one response. Changed-field callouts use only same-response adjacent older
  snapshots, including null transitions, and explain missing boundary context.
- Registered history with the existing live coordinator. Updates retain the page
  and scroll position, with a dismissible notice when the displayed IDs/count
  change. Existing coalescing and trailing reads settle events arriving during
  requests. A confirmed 404 removes the shipment view and retained history.
- Reused the dirty-note navigation confirmation for tab switches and clear the
  parent dirty flag when the notes section unmounts. Requested-run progress now
  stays above both tabs; a distinct latest run remains in Overview. Terminal
  displayed runs invalidate history as well as detail for missed-event recovery.
- Reused installed MUI, TanStack Router/Query, Axios, Zod and Day.js. The approved
  fixed-field comparison needs no additional package. Added disposable backend
  fixtures using actual tracking finalization for lifecycle semantics, plus
  deterministic equal-time records for pagination. No backend source or schema
  changes, new dependencies, worker startup or external carrier calls.

## Files Changed

### Feature and browser/unit regression coverage — commit 1

| File | Purpose |
| --- | --- |
| `src/features/shipments/schemas.ts` | Reuse the snapshot schema and validate history responses. |
| `src/features/shipments/api.ts` | Request history with cancellation and validate page consistency. |
| `src/features/shipments/history-model.ts` | Detail URL parsing, safe pagination validation and five-field differences. |
| `src/features/shipments/history-section.tsx` | History cards, fetching, pagination, update notices and error/empty states. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Shared header/run progress, URL tabs and Overview/History composition. |
| `src/features/shipments/notes-section.tsx` | Clear dirty state when confirmed navigation unmounts notes. |
| `src/features/shipments/run-panel.tsx` | Refresh history after a displayed run becomes terminal. |
| `src/routes/shipments.$shipmentId.tsx` | Wire detail search validation and preserve optional search input typing. |
| `src/features/shipments/history-model.test.ts` | URL, comparison and API boundary tests. |
| `e2e/shipment-history.spec.ts` | Desktop/mobile navigation, races, faults, discard, dates, keyboard and themes. |
| `e2e/shipment-detail.spec.ts` | Update the existing assertion to expect the implemented History tab. |

### Real-backend acceptance — commit 2

| File | Purpose |
| --- | --- |
| `scripts/shipment-history-fixtures.mjs` | Seed empty, initial, changed, unchanged, failed-later and multi-page scenarios. |
| `scripts/auth-backend.mjs` | Add a dedicated history account and initialize fixture tracking services. |
| `e2e-backend/shipment-history.spec.ts` | Verify persisted snapshots and shared progress through direct API and proxy. |

### Documentation and handoff — commit 3

| File | Purpose |
| --- | --- |
| `README.md` | Describe the implemented History route and interactions. |
| `docs/v1/README.md` | Record ticket implementation status and evidence. |
| `docs/v1/decisions.md` | Record approved interview decisions and dependency reuse. |
| `docs/v1/ui-spec.md` | Reconcile History behavior with the implemented interface. |
| `docs/v1/verification.md` | Document history test coverage and isolated account. |
| `docs/v1/tickets/README.md` | Update ticket index status. |
| `docs/v1/tickets/FE-V1-009-shipment-history.md` | Mark implemented with verification and commit status. |
| `docs/v1/implementation-summary/FE-V1-009-implementation-summary.md` | This inventory, verification evidence and commit proposal. |

No unrelated frontend changes were present at the initial worktree check. The
generated route tree was regenerated by typecheck and has no diff. Package and
lockfiles are unchanged.

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm run ci` | PASS: formatting, lint, Knip, 115 unit tests in 22 files with coverage, route generation, all three TypeScript projects, production build, and 74 desktop/mobile Chromium cases. |
| `pnpm exec playwright test e2e/shipment-history.spec.ts e2e/shipment-detail.spec.ts --workers=2` | PASS: 30 targeted cases; final enhanced keyboard/theme assertions also pass in full CI. |
| `pnpm --dir ../grd-dashboard-be build` | PASS: current sibling backend built for integration. |
| `VITE_API_ORIGIN=http://localhost:3019 pnpm build` | PASS: production frontend built for isolated backend access. |
| `FE_TEST_API_PORT=3019 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/shipment-history.spec.ts e2e-backend/shipment-detail.spec.ts` | PASS: all four real-backend scenarios, direct API and Vite proxy/mobile. Disposable PostgreSQL was created and removed by the harness. |
| `pnpm run ci` after integration | Restored the final production build to the normal default API origin, localhost:3000. |
| `git diff --check` and final diff review | PASS: reviewed requested source, tests and documentation; no whitespace errors or unrelated changes. |
| `curl --fail --silent --output /dev/null --write-out 'Frontend HTTP %{http_code}\n' http://localhost:5173` | HTTP 200; existing frontend left running. |
| `curl --fail --silent --output /dev/null --write-out 'Backend readiness HTTP %{http_code}\n' http://localhost:3000/api/v1/health/ready` | HTTP 200; existing backend left running. |
| Screenshot inspection | Inspected light full-page desktop/mobile captures and dark viewport captures in `/tmp/grd-history-*.png`; wrapping, tab focus and responsive layout are visible. |

V8 coverage is 66.69% statements, 51.19% branches, 58.17% functions, and 68.70%
lines. Browser coverage is not instrumented into these unit coverage percentages.
The existing non-failing route-generator circular-dependency warning and Vite
large-chunk warning remain. The first sandbox browser launch could not start its
server; the approved local-server run passed. An initial integration startup
exposed that tracking finalization is not an API Nest provider; the harness now
constructs it from the backend repository, matching backend integration tests.

Not run: the entire legacy real-backend suite, GitHub-hosted CI, Gitleaks,
production-domain validation, deployment, and external carrier execution.
Targeted real-backend History and existing detail regressions were run instead
of unrelated backend suites. No verification remains blocked within this ticket.

## Review Notes

- Offset pagination is a live read. The page number stays fixed while new
  observations can shift its records; this is explicitly disclosed. Adjacent
  comparisons never combine independently fetched pages.
- The backend currently preserves immutable snapshots without a retention policy.
  Initial-observation labeling relies on the oldest persisted snapshot being the
  initial observation under that existing contract.
- Live coordination serializes trailing reads. An old in-flight response can be
  displayed transiently with recovery pending, as documented in architecture.md;
  it cannot cancel the follow-up read required by an intervening live event.
- Discard confirmation is the existing Router blocker. Confirming the tab switch
  unmounts notes, so a discarded draft does not reappear on returning to Overview.
- Existing manual-test servers are reachable at http://localhost:5173 and
  http://localhost:3000. Their accounts/data were not reset. The temporary history
  fixture account exists only in the disposable harness, not these servers.

## Remaining Issues

None within FE-V1-009 implementation and local acceptance. Commit approval is
pending. Hosted CI and production validation remain broader release limitations;
publishing, deployment and FE-V1-011 tracking alerts remain deferred.

## Suggested Review Order

1. History model/schema/API, then the history cards and detail integration.
2. Unit/browser tests, then real-backend fixture and acceptance coverage.
3. Interview decisions, UI contract and verification documentation.

Proposed single-purpose commits, with exact file assignments in Files Changed:

1. `feat(shipments): FE-V1-009 add paginated tracking history` — commit 1 files;
   implements History and its local regressions.
2. `test(shipments): FE-V1-009 verify persisted history with the real API` — commit 2
   files; adds lifecycle fixtures and direct/proxy backend acceptance.
3. `docs(shipments): FE-V1-009 record history decisions and verification` — commit 3
   files; records behavior, status, evidence and handoff.

No files have been staged and no commit, merge, tag or push was performed.
