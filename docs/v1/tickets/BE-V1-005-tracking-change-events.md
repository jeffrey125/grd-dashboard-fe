# BE-V1-005: Distinguish actual tracking changes in the live event stream

## Status

Implemented and locally verified in the backend repository. Deployment is pending.
See the
[implementation summary](../../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-005-implementation-summary.md).

## Target repository

`/home/jeff/apps/grd-dashboard/grd-dashboard-be`. Read its AGENTS.md, README, and
applicable module instructions before implementation. This ticket lives in the
frontend planning repository; no backend code was changed when it was written.

## Objective

Allow accurate change alerts for shipments outside the visible table page without announcing notes or scheduling edits as carrier changes.

## Required reading

- [API contracts](../api-contracts.md), especially this ticket's proposed section.
- [Decisions](../decisions.md), [verification](../verification.md), and
  [source evidence](../source-evidence.md).
- Backend `docs/v1/frontend-handoff.md`, `docs/v1/auth-api.md`,
  `docs/v1/database-schema.md`, and the relevant existing module/tests.

## Scope

- Add the proposed tracking.changed event with Shipment UUID, public snapshot UUID, and observedAt when the committed current snapshot pointer changes to a non-null value.
- Use the existing transaction-aware PostgreSQL notification mechanism and an additive migration. Include first acquisition; successful unchanged checks produce no tracking.changed.
- Extend source schema/types, listener validation, and controller serialization together. Preserve existing shipment.changed/run.changed/resync/heartbeat contracts.
- Retain session revalidation, origin/auth protections, slow-consumer bounds, listener recovery, and no-replay semantics.
- Update backend event docs and frontend handoff with exact payload and examples.

## Acceptance criteria

- Actual committed snapshot changes emit the precise signal; rollback emits nothing. Payload references the committed snapshot owned by that Shipment.
- Notes edits, scheduling changes, pause/resume, and failed/not-found checks do not falsely emit the precise signal; generic invalidations remain available.
- IDs and timestamps survive source validation/controller serialization; no source data or internal identifiers escape.
- Existing SSE tests remain valid, and revoked/restricted sessions stop receiving events.
- Reconnect emits resync and does not claim replay. Repeated/late delivery can be safely deduplicated by public revision identity.

## Verification

Run real-PostgreSQL commit/rollback trigger tests and SSE HTTP tests, including first acquisition, changed/unchanged results, notes-only updates, session revocation, and listener recovery. Run applicable backend gates and document no-replay limits.

## Review notes and completion

No durable notification feed, message broker, polling of every shipment, or new production package is selected. The frontend gates sounds/toasts by route; the backend emits facts independently of UI navigation.

Follow the backend's handoff/commit instructions. Record implementation and exact
verification evidence in a ticket summary, and update this plan's API contract and
status only when the backend change is actually available. Deployment is deferred.
