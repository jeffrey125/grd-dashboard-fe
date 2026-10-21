# SQ-V1-011 Amazon SP-API sandbox frontend implementation

## Summary

The quote and provider-administration UI now treats Amazon as a sandbox API
provider. It removes the browser challenge workflow, visibly labels Amazon test
rates, and prevents simulated results from receiving the Lowest price badge.

## Changes Made

- Added `api` to provider execution-mode contracts and fixed Amazon settings to
  that mode; myUnishippers retains `request` and `browser`.
- Added the Amazon sandbox warning to quote results and provider settings.
- Excluded all simulated quotes from Lowest price ranking.
- Removed the Amazon verification dialog, API client, challenge controls, and
  Playwright coverage.
- Preserved a readable historical `verification_required` explanation and normal
  retry action for older attempts.
- Hid Amazon sender-default refresh while retaining it for myUnishippers.
- Added client-side Amazon name/contact/address-line and physical-package limits
  aligned with backend discovery and submission validation.
- Passed the three Amazon sandbox credentials through the LAN worker and copied
  them with the mode-600 LAN environment generator.
- Updated frontend API and UI documentation.

## Files Changed

- `src/features/shipping-quotes/quote-progress.tsx` and ranking files — show the
  warning, simplify retry, and suppress simulated winners.
- `src/features/shipping-quotes/pages/provider-settings-page.tsx` — expose Amazon
  API mode and hide the retired default-refresh path.
- `src/features/shipping-quotes/api.ts`, schemas, and quote detail — remove the
  verification client/state and accept the API execution mode.
- Deleted the Amazon verification dialog and its unit/E2E tests.
- Updated provider settings, progress, form, ranking, and schema tests.
- `docker-compose.lan.yml`, `scripts/prepare-lan-env.ts`, and container tests —
  provision the sandbox credentials for the single LAN worker.
- `docs/v1/api-contracts.md`, `docs/v1/ui-spec.md` — document sandbox behavior and
  current backend contracts.

## Verification

- `pnpm check` — passed: format, lint, typecheck, Knip, and 34 unit-test files with
  227 tests.
- `pnpm build` — passed; Vite emitted the existing large-chunk advisory.
- `pnpm test:e2e` — passed: 132 Chromium desktop/mobile tests.
- LAN HTTPS container lifecycle — passed: 4 tests; HTTP override — passed: 3
  tests. Both include the 16-migration database state.
- LAN environment smoke — generated a mode-600 file containing all three
  nonempty sandbox keys without exposing their values.
- LAN release `20261022-03` — API, frontend, database, and the single worker are
  healthy; migration count is 16; the live Amazon Admin card shows the sandbox
  warning, API mode, and a passed readiness check.
- `git diff --check` — passed.

## Review Notes

- The warning text is intentionally explicit: Amazon sandbox mode is test data,
  not live commercial pricing.
- Ranking suppresses Lowest price whenever any candidate is simulated, which also
  keeps demo-mode comparisons conservative.
- Historical attempts may still carry `request`, `browser`, and
  `verification_required`; schemas and copy retain read compatibility without
  restoring the retired interaction.

## Remaining Issues

- The UI must remain in sandbox presentation until a separate production Amazon
  rollout changes the backend contract and receives corresponding review.

## Suggested Review Order

1. `src/features/shipping-quotes/quote-progress.tsx` and `quote-ranking.ts`
2. `src/features/shipping-quotes/pages/provider-settings-page.tsx`
3. API/schema removals and their tests
4. Deleted verification UI/E2E files
5. Frontend contract and UI documentation
