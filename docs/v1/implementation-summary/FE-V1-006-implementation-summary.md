# FE-V1-006 implementation summary

Implemented in `grd-dashboard-fe` on 2026-10-16. Commit approval is pending.

## Summary

The authenticated shipment workspace now uses the real paginated API, server tab
counts and allowlisted sorts, validated URL state, Apply filters and quick row
commands, calendar filters and mobile shipment cards. The list includes Pickup and
Delivery dates, and the browser favicon has a white background. Creation/detail
destinations remain the explicitly approved placeholders.

## Changes Made

- Installed approved MUI X Data Grid Community 9.15.0 with strict peer compatibility.
  Default Active/page 1/25 rows/created-desc; 25/50/100-row controls remain available
  on mobile. Below 900px, MUI cards replace the grid with labeled details, wrapped
  references/notes, stacked full-width 44px action buttons, sorting controls and
  server pagination. A full-width Shipment view selector replaces the scrollable
  tab strip on mobile. Both views share the same UUID-keyed commands and query/URL state.
- Added the carrier-provided pickup date beside the delivery date in both views.
  The concise Delivery label still represents `estimatedDeliveryOn`; actual
  `deliveredOn` remains separate contract data for detail/history work.
- Changed fixed desktop column widths to flexible widths. The grid hides Notes and
  Date Created below 1536px, then Sales Rep, Pickup and Follow Up below 1200px, so
  the table fits without horizontal scrolling. The existing cards retain every
  field below 900px. The Tracking Number link opens the complete shipment detail.
- Added an opaque white background to generated SVG and six-resolution ICO
  favicons. The official source logo and original website favicon remain unchanged.
- Seeded three long but valid notes on the first fixture page so desktop truncation
  and full mobile-card wrapping can be reviewed against the real local API.
- Reference/notes search debounces for 350 ms and forwards Query cancellation.
  Carrier/outcome/date filters apply together. Invalid URLs retain editable values
  and disable list requests until corrected or explicitly cleared. Applied state
  survives reload, back/forward and placeholder return; local drafts survive live
  refresh and independent search changes. MUI X Date Pickers 9.15.0 and Day.js
  1.11.23 provide all four calendar filters. Narrow/touch devices use a dialog;
  larger mouse-driven screens use a popover. Undelivered-only has a removable chip.
  Day.js is approved for future date work; business timestamps now use its timezone plugin.
- Data/counts remain server-owned. Display previous results during query transitions
  with disabled row actions and a notice; distinguish initial loading, empty,
  failed/stale refresh and reconnect. Clamp pages after deletions/state changes.
- Refresh/pause/resume share feature mutations, avoid automatic retries, suppress
  duplicate pending row requests, and refetch on conflicts. Refresh acceptance is
  labeled queued/coalesced, never tracking success. Stable UUID identity prevents
  menu actions from targeting replacement rows. Carrier status, monitoring state,
  lookup outcome and latest run are separate; calendar dates never shift timezone.
- Register live list/carrier queries. Run-only events also invalidate list variants
  because these rows now show latest-run state; existing 100 ms coalescing and
  in-flight follow-up behavior applies. Use TanStack scalar URL helpers so long
  numeric references are not JSON-rounded. Fixture records are test-only, never
  included in production application data.

## Files Changed

All paths below are relative to this repository. The frontend worktree was clean
before FE-V1-006. The picker/card follow-up builds on that task's uncommitted work;
no unrelated frontend edits were found during final review. No backend source was edited; an unrelated untracked backend
`sample.txt` was left untouched.

