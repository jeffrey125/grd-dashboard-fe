# FE-V1-006: Implement the tabbed shipment list and quick actions

## Status

Not started. Depends on FE-V1-005 and BE-V1-002.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Deliver a responsive shipment workspace with server-owned queries and reliable quick monitoring actions.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [architecture.md](../architecture.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Build /shipments using TanStack Table and shadcn presentation; use the implemented paginated endpoint, not the legacy array endpoint.
- Implement All/Active/Paused/Delivered/Needs attention tabs and server counts, default Active, page size controls, and createdAt desc with stable server ties.
- Store tab/search/carrier/outcome/date ranges/page/sort in validated Router URL state. Support the overview's undelivered-only drill-down with a visible removable filter indicator.
- Debounce search, cancel obsolete requests, reset page for changed filters/sort/tab, and clamp pages after deletion/state changes.
- Implement reference/detail links, Add shipments navigation, useful columns/status distinctions, and per-row refresh plus valid pause/resume using shared feature mutations.

## Acceptance criteria

- Default and explicit URL states behave correctly across reload, back/forward, and detail return. Only server-allowlisted sorts appear interactive.
- Filters/sort operate across all matching records before pagination. Tab counts reflect non-tab filters and do not imply mutually exclusive Attention.
- Row controls follow manual versus threshold pause, completed, disabled-carrier, and queued/coalesced-run rules; stale 409s refetch and show safe feedback.
- Live updates keep current sort and correct counts, handle rows leaving a tab, and do not target the wrong row action.
- Loading, empty, error, stale, and previous-page placeholder states are distinguishable; mobile scrolling and keyboard actions work.

## Verification

Run URL/query-state and user-visible table/action tests, representative combinations over real backend paginated fixtures, and Playwright default/tab/search/sort/back-navigation scenarios. Verify rows beyond the first page affect search/counts correctly. Run quality gates.

## Review notes and completion

Mark/sound controls are added by FE-V1-011. Notes/deletion stay on detail; no bulk/global controls. Do not ship frontend-only fake sorting or counts.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
