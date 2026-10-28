# FILTER-V1-001 — Multiple Sales Rep filtering

## Summary

Implemented the approved searchable multi-rep Shipment filter. The complete
cross-repository file inventory and verification record is in
[the backend handoff](../../../../grd-dashboard-be/docs/v1/implementation-summary/FILTER-V1-001-implementation-summary.md).

## Changes Made

Existing MUI Autocomplete and React Hook Form provide checkbox choices and removable
chips, with Apply filters retained. Active and labeled inactive reps can be combined
with Unassigned. Empty selection means any rep. New plural URL values survive
reload/share; old singular filter links are rejected. Zod validates the comma-separated
UUIDv4/unassigned contract. Assignment remains active-only and singular.

## Files Changed

- `src/features/shipments/filters.tsx`: control, labels, retained drafts and stable UUID keys.
- `src/features/shipments/search-state.ts`: plural URL validation.
- `src/features/shipments/api.ts`: separate filter-options request.
- `src/features/shipments/pages/shipments-page.tsx`: options query and error feedback.
- `src/features/shipments/filters.test.tsx`: drafts, Apply/Clear and unavailable options.
- `src/features/shipments/search-state.test.ts`: new contract, old-key rejection and page reset.
- `e2e/shipments.spec.ts`: desktop/mobile selection, chip removal, reload and clearing.
- `docs/v1/api-contracts.md`: contract and behavior.
- This summary: review evidence and commit scope.

## Verification

- `pnpm check`: passed formatting, lint, typecheck, Knip and 262 tests.
- `pnpm build`: passed, including typecheck after the final UI change; non-blocking
  existing circular-dependency/bundle-size warnings.
- `pnpm exec playwright test e2e/shipments.spec.ts --workers=1`: 24 passed.
- `node /tmp/verify-multi-rep.mjs`: real API/PostgreSQL acceptance passed on desktop
  and mobile, including inactive reps, Unassigned, counts, reload and page width.
- Mobile screenshot inspected; both local servers returned successful responses.
- `git diff --check`: passed. Full browser/backend acceptance suites and container
  checks not run; no hosting or packaging changes.

## Review Notes

No new dependencies or migration. The old singular search parameter is intentionally
unsupported. Backend/frontend releases need coordination. The pre-existing edit to
`e2e-backend/tracking-review.spec.ts` is untouched and excluded from this scope.

## Remaining Issues

No feature blockers. A pre-existing responsive-grid assertion failed in a concurrent
run; all 24 cases passed sequentially without changing that assertion. Production
behavior and full acceptance suites remain unverified. No commit or deployment.

Manual frontend: `http://localhost:4176/shipments?q=multi-rep-demo`.
Backend: `http://localhost:3019/api/v1/health/live`. Both remain running against
an isolated database with tracking worker disabled. Fixture login:
`frontend-admin@example.test` / `admin fixture password`.

## Suggested Review Order

URL schema → control → API/page integration → tests → contract docs.
Proposed frontend commit, containing only the files listed above:
`feat(shipments)!: FILTER-V1-001 add multi-select sales rep filter`.
Explicit final approval is required before staging or committing.
