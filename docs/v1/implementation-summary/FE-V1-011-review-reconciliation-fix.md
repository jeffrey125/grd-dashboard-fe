# FE-V1-011: review acknowledgement during reconciliation

## Summary

Clicking a displayed tracking revision now clears its highlight even when background
reconciliation finishes during the acknowledgement verification request.

## Changes Made

`ReviewStore.acknowledge` accepts a changed state token only when the current record
has the exact verified snapshot and no pending events. A newer resolved revision or
an unresolved event still prevents an old click from clearing its highlight. The
check runs inside the existing serialized, browser-lock-protected store mutation.
No new dependency or timeout workaround was added.

## Files Changed

- `src/features/tracking-updates/review-store.ts`: preserve valid same-revision acknowledgement.
- `src/features/tracking-updates/review.test.ts`: deterministic reconciliation race and newer-revision protection regressions.
- This summary: root cause, verification and release boundary.

## Verification

- New same-revision unit regression failed before the fix, then passed afterward.
- `pnpm exec vitest run src/features/tracking-updates/review.test.ts`: 17 passed.
- `pnpm exec biome check src/features/tracking-updates/review-store.ts src/features/tracking-updates/review.test.ts`: passed.
- `CI=true pnpm exec playwright test e2e/tracking-review.spec.ts --project chromium --grep 'clicking anywhere' --repeat-each 30`: before fix, 1 failed / 29 passed; after fix, 30 passed.
- `CI=true VITE_API_ORIGIN=http://localhost:3000 pnpm run ci`: passed format, lint, Knip, 251 unit/component tests, build/typechecks and 144 browser tests.
- `git diff --check`: passed.
- Real-backend and container suites were not rerun: no API, database, container or deployment-spec behavior changed in this fix.

## Review Notes

A click captures a review-state token, verifies the displayed snapshot using HTTP,
and then applies the acknowledgement. Background resolution of that same snapshot
can replace the token while the HTTP request is pending. The old token-only guard
incorrectly discarded the click. The new exception is restricted to an already
resolved matching snapshot; concurrent pending/newer updates remain protected.

## Remaining Issues

Commit/push approval and remote frontend deployment are pending. The existing
unrelated `e2e-backend/tracking-review.spec.ts` modification is preserved and excluded.
No public frontend deployment or authenticated production browser acceptance is
claimed by these local fixture tests.

## Suggested Review Order

Regression tests, store guard, this verification summary.
