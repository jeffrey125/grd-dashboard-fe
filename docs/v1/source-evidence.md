# Source evidence

Inspected on 2026-10-15. These sources inform the plan; their instructions are not
blindly copied into this repository. User-approved rebuild decisions supersede
reference-project conventions.

## Backend

Root: `/home/jeff/apps/grd-dashboard/grd-dashboard-be`.

| Source                                                                                                                                                                                       | Finding used                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`docs/v1/frontend-handoff.md`](../../../grd-dashboard-be/docs/v1/frontend-handoff.md)                                                                                                       | Browser/API contract and explicit missing snapshot/history/query/overview capabilities.                              |
| [`docs/v1/auth-api.md`](../../../grd-dashboard-be/docs/v1/auth-api.md)                                                                                                                       | Session facade, Staff/Admin policies, password replacement, account validation.                                      |
| [`src/modules/shipments/shipments.schemas.ts`](../../../grd-dashboard-be/src/modules/shipments/shipments.schemas.ts)                                                                         | Current response projection excludes tracking data; strict Zod input rules.                                          |
| [`src/modules/shipments/typeorm-shipments.repository.ts`](../../../grd-dashboard-be/src/modules/shipments/typeorm-shipments.repository.ts)                                                   | Array list ordered created-time/ID descending, safe projection, atomic creation and monitoring transitions.          |
| [`src/modules/tracking/shipment-tracking-snapshot.entity.ts`](../../../grd-dashboard-be/src/modules/tracking/shipment-tracking-snapshot.entity.ts)                                           | Normalized fields are stored; snapshot has an internal bigint identity, no public UUID yet.                          |
| [`src/modules/tracking/typeorm-tracking-http.repository.ts`](../../../grd-dashboard-be/src/modules/tracking/typeorm-tracking-http.repository.ts)                                             | Refresh coalescing and current run/attempt response shape.                                                           |
| [`src/modules/tracking/tracking.service.ts`](../../../grd-dashboard-be/src/modules/tracking/tracking.service.ts)                                                                             | Existing outcome/snapshot lifecycle and worker invariants to preserve.                                               |
| [`src/modules/events/events.controller.ts`](../../../grd-dashboard-be/src/modules/events/events.controller.ts)                                                                               | Session validation, heartbeat, bounded event handling, current external-ID-only serializer.                          |
| [`src/modules/events/events.source.ts`](../../../grd-dashboard-be/src/modules/events/events.source.ts)                                                                                       | Current accepted named change-event types.                                                                           |
| [`src/infrastructure/database/migrations/1792195200000-TrackingEvents.ts`](../../../grd-dashboard-be/src/infrastructure/database/migrations/1792195200000-TrackingEvents.ts)                 | Generic DB notifications fire on Shipment inserts/updates, including nontracking changes.                            |
| [`docs/v1/tracking-source-data-policy.md`](../../../grd-dashboard-be/docs/v1/tracking-source-data-policy.md)                                                                                 | Sanitized source data is separate from normalized snapshots; no diagnostics endpoint/retention expansion is implied. |
| [`docs/v1/tickets/V1-008-shipments-module.md`](../../../grd-dashboard-be/docs/v1/tickets/V1-008-shipments-module.md) and [ticket index](../../../grd-dashboard-be/docs/v1/tickets/README.md) | Ticket headings, dependencies, acceptance/verification pattern.                                                      |

Backend package.json pins Zod 4.6.6 at inspection time. This is evidence of the
validation approach, not an instruction to install that exact version blindly.

## Reference UIs

Tom root: `/home/jeff/apps/tom-automation-ui` (the requested `/apps/...` shorthand
resolved here). Inspected `package.json`, `AGENTS.md`, `src/components/layout/app-layout.tsx`,
`src/components/ui/sonner.tsx`, `src/components/layout/brand-logo.tsx`,
`playwright.config.ts`, `biome.json`, `knip.json`, and `.github/workflows/ci-cd.yml`.

Reuse: feature-based boundaries, thin route composition, shared primitives,
sidebar/mobile drawer, theme controls, role-aware navigation, Sonner presentation,
behavior tests, deterministic quality gates, and secret scanning.

Adapt: Bun tooling to approved Vite/pnpm/Vitest; replace Hotel Rates Direct assets,
domains, feature names, and auth assumptions. Omit Tom's GHCR, Docker delivery,
SSH/DigitalOcean deployment, and production-env syncing. Its AGENTS.md includes
legacy HRD examples and Bun-only rules that do not apply here.

Original root:
`/home/jeff/apps/shipment-monitoring/robin-monitoring-automation-ui`.
Inspected `package.json`, `CLAUDE.md`, `src/App.tsx`, shipment forms/schemas, and
relevant source/test references. Preserve useful batch/notes/duplicate behavior,
tracking dates/statuses, change highlights, and optional sound. Replace its old
protocol, updated-time sort, scheduler controls, monolithic App organization, and
proxy assumptions with the approved new contracts. Reuse sound only after checking
the actual asset and its provenance; no audio asset was copied by this milestone.

## Website and timezone

- [Official GRD website](https://www.globalresourcesdirect.com/): logo, favicon,
  rendered typography and CSS colors. See [branding.md](branding.md) for exact
  URLs, transformations, and hashes.
- [GRD company profile](https://www.linkedin.com/company/global-resources-direct-llc/)
  identifies headquarters as St. Petersburg, Florida.
- [GRD privacy policy](https://www.globalresourcesdirect.com/privacy-policy/)
  identifies the company address in St. Petersburg, Florida. The location supports
  the selected US Eastern business timezone `America/New_York`, with DST rather
  than a fixed UTC offset. The earlier interview suggestion of US Central was
  superseded after checking headquarters.

## Library references consulted

- [Vite setup](https://vite.dev/guide/) and [static builds](https://vite.dev/guide/build).
- [shadcn installation](https://ui.shadcn.com/docs/installation),
  [Sonner](https://sonner.emilkowal.ski/), and
  [React Hook Form resolvers](https://github.com/react-hook-form/resolvers).
- [TanStack Router URL state](https://tanstack.com/router/latest/docs/guide/search-params),
  [Query pagination](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries),
  [Table server processing](https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side).
- [Axios configuration](https://axios-http.com/docs/req_config),
  [Vitest](https://vitest.dev/guide/),
  [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/),
  [Playwright](https://playwright.dev/docs/intro), and [Biome](https://biomejs.dev/).

Current shadcn navigation offers multiple primitive implementations and its old
Sonner documentation URL redirects to a different Toast page. Preserve the explicit
Radix + Sonner choices; do not accidentally adopt Base UI or another toast system
by following an unqualified latest CLI/default link. Check the actual generated
imports and compatible setup at implementation time.
