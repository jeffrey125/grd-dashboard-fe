# FE-V1-006: Implement the tabbed shipment list and quick actions

## Status

Implemented and locally verified on 2026-10-16; commit pending explicit approval.
FE-V1-005 and BE-V1-002 were verified in source and against the real local API.
See the [implementation summary](../implementation-summary/FE-V1-006-implementation-summary.md).

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

- Replace FE-V1-003's temporary `/shipments` page with MUI X Data Grid Community; use the implemented paginated endpoint, not the legacy array endpoint. Keep simultaneous filters in external MUI controls and URL state rather than relying on Pro-only built-in multi-filtering.
- Implement All/Active/Paused/Delivered/Needs attention tabs and server counts, default Active, page size controls, and createdAt desc with stable server ties.
- Store tab/search/carrier/page/sort in validated Router URL state.
- Debounce search, cancel obsolete requests, reset page for changed filters/sort/tab, and clamp pages after deletion/state changes.
- Implement reference/detail links, a reserved inline creation area, useful columns/status distinctions, and per-row refresh plus valid pause/resume using shared feature mutations.

## Acceptance criteria

- Default and explicit URL states behave correctly across reload, back/forward, and detail return. Only server-allowlisted sorts appear interactive.
- Filters/sort operate across all matching records before pagination. Tab counts reflect non-tab filters and do not imply mutually exclusive Attention.
- Row controls follow manual versus threshold pause, completed, disabled-carrier, and queued/coalesced-run rules; stale 409s refetch and show safe feedback.
- Live updates keep current sort and correct counts, handle rows leaving a tab, and do not target the wrong row action.
- Loading, empty, error, stale, and previous-page placeholder states are distinguishable; mobile cards, sorting/pagination and keyboard actions work.

## Verification

Run URL/query-state and user-visible table/action tests, representative combinations over real backend paginated fixtures, and Playwright default/tab/search/sort/back-navigation scenarios. Verify rows beyond the first page affect search/counts correctly. Run quality gates.

## Review notes and completion

Mark/sound controls are added by FE-V1-011. Notes/deletion stay on detail; no bulk/global controls. Do not ship frontend-only fake sorting or counts.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.

## Interview refinements

Carrier filters require Apply filters. Invalid URL values stay visible
and block shipment requests until staff correct or explicitly clear them. Creation
and detail links open labeled placeholders retaining the list return URL; full
creation/detail remain FE-V1-007/008. MUI X Data Grid Community 9.15.0 is installed.

The later product revision removes lookup-outcome and all date filter controls;
removed URL fields remain invalid and explicitly clearable.
Render MUI shipment cards below 900px with the same data, URL state and commands;
replace the tab strip with a full-width Shipment view selector and show card commands
as stacked full-width touch-friendly buttons instead of an overflow menu.
Add Pickup and Delivery date fields to desktop/mobile results; Delivery is the
concise label for the carrier's estimated-delivery date. Give generated SVG/ICO
favicons an opaque white background while preserving official source assets.
