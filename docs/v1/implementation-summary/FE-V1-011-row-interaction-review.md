# FE-V1-011: Review tracking updates from any row interaction

## Summary

Clicking or tapping any desktop shipment row or mobile card acknowledges its displayed tracking revision. Approved by the user on 2026-10-24.

## Changes Made

Reuse the approved installed React/MUI capture-phase click handling and existing ReviewController acknowledgement. Capture covers nested action controls without changing navigation or button actions. Placeholder results do not acknowledge updates; authoritative revision checks retain newer concurrent changes. No dependencies added.

## Files Changed

- `src/features/shipments/shipment-grid.tsx`: shared acknowledgement callback, desktop row and mobile card capture handlers.
- `e2e/tracking-review.spec.ts`: check cell/card clicks, nested controls, unchanged list navigation and detail navigation. Await displayed revision before interacting.
- `docs/v1/ui-spec.md`: document row/card acknowledgement.
- This summary: completion evidence.

## Verification

- `pnpm build`: passed, including typecheck. Existing circular-module and bundle-size warnings remain.
- `pnpm test -- src/features/tracking-updates/review.test.ts`: passed; this script invocation ran all 36 files / 238 unit/component tests.
- `pnpm exec playwright test e2e/tracking-review.spec.ts`: final run passed all 22 desktop/mobile-layout browser checks. Initial run passed 21/22; the new desktop control test clicked before revision 4 was displayed. Added an explicit displayed-revision wait; no application change was needed.
- `pnpm exec biome check --formatter-enabled=false src/features/shipments/shipment-grid.tsx e2e/tracking-review.spec.ts`: passed.
- `pnpm exec biome format src/features/shipments/shipment-grid.tsx e2e/tracking-review.spec.ts`: passed.
- `pnpm typecheck`: passed again after final browser-test edit.
- Final diff reviewed. Frontend worktree was clean before this change. Backend untracked proposal/guide documents remain unrelated and untouched.
- Full acceptance, container and real-backend suites not run for this frontend interaction change. Browser checks use API fixtures; no physical touchscreen verification.

## Review Notes

Acknowledgement still requires a matching current revision from the API; failed reads and newer updates retain the highlight. Tracking links also await acknowledgement before navigation. Ordinary row interactions never open detail. React capture handlers preserve existing child event behavior.

## Remaining Issues

Not committed or deployed. No application implementation blockers.

## Suggested Review Order

Grid interaction handlers, browser assertions, UI specification, this evidence.

## Proposed commit

Single commit containing the four files above:
`fix(shipments): FE-V1-011 clear update highlights on row interaction`

Staging and commit require explicit final approval.
