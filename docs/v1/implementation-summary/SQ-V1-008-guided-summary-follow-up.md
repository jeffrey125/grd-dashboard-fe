# SQ-V1-008 Guided summary follow-up

## Summary

Implemented the user's selected “Guided summary” design for saved quote comparisons.
This replaces the compact price table with readable cards using the existing approved
React/MUI, decimal.js and Day.js dependencies. No package was added.

## Changes Made

- Current prices appear first. The existing ranking module still determines exact
  price order within each freshness group, comparability warnings and Lowest price
  eligibility; the view does not invent a recommendation for incomparable results.
- Price cards show large two-decimal amounts, explicit currency, original estimate
  scope, provider/service/carrier, estimated transit and per-result Test price labels.
- Stale, expired and unknown-validity results remain visible with actionable wording.
  Freshness continues to update while the screen is open.
- Each card contains its original full breakdown in a collapsed MUI accordion.
  Shipment details, updated-price help and technical processing history follow the cards.
- The header names the receiver and summarizes boxes, destination, shipping date and
  saved time. Day.js formats the date-only ship date without timezone conversion.
- Existing retry, copy, delete/restore, errors, immutable history, API/SSE and left-aligned
  history pagination remain in place. No backend changes or provider requests were made.

## Files Changed

- `src/features/shipping-quotes/quote-progress.tsx`: cards, freshness grouping,
  inline breakdowns, detail slot and technical disclosure.
- `src/features/shipping-quotes/pages/quote-detail-page.tsx`: readable shipment
  summary, full shipment disclosure and updated-price help.
- `src/features/shipping-quotes/quote-progress.test.tsx`: accessible card/disclosure
  assertions, current-first order, mixed-rate safeguard and expiry transition coverage.
- `e2e-backend/quotes.spec.ts`: updated shipment disclosure label.
- `e2e-backend/quote-history.spec.ts`: updated technical disclosure label.
- This summary: scope, verification and review record.

## Verification

- `pnpm check && pnpm build`: passed; format, lint, types, Knip,
  34 test files / 210 tests and production build.
- `FE_TEST_API_PORT=3015 FE_TEST_QUOTE_DEMO=true pnpm exec playwright test --config /tmp/sq008-staff-ui.config.mjs`:
  passed 3 real-API browser tests in 19.4 seconds, reusing the existing disposable fixture API.
- `node /tmp/sq008-guided-browser.mjs`: passed current-first display, one test notice,
  collapsed/expanded details, desktop 1440px and mobile 390px, dark/light themes,
  mobile horizontal-overflow check and left pagination. Screenshots inspected.
- `git diff --check`: passed. Final frontend diff reviewed against the clean starting tree.
- Existing non-failing Router CLI circular-dependency and >500kB bundle warnings remain.
- Full opt-in retry/delete/restore browser suite was not rerun: the shared running
  fixture uses validation-failure outcomes, not the retry scenario. Its selectors
  were updated; retry gating/chronology remain covered by component tests.
- No live-provider or backend/container tests: this change is frontend presentation only.

## Review Notes

Current means the quote's freshness policy, not a booking guarantee or a recommendation.
Simulated/live distinctions and comparability warnings remain visible. USD uses a dollar
symbol plus its currency code; other currencies retain their code. Rounding is display-only.
All attempts, historical modes, origins and timestamps remain available under Technical details.
The existing app shell and theme are retained; the preview's fabricated dates/prices are not
copied into production source. The separate backend-workspace design preview is excluded.

## Remaining Issues

No implementation blocker. The user approved the commit on 2026-10-20. The full retry browser scenario
and real-provider verification were not run for this presentation change.

## Suggested Review Order

Quote progress → detail page → component/browser tests → this summary.

Approved single commit:
`feat(shipping-quotes): SQ-V1-008 add guided staff comparison view`
