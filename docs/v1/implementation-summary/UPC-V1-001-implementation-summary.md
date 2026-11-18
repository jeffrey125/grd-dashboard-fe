# UPC-V1-001: Upcoming Shipments frontend

## Summary

Implemented the approved responsive Airtable shipment views and rep assignments.

## Changes Made

Weekly shipments appear below Upcoming Deliveries. Monthly desktop dates open a
right drawer with all orders and animated details/Back. Mobile uses date navigation
and a centered details modal. Admin dispatch and account rep assignments support
multiple reps, explicit saves and email suggestions. Queries show freshness and
stale errors; unassigned staff do not see the feature.

## Files Changed

- `src/features/upcoming-shipments/`: API contracts, access hook, calendar, weekly/monthly/dispatch views, order panel and account assignments.
- `src/routes/upcoming-shipments.tsx`, `src/routes/admin.upcoming-shipments.tsx`, `src/app/route-tree.gen.ts`: routes and generated registration.
- `src/features/overview/pages/overview-page.tsx`: weekly section below deliveries.
- `src/features/accounts/pages/account-detail-page.tsx`: assignment editor.
- `src/features/auth/session-boundary.tsx`, `src/components/layout/app-shell.tsx`: permission-aware navigation.
- `package.json`, `pnpm-lock.yaml`: approved FullCalendar packages.
- `e2e/upcoming-fixture.ts`, `e2e/upcoming-shipments.spec.ts`: fictitious dense-day desktop/mobile coverage.
- `e2e/live-fixture.ts`, `e2e/smoke.spec.ts`: default access fixtures.
- This document: verification and handoff.

## Verification

- `pnpm check`: passed, including 267 unit/component tests.
- `pnpm build`: passed.
- `pnpm exec playwright test --workers=4`: 184 passed, 2 screenshot-generation tests skipped.
- `pnpm exec playwright test e2e/upcoming-shipments.spec.ts --workers=2`: final targeted run, 6 passed.
- After overview placement change: `pnpm exec biome check src/features/overview/pages/overview-page.tsx`, `pnpm exec tsc --noEmit`, `git diff --check`: passed.
- Live local browser/API check: 24 Airtable orders, desktop drawer and mobile modal, no browser errors.
- Production deployment and full backend/container acceptance were not run.

## Review Notes

Uses approved FullCalendar and existing MUI/Query/Router/Axios/Zod. Existing shared
320 ms motion and reduced-motion configuration remains separate pre-existing work.
Other pre-existing changes are excluded from this feature commit.

## Remaining Issues

Help guides/screenshots await separate approval. Production activation is not done.

## Suggested Review Order

API/access contracts, views/order panel, assignments/navigation, browser tests.

Approved commit: `feat(upcoming-shipments): UPC-V1-001 add responsive shipment views`.
