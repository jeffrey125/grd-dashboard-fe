# Frontend architecture

## Planned structure

This is a target structure, not an inventory of implemented files.

```text
src/
  app/                 # Providers, router, runtime configuration, session composition
  routes/              # Thin route guards and page composition
  features/
    auth/              # Pages, sign-in, password replacement, session lifecycle
    overview/          # Page, server aggregates, attention/delivery/change panels
    shipments/         # Pages, list, create, details, tracking history, commands
    tracking-updates/   # Event-to-cache coordination, route alerts, review state
    accounts/          # Admin account management
    carriers/          # Carrier reads and Admin settings
  components/
    layout/            # Shell, sidebar, page header, theme controls
    feedback/          # Shared notification queue and host
  theme/               # GRD Material UI theme and mode persistence
  api/                 # Axios transport and normalized application errors
  lib/                 # Generic dates, storage, configuration helpers
public/
  brand/grd-logo.svg
  brand/grd-original-favicon.ico
  favicon.svg
  favicon.ico
```

Keep feature-specific API functions, schemas, query keys, types, hooks, and tests
with the feature. Create subfolders only as needed; do not scaffold empty layers.
Lower-level `api`, `lib`, and shared components do not import feature internals.
The app layer coordinates session teardown and cross-feature event invalidation
through explicit exports/callbacks to avoid circular dependencies.

Page implementations live under `src/features/<feature>/pages`; route files only
validate route state and compose exported feature pages. Import Material UI
primitives directly. Add a shared module only when it hides meaningful behavior
behind a small interface, such as the shell or notification queue; do not create
pass-through wrappers for ordinary MUI controls.

## State ownership

| State                                                                  | Owner                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Server responses, overview totals, shipments, runs, accounts, carriers | TanStack Query                                                  |
| Shipment tab, search, filters, pagination, sort, detail tab            | TanStack Router URL state                                       |
| Authentication session/profile | Better Auth client, adapted to the existing cookie facade |
| Forms and row validation                                               | React Hook Form + feature Zod schemas                           |
| Dialogs, pending local edits, transient presentation                   | React state/reducer                                             |
| Theme and sound preferences; per-account reviewed revisions            | Versioned browser storage behind a small feature-owned boundary |

Do not duplicate server records in a global client store. Names, notes, passwords,
API response caches, session cookies, and tokens are not persisted to browser
storage. Review-state records contain only the account UUID, shipment UUID,
snapshot UUID, and minimal ordering/expiry metadata. Storage failure must degrade
to in-memory behavior without breaking the dashboard.

## API and authentication

Use one configured Axios client with `withCredentials: true`, the configured API
origin, cancellation support, safe error normalization, and correct 204 handling.
Feature functions own endpoint shapes; Zod validates relevant boundaries. Never
set browser Origin manually or send actor IDs/auth tokens.

Backend requests are centralized in `src/api/api.ts` (Axios) and feature `api.ts`
modules. Auth's `api.ts` uses Better Auth 1.7.7, matching the backend, with its
`customFetchImpl` extension to map `/get-session` to the relative `/auth/me` path and `/sign-in/email`
to `/auth/sign-in`; the transport prefixes every backend request with `/api/v1`. It adapts the public account to a minimal `{ user }` session
view and anonymous 401 to `null`; no session token/metadata is synthesized.
Sign-out/password-change preserve the backend's 204 and revocation policies.
Better Auth owns session storage, subscriptions, visibility/online revalidation,
and cancellation of superseded session fetches. The adapter is deliberately the
only module aware of this compatibility mapping and the library's session atom.

Development calls use `/api/v1`; Vite forwards to `VITE_API_ORIGIN` with the
prefix unchanged. Built assets use `${VITE_API_ORIGIN}/api/v1` directly. Vite's development
proxy does not establish a production reverse-proxy deployment.

Deduplicate `/api/v1/auth/me` rechecks after concurrent auth errors. A 401 closes events,
cancels in-flight requests, clears query data and transient UI, and routes to
sign-in. A business 403 triggers one session recheck to distinguish role denial
from mandatory password replacement. Prevent previous-account responses from
repopulating the next account's cache with cancellation plus a session generation
guard. Do not automatically retry non-idempotent mutations or auth failures.

The implemented auth coordinator exposes `registerCleanup` for live resources
and `recheck` for business/SSE auth failures. App composition recreates transient
UI on session generation changes. Better Auth owns the profile;
the policy snapshot exposes the validated account for access decisions without
adding an auth entry to Query. Cross-tab
`broadcast-channel` messages contain only `lock` or `changed`, never account data.
Failed logout remains locally locked until Retry confirms revocation. FE-V1-005
connects SSE through the app-owned `LiveSession`, outside the generation-keyed
notification/router subtree so login does not reopen a just-created stream.

