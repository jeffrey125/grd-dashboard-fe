# MON-V1-005: delivered shipments and Monitor again

## Summary

Delivered shipments stay completed regardless of follow-up dates. Monitor again
remains in desktop row actions, mobile cards and details and requests one check.
Implementation is in an isolated worktree checked out on main at `03d4098`.

## Changes Made

- Replace the future-date restart form with Check once confirmation using the
  existing refresh command, safe feedback, pending locks and cache invalidation.
- Preserve follow-up dates and show requested-run progress on detail Audit.
- Block pause/resume for known deliveries and explain the one-time alternative.
  Disabled carriers cannot submit Monitor again; Other remains manual.
- Reuse installed MUI and TanStack Query, with 320 ms dialog motion and zero
  transition duration when reduced motion is requested. No new dependencies.
- Update Help details/audit explanations and add a Staff-visible one-check guide,
  a fictional screenshot and three numbered markers. Admin visibility is preserved.

## Files Changed

| File | Purpose |
| --- | --- |
| `src/features/shipments/monitor-again-dialog.tsx` | One-time confirmation, pending lock, progress callback and reduced motion. |
| `src/features/shipments/actions.ts` | Make delivery independent of dates in pause/resume/refresh guidance. |
| `src/features/shipments/actions.test.ts` | Verify the changed action policy. |
| `src/features/shipments/shipment-grid.tsx` | Preserve desktop/mobile Monitor again and honor disabled carriers. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Preserve Monitor again, show requested-run progress and update completion copy. |
| `src/features/help/content.ts` | Update current policy and add the one-check guide. |
| `src/features/help/captures.json` | Position three markers for the new illustration. |
| `public/help/screenshots/monitor-again.png` | Fictional illustration of the final confirmation. |
| `e2e/help-capture.spec.ts` | Add opt-in targeted capture for the new illustration. |
| `e2e/help.spec.ts` | Verify guide loading and numbered markers across desktop/mobile. |
| `e2e/shipment-detail.spec.ts` | Verify one POST, preserved dates/status, dismissal/focus, pending UI, progress and motion. |
| `e2e/shipments.spec.ts` | Align delivered-row guidance assertions. |
| `e2e-backend/delivered-follow-up.spec.ts` | Real API desktop/mobile queueing, coalescing and delivery retention. |
| `e2e-backend/shipment-detail.spec.ts` | Expect accepted one-off requests for completed deliveries. |
| This summary | Review and verification evidence. |

## Verification

- `pnpm check`: passed format, lint, typechecks, Knip and 267 tests in 39 files.
  A later lint warning in the screenshot fixture was removed; `pnpm exec biome check --formatter-enabled=false .` then passed with no warnings.
- `pnpm build` and `VITE_API_ORIGIN=http://localhost:3018 pnpm build`: passed.
  Existing large-bundle and router circular-module warnings remain non-fatal.
- `pnpm exec playwright test e2e/shipment-detail.spec.ts e2e/shipments.spec.ts e2e/help.spec.ts --workers 2`:
  66 passed; four new cases initially referenced the wrong requested-run label.
  After correcting the test label, `pnpm exec playwright test e2e/shipment-detail.spec.ts --grep 'Monitor again checks once' --workers 2`: all four passed, including explicit 320 ms/zero duration assertions.
- `UPDATE_HELP_SCREENSHOTS=true HELP_CAPTURE_MONITOR_ONLY=true pnpm exec playwright test e2e/help-capture.spec.ts --project chromium --workers 1`: passed.
  Illustration visually inspected. `pnpm exec playwright test e2e/help.spec.ts --workers 2`: six passed; two marker assertions initially also selected a decorative SVG.
  After narrowing the marker selector, `pnpm exec playwright test e2e/help.spec.ts --grep 'admins can read' --workers 2`: both passed, verifying all images and markers. Staff visibility remains covered by the six passed cases.
- `FE_TEST_API_PORT=3018 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/delivered-follow-up.spec.ts e2e-backend/shipment-detail.spec.ts`:
  three passed; desktop row test initially needed to scroll to the existing virtualized action column.
  After adding grid scrolling, `FE_TEST_API_PORT=3018 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/delivered-follow-up.spec.ts --grep desktop`: passed. All four scenarios verified against real API/disposable PostgreSQL; no tracking worker or external carrier calls.
- `git diff --check`: passed. Original feature checkout's unrelated modifications
  remain there; only this task's eight-file initial patch was transferred.
- Full browser/real-backend acceptance, coverage, container/CI and production
  deployment suites were not run. There are no packaging/dependency changes.
- Manual servers remain reachable: frontend `http://localhost:5178`, API
  `http://localhost:3019/api/v1/health/ready`, Vite health proxy all HTTP 200.
  Disposable fixture login: `frontend-staff@example.test` / `staff fixture password`.
  Select Team and Delivered for existing fixture shipments. Tracking worker is off;
  one-time requests remain queued in this manual preview. No production data.

## Review Notes

Deploy the new API/worker before this frontend: older APIs reject completed-delivery
refreshes. Follow-up dates still drive Attention. A recognized carrier correction
back to undelivered resumes normal monitoring; failed/unknown/missing observations
preserve delivery. Existing shared refresh handling keeps feedback and query
invalidation consistent. The dialog removes only the restart date form, preserving
Monitor again in all three entry points.

## Remaining Issues

Not committed or deployed. Manual preview uses disposable data and no carrier
worker; carrier execution is covered by backend fixture integration tests.

## Suggested Review Order

1. Monitor again dialog, action policy and detail/row controls.
2. Isolated browser and real API regressions.
3. Help content, illustration/markers and capture test.

One frontend commit containing the files above:
`fix(shipments): MON-V1-005 keep deliveries completed with check-once action`.
Explicit final approval is required before staging or committing.
