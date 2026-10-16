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
| UI                   | Material UI + Emotion, themed to GRD while retaining Tom's compact shell pattern. |
| Routing              | TanStack Router; typed routes and URL-owned list state.                           |
| Server state         | TanStack Query; requests, caching, mutations, invalidation.                       |
| Tables               | MUI X Data Grid Community with external URL-owned filters and server offset pagination. |
| HTTP                 | Axios, explicitly selected over native fetch; credentialed requests.              |
| Notifications        | Shared MUI Snackbar/Alert queue for action and grouped tracking feedback.          |
| Icons                | Material Icons through `@mui/icons-material`; use direct imports.                  |
| Auth client | Better Auth 1.7.7, explicitly selected in the FE-V1-004 follow-up; an `api.ts` adapter preserves the existing backend facade. |
| Development proxy | Vite built-in `/api/v1` proxy, forwarded unchanged; built assets use the configured API origin plus `/api/v1`. |
| Cross-tab sessions   | `broadcast-channel`, explicitly approved during FE-V1-004; signal invalidation only, never synchronize credentials or cached records. |
| Dates                | Day.js for new date parsing, formatting and arithmetic; MUI X Date Pickers Community with AdapterDayjs for calendar inputs. |
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

The user replaced the earlier Tailwind/shadcn/Radix/Sonner/Lucide and TanStack
Table plan during the FE-V1-003 implementation interview on 2026-10-16. Material
UI core, Emotion, Material Icons, and MUI X Data Grid Community are the approved
replacements. MUI X Pro/Premium is not approved; advanced commercial features
require a separate dependency and license decision. No Zustand, charting library, or font npm package is approved.
The user approved MUI X Date Pickers Community and Day.js on 2026-10-16, and
requested Day.js for future date work. This supersedes the earlier date-library exclusion.
The user subsequently approved the Better Auth client and Vite development proxy
on 2026-10-16; this supersedes the original browser-client exclusion. The final
route decision uses the Nest global `/api/v1` prefix for every backend endpoint,
including health, without legacy aliases. Backend implementation is owned by a
separate session; this repository supplies the versioned frontend integration.

## Implementation defaults within the approved scope

These details are design defaults supplied by this plan, not separate user quotes.
An implementer may refine them with evidence without expanding product scope;
record any material behavior change and obtain direction if it changes user intent.

- Use native EventSource for SSE, React state/context for local preferences, and
  Day.js for new date handling. Use its UTC/timezone plugins for business timestamps
  in `America/New_York`; keep calendar dates as `YYYY-MM-DD` without timezone
  conversion. Validate calendar input before parsing to reject silent rollover.
  Existing unrelated date code can migrate when touched; no wholesale migration is required.
- List/history pages default to 25 rows, with 25/50/100 options; the server caps at 100. Overview lists show at most 10 items and link to the full filtered list.
- Shipment list filtering remains in explicit MUI controls and TanStack Router URL
  state rather than MUI X's built-in filter panel. The Data Grid receives already
  filtered server pages; this keeps simultaneous v1 filters within the Community tier.
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

The new backend uses UUID routes, cookie sessions, and different event names.
The later approved API versioning decision uses `/api/v1`. Its worker starts automatically. The old updated-time sorting is
replaced by created-time descending. The old direct proxy, scheduler controls,
auth assumptions, and data response types are not reuse candidates.

## FE-V1-004 interview decisions

Approved on 2026-10-16: failed logout hides protected content with a persistent
error and Retry until revocation is confirmed. Other open dashboard tabs lock
when logout is requested; successful logout, sign-in, and password replacement
trigger authoritative session rechecks. Use the `broadcast-channel` package,
including its compatibility fallbacks, instead of implementing a custom messaging
fallback. Browser suspension and blocked storage can delay delivery; focus/online
rechecks remain available. Discard transient forms/notifications on session loss.

The ticket uses approved Axios and React Hook Form/Zod/resolvers with TanStack
Query/Router and MUI. FE-V1-004 provides cleanup/recheck interfaces for SSE;
FE-V1-005 opens and synchronizes the actual stream. Administration pages remain
in FE-V1-012/013; the root session boundary enforces role denial on Admin URLs now.

## FE-V1-005 interview decisions

Approved on 2026-10-16: native credentialed EventSource, installed TanStack Query,
Zod and MUI, with feature registration/integration code and no new production
dependency. Consume the implemented `tracking.changed` payload for quiet refreshes
and expose it for FE-V1-011; highlights, audio and tracking toasts remain deferred.

Use one protected-shell stale banner, visible after two seconds of staleness.
Retain data/actions while HTTP confirms the session; use the existing locked
screen if `/auth/me` cannot confirm access. Resync starts authoritative recovery;
successful relevant refreshes complete it. Merge events within 100 ms and retain
one pending follow-up per target during an in-flight fetch. Carrier-dependent
active queries refresh on visible focus when their last successful fetch is at
least 30 seconds old; reconnect and local edits bypass that threshold. This
focus policy does not bound how long externally edited carrier data can be stale.

## FE-V1-006 interview decisions

Approved on 2026-10-16: implement the tabbed list using MUI X Data Grid Community
9.15.0, with installed MUI, TanStack Router/Query, Axios, React Hook Form and Zod.
Carrier, lookup outcome and date filters require **Apply filters**; reference/notes
search remains debounced. Invalid bookmarked URL values remain editable and block
shipment requests until staff correct or explicitly clear them. Valid filters are
not silently dropped. Draft filters survive live refreshes and search changes.

Creation and detail remain FE-V1-007/008. Their routes now provide clearly labeled
placeholders and a validated return link retaining the originating list URL.
No mark-seen, highlights, tracking-change toasts or sound is added in this ticket.

Use TanStack Router's scalar search parsing/serialization helpers to preserve
literal tracking references, including long numbers, and readable pagination URLs.
The follow-up uses MUI X Date Pickers Community 9.15.0 and Day.js 1.11.23.
Invalid raw URL dates remain in visible error text until explicitly replaced or
cleared; calendar selection remains a draft until Apply filters.
The user also requested a mobile card view. Below the MUI `md` breakpoint (900px),
use installed MUI Cards with the same server pages, URL sorting and shared row
actions; desktop retains the Data Grid. No further dependency is required.
