# BE-V1-002: Add paginated shipment search, filters, and tab counts

## Status

Not started. Depends on BE-V1-001.

## Target repository

`/home/jeff/apps/grd-dashboard/grd-dashboard-be`. Read its AGENTS.md, README, and
applicable module instructions before implementation. This ticket lives in the
frontend planning repository; no backend code was changed when it was written.

## Objective

Support 1,000–10,000 retained shipments with full-dataset queries and deterministic newest-created-first results.

## Required reading

- [API contracts](../api-contracts.md), especially this ticket's proposed section.
- [Decisions](../decisions.md), [verification](../verification.md), and
  [source evidence](../source-evidence.md).
- Backend `docs/v1/frontend-handoff.md`, `docs/v1/auth-api.md`,
  `docs/v1/database-schema.md`, and the relevant existing module/tests.

## Scope

- Implement proposed GET /shipments/search, registered before the UUID route, while preserving existing GET /shipments.
- Validate tab, literal reference/notes search, carrier UUID, latest completed outcome, created-date range, estimated-date range, pagination, and allowlisted sort fields/direction. Support the overview's undelivered-only drill-down.
- Implement Active default and SQL created_at DESC with stable internal tie-breaker. Apply search/filter/sort before LIMIT/OFFSET; define null ordering.
- Return total plus overlapping tabCounts under all non-tab filters from the same database read snapshot as items. Exclude soft-deleted shipments but retain existing shipments of disabled carriers.
- Use the exact attention predicate and business-timezone date bounds. Inspect query plans and add justified indexes through migrations; update schema/query documentation.

## Acceptance criteria

- Empty URL query defaults to Active/page 1/25/newest created; ties stay deterministic. All five tabs and approved filters work together.
- Search preserves literal leading zeros/case in stored references; case-insensitive substring matching does not interpret SQL wildcard input as unintended wildcards.
- Created ranges respect America/New_York DST boundaries. ETA ranges compare date-only fields and exclude missing ETA; reversed/invalid ranges and unknown fields return safe 400s.
- Counts use the same filters as items except selected tab; Attention overlaps Active/Paused without double-counted aggregate claims. Never checked means no completed lookup, including pending-first-run cases.
- Page size is capped, malformed page/sort input is rejected, and out-of-range pages return empty items with accurate total. Legacy array consumers and UUID detail routes remain compatible.
- Representative 10,000-shipment fixtures prove whole-dataset results, bounded response sizes, stable ties, and no N+1 queries; record measured query plans rather than inventing a latency guarantee.

## Verification

Run backend gates plus disposable-PostgreSQL query/integration and HTTP authorization/validation tests. Exercise every filter individually, representative combinations, duplicate timestamps, concurrent state changes, DST, null ETAs, and old/new route compatibility.

## Review notes and completion

Only public allowlisted fields may drive SQL ordering. Internal tie-breaker IDs stay private. No client-side pagination workaround or production data fixture is acceptable.

Follow the backend's handoff/commit instructions. Record implementation and exact
verification evidence in a ticket summary, and update this plan's API contract and
status only when the backend change is actually available. Deployment is deferred.
