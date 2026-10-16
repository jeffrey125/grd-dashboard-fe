# FE-V1-009: Add the shipment History tab

## Status

Implemented with local unit, browser and real-backend verification. Commit approval
is pending. Prerequisites FE-V1-008 and BE-V1-003 were verified in source and their
implementation evidence. See the
[implementation summary](../implementation-summary/FE-V1-009-implementation-summary.md)
for exact checks and limitations.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Let staff inspect recorded tracking changes without crowding the shipment Overview.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Add Overview/History tabs with URL-owned selection and history pagination, keeping the identity/actions header above both.
- Fetch the real paginated normalized-history endpoint; show newest observations first with status/detail and pickup/estimated/actual delivery dates.
- Label first observation distinctly and optionally show accurate field differences only when the adjacent prior snapshot is known.
- Invalidate/refetch relevant history after tracking updates and preserve stable pagination behavior.
- Handle no observations, loading, error, partial data, page bounds, and deleted shipment states accessibly.

## Acceptance criteria

- History renders persisted normalized snapshots and their public IDs/timestamps; it does not invent unchanged polls, carrier scans, or raw diagnostics.
- Direct tab/page links and browser back/forward restore the correct view; header controls remain usable.
- At pagination boundaries, incomplete comparison context is not presented as a complete change diff.
- Date-only values never shift across timezones, and recorded timestamps display in America/New_York.
- An updated history request cannot overwrite a newer revision after a concurrent live event.

## Verification

Run history/page/tab rendering tests and Playwright direct-link/navigation cases. Integrate with real no-snapshot, initial, changed, unchanged, null-field, failed-later, and multi-page histories. Run quality gates.

## Review notes and completion

This separate ticket fulfills the interview's explicit history scope. Attempt logs, retention policy, and complete carrier event histories are deferred.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
