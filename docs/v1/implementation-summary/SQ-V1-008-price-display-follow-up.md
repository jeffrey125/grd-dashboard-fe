# SQ-V1-008 staff comparison view follow-up

## Summary

Implemented the approved staff-friendly comparison view, two-decimal prices and
left-aligned pagination (the latest direction supersedes the earlier centering request).
The changes are verified; the user approved the commit on 2026-10-20.

## Changes Made

- Show provider/service, price, estimated transit and validity together. Desktop uses
  a compact table; narrow screens stack each row into a labeled two-column card.
- Present one test-data banner; mark each simulated price so mixed live/test results
  remain distinguishable. Preserve existing equivalence warnings and exact ranking.
- Keep latest failures and retry controls visible. Collapse price breakdowns,
  shipment details and processing history until opened. Preserve all original
  attempts, origins, timestamps, options, charges and package data.
- Add a concise destination/ship-date/box-count summary, responsive actions and plain
  language for waiting, failed, current and stale states.
- Reuse approved MUI Table/Accordion/Stack, React and decimal.js. Render amounts
  through QuoteDecimal.toFixed(2) with half-up rounding; API strings, editable input
  precision and ranking arithmetic retain full precision. No dependencies added.

## Files Changed

- `src/features/shipping-quotes/quote-progress.tsx`: responsive price summary,
  single simulation notice, current provider messages, expandable breakdown/history,
  two-decimal results and charges.
- `src/features/shipping-quotes/pages/quote-detail-page.tsx`: concise shipment
  summary, expandable full details, responsive actions and two-decimal saved values.
- `src/features/shipping-quotes/pages/quotes-page.tsx`: left-aligned, vertically
  centered pagination controls.
- `src/features/shipping-quotes/quote-progress.test.tsx`: disclosure interactions,
  retry gating, simulation notice, stale-price eligibility and mixed live/test safety.
- `e2e-backend/quotes.spec.ts`: match the disclosure/price view and use existing
  state dropdowns rather than stale text-input interactions.
- `e2e-backend/quote-history.spec.ts`: expand processing history and scope current
  errors to alerts while retaining retry, deletion/restoration and snapshot checks.
- This summary: approved scope, verification, boundaries and commit proposal.

## Verification

- `pnpm check && pnpm build`: passed, 34 files / 210 tests. Includes formatting,
  lint, typecheck, Knip, unit/component tests and production build.
- `pnpm exec vitest run src/features/shipping-quotes/quote-progress.test.tsx src/features/shipping-quotes/quote-ranking.test.ts`: 17 passed.
- `FE_TEST_API_PORT=3015 FE_TEST_QUOTE_DEMO=true pnpm exec playwright test --config /tmp/sq008-staff-ui.config.mjs`:
  3 passed in 18.1 seconds. Temporary config reuses the running local fixture API
  and Vite server; tests save/reopen/copy, blank dimensions, partial results and reload.
- `node /tmp/sq008-staff-browser.mjs`: passed. Checks both-success seeded results,
  one test banner, collapsed disclosures and expansion, mobile/desktop dark/light,
  absence of page overflow, and left-aligned pagination. Screenshots inspected at
  `/tmp/sq008-staff-desktop.png`, `/tmp/sq008-staff-mobile.png`,
  `/tmp/sq008-staff-mobile-light.png` and `/tmp/sq008-staff-expanded.png`.
- `git diff --check`: passed. The only pre-existing edits were this task's uncommitted
  price-formatting changes; they are included in this combined final view.
- The opt-in retry/delete/restore browser suite was updated but not rerun: the
  currently running fixture worker intentionally uses validation failures rather
  than the retry-mode fixture. Retry eligibility and chronology pass component tests.
- No backend code or migration changed. No live provider or deployment check ran.

## Review Notes

Stored prices retain full precision; display rounding can make distinct values look
equal. Existing ranking decides badges before rendering and excludes stale/expired
quotes, incompatible currencies/origins/options and mixed live/simulated prices.
The test banner does not claim all prices are synthetic when live and test results
are mixed. Previously failed attempts remain accessible in Processing history.

Existing router circular-dependency and large-bundle warnings are non-failing.
Initial browser failures exposed old state-input assumptions and ambiguous selectors
for collapsed history; updated assertions passed the final browser run.

The approved commit contains every file above:
`feat(shipping-quotes): SQ-V1-008 simplify staff comparison view`.
The user explicitly approved staging and committing this scope.

## Remaining Issues

None within the requested UI scope. The full retry/delete/restore browser suite
has the verification limitation stated above.

## Suggested Review Order

QuoteProgress summary and disclosures, QuoteDetailPage shipment/actions,
pagination alignment, component/browser assertions, verification evidence.
