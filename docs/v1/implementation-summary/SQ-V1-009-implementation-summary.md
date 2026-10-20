# SQ-V1-009 implementation summary

## Summary

Updated the quote comparison UI for the guarded myUnishippers Quick Quote flow,
added dark-theme brand assets, and made shipment monitoring highlights actionable.
New quote comparisons require an explicit sender and complete dimensions. Shipment
rows now open their detail page and acknowledge the exact update the user saw.

## Changes Made

- Removed Account Default sender from new and copied comparisons. Historical
  account-default snapshots are converted to explicit editable sender data.
- Aligned myUnishippers validation and guidance with Quick Quote: domestic US,
  today's America/New_York date, complete dimensions, no signature/insurance,
  calculated quantity totals for each distinct package group.
- Added dark-theme logo and favicon variants and updates when the selected theme changes.
- Reordered shipment tabs to Active, Needs attention, Delivered, All Shipments.
  Unseen attention rows are red; other unseen updates are green. Desktop rows and
  mobile cards open details and acknowledge the displayed revision on ordinary clicks.
- Updated the isolated full-stack readiness fixture: domestic Amazon and
  myUnishippers totals are calculated; international/options fail closed.

## Files Changed

| Area | Files and purpose |
| --- | --- |
| Quote comparison | `new-quote-page.tsx`, `quote-form.tsx`, `schemas.ts`, their tests, `quote-readiness.spec.ts`, and `quote-readiness-fixture.mjs` implement and verify explicit Quick Quote inputs and calculated totals. |
| Shipment monitoring | `shipment-grid.tsx`, `search-state.ts`, `search-state.test.ts`, and `tracking-review.spec.ts` implement tab order, highlight state, clickable navigation, and acknowledgement. |
| Branding | `brand-logo.tsx`, `theme-provider.tsx`, `index.html`, `public/brand/grd-logo-dark.svg`, and `public/favicon-dark.svg` provide theme-specific assets. |
| Documentation | `api-contracts.md`, `branding.md`, `ui-spec.md`, and this summary describe the delivered behavior. |

## Verification

- `pnpm check`: passed formatting, lint, Knip, typecheck, and 213 tests in 34 files.
- `pnpm build`: passed; emitted the existing chunk-size advisory only.
- `FE_TEST_QUOTE_READINESS=true pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/quote-readiness.spec.ts`: 2 passed.
- Focused `tracking-review.spec.ts` desktop and mobile runs: 2 passed; both update
  colors appeared and cleared after detail navigation.
- Focused quote form and shipment search-state tests passed before the final full check.
- Final diff and status were reviewed; no frontend changes outside the requested scope were found.

## Review Notes

No production dependency was added. The implementation uses the installed Playwright,
Decimal.js, MUI, TanStack Router/Query, theme APIs, and native browser favicon support.
Modified clicks retain native browser behavior and do not acknowledge because the
current tab may never display the detail page. A normal row/reference click acknowledges
only the displayed revision before navigation, preserving newer unseen revisions.

The readiness fixture substitutes only provider I/O. Its domestic myUnishippers result
now mirrors calculated multi-group Quick Quote semantics; it no longer claims live
international or native whole-shipment support.

## Remaining Issues

- Amazon live quoting and the separately named myUnishippers request mode were not
  rerun against live providers in this follow-up.
- Current changes are not committed or deployed.

## Suggested Review Order

1. Quote form/schema and readiness browser scenario.
2. Shipment grid navigation, acknowledgement, and tab-order model.
3. Theme logo/favicon switching and brand assets.
4. API, UI, and branding documentation.

## Proposed commits — final approval required

1. `feat(shipping-quotes): SQ-V1-009 require explicit Quick Quote inputs`
   - Quote form/schema, readiness fixture/test, API contract, and this summary.
   - Requires explicit sender/dimensions and displays calculated Quick Quote totals.
2. `feat(shipments): FE-V1-011 acknowledge highlighted rows on navigation`
   - Shipment grid/search state, tracking review browser test, and UI specification.
   - Adds red/green unseen highlights, row navigation, acknowledgement, and tab order.
3. `feat(theme): FE-V1-003 add dark brand assets`
   - Theme provider, brand logo, HTML favicon setup, SVG assets, and branding docs.
   - Selects the matching logo and favicon for light or dark mode.

Nothing is staged or committed. Deployment remains a separate authorized step after
the commits are approved and created.
