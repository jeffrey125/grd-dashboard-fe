# Approved decisions

## FE-V1-013 interview and Upcoming restoration (2026-10-17)

Approved through the interview and explicit proceed: reuse installed MUI,
TanStack Query/Router, Axios, React Hook Form/Zod/resolvers and Day.js; backend
uses installed NestJS, Zod and TypeORM/PostgreSQL. No new production dependency.

Carrier list: compact desktop table/mobile cards with name/code, active state,
fetch mode and interval. Details: read-only followed by Edit/Save/Cancel; immutable
code/UUID, exact existing validation and null only for RPM. Confirm disabling on
Save. Preserve drafts on failed/background reads and protect dirty navigation.
Detected conflicts offer Use latest settings or Keep my draft; the latter requires
save confirmation. Submit only baseline-changed fields. A newer read invalidates
an older confirmation. Failed refreshes block saving until recovery. Existing
focus/reconnect and dependent-query invalidation behavior is reused.

Also restore Upcoming deliveries below Needs attention, showing five earliest
undelivered shipments from New York today through day +6 and the matching View all
destination. Restore backend aggregate/window and ETA/undelivered search filters,
with explicit frontend Apply controls. This supersedes FE-V1-010's earlier decision
to omit Upcoming. Recent tracking changes stays omitted. This is a read-model
restoration; no database migration or new provider calls are needed.

## Product and pages

| Decision       | Approved outcome                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Scope          | Rebuild the original shipment workflow against the new backend; use Tom for layout patterns.              |
| Homepage       | Separate operational overview at `/`, problems first; performance analytics deferred.                     |
| Scale          | Plan for 1,000–10,000 retained shipments, including completed records.                                    |
| List behavior  | Backend pagination, search, filtering, counts; newest created first, stable tie-breaker.                  |
| Tabs           | All, Active, Delivered, Needs attention; the latter three partition All and paused Shipments need attention. |
| Filters        | Reference/notes search and carrier.                                                               |
| Creation       | Single inline form above `/shipments`; one request at a time, no bulk import/page.                         |
| Detail         | Dedicated page with Overview and paginated History tabs.                                                  |
| Actions        | Refresh and valid pause/resume in row menus; note editing/deletion on detail page. Per-shipment only.     |
| Administration | Admin-only account list/create/detail and carrier list/detail settings pages.                             |
| Auth           | Existing employee-cookie contract, including mandatory password replacement.                              |
| Alerts         | Tracking-change toasts and optional sound only on exact `/shipments`, regardless of tab/page.             |
| Review         | Changed highlights remain until reviewed; mark-seen control; per-account browser storage, no device sync. |
| Themes         | Light/dark, system default, persisted explicit preference.                                                |
| Branding       | GRD official website colors and logo; vector globe/GRD favicon and multi-size ICO fallback.               |
| Timezone       | Headquarters timezone, `America/New_York`; preserve carrier calendar dates unchanged.                     |
| Delivery       | Manual LAN-only Docker Compose deployment at `https://192.168.100.83`; public hosting and automated publishing/deployment remain deferred. |

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
- List/history pages default to 25 rows, with 25/50/100 options; the server caps at 100. Overview lists show at most 5 items and link to the full filtered list.
- Shipment list filtering remains in explicit MUI controls and TanStack Router URL
  state rather than MUI X's built-in filter panel. The Data Grid receives already
  filtered server pages; this keeps simultaneous v1 filters within the Community tier.
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
Carrier filters require **Apply filters**; reference/notes
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

## FE-V1-007 interview decisions

Approved on 2026-10-16 and refined by the user: use installed React Hook Form,
Zod/resolvers, MUI, TanStack Query/Router and Axios with no new dependency. Create
exactly one shipment from a compact inline form above `/shipments`; remove the
dedicated creation route and all bulk/import behavior. The first carrier requires
explicit selection. Identity follows backend trimming and case-sensitive reference
rules.

Already-saved shipments return immediately as `existing` while preserving their
notes/status. Lock editing during submission and retain input after failures.
Success stays in the current list view, clears only
reference/notes, retains carrier selection, invalidates list/overview data, and
shows outcome-specific feedback. Search, filter, tab, sort, and pagination URL
updates preserve scroll position.

## FE-V1-008 interview decisions

Approved on 2026-10-16: use installed MUI, TanStack Router/Query, React Hook Form,
Zod/resolvers, Axios and Day.js; no new production dependency. Implement the
dedicated Overview detail page with a non-sticky identity/action header and
separate Tracking, Monitoring, Latest lookup & run, and Notes sections. Stack
sections/actions on mobile. History stays absent until FE-V1-009.

Keep Refresh visible with a disabled explanation when unavailable. Show Pause or
Resume only for valid transitions; explain threshold pause and terminal delivery.
Use a standard delete dialog identifying carrier/reference, without typed-reference
entry. If notes are dirty, that same dialog discloses their loss. Delete returns
to the validated originating list URL, with `/shipments` as the direct-link fallback.

Notes use explicit Edit/Save/Cancel, normalized dirty comparison and null clearing.
Protect internal navigation with a MUI dialog and reload/tab-close with the native
browser warning. Session loss discards transient drafts. Live reads preserve dirty
drafts; a changed server note is shown alongside the draft with Use latest note or
Save my draft anyway. This is best-effort detection: the existing backend has no
conditional-save token, and no backend locking feature is introduced here.

