# Approved decisions

## Product and pages

| Decision       | Approved outcome                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Scope          | Rebuild the original shipment workflow against the new backend; use Tom for layout patterns.              |
| Homepage       | Separate operational overview at `/`, problems first; performance analytics deferred.                     |
| Scale          | Plan for 1,000–10,000 retained shipments, including completed records.                                    |
| List behavior  | Backend pagination, search, filtering, counts; newest created first, stable tie-breaker.                  |
| Tabs           | All shipments, Active, Paused, Delivered, Needs attention; Active is the default.                         |
| Filters        | Reference/notes search, carrier, latest lookup outcome, created range, estimated-delivery range.          |
| Creation       | Dedicated page, 1–10 rows, atomic validation, return to list after success.                               |
| Detail         | Dedicated page with Overview and paginated History tabs.                                                  |
| Actions        | Refresh and valid pause/resume in row menus; note editing/deletion on detail page. Per-shipment only.     |
| Administration | Admin-only account list/create/detail and carrier list/detail settings pages.                             |
| Auth           | Existing employee-cookie contract, including mandatory password replacement.                              |
| Alerts         | Tracking-change toasts and optional sound only on exact `/shipments`, regardless of tab/page.             |
| Review         | Changed highlights remain until reviewed; mark-seen control; per-account browser storage, no device sync. |
| Themes         | Light/dark, system default, persisted explicit preference.                                                |
| Branding       | GRD official website colors and logo; vector globe/GRD favicon and multi-size ICO fallback.               |
| Timezone       | Headquarters timezone, `America/New_York`; preserve carrier calendar dates unchanged.                     |
| Deferred       | Analytics, global controls, production publishing, hosting, and deployment.                               |

## Approved libraries and tools

| Concern              | Choice and reason                                                                 |
| -------------------- | --------------------------------------------------------------------------------- |
| Foundation           | React + TypeScript + Vite; separate frontend with static build output.            |
| Package manager      | pnpm, consistent with the backend.                                                |
| UI                   | Tailwind CSS + shadcn/ui using Radix primitives, matching Tom's approach.         |
| Routing              | TanStack Router; typed routes and URL-owned list state.                           |
| Server state         | TanStack Query; requests, caching, mutations, invalidation.                       |
| Tables               | TanStack Table with backend sorting/filtering/pagination and shadcn presentation. |
| HTTP                 | Axios, explicitly selected over native fetch; credentialed requests.              |
| Toasts               | Sonner, matching Tom; action feedback and grouped tracking notifications.         |
| Forms                | React Hook Form + Zod + `@hookform/resolvers`.                                    |
| Validation boundary  | Separate frontend schemas aligned with the backend; no shared package initially.  |
| Formatting/lint      | Biome.                                                                            |
| Unit/component tests | Vitest + React Testing Library + jsdom.                                           |
| Browser tests        | Playwright.                                                                       |
| Dead-code checks     | Knip.                                                                             |
| Commit hooks         | Husky + lint-staged.                                                              |
| CI reference         | Tom's quality and secret-scanning patterns, adapted to pnpm/Vite.                 |

These approvals persist for this rebuild. Choose compatible maintained stable
versions at scaffolding, inspect peer/engine requirements, pin the runtime and
package-manager versions, and commit the lockfile. Do not copy Tom's versions or
its `latest` dependency declarations without checking compatibility.

Supporting shadcn packages and test adapters must be enumerated in the scaffold
dependency review. Their necessity does not silently authorize unrelated packages.
No Zustand, charting library, Better Auth browser client, date library, font npm
package, or icon npm package has been independently approved. Ask before adding
one; an existing approved choice does not need another confirmation.

## Implementation defaults within the approved scope

These details are design defaults supplied by this plan, not separate user quotes.
An implementer may refine them with evidence without expanding product scope;
record any material behavior change and obtain direction if it changes user intent.

- Use native EventSource for SSE, React state/context for local preferences, and
  `Intl.DateTimeFormat` for timestamp presentation. These platform mechanisms
  require integration code, not a new state/SSE/date package.
- List/history pages default to 25 rows, with 25/50/100 options; the server caps at 100. Overview lists show at most 10 items and link to the full filtered list.
- Upcoming deliveries means today through the next six calendar days in the
  business timezone; no assumed ETA when a carrier omits it.
- Use an additive paginated search endpoint and preserve the existing array-returning
  shipment list. Proposed API names and fields are specified in api-contracts.md.
- A newly acquired first tracking snapshot is a meaningful live update. Existing
  data loaded on login/navigation/resync is a quiet baseline, not a new alert.
- The existing SSE contract has no replay. Reconnection refreshes authoritative
  data quietly; there is no promise of notifications for disconnected periods.
- Mark-seen applies to displayed highlighted shipments and says so in its label.
  Opening a detail page acknowledges only the snapshot successfully displayed.
- Baseline UI typography uses a readable system stack with Open Sans when locally
  available. Adding a bundled webfont or icons requires the dependency review;
  copying the site's Adobe-hosted heading font is not assumed.

## Explicit differences from the original frontend

The new backend uses UUID routes, cookie sessions, different event names, and no
`/api` prefix. Its worker starts automatically. The old updated-time sorting is
replaced by created-time descending. The old direct proxy, scheduler controls,
auth assumptions, and data response types are not reuse candidates.
