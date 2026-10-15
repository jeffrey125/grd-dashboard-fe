# Planning milestone change manifest

All files below are new files created for the requested rebuild-planning task.
The brand assets were acquired during the interview; the documents and agent
instructions were written after final plan approval. No unrelated user changes
were included, and no application/backend implementation or dependency install
is part of this milestone.

## Brand assets

| File                                                                                   | Purpose                                                           |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`public/brand/grd-logo.svg`](../../public/brand/grd-logo.svg)                         | Preserve the official full vector logo.                           |
| [`public/brand/grd-original-favicon.ico`](../../public/brand/grd-original-favicon.ico) | Preserve the original 16×16 website favicon as source evidence.   |
| [`public/favicon.svg`](../../public/favicon.svg)                                       | Frame the official globe/GRD vector as an app favicon.            |
| [`public/favicon.ico`](../../public/favicon.ico)                                       | Provide a six-resolution fallback derived from the vector source. |

## Plan and project guidance

| File                                               | Purpose                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`README.md`](../../README.md)                     | Repository entry point and honest current scaffold status.                           |
| [`AGENTS.md`](../../AGENTS.md)                     | Focused project instructions and conditional pointers to detailed guidance.          |
| [`docs/v1/README.md`](README.md)                   | Reading order, delivery boundaries, and backend prerequisite status.                 |
| [`docs/v1/decisions.md`](decisions.md)             | Approved interview decisions, dependencies, and labeled implementation defaults.     |
| [`docs/v1/architecture.md`](architecture.md)       | Feature boundaries, state ownership, transport/auth/live-update composition.         |
| [`docs/v1/ui-spec.md`](ui-spec.md)                 | All pages, transitions, filtering, Admin workflows, alerts, review state, and dates. |
| [`docs/v1/api-contracts.md`](api-contracts.md)     | Existing API constraints and concrete proposed backend additions.                    |
| [`docs/v1/branding.md`](branding.md)               | Official source URLs/hashes, favicon derivation, palette, and theme rules.           |
| [`docs/v1/verification.md`](verification.md)       | CI adaptation, acceptance matrix, and real-backend verification requirements.        |
| [`docs/v1/source-evidence.md`](source-evidence.md) | Inspected source references, useful patterns, and superseded reference assumptions.  |
| [`docs/v1/agent-workflow.md`](agent-workflow.md)   | Required handoff, commit approval, full-stack server, and SemVer tag rules.          |
| [`docs/v1/change-manifest.md`](change-manifest.md) | Complete review inventory and proposed single-purpose commit groups.                 |

## Tickets

| File                                                                                     | Purpose                                                               |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`docs/v1/tickets/README.md`](tickets/README.md)                                         | Index, dependency graph, execution order, and shared completion rule. |
| [`BE-V1-001-tracking-read-projection.md`](tickets/BE-V1-001-tracking-read-projection.md) | Current snapshot/latest lookup/latest run and public snapshot UUIDs.  |
| [`BE-V1-002-shipment-search.md`](tickets/BE-V1-002-shipment-search.md)                   | Additive server pagination/filter/sort/counts.                        |
| [`BE-V1-003-tracking-history.md`](tickets/BE-V1-003-tracking-history.md)                 | Separate paginated normalized-history read API.                       |
| [`BE-V1-004-overview-aggregates.md`](tickets/BE-V1-004-overview-aggregates.md)           | Consistent operational totals and bounded panels.                     |
| [`BE-V1-005-tracking-change-events.md`](tickets/BE-V1-005-tracking-change-events.md)     | Precise transactional tracking-change SSE signal.                     |
| [`FE-V1-001-scaffold.md`](tickets/FE-V1-001-scaffold.md)                                 | Approved React/TypeScript/Vite/pnpm foundation.                       |
| [`FE-V1-002-quality-and-ci.md`](tickets/FE-V1-002-quality-and-ci.md)                     | Approved quality tools, hooks, CI, and smoke-test setup.              |
| [`FE-V1-003-branded-shell.md`](tickets/FE-V1-003-branded-shell.md)                       | Responsive GRD shell, theme modes, favicon, and toast host.           |
| [`FE-V1-004-api-and-auth.md`](tickets/FE-V1-004-api-and-auth.md)                         | Axios and employee session/replacement/role lifecycle.                |
| [`FE-V1-005-live-synchronization.md`](tickets/FE-V1-005-live-synchronization.md)         | Single SSE connection and event/fetch-race reconciliation.            |
| [`FE-V1-006-shipment-list.md`](tickets/FE-V1-006-shipment-list.md)                       | Active-default tabbed server-driven table and quick actions.          |
| [`FE-V1-007-create-shipments.md`](tickets/FE-V1-007-create-shipments.md)                 | Dedicated atomic batch form and list redirect.                        |
| [`FE-V1-008-shipment-details.md`](tickets/FE-V1-008-shipment-details.md)                 | Dedicated Overview page, notes, run status, and actions.              |
| [`FE-V1-009-shipment-history.md`](tickets/FE-V1-009-shipment-history.md)                 | Separate History tab and pagination.                                  |
| [`FE-V1-010-overview-homepage.md`](tickets/FE-V1-010-overview-homepage.md)               | Problem-first homepage and matching drill-downs.                      |
| [`FE-V1-011-alerts-and-review.md`](tickets/FE-V1-011-alerts-and-review.md)               | Route-scoped audio/toasts and account-local reviewed highlights.      |
| [`FE-V1-012-account-administration.md`](tickets/FE-V1-012-account-administration.md)     | Dedicated account list/create/detail and sensitive actions.           |
| [`FE-V1-013-carrier-administration.md`](tickets/FE-V1-013-carrier-administration.md)     | Dedicated carrier list/settings with dependency invalidation.         |
| [`FE-V1-014-integration-readiness.md`](tickets/FE-V1-014-integration-readiness.md)       | Real-backend acceptance and running local handoff.                    |

## Proposed commits — not executed

| Order / exact message                                                | Files                                                            | Behavioral summary                                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `chore(branding): add GRD logo and sharp favicons`                | The four files under Brand assets above.                         | Official assets plus approved vector framing and multi-resolution favicon.                                                             |
| 2. `docs(plan): define frontend v1 scope and implementation tickets` | Root README and all `docs/v1/` files except `agent-workflow.md`. | Approved product/library decisions, proposed API prerequisites, page/architecture/verification specs, 19 tickets and review inventory. |
| 3. `docs(agents): add frontend implementation and handoff guidance`  | Root AGENTS.md and `docs/v1/agent-workflow.md`.                  | Project conventions, context pointers, dependency/commit approval, required handoff, server checks, and release tags.                  |

These commits form one initial documentation delivery; cross-links between the
plan and agent guidance resolve once the complete series is applied. Final user
approval is required before staging/committing. No commit, branch rename, push,
merge, or tag has been performed as part of writing this manifest.
