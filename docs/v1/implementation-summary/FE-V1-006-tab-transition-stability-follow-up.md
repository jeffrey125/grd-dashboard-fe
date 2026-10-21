# FE-V1-006 tab transition stability follow-up

Implemented and deployed on 2026-10-21, then committed with explicit approval on
2026-10-22.

## Summary

Shipment results no longer move vertically while a tab change fetches its next
page. Existing results remain visible, row actions remain unavailable while those
results are placeholders, and an in-place progress bar communicates the update
without changing layout.

## Root Cause

`ShipmentsPage` inserted its `role="status"` Typography into a spaced MUI Stack
only while TanStack Query was fetching. The status line and Stack gap changed the
grid's document position during every uncached tab transition, then removed that
space when the request completed.

## Changes Made

- Keep a one-pixel, visually hidden status live region mounted so assistive
  technology still receives loading, stale-result, and refresh announcements
  without changing Stack children or page geometry.
- Overlay the installed MUI `LinearProgress` on desktop grids and mobile cards
  while existing results update. No dependency was added.
- Add a desktop/mobile Playwright regression that verifies the results' absolute
  document position before, during, and after a delayed tab fetch.
- Make the existing tracking-review browser test wait until the current snapshot
  is visibly rendered before asserting that opening it acknowledges that exact
  snapshot. A clean-HEAD comparison reproduced the previous mobile race.

## Files Changed

- `src/features/shipments/pages/shipments-page.tsx`
- `src/features/shipments/shipment-grid.tsx`
- `e2e/shipments.spec.ts`
- `e2e/tracking-review.spec.ts`
- `docs/v1/implementation-summary/FE-V1-006-tab-transition-stability-follow-up.md`

## Verification

- `pnpm check`: passed; 34 files and 220 unit/component tests.
- `pnpm build`: passed; existing chunk-size advisory remains.
- `pnpm exec playwright test e2e/shipments.spec.ts`: 22 passed across desktop and
  mobile Chromium.
- `pnpm exec playwright test e2e/tracking-review.spec.ts --grep "only the Tracking Number link opens detail"`:
  2 passed across desktop and mobile Chromium.
- `pnpm test:acceptance`: passed; 220 unit/component tests, 132 isolated browser
  tests, 22 real-backend tests, and both HTTPS and HTTP container checks. Five
  provider-gated real-backend scenarios were intentionally skipped by the harness.
- Live release `20261021-04`: frontend, API, database, and worker healthy; `/healthz`
  and `/api/v1/health/ready` passed. Browser measurements across Active, Delivered,
  and All showed `0px` document-position change during and after updates.

## Deployment Notes

Only `grd-dashboard-fe:http-20261021-04` was replaced. Backend image
`grd-dashboard-be:20261021-02`, the database volume, secrets, and the existing
single worker were preserved. The pre-upgrade database backup is
`backups/grd-dashboard-20261021-171940.dump` on `debian-vm`; the previous environment
file is retained as `.env.pre-20261021-04`.

## Remaining Issues

MUI Data Grid still resets its internal virtual-row scroll when switching to a
different result set. This follow-up removes the whole-table layout shift; preserving
an independent row-scroll offset per tab was not part of the approved fix.

## Commits

1. `e3e1df0 fix(shipments): FE-V1-006 keep results anchored during tab updates`
2. `841b232 test(tracking): FE-V1-011 wait for the displayed snapshot before review`
3. `docs(shipments): FE-V1-006 record tab stability rollout`
