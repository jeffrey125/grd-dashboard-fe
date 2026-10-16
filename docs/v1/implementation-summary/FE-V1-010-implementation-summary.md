# FE-V1-010 implementation summary

## Summary

Implemented the operational homepage at `/` using the real overview aggregate API.
The user approved visible-page minute polling, a full-width attention panel with
two secondary desktop columns, and returning to Overview from homepage-origin
shipment details/history.

## Changes Made

- Five linked server-count cards precede Needs attention, Upcoming deliveries and
  Recent tracking changes. Mobile stacks the panels; both GRD themes are supported.
- The feature validates the aggregate response, forwards cancellation, preserves
  literal references and calendar dates, and uses the server's `asOf`, timezone,
  totals and seven-day window. No aggregate is derived from a loaded shipment page.
- Installed TanStack Query polls every 60 seconds while visible. Shared event,
  reconnect and carrier-dependent focus synchronization remain active. Failed reads
  show errors or retained stale data with Retry; the warning survives an in-flight
  retry. No tracking-change toast or sound is introduced.
- Summary/view-all links use the matching shipment predicates. Upcoming view-all
  selects All, the server ETA range, undelivered-only and ETA ascending. References
  open details; recent observations open History. Only exact `/` is added to the
  existing safe return destinations, preserving filtered-list navigation.
- Reused MUI, TanStack Query/Router, Axios, Zod and Day.js. No dependency, backend
  source, schema migration, deployment configuration or lockfile was changed.

## Files Changed

### Runtime

| File | Purpose |
| --- | --- |
| `src/features/overview/api.ts` | Aggregate schema, safe API adapter and upcoming filter mapping. |
| `src/features/overview/pages/overview-page.tsx` | Real homepage panels, counts, polling, feedback and navigation. |
| `src/features/shipments/contracts.ts` | Public data-only exports; consumers need not import page/router implementation. |
| `src/features/shipments/schemas.ts` | Export the existing snapshot schema for contract reuse. |
| `src/features/shipments/search-state.ts` | Allow exact `/` as a safe return destination. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Label homepage-origin return links Back to Overview. |

### Verification

| File | Purpose |
| --- | --- |
| `src/features/overview/api.test.ts` | Validate response/cancellation boundaries and date-window drill-downs. |
| `src/features/shipments/search-state.test.ts` | Cover Overview returns and rejected redirect variants. |
| `src/test/overview-fixture.ts` | Typed empty/populated test data, separate from runtime. |
| `src/app/routes.test.tsx` | Replace the placeholder assertion with actual empty aggregate behavior. |
| `e2e/overview.spec.ts` | Desktop/mobile behavior, polling, recovery, dates, links and theme screenshots. |
| `e2e-backend/overview.spec.ts` | Direct/proxy real-API aggregate, search and history parity. |
| `e2e/live-fixture.ts` | Supply an empty overview to existing browser scenarios. |
| `e2e/auth.spec.ts` | Supply overview data through the auth suite's catch-all handler. |
| `e2e/smoke.spec.ts` | Accept the new aggregate request and disambiguate sidebar navigation. |

### Documentation

| File | Purpose |
| --- | --- |
| `README.md` | Record implemented overview behavior and remove placeholder claims. |
| `docs/v1/README.md` | Record ticket completion and link this evidence. |
| `docs/v1/decisions.md` | Record approved interview decisions and library reuse. |
| `docs/v1/ui-spec.md` | Align layout, polling and originating-page navigation with the approved plan. |
| `docs/v1/verification.md` | Document overview checks and real-API ordering semantics. |
| `docs/v1/tickets/README.md` | Update ticket index status. |
| `docs/v1/tickets/FE-V1-010-overview-homepage.md` | Record implementation and prerequisite verification. |
| `docs/v1/implementation-summary/FE-V1-010-implementation-summary.md` | This review and verification handoff. |

## Verification

- Final `pnpm run ci`: passed formatting, lint, Knip, 127 tests with coverage,
  all TypeScript configurations, production build and all 86 browser tests.
- `pnpm format:check`, `pnpm lint`, `pnpm knip`: passed without lint warnings.
- `pnpm typecheck`: passed all application, tooling and browser-test configurations.
- `pnpm test`: 23 files, 127 tests passed.
- `pnpm build`: passed. Existing Router CLI circular-dependency and large-chunk
  warnings remain; neither blocks the build.
- `pnpm exec playwright test e2e/overview.spec.ts`: 12 desktop/mobile cases passed.
- `pnpm exec playwright test e2e/smoke.spec.ts`: all 4 passed; the final full
  browser suite passed all 86 cases through `pnpm run ci`.
- `pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/overview.spec.ts`:
  both direct API and mobile Vite proxy cases passed using disposable PostgreSQL
  and the real backend. Counts, full upcoming membership, date boundaries, history
  navigation and `Cache-Control: no-store` were checked against over 1,000 records.
- In `../grd-dashboard-be`, `pnpm build && pnpm exec vitest run --project integration test/integration/dashboard-overview.spec.ts`:
  build and all 8 existing PostgreSQL overview tests passed. These cover both
  New York DST date boundaries, null/deleted/disabled shipments, exact search
  predicates, bounded deterministic panels, concurrency and representative scale.
- Captured desktop/mobile light/dark screenshots; manually inspected the light
  desktop and dark mobile captures for hierarchy, wrapping and clipping. Browser
  assertions check keyboard navigation, panel placement and horizontal overflow.
- `git diff --check`: passed. Initial worktree was clean; all final changes belong
  to this ticket. Reviewed runtime, test and documentation changes before handoff.
- Local reachability: frontend `http://localhost:5173/` and isolated backend
  `http://localhost:3000/api/v1/health/live` both returned HTTP 200. Servers remain
  running for manual testing. Backend uses a disposable fixture database with the
  worker disabled. Sign in with `frontend-staff@example.test` and
  `staff fixture password` (test-only credentials).

## Review Notes

The existing backend overview breaks equal-ETA ties by creation time then ID;
shipment search breaks them by ID. Their matching sets and totals agree, while
their first page can differ. The real-API test checks the full filtered set.
No unsupported sort or backend behavior was added to force the ordering to match.

Minute polling stops while hidden; shared live updates retain their established
behavior. Browser suspension can delay timers, and the existing visible-focus
policy refreshes overview data older than 30 seconds. Server dates remain
authoritative; the frontend does not calculate business-today or invent an ETA.

Response validation rejects inconsistent attention totals and incomplete bounded
panels. Unknown response fields are stripped through the feature schemas. Recent
items are observations, including initial acquisition; the overview does not infer
field differences without a previous snapshot.

## Remaining Issues

None within FE-V1-010. GitHub-hosted CI, production cookie/origin verification and
deployment remain outside this ticket; no claim of
those checks is made. The entire backend browser suite and secret scanner were
not rerun; targeted real-backend overview tests and existing PostgreSQL integration
tests cover this change.

## Suggested Review Order

1. `src/features/overview/api.ts` and `src/features/shipments/contracts.ts`.
2. `src/features/overview/pages/overview-page.tsx` and the shipment return changes.
3. Unit/browser tests, then `e2e-backend/overview.spec.ts`.
4. Recorded decisions, UI specification and this verification evidence.

One coherent feature commit is proposed for all files listed above:

`feat(overview): FE-V1-010 implement the operational homepage`

It delivers the homepage with its necessary return navigation, regression fixtures,
acceptance tests and documentation.