Keep the exact accepted manual run as Your refresh in page memory, separately from
a newer Latest run; merge labels when IDs match. Reload starts from the backend's
latest run. Live events refetch displayed runs, with 15-second visible-page fallback
polling only while queued/running; terminal and inaccessible runs stop polling.
Mutation responses trigger authoritative reads instead of replacing newer cached
shipment projections. Tracking-change audio/toasts and reviewed highlights remain
FE-V1-011; user-action notifications remain available.

## FE-V1-009 interview decisions

Approved through the ticket interview: full responsive snapshot cards, showing
public IDs, normalized status/date fields and New York recorded timestamps.
Show differences only against an adjacent older snapshot in the same response;
no extra boundary request. Identify the initial observation using the response's
total and position. History is the application's observations, without invented
unchanged polls or failed-lookup entries.

Reuse installed MUI, TanStack Router/Query, Axios, Zod and Day.js. Five-field
comparison is feature-local logic; no new dependency or generic diff package.
URL state owns tab/page/pageSize, with 25/50/100 options. Preserve the current
page and scroll on live updates and display a quiet update notice; offset reads
may shift records between pages. Dirty notes require discard confirmation before
switching to History. The accepted manual run stays above both tabs, without
duplicating the same run in Overview. Existing live coordination handles
coalescing, trailing reads and deletion; terminal displayed runs also invalidate
history for missed-event recovery.

## FE-V1-010 interview decisions

Approved through the ticket interview, then revised by the user: four server-count
cards followed by Needs attention. Upcoming deliveries and Recent tracking changes
are not shown. Use the installed MUI, TanStack Query/Router,
Axios, Zod and Day.js; no new dependency. Query's built-in interval refreshes every
60 seconds while visible, alongside shared live synchronization and its existing
age-aware focus refresh. No midnight timer or tracking-change alert is added.

Retain known data and a warning through unsuccessful refreshes and in-flight
retries; only a successful read clears the local warning. Use server `asOf`,
timezone and totals. Overview detail links return to `/`; list-origin links retain
their filtered list.

## FE-V1-011 interview decisions

Approved through the ticket interview: tracking toasts/audio remain restricted to
exact `/shipments`, including background browser tabs, every shipment view and
off-page/filtered-out updates. Coordinate one sound across eligible tabs; each
eligible tab may show its own bounded summary. Group bursts for two seconds.
Only visible detail pages automatically acknowledge the actual revision displayed;
background detail pages do not mark changes reviewed. Manual acknowledgement covers
the current results page, including rows requiring scrolling, not other pages.

Reuse installed React, MUI, TanStack Query/Router, Zod and `broadcast-channel`, with
native browser audio, local storage and Web Locks. Application-specific pending
revision/CAS logic is approved; no new dependency is needed. The project owner
approved reuse of the original `kieffy-meow.m4a`; provenance/hash are recorded in
`public/sounds/README.md`. Sound defaults off. Saved consent survives reload, but
browser playback permission still applies; denial disarms the tab until explicit
retry, without repeated automatic playback errors.

Retain at most 10,000 shipment review records per account. Evict reviewed records
before unseen ones; unseen records do not automatically expire. Warn at capacity.
Bound each shipment to 32 unresolved identities and the sound-claim ledger to 256
snapshot UUIDs. Serialized storage is capped at four million characters. Storage
or lock failures retain in-memory review state with a warning; sound pauses when
durable cross-tab coordination is unavailable. Reload can lose memory-only changes.

## FE-V1-012 interview decisions

Approved through the ticket interview: all account pages/actions remain Admin-only.
Details start read-only with Edit/Save/Cancel for first name, last name and role.
Email is disabled after creation in this frontend. Role changes, activation/
deactivation and Admin password resets require target/effect confirmation.
Self-demotion/deactivation remain unavailable; the current Admin uses the existing
Change password page. Retain all implemented password/session revocation policies.
No concurrent-edit warning or save blocking is wanted. Preserve local drafts,
send only changed profile fields, and retain the API's last-write-wins limitation.

The user explicitly required Better Auth. Reuse its installed session adapter and
refresh own-profile edits through it, with the existing cross-tab invalidation.
Use installed MUI/Data Grid, React Hook Form/Zod/resolvers, TanStack Query/Router,
Axios and Day.js. Admin operations use the implemented GRD account endpoints;
do not install a Better Auth Admin plugin or call nonexistent generic Admin routes.
No new dependency is needed. Credential-bearing mutations use local async/form
state rather than Query's mutation cache; account reads remain Query-owned.

## FE-V1-014 interview decisions

Approved on 2026-10-17: deploy the complete dashboard on `debian-vm` for LAN-only
IP access at `https://192.168.100.83`. Use Docker Compose with exact official
PostgreSQL and Caddy images; add no npm production dependency. Build frontend and
backend images locally, save and transfer an image archive, and copy a generated
mode-600 environment file to `/home/jeff/app/grd-dashboard`.

Use a fresh PostgreSQL database; do not migrate the Raspberry Pi SQLite data.
Caddy belongs in the Compose stack and terminates HTTPS with its internal CA. The
frontend and API use one origin, API port 3000 and PostgreSQL remain unpublished,
and the exported CA certificate must be trusted on each client. The first start
runs PostgreSQL, migrations, one API and Caddy/frontend. Keep the worker stopped
until an Admin is bootstrapped and carrier settings/credentials are confirmed,
then start exactly one worker through its explicit profile. Backups and deployments
are manual; no backup sidecar, registry or deployment workflow is authorized.

On 2026-10-17 the user also approved an explicit HTTP-only Compose override for a
trusted isolated LAN. It uses a separate Caddyfile, publishes only port 80, sets
the API to development cookie mode, and is opt-in through `--scheme http`; HTTPS
and the internal-CA flow remain the default and recommended deployment.
