# BE-V1-004: Add operational overview aggregates

## Status

Implemented and locally verified in the backend. Deployment is pending. Depends
on BE-V1-002 and BE-V1-003, which are also implemented locally.

## Target repository

`/home/jeff/apps/grd-dashboard/grd-dashboard-be`. Read its AGENTS.md, README, and
applicable module instructions before implementation. This ticket lives in the
frontend planning repository; no backend code was changed when it was written.

## Objective

Supply accurate overview counts and bounded attention, upcoming-delivery, and recent-change panels without loading every shipment into the browser.

## Required reading

- [API contracts](../api-contracts.md), especially this ticket's proposed section.
- [Decisions](../decisions.md), [verification](../verification.md), and
  [source evidence](../source-evidence.md).
- Backend `docs/v1/frontend-handoff.md`, `docs/v1/auth-api.md`,
  `docs/v1/database-schema.md`, and the relevant existing module/tests.

## Scope

- Implement proposed GET /dashboard/overview with unrestricted Staff/Admin authorization and explicit safe projection.
- Share predicates with shipment search for counts and attention; use a consistent database snapshot across cards and panels.
- Compute upcoming boundaries using America/New_York and date-only ETAs: today through day +6, undelivered only. Return window, timezone, and asOf.
- Return up to 10 attention rows, 10 upcoming rows, and 10 recent normalized snapshots, with totals for paginated drill-down destinations.
- Document aggregate meaning, null handling, ordering, and cache behavior; keep performance analytics deferred.

## Acceptance criteria

- Counts exclude deleted records, include disabled-carrier shipments, and distinguish monitoring completion from delivered-today metrics.
- Attention means noncompleted with latest failed lookup or not-found-threshold pause; it does not imply delivery lateness.
- Upcoming excludes delivered/unknown-ETA records, covers the exact business date window, and has a matching list drill-down.
- Recent changes reflect persisted observations including first acquisition, not generated mock events or every unchanged poll.
- Panel counts and items are internally consistent under worker mutations and payloads stay bounded with representative 10,000-shipment fixtures.

## Verification

Run PostgreSQL aggregate and HTTP policy tests, date-boundary/DST tests, empty/all-null/disabled/deleted fixtures, concurrent consistency checks, and backend gates. Cross-check search drill-down totals against aggregate predicates.

## Review notes and completion

No charting dependency, KPI definition, or analytics endpoint is required. The planned frontend renders problems before deliveries.

Follow the backend's handoff/commit instructions. Record implementation and exact
verification evidence in a ticket summary, and update this plan's API contract and
status only when the backend change is actually available. Deployment is deferred.

Implemented with the existing NestJS, Zod, TypeORM, PostgreSQL, Vitest,
Supertest, and Testcontainers stack. One parameterized SQL statement supplies the
entire response snapshot; no production dependency or schema migration was added.
See the backend
[`BE-V1-004 implementation summary`](../../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-004-implementation-summary.md)
for the final contract, tests, and review evidence.
