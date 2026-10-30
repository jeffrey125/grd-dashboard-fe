# SHIP-V1-002 frontend implementation handoff

## Summary

Add SO and Product storage to the paired backend and show/edit both only in shipment details. PO editing supports multiple references while the existing monitoring table retains its PO# column. Warehouse shipments retain PO# 0 and separate SO values.

## Changes Made

- Reused installed Material UI Autocomplete, React Hook Form, Zod and TanStack Query; no dependency or lockfile change.
- Details edit reference/product lists as free-text chips with existing save, dirty-state and refresh protections. Long product names wrap; commas remain part of a product name.
- Only changed fields are submitted. Empty lists clear a field; unrelated customer/vendor/assignment edits preserve PO associations. Old API response reads retain one opaque PO fallback and empty SO/Product defaults; deploy the new API before edits use the new fields.
- Updated the shipment-details Help guide, fictional screenshot and three marker positions while preserving role-based Help visibility. No SO/Product monitoring columns or creation-form fields were added.

## Files Changed

Work is isolated in `/tmp/grd-shipment-order-details-fe` on `feature/SHIP-V1-002-shipment-order-details`, based on current main. The original frontend checkout remains on `feature/post_deployment_feedback` with its existing tracking-review test edit untouched. The untracked node_modules symlink is local tooling only and must not be staged.

| File | Purpose |
|---|---|
| [docs/v1/api-contracts.md](../../../docs/v1/api-contracts.md) | Align the documented API and detail-only display contract. |
| [docs/v1/implementation-summary/SHIP-V1-002-implementation-summary.md](../../../docs/v1/implementation-summary/SHIP-V1-002-implementation-summary.md) | Record scope, verification, rollout limits and review order. |
| [e2e-backend/shipment-detail.spec.ts](../../../e2e-backend/shipment-detail.spec.ts) | Prove SO/Product persistence through the real API while preserving warehouse PO 0; align run-panel checks with Audit. |
| [e2e/help-capture.spec.ts](../../../e2e/help-capture.spec.ts) | Generate the affected screenshot with fictional list values while retaining unrelated captures. |
| [e2e/shipment-detail.spec.ts](../../../e2e/shipment-detail.spec.ts) | Verify chips, clearing, warehouse references and preservation of unrelated PO associations on desktop/mobile. |
| [public/help/screenshots/details.png](../../../public/help/screenshots/details.png) | Show the final detail editor using fictional orders and products. |
| [src/features/help/captures.json](../../../src/features/help/captures.json) | Align the three shipment-details screenshot markers with the final image. |
| [src/features/help/content.ts](../../../src/features/help/content.ts) | Explain multiple order references, PO 0, and detail-only SO/Product fields in Help. |
| [src/features/shipments/api.ts](../../../src/features/shipments/api.ts) | Type the additional optional PATCH lists. |
| [src/features/shipments/assignment-section.tsx](../../../src/features/shipments/assignment-section.tsx) | Edit multiple POs, SOs and products using existing MUI/RHF controls and dirty-state protection. |
| [src/features/shipments/schemas.ts](../../../src/features/shipments/schemas.ts) | Read list fields, with rollout defaults for older responses. |
| [src/test/shipment-fixture.ts](../../../src/test/shipment-fixture.ts) | Supply default empty SO/Product lists in fictional fixtures. |

## Verification

| Exact command / check | Result |
|---|---|
| `pnpm --config.verifyDepsBeforeRun=false check` | Passed format, lint, route/type checks, Knip and 267 unit/component tests. The flag avoids mutating the original checkout's shared dependency installation. |
| `VITE_GOOGLE_PLACES_API_KEY=browser-test-key pnpm --config.verifyDepsBeforeRun=false build` | Passed; existing bundle-size and router tooling warnings remain. The key is fictional test configuration. |
| `pnpm --config.verifyDepsBeforeRun=false exec playwright test --workers=2` | Final full isolated run: 174 passed, 2 intentionally skipped opt-in screenshot-generation cases. An earlier build without the documented Places test key caused four address-search failures; the configured final run passed them. |
| `pnpm --config.verifyDepsBeforeRun=false exec playwright test --config playwright.backend.config.ts e2e-backend/shipment-detail.spec.ts` | 2 passed: real API + disposable PostgreSQL persistence, desktop preview and mobile dev-proxy paths; warehouse PO 0 retained while SO/Product changes persisted. Existing refresh-panel checks were aligned with the current Audit tab. |
| `UPDATE_HELP_SCREENSHOTS=true HELP_CAPTURE_DETAILS_ONLY=true pnpm --config.verifyDepsBeforeRun=false exec playwright test e2e/help-capture.spec.ts --project=chromium --workers=1` | Passed. Generated only the approved details screenshot/markers using fictional data; other captures unchanged. Final screenshot visually inspected. |
| `pnpm --config.verifyDepsBeforeRun=false exec playwright test e2e/help.spec.ts --workers=2` | 8 passed after the final capture: desktop/mobile guides, markers/images, Staff/Admin visibility and auth. |
| `git diff --check` | Passed. |
| Local server checks | Frontend http://localhost:5173 reachable; API http://localhost:3000/api/v1/health/ready reports up. Both remain running against fictional disposable data, tracking worker disabled. |

Manual fixture login: `frontend-details@example.test` / `details fixture password`. A fictional warehouse example is available at http://localhost:5173/shipments/f0ffeba2-38a0-4e3a-8100-e2e216093dcf. These credentials and records are disposable local fixtures, not production.

The real API browser subset was run; the entire frontend real-backend acceptance suite and opt-in container checks were not run. No deployment, production write, staging or commit has been performed.

## Review Notes

Deploy the paired backend migration/API first. SO and Product are database arrays because a tracked shipment may span several source line items/SOs. PO relationships are persisted relationally by the backend. Customer/Vendor remain the existing shipment-wide fields; conflicting source data stays excluded from the backfill.

Help screenshots contain fictional values. Screenshot generation was restricted to details to preserve unrelated captures. No new production dependency or custom replacement for the installed UI/form/validation libraries was introduced.

## Remaining Issues

- The user approved the exact commit plan, paired PRs and deployment on 2026-10-31. Release checks and live verification follow implementation checks.
- Backend deployment/migration and production backfill remain pending; production is unchanged.
- Eight source matches remain unresolved and excluded by the paired backend plan.

## Suggested Review Order

1. `src/features/shipments/assignment-section.tsx`, API types and response schema.
2. Detail browser tests and real-API persistence checks.
3. Help content, final details screenshot and marker positions.
4. Paired backend migration, relationship persistence and guarded backfill.
