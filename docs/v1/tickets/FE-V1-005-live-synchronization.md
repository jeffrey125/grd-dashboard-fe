# FE-V1-005: Coordinate SSE and race-safe query refresh

## Status

Implemented, locally verified, and committed on 2026-10-16 after explicit approval.
FE-V1-004 is implemented. See the
[implementation summary](../implementation-summary/FE-V1-005-implementation-summary.md)
for exact verification and the registration boundary for later feature queries.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Keep protected data synchronized with one authenticated event connection without losing updates or leaking subscriptions.

## Required reading

- [api-contracts.md](../api-contracts.md)
- [architecture.md](../architecture.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Use native credentialed EventSource under the authenticated app lifecycle; subscribe before protected initial data fetches.
- Handle existing resync, shipment.changed, tracking.changed, run.changed, and heartbeat through explicit feature registration/exports. BE-V1-005 is implemented; expose its validated payload while deferring tracking alerts/review behavior to FE-V1-011.
- Coalesce bursts and invalidate relevant detail/list/count/overview/run queries. Guarantee a follow-up fetch or safe cancellation when an event arrives during an in-flight request.
- Handle reconnect and one backed-off /auth/me check after stream error; close on revoked/restricted sessions and stop old-account work.
- Refresh displayed carrier data after edits/focus/reconnect because no carrier SSE event exists. Expose honest connection/stale state without noisy repetitive toasts.

## Acceptance criteria

- Only one app event connection exists per browser tab/session; repeated mounts/navigation do not leak listeners or multiply invalidations.
- An event during fetch cannot leave the UI stuck on an older response; event bursts settle on authoritative data with bounded requests.
- Resync reloads authoritative data quietly, including displayed explicit runs. Last-Event-ID is not treated as replay support.
- Logout/restriction/unmount closes connections and removes consumers; late callbacks cannot mutate a new session.
- 404 after a shipment invalidation removes/navigates away from deleted records safely; focus/reconnect keeps carrier-dependent UI current.

## Verification

Use deterministic tests for event-during-fetch, burst, reconnect, revoked-session, teardown, and account-switch races, plus browser tests against the real backend SSE endpoint. Run quality gates and inspect active connection counts during repeated navigation.

## Review notes and completion

This ticket synchronizes data only. Tracking-specific toast/audio/review behavior belongs to FE-V1-011 after BE-V1-005.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
