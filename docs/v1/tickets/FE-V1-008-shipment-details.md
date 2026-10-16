# FE-V1-008: Build shipment details, notes, and monitoring actions

## Status

Implemented, locally verified and committed on `feature/dashboard-v1`. FE-V1-006 and
BE-V1-001 prerequisites were verified against source and existing test evidence.
See the [implementation summary](../implementation-summary/FE-V1-008-implementation-summary.md)
for exact checks and verification limits.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Provide a dedicated, shareable shipment page that clearly separates tracking state, monitoring state, and lookup progress.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Implement /shipments/$shipmentId with a persistent, non-sticky identity/action header and Overview content. History navigation remains absent until FE-V1-009. Preserve the originating list URL or fall back to default /shipments.
- Render current normalized tracking, partial date/status fields, snapshot recorded time, last attempt/next check, latest completed lookup, and latest/explicitly requested run information.
- Reuse shared per-shipment refresh/pause/resume mutations and show queued/running/terminal distinctions. Poll/refetch only displayed runs as justified by SSE recovery; stop terminal work.
- Implement editable notes with save/cancel, null clearing, dirty-navigation protection, and live-refresh isolation from drafts.
- Implement reference-specific soft-delete confirmation and list redirect; validate external verification links and handle concurrent deletion/404.

## Acceptance criteria

- Public UUID direct links work, static new routes are not mistaken for UUIDs, and missing/deleted records have an honest recovery screen.
- Known tracking remains visible after technical failure; monitoring Active is never labeled as carrier In transit, and run success is never labeled delivery.
- Note drafts survive background refresh, blank clearing sends null, and successful actions update caches/toasts without losing newer server changes.
- Pause/resume/refresh availability follows the actual backend rules; a duplicate accepted refresh may reuse a run or return already-terminal state.
- Delete confirmation names the shipment, soft-delete success returns to the list, and there is no unsupported restore or carrier/reference-edit action.

## Verification

Run detail/mutation/dirty-form tests, real-backend manual/threshold/terminal/disabled/failed/coalesced-run scenarios, concurrent deletion, and Playwright direct-link/back navigation. Test safe external links and unknown diagnostics. Run quality gates.

## Review notes and completion

History is intentionally a separate ticket. Tracking-change audio/toasts do not fire on detail routes; action feedback does.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
