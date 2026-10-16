# FE-V1-010 Upcoming deliveries restoration

## Summary

Restored Upcoming deliveries below Needs attention and the matching View all
destination, as requested during the FE-V1-013 interview. Both frontend and backend
had removed this behavior; both are updated. No dependency or migration was added.

## Changes Made

- Server returns `upcomingWindow` and `upcomingDeliveries` from the same PostgreSQL
  statement as counts/attention. New York today through day +6 is inclusive.
  Non-completed/nondeleted shipments with a current ETA in that range qualify;
  disabled carriers remain included, while null ETA and completed records do not.
- Overview shows the five earliest qualifying shipments and full total, with carrier,
  calendar ETA, last known status and links that return to Overview. Empty/loading/
  error/stale handling and quiet live/minute refresh are preserved.
- View all selects All shipments with `estimatedDeliveryFrom`, `estimatedDeliveryTo`,
  `undeliveredOnly=true`, delivery ascending. These filters operate before server
  pagination/counting. Frontend controls use explicit Apply and retain invalid input.
- Installed Day.js still handles dates. Plugin imports now use `.js` extensions for
  compatibility when Playwright's Node process imports the Overview schema.

## Files Changed

Frontend paths; backend files have their own manifest in the
[backend restoration handoff](../../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-004-upcoming-restoration.md).

| File | Review purpose |
| --- | --- |
| `src/features/overview/api.ts` | Required upcoming window/panel validation, range and cardinality checks. |
| `src/features/overview/pages/overview-page.tsx` | Upcoming panel, calendar dates, total and matching navigation. |
| `src/features/shipments/search-state.ts` | Validated ETA bounds and undelivered URL state. |
| `src/features/shipments/filters.tsx` | Applied date-range/delivery-state controls with explicit validation. |
| `src/lib/dates.ts` | Node-compatible Day.js plugin imports. |
| `src/features/overview/api.test.ts` | Invalid window/panel, out-of-range/completed rows and date-only preservation tests. |
| `src/features/shipments/search-state.test.ts` | Restored valid filters and invalid dates/ranges/boolean checks. |
| `src/test/overview-fixture.ts` | Updated test-only overview response. |
| `e2e/overview.spec.ts` | Desktop/mobile rendering, matching filter URL, date-only values and empty state. |
| `e2e-backend/overview.spec.ts` | Real aggregate/search total parity and browser drill-down through direct/proxy APIs. |
| `README.md` | Restored Overview and shipment-filter documentation; Upcoming-specific hunks. |
| `docs/v1/api-contracts.md` | Restored API fields and predicates. |
| `docs/v1/ui-spec.md` | Restored panel and filter behavior. |
| `docs/v1/decisions.md` | Approved restoration superseding the earlier omission. |
| `docs/v1/verification.md` | Updated Upcoming verification evidence. |
| `docs/v1/README.md` | Restoration summary link. |
| `docs/v1/tickets/BE-V1-004-overview-aggregates.md` | Restored backend scope. |
| `docs/v1/tickets/FE-V1-010-overview-homepage.md` | Restored frontend scope and evidence link. |
| `docs/v1/implementation-summary/FE-V1-010-upcoming-restoration.md` | This handoff. |

## Verification

`pnpm run ci` passed all frontend gates, production build, 174 unit tests and 126
desktop/mobile browser cases. The targeted command
`pnpm exec playwright test e2e/carriers.spec.ts e2e/overview.spec.ts --workers=2`
passed 22 cases. `pnpm exec playwright test --config playwright.backend.config.ts
e2e-backend/carriers.spec.ts e2e-backend/overview.spec.ts` passed four direct/proxy
real-API browser cases. See the [carrier handoff](FE-V1-013-implementation-summary.md)
for the shared exact check table, visual inspection, startup URLs and warnings.

Backend `pnpm check` passed 264 unit tests, types/lint/format/build. Focused
PostgreSQL/search/HTTP checks passed 35 cases including New York midnight around
both DST transitions, null/disabled/deleted/completed records, five-row caps,
full totals, search membership and the 10,000-row one-statement plan.
`git diff --check` passed in both repos; final diffs were reviewed.

Remote CI, production deployment/origins, live providers and container/release suites
were not run. These read/UI changes do not modify runtime packaging or schema.

## Review Notes

Deploy the backend addition before the new frontend, which requires the upcoming
fields. Search uses id to break equal-ETA ties; Overview uses creation/id. Full
membership/totals agree, but tied preview rows need not match the first search page.
Dates remain carrier calendar strings. The server calculates the window once, so
browser timezone and DST do not shift membership. Recent changes stays absent.

The earlier implementation summary is historical; this document records the current
restoration without claiming its old checks ran again. The pre-existing backend
`sample.txt` is excluded; the frontend started clean.

## Remaining Issues

No functional acceptance blocker. Commits await explicit approval. Production and
live-provider verification remain deferred; non-failing tool/development warnings
are recorded in the carrier handoff.

## Suggested Review Order

1. Backend schemas/query and PostgreSQL/HTTP tests.
2. Frontend Overview schema/panel, shipment URL/filter handling and tests.
3. Updated API contracts, specifications and both handoffs.

Proposed single-purpose commits, in dependency order:

1. Backend: `feat(dashboard): BE-V1-004 restore upcoming delivery aggregates` —
   backend manifest files; adds the window/panel and matching search predicates.
2. Frontend: `feat(overview): FE-V1-010 restore upcoming deliveries` — files above,
   with only Upcoming-related shared-documentation hunks; restores panel/drill-down.
3. Frontend: `feat(carriers): FE-V1-013 implement carrier administration` — carrier
   handoff files and remaining carrier documentation hunks; adds protected settings UI.

Nothing is staged or committed. Commit approval does not authorize merge, push or deployment.
