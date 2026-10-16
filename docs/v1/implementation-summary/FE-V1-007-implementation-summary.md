# FE-V1-007 implementation summary

Implemented in `grd-dashboard-fe` and sibling `grd-dashboard-be` on 2026-10-16.
Commit approval is pending.

## Summary

`/shipments` now contains one compact shipment form above its filters and results.
The dedicated `/shipments/new` route and public batch/import workflow were removed.
Creation stays in the current list view and reports new versus existing shipments
immediately. Search, filter, tab, sort, and page changes preserve scroll position.

## Changes Made

- Reused installed React Hook Form, Zod/resolvers, MUI, TanStack Query/Router, and
  Axios; no dependency or lockfile change was required.
- Added one carrier/reference/notes form with responsive desktop/mobile layout,
  exact input normalization, synchronous double-submit protection, safe field
  errors, and draft retention after failed requests.
- A successful creation clears reference/notes, retains the selected carrier,
  invalidates shipment/overview queries, and stays on `/shipments`.
- An existing Carrier/reference pair returns immediate feedback and an All
  shipments action without overwriting existing notes or monitoring state.
- Same-route URL updates set `resetScroll: false`; this covers debounced search,
  applied filters, tabs, sorting, pagination, and automatic page clamping.
- The backend public `POST /shipments` contract now accepts one strict shipment
  object and returns `{ outcome: "created" | "existing", shipment }` with 201/200.
  The repository's internal `createMany` primitive remains for transaction-safe
  persistence and fixtures, but is no longer exposed publicly.

## Files Changed

Frontend behavior is primarily in `src/features/shipments/create-form.tsx`,
`create-schema.ts`, `api.ts`, and `pages/shipments-page.tsx`. The generated route
tree and shipment placeholder were updated after removing `shipments.new.tsx`.
Frontend unit, browser, and real-backend specs were reshaped for the single-item
contract. README and v1 contract/ticket/decision/verification documents now match.

Backend behavior is primarily in `shipments.schemas.ts`, `shipments.service.ts`,
and `shipments.controller.ts`. Shipment unit and HTTP e2e tests plus dependent auth,
dashboard, and refresh fixtures now send and read the single-item shape. The backend
frontend handoff, tracking behavior, ticket, release-readiness, and implementation
summary were updated. Pre-existing untracked `sample.txt` was not touched.

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm run ci` (frontend) | Passed: format, lint, Knip, 96 unit/coverage tests, typechecks, production build, and 44 desktop/mobile Playwright tests. |
| `pnpm check` (backend) | Passed: Prettier, oxlint, typecheck, 261 unit tests, and Nest build. |
| `pnpm test:e2e` (backend) | Passed: 47 HTTP/PostgreSQL tests in 7 files. |
| `pnpm test:e2e:backend` (frontend) | Passed: 8 real-backend desktop/mobile scenarios, including creation, duplicates, disabled-carrier race, SSE, auth, and 1,000-row list fixtures. |
| `git diff --check` in both repositories | Passed. |
| `curl` for `/shipments` and `/api/v1/health/ready` | Both returned 200; servers left running at ports 5173 and 3000. |

## Review Notes

- Duplicate identity remains Carrier UUID plus the normalized, case-sensitive
  tracking reference. Leading zeros and case are preserved.
- Backend error details expose allowlisted field names only; raw diagnostics and
  submitted values are not shown by the frontend.
- The inline form intentionally has no route-leave blocker. The former dedicated-
  page blocker stalled same-route live/page corrections; failures still retain the
  draft, while leaving the list follows normal navigation behavior.
- Vite continues to report the pre-existing large-chunk warning for main/list
  bundles; it does not fail the build.

## Remaining Issues

No known blocking issue. GitHub-hosted CI, production deployment, and real carrier
network calls were not run. No commit, push, merge, tag, or deployment occurred.

## Suggested Review Order

1. Backend schema/service/controller and shipment service/HTTP tests.
2. Frontend creation schema/API/form and `/shipments` page integration.
3. Browser/real-backend tests, then contract and ticket documentation.

## Proposed Commits

1. Backend: `refactor(shipments): V1-008 replace bulk creation with single-item contract`
2. Frontend: `feat(shipments): FE-V1-007 add inline single-shipment creation`
