# MON-V1-004 — Manual Other carrier UI

## Summary

Implemented the approved manual Other carrier workflow. Choosing Other in Add
shipment reveals manual fields; Staff edit those fields on the detail page.
Admins enable/disable new entries through the existing carrier settings page.

## Changes Made

- Conditional Add shipment status/pickup/delivery fields; normal reference, notes,
  Sales Rep and follow-up controls remain. Manual input is omitted for other carriers.
- Detail Save changes updates status, dates, assignment and follow-up together,
  invalidates history/list/overview, and permits retaining an unchanged overdue reminder.
- Other tab and homepage count/link; manual shipments remain in All and due records
  also appear in Needs attention. Active/Delivered exclude Other server-side.
- Manual records hide Refresh, pause/resume, Monitor again and lookup/run panels.
  Disabled Other remains editable; Admin sees only Active for its configuration.
- No new dependencies. Uses approved installed MUI, React Hook Form, Zod, TanStack
  Query and existing date utilities. API/persistence is implemented in the sibling backend.

## Files Changed

Paths relative to `grd-dashboard-fe`; only Other-specific hunks belong to this scope.

| File | Reason |
| --- | --- |
| `src/features/shipments/manual-tracking.ts` | Shared status/date schema and draft conversion. |
| `src/features/shipments/create-schema.ts` | Optional validated manual input. |
| `src/features/shipments/create-form.tsx` | Conditional manual controls, carrier-specific payload and explicit reset of manual fields. |
| `src/features/shipments/assignment-section.tsx` | Manual detail form, history invalidation, unchanged overdue reminders. |
| `src/features/shipments/assignment-section.test.tsx` | Status-only edit enables Save changes. |
| `src/features/shipments/api.ts` | Manual update contract; preserve earlier filter-options changes separately. |
| `src/features/shipments/search-state.ts` | Other URL/tab. |
| `src/features/shipments/search-state.test.ts` | Other in expected tab navigation. |
| `src/features/shipments/schemas.ts` | Parse additive Other count. |
| `src/features/shipments/actions.ts` | No automated actions for manual records. |
| `src/features/shipments/detail-model.ts` | Manual monitoring label. |
| `src/features/shipments/shipment-grid.tsx` | Hide automated row/card actions for Other. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Manual monitoring, disabled edit explanation and audit labels. |
| `src/features/shipments/pages/shipments-page.tsx` | Switch to Other after add and explain tab semantics. |
| `src/features/overview/api.ts` | Parse Other count. |
| `src/features/overview/pages/overview-page.tsx` | Fifth overview link/count; explain overlapping views. |
| `src/test/overview-fixture.ts` | Add Other fixture count. |
| `src/features/carriers/schemas.ts` | Permit Other settings form. |
| `src/features/carriers/carrier-editor.tsx` | Show only Active for Other. |
| `src/features/carriers/pages/carrier-detail-page.tsx` | Editable Other settings; hide polling/session fields. |
| `src/features/carriers/pages/carriers-page.tsx` | Manual/Not applicable labels for automated settings. |
| `e2e-backend/manual-other.spec.ts` | Retained real-API desktop/mobile staff/admin acceptance. |
| `docs/v1/api-contracts.md` | Manual API contract. |
| `docs/v1/implementation-summary/MON-V1-004-implementation-summary.md` | Review and verification evidence. |

## Verification

- `pnpm check`: passed formatting, lint, TypeScript, Knip and all 263 tests.
- `pnpm build`: passed, with existing non-blocking bundle-size warning.
- `pnpm exec playwright test e2e/shipments.spec.ts e2e/create-shipments.spec.ts e2e/shipment-detail.spec.ts e2e/shipment-history.spec.ts e2e/carriers.spec.ts e2e/overview.spec.ts --workers=3`:
  all 86 desktop/mobile tests passed.
- `pnpm exec playwright test --config /tmp/other-live.config.cjs --repeat-each=2`:
  all 4 real-API/PostgreSQL cases passed. Temporary config reuses fixture servers;
  retained source is `e2e-backend/manual-other.spec.ts`. Covers conditional Add,
  dates/status persistence after reload, Delivered with due attention, absence from
  Delivered tab, hidden automated actions, Admin disable, Staff edit while disabled,
  and no page overflow at 1440px and 375px. Screenshots visually inspected.
  Final run after fixing Add form reset: 2/2 passed, including cleared dates and
  Pending Pickup restored after save. The 86-test regression suite passed again.
- Browser-test synchronization now waits for Manual shipment details before
  selecting status; previously it could select the outgoing Add shipment form.
  No production delay or form-readiness workaround was retained.
- Backend: focused manual/carrier HTTP suite 24 passed; container lifecycle/migration
  suite 6 passed. Final complete backend coverage run: all 719 tests in 95 files
  passed, with 90.91% line coverage; details in the sibling backend handoff.
- Final diff reviewed against pre-Other baseline; no staging or commits.

## Review Notes

Delivery means estimated delivery, matching the existing table. Delivered status
sets an internal actual New York date server-side. Manual status/date edits append
history; reverting status preserves old snapshots. Carrier disable blocks new
entries but never prevents edits or due reminders for existing records.

Count schemas default the additive Other count to zero for existing fixtures;
actual Other functionality requires the backend migration/API. Other and Needs
attention overlap, so counts must not be summed for All.

Keep prior FILTER-V1-001 hunks separate, including shared API, search state,
shipments page and API documentation. Preserve unrelated pre-existing
`e2e-backend/tracking-review.spec.ts`. No new production package or custom
replacement for reusable validation/date/form functionality was introduced.

## Remaining Issues

No frontend feature blockers. Full unrelated frontend acceptance/container suites
were not rerun; relevant unit/build/browser checks passed. Production deployment
and live carrier calls were not requested.

Local fixture servers remain running, tracking worker disabled:

- Frontend: `http://localhost:4176/shipments?tab=other`
- Backend: `http://localhost:3019/api/v1/health/live`
- Staff: `frontend-staff@example.test` / `staff fixture password`.
- Admin: `frontend-admin@example.test` / `admin fixture password`.

## Suggested Review Order

Manual schema → Add/detail forms → tabs/counts and hidden automated actions →
Admin settings → real-API desktop/mobile tests and contract.

Proposed separate commit after FILTER-V1-001:
`feat(shipments): MON-V1-004 add manual Other carrier workflow`.

Scope is exactly the files above and Other-specific hunks in shared files.
Explicit final approval is required before staging or committing.
