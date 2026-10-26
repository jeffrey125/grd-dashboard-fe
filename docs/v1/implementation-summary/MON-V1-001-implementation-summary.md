# MON-V1-001 frontend implementation summary

## Summary

Added independent admin monitoring safeguards and clear failure-pause recovery states for shipments.

## Changes Made

- Carrier editor shows two switches and thresholds (1–10, default 2), with existing save/conflict handling.
- Carrier detail/list display the shared failure count and automatic-disable reason.
- Shipment detail/grid expose failure pauses, counts and Retry now, preserving disabled-carrier restrictions; overview labels the correct pause reason.
- Run events refresh carrier-dependent queries so automatic disablement updates eligibility.

## Files Changed

Paths below are relative to the frontend repository. Existing shipping-quote changes and `e2e-backend/tracking-review.spec.ts` are excluded.

| File | Purpose |
| --- | --- |
| `e2e-backend/carriers.spec.ts` | Verify the changed behavior, contract or migration expectations with fixtures. |
| `e2e/carriers.spec.ts` | Verify the changed behavior, contract or migration expectations with fixtures. |
| `e2e/shipment-detail.spec.ts` | Verify the changed behavior, contract or migration expectations with fixtures. |
| `src/features/carriers/carrier-editor.tsx` | Expose and manage independent admin safeguards, thresholds and durable carrier state. |
| `src/features/carriers/pages/carrier-detail-page.tsx` | Expose and manage independent admin safeguards, thresholds and durable carrier state. |
| `src/features/carriers/pages/carriers-page.tsx` | Expose and manage independent admin safeguards, thresholds and durable carrier state. |
| `src/features/carriers/schemas.test.ts` | Verify the changed behavior, contract or migration expectations with fixtures. |
| `src/features/carriers/schemas.ts` | Expose and manage independent admin safeguards, thresholds and durable carrier state. |
| `src/features/overview/pages/overview-page.tsx` | Keep dashboard projections and labels consistent with failure pauses. |
| `src/features/shipments/detail-model.ts` | Expose failure counters and pause/retry behavior in shipment contracts or UI. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Expose failure counters and pause/retry behavior in shipment contracts or UI. |
| `src/features/shipments/schemas.ts` | Expose failure counters and pause/retry behavior in shipment contracts or UI. |
| `src/features/shipments/shipment-grid.tsx` | Expose failure counters and pause/retry behavior in shipment contracts or UI. |
| `src/features/tracking-updates/query-refresh.ts` | Reconcile carrier eligibility after run events. |
| `src/test/carrier-fixture.ts` | Provide current carrier/shipment fields and migration fixtures. |
| `src/test/shipment-fixture.ts` | Provide current carrier/shipment fields and migration fixtures. |
| `docs/v1/implementation-summary/MON-V1-001-implementation-summary.md` | Review handoff, verification evidence and commit scope. |

## Verification

- `pnpm check` — passed formatting, lint, typecheck, Knip and all 248 tests across 36 files.
- `VITE_API_ORIGIN=http://localhost:3301 pnpm build` — passed.
- `pnpm exec playwright test e2e/carriers.spec.ts e2e/shipment-detail.spec.ts e2e/shipments.spec.ts --workers=2` — 60 passed before the final new retry test.
- `pnpm exec playwright test e2e/shipment-detail.spec.ts --workers=2` — final 24 passed, including the new failure-paused/disabled-carrier test on desktop and mobile.
- `FE_TEST_API_PORT=3301 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/carriers.spec.ts` — 2 passed with the real fixture API after rebuilding for its port. Initial preview-port mismatch was corrected; the development-server test already passed.
- Local frontend and API readiness returned HTTP 200. Manual browser review uses `http://localhost:5173` and backend `http://localhost:3302`, login `frontend-admin@example.test` / `admin fixture password`. Desktop/mobile capture succeeded with no horizontal overflow; mobile screenshot was visually reviewed.
- Final `git diff --check` passed. Full frontend acceptance suite was not run; relevant browser and real-API checks above were run.

## Review Notes

Uses the approved installed Axios/cookie jar, TypeORM/PostgreSQL, Zod, MUI and TanStack Query capabilities; no production dependency was added. Business rules are limited to the approved monitoring scope. Shipping quotes are unchanged by this feature.

Defaults are enabled with thresholds of 2; each threshold accepts 1–10. Not-found keeps its existing separate threshold. Shared session failures count once per run and do not increase shipment technical-failure counts. Re-enabling a safeguard resets counters but does not resume paused shipments or disabled carriers. A successful explicit retry resumes monitoring; failed/not-found retains the pause. Carrier disablement blocks new work; an operation already running may finish.

Deploy the migration and backend before the matching frontend. New frontend response schemas require the new backend fields. Cookies remain worker-memory only and disappear on restart. Existing historical failures are not backfilled. The enum migration rewrites its column type transactionally and needs normal database DDL locking; rollback converts failure pauses to manual pauses.

## Remaining Issues

This report was prepared before commit and deployment. Live provider credentials were not exercised; fixture success does not establish that EchoShip has unlocked the account. Production rollout and provider recovery remain separate work. Full combined coverage and opt-in container lifecycle checks were not run for this feature; no container/release configuration changed. The backend whole-repository format gate still reports the pre-existing `docs/v1/shipping-quotes.md` formatting issue.

## Suggested Review Order

1. Approved behavior in `docs/v1/monitoring-safeguards.md`, migration and entity mappings.
2. Tracking transactions/executor and adapter session lifecycle, followed by regression tests.
3. Frontend carrier settings, shipment retry presentation and browser/API evidence.

Proposed commits (approval required before staging or committing):

- Backend: `feat(monitoring): MON-V1-001 add durable failure safeguards and session reuse` — the backend files listed above; only the MON-V1-001 addition in `docs/v1/frontend-handoff.md`.
- Frontend: `feat(carriers): MON-V1-001 expose monitoring safeguards and retry states` — the frontend files listed in its companion report.

All pre-existing Amazon/shipping-quote edits remain outside these commit scopes. The commit and deployment results are reported in the delivery message for this change.
