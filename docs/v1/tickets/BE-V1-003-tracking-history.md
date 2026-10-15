# BE-V1-003: Expose paginated shipment tracking history

## Status

Implemented and locally verified in the backend repository. Deployment is
pending. Depends on BE-V1-001.

## Target repository

`/home/jeff/apps/grd-dashboard/grd-dashboard-be`. The implementation and exact
verification evidence are recorded in its
[`BE-V1-003` summary](../../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-003-implementation-summary.md).

## Objective

Provide an independently reviewable read API for the shipment detail History tab.

## Required reading

- [API contracts](../api-contracts.md), especially this ticket's proposed section.
- [Decisions](../decisions.md), [verification](../verification.md), and
  [source evidence](../source-evidence.md).
- Backend `docs/v1/frontend-handoff.md`, `docs/v1/auth-api.md`,
  `docs/v1/database-schema.md`, and the relevant existing module/tests.

## Scope

- Implement proposed GET /shipments/:externalId/history with validated page/pageSize and the shared public TrackingSnapshot shape.
- Read only snapshots owned by the requested nondeleted Shipment; order observedAt descending with a stable internal tie-breaker and return total.
- Preserve initial observation and existing deduplicated snapshot semantics. Keep unchanged checks and failed attempts out of this normalized-change list.
- Update backend handoff and HTTP/repository tests, including new public snapshot identities.

## Acceptance criteria

- Staff/Admin can read history; missing/deleted UUIDs return 404 and no-snapshot shipments return an empty page.
- First and subsequent pages are deterministic for equal timestamps, page size is capped, and foreign-shipment snapshots cannot appear.
- Null date/status fields remain honest; known history remains available after a failed lookup.
- History contains public normalized data only, not raw source data, internal IDs, every carrier scan, or a fabricated attempt timeline.

## Verification

Run focused real-PostgreSQL history/pagination tests, HTTP auth/validation/404 tests, and applicable backend gates. Test initial, changed, unchanged, failure-preserved, equal-time, and deleted-record cases.

## Review notes and completion

This is the separate history ticket agreed in the interview. It does not add retention/purge policy or source-data access.

Follow the backend's handoff/commit instructions. Record implementation and exact
verification evidence in a ticket summary, and update this plan's API contract and
status only when the backend change is actually available. Deployment is deferred.

Implemented with the existing Zod, TypeORM and PostgreSQL stack and the existing
snapshot-history index. No dependency or schema migration was needed.
