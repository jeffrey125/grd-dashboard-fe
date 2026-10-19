# SQ-V1-005 frontend implementation summary

## Summary

Added provider-mode-aware package dimension input for myUnishippers request quotes.
Users may leave all three dimensions blank only when that request mode is the sole
selected provider; weight remains required.

## Changes Made

- Provider discovery now validates `executionMode` from the backend response.
- Zod and React Hook Form accept all-or-none dimensions, then require dimensions for
  Amazon, mixed-provider comparisons, and myUnishippers browser mode.
- The form explains the request-mode exception and saved comparisons display
  `Dimensions not provided` instead of empty multiplication symbols.
- Rejected submissions show the all-three-or-none rule, sole-provider request-mode
  exception, and always-required weight in the validation banner.

## Files Changed

- `src/features/shipping-quotes/schemas.ts`: provider mode and dimension contracts.
- `src/features/shipping-quotes/quote-form.tsx`: dynamic validation and guidance.
- `src/features/shipping-quotes/quote-form.test.tsx`: allowed and rejected cases.
- `src/features/shipping-quotes/pages/quote-detail-page.tsx`: blank-dimension display.
- `docs/v1/api-contracts.md`: aligned public API and input rules.

## Verification

- `pnpm test -- src/features/shipping-quotes/quote-form.test.tsx`: 32 files / 193 tests passed.
- `pnpm typecheck`: passed application, tooling, and browser TypeScript checks.
- `pnpm check`: passed formatting, lint, typechecks, Knip, and 193 tests in 32 files.
- `pnpm build`: passed; the existing large-chunk warning remains.
- Real-backend Chromium quote suite: 3 passed, including the six-box, 51 lb,
  blank-dimension save/reopen path.

## Review Notes

The immutable comparison schema accepts historical blank dimensions independently
of current provider configuration. The form schema applies the current execution mode,
and the backend remains authoritative if configuration changes during submission.

## Remaining Issues

The final hardened myUnishippers browser adapter remains fixture-verified but not
live-reverified because the provider sign-in flow stalled before form entry. The
new request-mode blank-dimension behavior is live-verified.

## Suggested Review Order

1. `schemas.ts` and `quote-form.test.tsx`.
2. `quote-form.tsx` and `quote-detail-page.tsx`.
3. `docs/v1/api-contracts.md`.