| File | Review purpose |
| --- | --- |
| `package.json` | Pin approved MUI Data Grid, Date Pickers and Day.js dependencies. |
| `pnpm-lock.yaml` | Record the approved packages and resolved peer graph. |
| `src/features/shipments/search-state.ts` | API-compatible defaults, strict validation, editable invalid URLs, page reset and safe list return. |
| `src/features/shipments/schemas.ts` | Frontend Shipment, Carrier, Run and paginated response validation. |
| `src/features/shipments/api.ts` | Credentialed shared transport adapters, cancellation and safe response failures. |
| `src/features/shipments/actions.ts` | Eligibility, keyed pending mutations, feedback and authoritative invalidation. |
| `src/features/shipments/filters.tsx` | Debounced search, controlled calendar pickers, retained filter drafts, Apply/Clear and corrections. |
| `src/features/shipments/shipment-grid.tsx` | Responsive grid/cards, distinct statuses, desktop menus, stacked full-width mobile buttons, Day.js timestamps and mobile sorting/pagination. |
| `src/features/shipments/pages/shipments-page.tsx` | URL/query composition, desktop tabs/mobile view selector, counts, loading/error states and page clamping. |
| `src/features/shipments/pages/placeholder-page.tsx` | Honest Add/detail destinations and validated return link. |
| `src/features/shipments/search-state.test.ts` | Defaults, invalid dates/queries, paging and safe return tests. |
| `src/features/shipments/actions.test.ts` | Manual/threshold/terminal/disabled action matrix. |
| `src/features/shipments/filters.test.tsx` | Apply validation, draft preservation and explicit invalid-page correction. |
| `src/routes/shipments.tsx` | Parent outlet for list/new/UUID routes. |
| `src/routes/shipments.index.tsx` | Thin list route and raw search validation boundary. |
| `src/routes/shipments.new.tsx` | Creation placeholder route. |
| `src/routes/shipments.$shipmentId.tsx` | UUID-validated detail placeholder route. |
| `src/app/route-tree.gen.ts` | Regenerated and tracked route definitions. |
| `src/app/router.ts` | Install scalar URL parsing/serialization. |
| `src/lib/dates.ts` | Strict calendar parsing without rollover/timezone shifts and Day.js New York timestamp formatting. |
| `src/lib/dates.test.ts` | Leap dates, early years, malformed values and DST transitions. |
| `src/lib/url-search.ts` | Configure TanStack helpers for literal scalar query values. |
| `src/lib/url-search.test.ts` | Long-number, leading-zero, literal and nested-return URL cases. |
| `src/app/routes.test.tsx` | Replace temporary-page assertion and provide valid business API fixtures. |
| `src/features/tracking-updates/query-refresh.ts` | Refresh lists on run events for latest-run cells. |
| `src/features/tracking-updates/live-updates.test.ts` | Assert run events refresh registered lists and explicit runs. |
| `src/test/shipment-fixture.ts` | Shared typed test-only shipments and empty search response. |
| `e2e/shipments.spec.ts` | Desktop/mobile URL, calendar, touch/timezone, card/resizing, action, pending, race, pagination and live-run scenarios. |
| `e2e/auth.spec.ts` | Fulfill new business reads while retaining auth-focused scenarios. |
| `e2e/live-fixture.ts` | Default empty list/carrier fixtures for existing stream tests. |
| `e2e/smoke.spec.ts` | Expect actual empty list and allow its explicit requests. |
| `scripts/auth-backend.mjs` | Seed isolated shipment records and a separate test employee. |
| `scripts/shipment-list-fixtures.mjs` | Generate 1,000 deterministic PostgreSQL records, including three visible long-note examples, snapshots and failures. |
| `e2e-backend/shipments.spec.ts` | Real API/SQL pagination/filter/count parity and UI commands, direct and proxied. |
| `README.md` | Current routes, dependencies and manual fixture setup. |
| `public/favicon.svg` | Add an opaque white background behind the cropped GRD mark. |
| `public/favicon.ico` | Regenerate white-backed 16/32/48/64/128/256-pixel fallback frames. |
| `docs/v1/branding.md` | Document the derived white-backed favicon while preserving source assets. |
| `docs/v1/README.md` | Record implemented ticket status. |
| `docs/v1/tickets/README.md` | Update ticket index and evidence link. |
| `docs/v1/tickets/FE-V1-006-shipment-list.md` | Completion status and interview refinements. |
| `docs/v1/decisions.md` | Record approved dependency and interaction choices. |
| `docs/v1/ui-spec.md` | Reflect Apply filters and staff-corrected invalid URLs. |
| `docs/v1/architecture.md` | Document run-event list invalidation. |
| `docs/v1/verification.md` | Explain new browser/PostgreSQL coverage. |
| `docs/v1/implementation-summary/FE-V1-006-implementation-summary.md` | This evidence, limitations and commit proposal. |

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm view @mui/x-data-grid version peerDependencies engines --json` | 9.15.0 supports installed React 19/MUI 9/Emotion and Node 24. |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Passed; lockfile current and supply-chain policy passed. No package agent skills approved. |
| `pnpm check` | Passed again on 2026-10-21 after the responsive-grid follow-up: format, lint, types, Knip and 220 tests in 34 files. |
| `pnpm run ci` | Passed after all picker/card changes: format, lint, Knip, 83 tests in 19 files, build/types and 38 browser tests. Overall line coverage 82.66%; browser execution is not included. |
| `pnpm build` | Passed again on 2026-10-21 after the responsive-grid follow-up. Vite emitted the existing chunk-size advisory; the largest chunk was approximately 588 kB/189 kB gzip. |
| `pnpm exec playwright test` | Original 34 scenarios passed before the follow-up. The final `pnpm run ci` ran all 38 desktop/mobile/touch scenarios successfully. |
| `pnpm exec playwright test e2e/shipments.spec.ts --grep 'dates\|calendar'` | Passed 6 matching scenarios after the narrow-screen dialog correction, including all four calendars, invalid URL replacement/clearing and Los Angeles date preservation. |
| `pnpm exec playwright test e2e/shipments.spec.ts` | Passed all 20 current desktop/mobile shipment scenarios on 2026-10-21. The responsive scenario checks 375, 1100, 1440 and 1600px widths, visible columns, no horizontal grid scrolling, and Tracking Number-only detail navigation. |
| `pnpm exec playwright test e2e/tracking-review.spec.ts --grep "only the Tracking Number"` | Passed 2 desktop/mobile scenarios: ordinary cells/card content retain the highlight and list route; Tracking Number acknowledges the displayed revision and opens detail. |
| `pnpm test:e2e:backend` | Passed all 6 real-backend tests, including the 1,000-row list plus refresh/coalescing/pause/resume through both direct CORS and Vite proxy. Uses real migrations/PostgreSQL 18.3 and no worker. |
| `pnpm exec playwright test --config /tmp/grd-existing-backend.config.mts shipments.spec.ts` | Passed both 1,000-record scenarios after the follow-up, including date inputs and row commands. Temporary config reuses the running disposable backend and starts normal 4175/4176 frontend servers; manual preview remains running. |
| `node /tmp/grd-picker-review.mjs` | Captured and inspected the final 375px calendar dialog and dark cards against the real backend. A separate touch interaction check selected/applied dates in Asia/Manila without shifting them. Light cards were also visually inspected. |
| `pnpm format:check` and `pnpm lint` | Passed after final presentation changes. |
| `git diff --check` | Passed; final diff and new files reviewed against requested scope. |
| Browser visual review at 1440px and 375px | Signed-in fixture list inspected. Fixed clipped second-line carrier/run labels and mobile page-size visibility; screenshots under `/tmp` informed the corrections and browser tests verify final footer bounds. |
| `identify public/favicon.ico public/favicon.svg` plus opaque-pixel inspection | Confirmed a white-backed 544×544 SVG and opaque 16/32/48/64/128/256 ICO frames; visually inspected the rendered 256px mark. Official source hashes remain unchanged. |
| HTTP reachability | Frontend `/shipments` and backend `/api/v1/health/ready` both returned 200; servers remain running. |

The full six-test backend suite preceded the follow-up; its two shipment scenarios
were rerun successfully against the existing disposable backend afterward. Auth
and SSE backend scenarios were not rerun for these presentation/date changes;
their frontend/browser regressions passed. The backend contract, fixture schema
and command behavior are unchanged.
Gitleaks was not run because the binary is unavailable. GitHub-hosted CI,
production cookies/domains, live carrier I/O and deployment were not run.

## Review Notes

- Data Grid needs a stable sort-model reference: otherwise its sort-change event
  resets paging. Row commands stay keyed by UUID, including through virtualization.
  Menus render above action toasts so feedback cannot block the next command.
- Calendar fields preserve malformed bookmarked values in visible error text until
  explicitly replaced/cleared. Strict Zod calendar validation prevents Day.js rollover.
  Picker values serialize as YYYY-MM-DD, never UTC timestamps. The supported year
  range remains 0001–9999 rather than inheriting MUI's default 1900–2099 restriction.
  Business timestamps use Day.js in America/New_York; ETA stays date-only.
- Cards render the current server page (up to 100 records), without virtual scrolling.
  Mobile uses a full-width view selector plus stacked full-width action buttons.
  Resizing swaps presentation without changing the URL, data ownership or action rules.
- Run events do not identify shipments, so they invalidate all list variants and
  refetch only active consumers. This adds bounded HTTP work in exchange for
  current latest-run cells; it reuses established coalescing instead of adding a
  parallel event listener or polling loop.
- The fixture database has 800 Active, 150 Paused, 50 Delivered and 52 overlapping
  Needs attention records. Two active failures make the overlap observable. All
  creation timestamps tie to exercise stable server ordering.
- Manual servers: frontend `http://localhost:5173/shipments`; backend
  `http://localhost:3000/api/v1`. Started with `pnpm dev --host localhost` and
  `node scripts/auth-backend.mjs`. Use `frontend-staff@example.test` /
  `staff fixture password`. Stopping the harness deletes only its disposable DB.

