# SQ-V1-012 frontend handoff

## Summary

Added admin-configurable per-box limits and comparison eligibility messages.

## Changes Made

Admin editing with above-default warnings; per-provider limits beside selection;
box-specific overweight warnings; no-eligible-provider submission blocking;
historical skip and retry explanations. Uses installed Zod, Decimal.js, React Hook
Form and MUI; receives Math.js-converted limits from the backend.

## Files Changed

| File | Purpose |
| --- | --- |
| `src/features/shipping-quotes/provider-weight-policy.ts` | Decimal comparisons using API-converted limits and recorded failure messages. |
| `src/features/shipping-quotes/provider-admin-schemas.ts` | Read limits and validate editable positive decimal values. |
| `src/features/shipping-quotes/pages/provider-settings-page.tsx` | Admin input, default display and above-published-limit warning; preserve existing Amazon changes. |
| `src/features/shipping-quotes/pages/provider-settings-page.test.tsx` | Weight-only save and zero rejection tests; preserve existing Amazon tests. |
| `src/features/shipping-quotes/schemas.ts` | Read additive API fields and reject all-overweight submissions. |
| `src/features/shipping-quotes/quote-form.tsx` | Visible provider limits, group warnings and disabled submission. |
| `src/features/shipping-quotes/quote-form.test.tsx` | Partial eligibility, correction and kg UI coverage. |
| `src/features/shipping-quotes/quote-progress.tsx` | Explain recorded skip and retry limitations. |
| `e2e-backend/provider-weight-limits.spec.ts` | Real API persistence, bypass rejection, partial exclusion and desktop/mobile checks. |
| `docs/v1/implementation-summary/SQ-V1-012-implementation-summary.md` | Frontend review manifest and link to full verification. |

## Verification

`pnpm lint && pnpm knip && pnpm test`: passed, 243 tests.
`pnpm format:check && pnpm typecheck`: passed.
`VITE_API_ORIGIN=http://localhost:3027 pnpm build`: passed.
`FE_TEST_API_PORT=3027 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/provider-weight-limits.spec.ts`: one passed against real disposable PostgreSQL/API, including desktop/mobile layout checks.
Full browser acceptance, container checks and live provider calls were not run.

## Review Notes

Preserved the pre-existing Amazon-specific edits in both provider-settings page
files and unrelated tracking-review edits. Only SQ-V1-012 hunks belong to this task.
See the [complete backend/full-stack handoff](../../../../grd-dashboard-be/docs/v1/implementation-summary/SQ-V1-012-implementation-summary.md)
for API/schema details, complete test evidence and local fixture credentials.

## Remaining Issues

No known feature defects in the checked scope; not deployed. Migration must precede
new backend runtime. Local frontend http://localhost:5173/ and isolated API
http://localhost:3028/api/v1/health/live are left running; fixture worker is disabled.

## Suggested Review Order

Policy/schema → admin/form/results → tests.
Proposed commit (not staged or committed):
`feat(shipping-quotes): SQ-V1-012 expose provider weight limits in comparisons`.
