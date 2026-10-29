# SHIP-V1-001: shipment business fields

## Summary

Added optional PO#, Customer and Vendor to shipment creation, detail editing,
desktop tables and mobile cards. Reused approved Zod, React Hook Form, MUI DataGrid
and existing query/API infrastructure; no dependencies or lockfiles changed.

## Changes Made

Desktop columns begin Sales Rep, PO#, Customer, Vendor, Tracking Number. Sales Rep
remains visible at all desktop widths so PO# is consistently second. The table
scrolls horizontally within its container when necessary. Mobile cards show only
populated fields, in PO#, Customer, Vendor order, with long text wrapping.

All fields trim whitespace, preserve case/leading zeros, allow 255 UTF-16 code
units and submit blanks as null. Detail saves send only dirty properties, so an
unrelated edit does not resubmit unchanged assignment, follow-up, manual tracking
or business fields. All new fields support server-side sorting; search help text
explains their inclusion in the existing global search.

## Files Changed

These files form the proposed frontend commit:

| File | Purpose |
| --- | --- |
| `src/features/shipments/api.ts` | Extend PATCH input types. |
| `src/features/shipments/schemas.ts` | Require the three nullable response properties. |
| `src/features/shipments/create-schema.ts` | Shared text validation, labels and field errors. |
| `src/features/shipments/create-form.tsx` | Optional inputs and reset defaults. |
| `src/features/shipments/assignment-section.tsx` | Detail fields, dirty-only PATCH and reset values. |
| `src/features/shipments/search-state.ts` | New server sort options and URL validation. |
| `src/features/shipments/filters.tsx` | Describe expanded search scope. |
| `src/features/shipments/shipment-grid.tsx` | Desktop order, sorting and populated mobile values. |
| `src/test/shipment-fixture.ts` | Extend shared response fixtures. |
| `e2e/create-shipments.spec.ts` | Verify normalized creation request. |
| `e2e/shipment-detail.spec.ts` | Verify editing, clearing, exact dirty-only request and reload. |
| `e2e/shipments.spec.ts` | Verify columns, sorting, mobile order, internal scrolling and responsive behavior. |
| `docs/v1/implementation-summary/SHIP-V1-001-implementation-summary.md` | This review handoff. |

Pre-existing `e2e-backend/tracking-review.spec.ts` changes are unrelated and remain
excluded. No staging or commit has occurred.

## Verification

- `node_modules/.bin/tsc --noEmit` — passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.node.json` — passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.e2e.json` — passed.
- `node_modules/.bin/vite build` — passed; existing large-chunk advisory remains.
- `node_modules/.bin/biome check --formatter-enabled=false .` — passed.
- Scoped `node_modules/.bin/biome check` and `git diff --check` — passed.
- `node_modules/.bin/vitest run` — 267 passed.
- `node_modules/.bin/playwright test e2e/create-shipments.spec.ts e2e/shipment-detail.spec.ts e2e/shipments.spec.ts --workers=2`
  — final 58 passed across desktop and mobile. Initial layout assertions assumed
  the shorter form and no horizontal grid scrolling; updated them to scroll the
  actual controls into view and await the responsive column model before checking
  column order. Retained URL/scroll stability and page-overflow assertions.
- `node /tmp/shipment-live-smoke.cjs` — passed against actual local UI/API and
  disposable PostgreSQL: sign in, create with business fields, edit/clear Vendor,
  reload and verify persisted PO#/blank Vendor.
- Local frontend HTTP 200 and API health `{"status":"ok"}` verified. Servers
  remain running at http://localhost:5173 and http://localhost:3000/api/v1.

Tests use fictional fixtures. Full frontend acceptance, all browser suites and
release/container checks were not run; scoped affected suites were used. Backend
verification is recorded in the sibling SHIP-V1-001 summary.

## Review Notes

The updated backend/migration must precede this frontend because shipment schemas
expect the new nullable properties. PO sorting is lexical, not numeric. Duplicate
PO values remain permitted. Empty fields are hidden only on mobile cards; inputs
remain available to add/edit them. Backend permissions remain authoritative.

Final diff reviewed separately from the pre-existing tracking-review test edit.
No custom replacement for approved library functionality was introduced.

## Remaining Issues

No known feature blockers. Airtable import, managed directories, future uniqueness
and production rollout are deferred. Production was not modified.

## Suggested Review Order

1. API/validation contracts and corresponding backend migration.
2. Creation/detail forms and grid/search state.
3. Browser tests and shared fixtures.

Proposed commit:
`feat(shipments): SHIP-V1-001 add PO customer and vendor fields`

Explicit final approval is required before staging/committing under AGENTS.md.
