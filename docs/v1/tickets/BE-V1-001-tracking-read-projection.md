# BE-V1-001: Expose current tracking and latest lookup information

## Status

Implemented, locally verified, and committed in the backend repository. Deployment
is pending. Depends on the existing backend v1 implementation; no frontend feature
was implemented.

See the [backend implementation summary](../../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-001-implementation-summary.md)
for changed files, exact verification, migration/rollback notes and review results.

## Target repository

`/home/jeff/apps/grd-dashboard/grd-dashboard-be`. Read its AGENTS.md, README, and
applicable module instructions before implementation. This ticket lives in the
frontend planning repository; no backend code was changed when it was written.

## Objective

Make stored tracking details available through an explicit public Shipment projection without changing the worker's tracking behavior.

## Required reading

- [API contracts](../api-contracts.md), especially this ticket's proposed section.
- [Decisions](../decisions.md), [verification](../verification.md), and
  [source evidence](../source-evidence.md).
- Backend `docs/v1/frontend-handoff.md`, `docs/v1/auth-api.md`,
  `docs/v1/database-schema.md`, and the relevant existing module/tests.

## Scope

- Add the proposed currentTracking, latestLookup, and latestRun fields consistently to Shipment read/mutation/batch results. Use the Shipment's current snapshot pointer and deterministic latest-completed-attempt/latest-run selection.
- Add stable public UUIDv4 identities to existing and new snapshots through a reviewed additive migration; retain internal keys, existing foreign keys, immutable content, and ON DELETE NO ACTION policy.
- Use efficient joins/subqueries rather than per-shipment lookups. Keep the legacy GET /shipments array shape and all existing fields.
- Keep source data, internal keys, actors, credentials, and provider diagnostic messages out of the response. Document date-only versus timestamp semantics.
- Update backend response schemas, repository interfaces, tests, schema documentation, and frontend-handoff.md. Record the implemented contract back in the frontend plan.

## Acceptance criteria

- A newly created shipment has null tracking/lookup/run fields where no record exists; partial provider data retains explicit nulls.
- An unchanged successful check reuses the known snapshot; failed/not-found/skipped checks do not erase it. Snapshot observedAt is not mislabeled as the last successful lookup time.
- A pending attempt cannot replace latestLookup. latestRun uses associated runs and a deterministic order, and an explicit manual run remains independently readable.
- Existing snapshots receive unique public UUIDs without changing their values or current-pointer relationships; migrations work on both empty and populated disposable databases.
- All read and mutation response variants agree, including duplicates and notes updates. Public API tests assert no internal IDs/source data leak and existing role restrictions remain enforced.

## Verification

Run backend format/lint/typecheck/build, focused Shipment/tracking unit and HTTP tests, and real PostgreSQL migration/repository tests. Include populated migration, no-snapshot, unchanged/failure, pending-run, and response-consistency cases. Run representative query-count checks to rule out N+1 behavior.

## Review notes and completion

This ticket does not implement the history endpoint, pagination, analytics, or new scraping. No new production dependency is planned: reuse installed NestJS, Zod, TypeORM, and PostgreSQL tooling.

Follow the backend's handoff/commit instructions. Record implementation and exact
verification evidence in a ticket summary, and update this plan's API contract and
status only when the backend change is actually available. Deployment is deferred.
