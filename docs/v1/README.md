# Frontend v1 plan

## Status and scope

Approved through the planning interview on 2026-10-15. This milestone creates the
plan, tickets, project agent instructions, and brand assets. That planning
milestone did not implement the dashboard or modify the backend. FE-V1-001 is now
implemented, locally verified, and committed on `feature/dashboard-v1`. See its
[implementation summary](implementation-summary/FE-V1-001-implementation-summary.md)
for evidence. The other 18 tickets remain **Not started** in this plan.

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

The current API does not expose normalized tracking snapshots, history, latest
lookup by shipment, paginated shipment queries, or dashboard aggregates. Its
generic shipment events do not distinguish tracking changes from notes/scheduling
updates. Five backend prerequisite tickets address these gaps in the sibling repo.

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
