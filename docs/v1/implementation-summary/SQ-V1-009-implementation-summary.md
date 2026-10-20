# SQ-V1-009 implementation summary

## Summary

Updated the quote comparison UI for the guarded myUnishippers Quick Quote flow,
added dark-theme brand assets, and made shipment monitoring highlights actionable.
New quote comparisons require an explicit sender. myUnishippers-only comparisons may
omit all dimensions; partial dimensions and Amazon-inclusive comparisons still require
all three. Tracking Number links open shipment detail and acknowledge the exact
update the user saw.

## Changes Made

- Removed Account Default sender from new and copied comparisons. Historical
  account-default snapshots are converted to explicit editable sender data.
- Aligned myUnishippers validation and guidance with Quick Quote: domestic US,
  today's America/New_York date, optional all-blank dimensions when it is the only
  provider, no signature/insurance, and calculated quantity totals for each distinct
  package group.
- Added dark-theme logo and favicon variants and updates when the selected theme changes.
- Reordered shipment tabs to Active, Needs attention, Delivered, All Shipments.
  Unseen attention rows are red; other unseen updates are green. Desktop rows and
  mobile cards keep their highlight until the Tracking Number link is opened; that
  link acknowledges the displayed revision before navigation.
- Updated the isolated full-stack readiness fixture: domestic Amazon and
  myUnishippers totals are calculated; international/options fail closed.
- Added a safe Amazon-specific message for provider_setup_required so users know an
  admin must finish pickup/contact onboarding before retrying.

## Files Changed

| Area | Files and purpose |
| --- | --- |
| Quote comparison | `new-quote-page.tsx`, `quote-form.tsx`, `schemas.ts`, `quote-progress.tsx`, their tests, `quote-readiness.spec.ts`, and `quote-readiness-fixture.mjs` implement and verify explicit Quick Quote inputs, calculated totals, and Amazon setup guidance. |
| Shipment monitoring | `shipment-grid.tsx`, `search-state.ts`, `search-state.test.ts`, and `tracking-review.spec.ts` implement tab order, highlight state, clickable navigation, and acknowledgement. |
| Branding | `brand-logo.tsx`, `theme-provider.tsx`, `index.html`, `public/brand/grd-logo-dark.svg`, and `public/favicon-dark.svg` provide theme-specific assets. |
| Documentation | `api-contracts.md`, `branding.md`, `ui-spec.md`, and this summary describe the delivered behavior. |

## Verification

- `pnpm check`: passed formatting, lint, Knip, typecheck, and 214 tests in 34 files.
- Focused Amazon setup-message regression: 1 file / 10 tests passed.
- `pnpm build`: passed; emitted the existing chunk-size advisory only.
- Focused quote-form regression: 1 file / 13 tests passed, including myUnishippers-only
  blank dimensions and Amazon/mixed-provider rejection.
- `FE_TEST_QUOTE_READINESS=true pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/quote-readiness.spec.ts`: 2 passed.
- Focused `tracking-review.spec.ts` desktop and mobile runs: 2 passed; both update
  colors appeared and cleared after detail navigation.
- Focused quote form and shipment search-state tests passed before the final full check.
- Final diff and status were reviewed; no frontend changes outside the requested scope were found.

## Review Notes

No production dependency was added. The implementation uses the installed Playwright,
Decimal.js, MUI, TanStack Router/Query, theme APIs, and native browser favicon support.
Modified clicks retain native browser behavior and do not acknowledge because the
current tab may never display the detail page. A normal Tracking Number click
acknowledges only the displayed revision before navigation, preserving newer unseen
revisions. Other cells and card content do not navigate.

The readiness fixture substitutes only provider I/O. Its domestic myUnishippers result
now mirrors calculated multi-group Quick Quote semantics; it no longer claims live
international or native whole-shipment support.

## Remaining Issues

- Amazon rates remain blocked until the account owner completes Amazon Shipping's
  pickup/contact onboarding and resolves the worker sign-in verification challenge.
- Current frontend changes are committed locally and not deployed.

## Suggested Review Order

1. Quote form schema and provider-aware dimension guidance.
2. Quote form regression tests.
3. API contract and this implementation summary.

## Commit

`feat(shipping-quotes): SQ-V1-009 improve comparison guidance and validation`

Includes the provider-aware form contract, staff-facing validation and errors, safe
Amazon setup guidance, focused regressions and documentation. Deployment remains a
separate authorized step.
