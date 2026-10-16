# FE-V1-010: Build the problem-first operational homepage

## Status

Implemented and locally verified.
FE-V1-009 and BE-V1-004 prerequisites were checked against their implementation;
the real overview API and its PostgreSQL tests were exercised locally.
See the [implementation summary](../implementation-summary/FE-V1-010-implementation-summary.md).

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Make / an actionable operational homepage using backend aggregates, led by problems requiring attention.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [branding.md](../branding.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Render four summary cards from server counts followed by Needs attention and Upcoming deliveries; omit Recent tracking changes.
- Use the backend's asOf, timezone, bounded attention items, and totals; avoid deriving aggregates from loaded shipment pages.
- Link cards and the Needs attention view-all action to matching shipment views.
- Upcoming restoration approved on 2026-10-17: five earliest undelivered shipments
  due today through day +6 in New York, with a matching View all filtered destination.
  See the [restoration summary](../implementation-summary/FE-V1-010-upcoming-restoration.md).
- Show clear distinction between failed tracking and late delivery, current completed count and daily delivery metrics.
- Refresh silently through shared live synchronization, with honest loading/empty/error/stale states in both themes and responsive layouts.

## Acceptance criteria

- The homepage is separate from /shipments, problems lead after summary cards, and no performance analytics/charts or unsupported KPIs appear.
- Aggregate and drill-down predicates agree for partitioned Attention counts.
- Failed aggregate requests do not become fake zeros or remove a visible stale-data warning.
- Tracking-change sound/toasts remain silent on / while live data still refreshes.

## Verification

Run aggregate rendering/drill-down tests and real-backend count comparisons, plus browser responsive/theme/keyboard and stale/error scenarios. Run quality gates.

## Review notes and completion

No charting npm dependency is approved or needed. Recent changes are application observations, not a global notification inbox.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