FE-V1-012 exposes the shared public account schema through auth's feature export.
Its account list/detail records are separate business queries under `accounts`,
with ordinary focus/reconnect refresh (there is no account SSE event). Own-name
edits call `Session.accountChanged()` for an authoritative Better Auth recheck and
the existing cross-tab changed signal. No direct session-atom writes or parallel
session implementation are added. Credential-bearing create/reset submissions use
feature-local async state, keeping passwords out of MutationCache as well as query
data. Successful changes invalidate account queries; dirty drafts are preserved.

## Live coordination

Open one credentialed EventSource per unrestricted authenticated browser app.
Register listeners before initial protected data fetches. Features register
invalidation targets; the app owns the connection and closes it on logout,
restricted session, or unmount. Route changes remove route-specific consumers,
not unrelated application subscriptions.

Generic invalidations refresh authoritative data. Record events arriving during
a request and guarantee a follow-up fetch or cancellation/replacement; merely
deduplicating an in-flight query can otherwise lose the later update. Coalesce
bursts, invalidate page/count/overview caches together, and handle deletion 404s.

The implemented `tracking.changed` event enables accurate alerts for off-page rows.
Its snapshot UUID is identity/deduplication metadata; it does not replace fetching
current data. Gate toast/audio behavior on `pathname === '/shipments'`, ignoring
search parameters. Live data continues updating silently elsewhere.

### Implemented live registration boundary (FE-V1-005)

`features/tracking-updates` exports `liveQuery`, `LiveUpdatesContext`, and the
validated `LiveEvent` type. Feature query options spread `liveQuery({ target })`;
feature modules retain their own query keys, HTTP functions, schemas and UI.
Targets are `shipments` (list/count variants), `overview`, `carriers`, or
`shipment`/`history`/`run` with an `externalId`. No business reads are fabricated
for the existing placeholder pages. FE-V1-006–013 must register their actual queries.

Generic and precise shipment events refresh shipment lists, overview and matching
detail/history queries; run events refresh the matching explicit run, shipment
detail and list queries that display latest-run state (FE-V1-006/008). Run events contain no
shipment IDs, so the coordinator invalidates all detail/list variants and refetches only
active consumers, preserving its existing coalescing and in-flight follow-up rules. Resync
refreshes every registered target, including carriers and displayed explicit runs.
Inactive cached queries are invalidated without background fetching. Use ordinary
enabled Query queries; `staleTime: 'static'` intentionally prevents refetch and
is unsuitable for these live targets. Forward Query's AbortSignal through the
shared API adapter. Router loaders that prefetch protected data must also wait
for session/stream readiness; the current routes have no such loaders.

Events use a 100 ms fixed coalescing window. Each query retains at most one pending
refresh while its current request runs, including its initial fetch. A completed
old response may be displayed transiently, but the pending fetch must settle on
authoritative data. A failed refresh keeps known data and the stale warning;
404 for shipment/detail history clears retained data and keeps the error result
for the feature's missing/deleted screen. An optional active-query `onMissing`
callback supports route-specific recovery; do not capture an obsolete route in
long-lived query options. Consumers of `onEvent` unsubscribe on unmount; session
teardown clears all consumers and timers. FE-V1-011 consumes precise revision events
separately for alerts and review state.

Carrier-dependent queries opt in with `carrierDependent: true`. On visible focus,
registered active carrier targets older than 30 seconds refresh. This is not
polling or a 30-second freshness guarantee. After successful local carrier edits,
call `refreshCarriers()` from the live context; it also invalidates inactive
carrier-dependent caches. Resync bypasses the focus age threshold. The registration
helper disables Query's independent focus/reconnect triggers to avoid duplicates.

The protected shell displays one quiet stale banner after two seconds. Connection
opening alone does not establish synchronization: resync plus successful registered
refreshes clear it. HTTP actions remain usable while the session is confirmed;
failed auth rechecks retain FE-V1-004's locked-screen policy. Native EventSource
reconnects when possible; closed streams are recreated after a shared session
recheck, backed off from 2 to 30 seconds. A 45-second liveness watchdog covers
stalled streams (the server emits a heartbeat every 15 seconds). No replay,
missed-change notification, or transport ordering guarantee is inferred.

### Implemented review boundary (FE-V1-011)