## Remaining Issues

No known blocking FE-V1-006 defect. Creation/detail remain the approved placeholders
for FE-V1-007/008; tracking highlights/sounds remain FE-V1-011. Build-size warnings,
unavailable local Gitleaks and unexecuted hosted/production checks remain visible
verification/delivery limitations. No commit, push, merge, tag or deployment occurred.

## Suggested Review Order

1. Search/response schemas and API adapters, then the scalar URL helper.
2. Filters, page composition, grid and row actions.
3. Live-query invalidation and its regression test.
4. Browser tests, isolated database fixture and real-backend evidence.
5. Route/dependency/documentation changes.

## Proposed commits — approval required

1. `build(shipments): FE-V1-006 add MUI grid and date pickers`
   - Files: `package.json`, `pnpm-lock.yaml`.
   - Behavior: install the approved compatible grid, calendar picker and Day.js packages.
2. `feat(shipments): FE-V1-006 implement live shipment workspace`
   - Files: every `src/`, `e2e/`, `e2e-backend/` and `scripts/` file listed above.
   - Behavior: list, URL validation, Apply filters, quick commands, placeholder
     navigation, mobile cards, calendar filters, Day.js dates, live run state and
     their deterministic/real-backend verification.
3. `fix(branding): FE-V1-006 add white favicon background`
   - Files: `public/favicon.svg`, `public/favicon.ico` and `docs/v1/branding.md`.
   - Behavior: keep the cropped GRD mark readable against light and dark browser
     chrome while preserving both official source assets unchanged.
4. `docs(shipments): FE-V1-006 record implementation and verification`
   - Files: `README.md` and every other `docs/v1/` file listed above.
   - Behavior: record agreed behavior, current status, evidence and review limitations.

Stage only these files after explicit final approval. No unrelated backend file
belongs to these commits.
