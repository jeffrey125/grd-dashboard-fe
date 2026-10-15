# FE-V1-010: Build the problem-first operational homepage

## Status

Not started. Depends on FE-V1-009 and BE-V1-004.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Make / an actionable operational homepage using backend aggregates, with problems more prominent than upcoming deliveries.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [branding.md](../branding.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Render summary cards from server counts, followed by Needs attention as the primary panel, then Upcoming deliveries and Recent tracking changes.
- Use the backend's asOf, timezone, upcoming window, bounded items, and totals; avoid deriving aggregates from loaded shipment pages.
- Link cards and view-all actions to matching query-aware shipment tabs/filters; link recent changes to dedicated history.
- Show clear distinction between failed tracking and late delivery, current completed count and daily delivery metrics.
- Refresh silently through shared live synchronization, with honest loading/empty/error/stale states in both themes and responsive layouts.

## Acceptance criteria

- The homepage is separate from /shipments, problems lead after summary cards, and no performance analytics/charts or unsupported KPIs appear.
- Aggregate and drill-down predicates agree, including undelivered-only upcoming dates and overlapping Attention counts.
- Unknown ETAs are not classified as upcoming; date boundaries use headquarters time with DST and preserve calendar dates.
- Failed aggregate requests do not become fake zeros or remove a visible stale-data warning.
- Tracking-change sound/toasts remain silent on / while live data still refreshes.

## Verification

Run aggregate rendering/drill-down tests and real-backend count/date-window comparisons, plus browser responsive/theme/keyboard and stale/error scenarios. Verify midnight and DST cases with controlled clocks. Run quality gates.

## Review notes and completion

No charting npm dependency is approved or needed. Recent changes are application observations, not a global notification inbox.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