App-owned `TrackingReview` adapts the public Shipment read function to a current
snapshot identity reader, injected into the tracking feature. Router's `InnerWrap`
mounts it inside router context; no route or shared infrastructure imports a
business feature's private module. Account/session changes recreate and tear down
the review runtime, its channels, timers and requests.

`ReviewStore` persists only public identities, pending IDs, review flags, random
compare-and-swap tokens and retention metadata. Web Locks serialize storage
read/modify/write across tabs when available; installed `broadcast-channel`
announces changes and supplies the coordination fallback when Web Locks are
unavailable. `ReviewController` reconciles at most four reads at
once, with 100 ms queue coalescing. Authoritative current-snapshot reads and storage
tokens protect against delayed events, stale reads and acknowledgement races;
neither UUID lexical order nor `observedAt` is treated as a revision sequence.
Pending observed identities survive failed HTTP reads and reload. Resync reconciles
quietly, including deletion checks for unseen records. Generic events check deletion
without installing a new baseline that could swallow a later precise event.

The UI shows one tracking Snackbar per eligible tab, separate from user-action
notifications, with a close button and six-second timeout. Route departure discards
pending summaries. A two-second burst counts distinct shipments; the sound consumer
uses package leader election plus atomic, bounded sound claims to avoid duplicate
playback across tabs. Stored consent does not bypass browser autoplay policies.
Missing Web Locks alone does not pause automatic audio: the channel and its leader
election continue to coordinate eligible tabs. Durable storage or channel failure
still pauses automatic audio rather than sounding once per disconnected tab.
Browser/OS suspension remains outside the replay guarantee.

Displayed-page acknowledgement and visible detail acknowledgement re-read current
identity before clearing marks. The displayed UUID must match; the record's token
must still match the pre-read token. History auto-review is limited to the current
snapshot actually shown on its first page. Older pages never silently acknowledge
an undisplayed current snapshot. Deleted records are removed on confirmed 404.

Storage limits: 10,000 shipments/account, 32 pending IDs/shipment, 256 sound-claim
IDs and four million serialized characters. Evict oldest reviewed records first;
never silently expire unseen records. At a full unseen capacity, existing marks
remain and a warning explains that additional highlights cannot be retained.
Storage parse/version/quota failures use isolated in-memory state with a visible
warning; reload can lose memory-only marks. No names, notes or API caches persist.

## Configuration and delivery

`VITE_API_ORIGIN` is public build configuration, with local default
`http://localhost:3000`, with frontend origin `http://localhost:5173`. Validate it
and document that `VITE_*` values are public. Do not copy actual `.env` files or
reference-project domains/secrets.

Keep the build a Vite static artifact. `vite preview` is for verification, not a
selected production server. The approved LAN delivery builds the frontend with
`VITE_API_ORIGIN=https://192.168.100.83` and serves it with Caddy from the same
origin as `/api/v1`. Caddy's internal CA provides IP-address HTTPS after its root
certificate is installed on each client. The Compose stack runs fresh PostgreSQL,
a one-shot migration, one API, static frontend, and an opt-in single worker.
Only ports 80/443 bind to the LAN address; PostgreSQL and API port 3000 stay private.

For a trusted isolated LAN that cannot install the local CA, the explicit
`docker-compose.lan-http.yml` override builds Caddy with `Caddyfile.http`, uses an
HTTP frontend origin, publishes only port 80, and switches the API to development
cookie mode. This mode carries credentials and session cookies in cleartext and is
never a substitute for the default HTTPS delivery or a public deployment.

Local image archives and a mode-600 environment file are manually copied to the
homeserver. Registry pushes, public hosting/DNS and automated deployment remain
deferred. See [lan-deployment.md](lan-deployment.md).

## Dates and responsive shipment results

Use approved Day.js for new date handling. `src/lib/dates.ts` validates date-only
values before parsing and formats business timestamps using UTC/timezone plugins.
MUI X Date Pickers use AdapterDayjs; form/URL/API state remains plain calendar
strings. Do not serialize calendar dates through UTC timestamps.

Shipment results share queries, URL state and row-command behavior across the
desktop Data Grid and MUI cards below 900px. The breakpoint changes presentation,
not pagination/filter ownership or action eligibility.

## Monitoring scope preference

`features/monitoring-scope` owns the approved Zustand persist store. Its versioned
localStorage value contains only account UUID-to-Mine/Everyone preferences, with
Zod validation and in-memory fallback when storage is unavailable. Each page
selects the signed-in account's preference, defaulting to Mine; there is no stored
active account, session, or shipment data. Overview and shipment query keys include
account and scope. Existing TanStack Query prefix invalidation remains effective.
