## Summary

SQ-V1-003 adds live asynchronous comparison progress and results. The full cross-repository file/commit manifest and backend evidence are in the [backend implementation summary](../../../../grd-dashboard-be/docs/v1/implementation-summary/SQ-V1-003-implementation-summary.md).

## Changes Made

Reused TanStack Query, MUI, Zod and credentialed EventSource. Active comparisons refetch after open/resync/change and every 15 seconds. Reads serialize, changes during reads trigger another fetch, and session teardown stops subscriptions. The UI retains partial successes, displays safe failures, and labels simulated rates.

## Files Changed

- `docs/v1/api-contracts.md`
- `e2e-backend/quotes.spec.ts`
- `scripts/auth-backend.mjs`
- `src/features/shipping-quotes/pages/quote-detail-page.tsx`
- `src/features/shipping-quotes/pages/quotes-page.tsx`
- `src/features/shipping-quotes/quote-form.test.tsx`
- `src/features/shipping-quotes/quote-form.tsx`
- `src/features/shipping-quotes/schemas.ts`
- `src/features/shipping-quotes/quote-live.test.ts`
- `src/features/shipping-quotes/quote-live.ts`
- `src/features/shipping-quotes/quote-progress.test.tsx`
- `src/features/shipping-quotes/quote-progress.tsx`
- `src/features/shipping-quotes/use-comparison.ts`
- `docs/v1/implementation-summary/SQ-V1-003-implementation-summary.md`

## Verification

- `pnpm check`: passed formatting, lint, TypeScript, Knip, and 186 tests in 32 files.
- `VITE_API_ORIGIN=http://localhost:3013 pnpm build`: passed.
- `FE_TEST_QUOTE_DEMO=true FE_TEST_API_PORT=3013 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/quotes.spec.ts`: 2 passed against disposable PostgreSQL, the real API, and fixture worker.
- `git diff --check`: passed.
- Standards and Spec reviews: no open material findings.
- Entire frontend browser/container suites and deployment were not run; they are outside this ticket's changed delivery scope.

## Review Notes

Historical saved comparisons remain read-only and unqueued. New saves queue automatically. Events are hints, never state patches. Manual Retry remains SQ-V1-007. The demo harness is opt-in and performs no tracking/provider I/O.

Manual UI: http://localhost:5173/quotes; API: http://localhost:3013/api/v1/health/live. Both returned HTTP 200 and remain running. Fixture login: `frontend-staff@example.test` / `staff fixture password`.

## Remaining Issues

The eight backend baseline failures are resolved. Final backend `pnpm test:cov:all` passed all 563 tests in 65 files with zero failures; combined line coverage is 91.21%. Real provider rate adapters remain later tickets. The user approved the implementation commits; no push, merge, deployment or release tag is included.

Approved frontend commit: `feat(shipping-quotes): SQ-V1-003 render live comparison results`.

## Suggested Review Order

1. API schemas and subscription/refetch behavior.
2. Progress UI and existing page integration.
3. Reconnect/component tests and opt-in real-backend browser harness.
