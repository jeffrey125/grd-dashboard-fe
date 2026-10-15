# FE-V1-011: Add route-scoped tracking alerts, optional sound, and review highlights

## Status

Not started. Depends on FE-V1-008 and BE-V1-005; FE-V1-005 synchronization is already a transitive prerequisite.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Notify staff of actual tracking updates while on /shipments and retain observed change highlights until reviewed.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [architecture.md](../architecture.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Consume the implemented tracking.changed event, deduplicating public snapshot identities while still refetching authoritative data.
- Gate tracking toasts/audio on exact pathname /shipments across all tabs/pages, including off-page or filtered-out shipments. Keep action toasts available elsewhere.
- Group bursts into bounded toast summaries and one optional sound; default sound off and persist the per-account/browser preference.
- Add a sound control and Mark displayed changes as seen; persist minimal per-account unseen revision records in versioned browser storage with an in-memory fallback.
- Acknowledge only the successfully displayed revision when detail opens or a displayed-row acknowledgement occurs; retain newer concurrent updates and clean confirmed deletions.

## Acceptance criteria

- No tracking alert/audio on homepage, create, detail, Admin, or auth routes. Query strings do not disable alerts on /shipments.
- A newly delivered off-page shipment can alert while Active is selected; notes/schedule/pause changes and unchanged successful checks do not falsely sound.
- Duplicate or out-of-order events and manual-refresh feedback do not produce duplicate alerts or downgrade a newer unseen revision.
- Highlights persist through reload until reviewed, remain account-isolated, and are not cleared globally by a displayed-only acknowledgement.
- Initial data and reconnect resync are quiet. Audio permission denial, disabled storage, malformed/version-old storage, and logout do not crash or leak state.
- Sound asset provenance is checked before reusing the original UI asset; no new audio/global-state dependency is added without approval.

## Verification

Run event/dedup/acknowledgement-race/storage tests and browser checks for exact routes, off-page updates, bursts, autoplay denial, account switching, reload persistence, deletion, and reconnect. Verify an actual backend notes-only update stays quiet while a committed tracking change alerts. Run quality gates.

## Review notes and completion

No replay guarantee, cross-device review sync, browser push notifications, or team-shared acknowledgement is included. Bound retained state without silently discarding currently relevant unreviewed changes; document any retention limit.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
