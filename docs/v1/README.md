# Frontend v1 plan

## Status and scope

Approved through the planning interview on 2026-10-15. This milestone creates the
plan, tickets, project agent instructions, and brand assets. That planning
milestone did not implement the dashboard or modify the backend. FE-V1-001 is now
implemented, locally verified, and committed on `feature/dashboard-v1`. See its
[implementation summary](implementation-summary/FE-V1-001-implementation-summary.md)
for evidence. FE-V1-002 is implemented, locally verified, and committed; GitHub-hosted
execution remains pending. See its
[implementation summary](implementation-summary/FE-V1-002-implementation-summary.md).
FE-V1-003 is implemented and locally verified; its commit remains pending explicit
approval. See its
[implementation summary](implementation-summary/FE-V1-003-implementation-summary.md).
FE-V1-004 is implemented, locally verified, and committed. See its
[implementation summary](implementation-summary/FE-V1-004-implementation-summary.md).
FE-V1-005 is implemented, locally verified, and committed.
See its [implementation summary](implementation-summary/FE-V1-005-implementation-summary.md).
FE-V1-006 is implemented and locally verified; commit approval is pending.
See its [implementation summary](implementation-summary/FE-V1-006-implementation-summary.md).
FE-V1-007 is implemented and locally verified; commit approval is pending.
See its [implementation summary](implementation-summary/FE-V1-007-implementation-summary.md).
FE-V1-008 is implemented, locally verified and committed on `feature/dashboard-v1`.
See its [implementation summary](implementation-summary/FE-V1-008-implementation-summary.md).
FE-V1-009 is implemented with local unit, browser and real-backend verification;
commit approval is pending. See its
[implementation summary](implementation-summary/FE-V1-009-implementation-summary.md).
FE-V1-010 is implemented with local unit, browser and real-backend verification;
see its
[implementation summary](implementation-summary/FE-V1-010-implementation-summary.md).
BE-V1-001 is implemented, locally verified, and committed in the
backend repository; deployment is pending. See its
[summary](../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-001-implementation-summary.md).
BE-V1-002 through BE-V1-005 are also implemented and locally verified;
deployment is pending. The remaining ticket statuses are recorded in their
individual files.

Rebuild shipment-monitoring behavior against the new backend, use Tom's dashboard
layout patterns, and apply GRD branding. The homepage is a separate operational
overview; performance analytics and deployment are deferred.

## Reading order

1. [Decisions](decisions.md): approved scope, libraries, and implementation defaults.
2. [UI specification](ui-spec.md) and [branding](branding.md): pages and behavior.
3. [API contracts](api-contracts.md): implemented API versus proposed additions.
4. [Architecture](architecture.md) and [verification](verification.md).
5. [Ticket index](tickets/README.md): dependency graph and execution order.

[Source evidence](source-evidence.md) records the inspected repositories and
website assets. [Agent workflow](agent-workflow.md) defines handoff, commit, and
release requirements. The [change manifest](change-manifest.md) lists every file
delivered by this planning milestone and its review purpose. Implementation summaries belong in
`docs/v1/implementation-summary/<ticket-id>-implementation-summary.md` when a
ticket is implemented; do not create empty summaries as completion evidence.

## Backend dependencies

BE-V1-001 now exposes normalized current tracking, latest completed lookup and
latest associated run through Shipment responses after its migration. BE-V1-002
now provides authenticated whole-dataset Shipment search, filters, stable offset
pagination and overlapping tab counts. BE-V1-003 now provides paginated normalized
tracking history. BE-V1-004 now provides operational overview aggregates. Precise
tracking-change events are now available through BE-V1-005 alongside the existing
generic Shipment invalidations.

The API shapes in this plan's **proposed** sections are implementation targets,
not a claim that those routes or fields already exist. Backend implementation
must update its response schemas, tests, frontend handoff, and relevant schema docs
before a dependent frontend feature can be accepted against the real API.

## Delivery boundaries

- All frontend planning tickets are stored in this repo's `docs/v1/tickets`.
  `BE-V1-*` tickets execute in the backend; `FE-V1-*` execute here.
- CI is in scope: installation, formatting, linting, types, dead-code checks,
  tests, build, secret scanning, and browser smoke checks.
- No image publishing, deployment workflow, hosting account, production proxy,
  DNS changes, or registry credentials are selected.
- The existing backend authentication and role policies remain authoritative.
  There is no signup, emailed password reset, refresh-all, or scheduler control UI.
- No npm dependencies have been installed by this planning milestone.
