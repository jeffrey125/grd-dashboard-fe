# SHIP-V1-002: shipment detail tabs and equal-height cards

## Summary

Rearranged shipment details into Overview, Audit and the existing History tab.
Reused installed MUI Tabs/Box/Stack/Paper and CSS Grid under the existing approved
approach; no dependencies changed.

## Changes Made

- Overview: Tracking and Shipment details side by side on desktop, stretched to
  equal height, with full-width Notes below.
- Audit: Monitoring, Latest lookup & run and Shipment audit in an equal-height
  desktop row. Requested refresh run progress also appears here. Existing Other
  carrier behavior still omits automated lookup information.
- Mobile: single-column cards with natural heights. Desktop equal heights apply
  within each row, without clipping content or imposing fixed pixel heights.
- Audit supports direct links and reload via `tab=audit`. History remains intact.
  Assignment drafts survive tab switches. Notes retain the existing discard
  confirmation and clear their draft after a confirmed tab departure.

## Files Changed

| File | Purpose |
| --- | --- |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Tab/panel organization and equal-height responsive grids. |
| `src/features/shipments/history-model.ts` | Accept Audit in detail URLs. |
| `src/features/shipments/history-model.test.ts` | Verify Audit parsing. |
| `e2e/shipment-detail.spec.ts` | Move audit assertions to the new tab; verify equal heights, direct links, mobile layout and preserved assignment drafts. Only layout-related hunks belong to this commit; the business-field editing test belongs to SHIP-V1-001. |
| `e2e/shipment-history.spec.ts` | Navigate three tabs with the keyboard; retain confirmed note-discard checks. |
| `docs/v1/ui-spec.md` | Record the approved layout. |
| `docs/v1/implementation-summary/SHIP-V1-002-implementation-summary.md` | This handoff. |

## Verification

- `node_modules/.bin/tsc --noEmit` — passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.e2e.json` — passed.
- `node_modules/.bin/vite build` — passed (existing large-chunk advisory).
- Scoped `node_modules/.bin/biome check` — passed.
- `node_modules/.bin/vitest run src/features/shipments/history-model.test.ts` — 3 passed.
- `node_modules/.bin/playwright test e2e/shipment-detail.spec.ts e2e/shipment-history.spec.ts --workers=2`
  — 36 passed across desktop and mobile. Initial History failures identified the
  new keyboard tab count and confirmed-note-discard regression; both were fixed
  and the complete affected suites rerun.
- Desktop Overview and Audit screenshots visually inspected. Browser assertions
  check card height differences below 2px, page overflow, Audit reload and draft
  preservation.
- `git diff --check` — passed; final diff reviewed.
- Local frontend http://localhost:5173 returned HTTP 200 and isolated API
  http://localhost:3000/api/v1/health/live returned `{"status":"ok"}`. Both remain running.

Full frontend acceptance and backend tests were not rerun for this presentation
change; no backend behavior changed.

## Review Notes

Prior SHIP-V1-001 changes remain uncommitted and separate from this layout work.
The pre-existing `e2e-backend/tracking-review.spec.ts` edit remains untouched.
Use partial staging for the shared shipment-detail browser test when committing.
No production migration, deployment, push or commit was performed.

## Remaining Issues

None within the requested UI scope. Commit approval is pending.

## Suggested Review Order

Detail page → URL model → desktop/mobile and History regression tests → UI spec.

Proposed separate frontend commit, after the two pending SHIP-V1-001 commits:
`feat(shipments): SHIP-V1-002 organize detail audit tab and equalize cards`
