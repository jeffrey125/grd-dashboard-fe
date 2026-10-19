# API contracts and backend prerequisites

## Authority and status

**Implemented today:** the sibling backend's
[`frontend-handoff.md`](../../../grd-dashboard-be/docs/v1/frontend-handoff.md) and
[`auth-api.md`](../../../grd-dashboard-be/docs/v1/auth-api.md), checked against its
controllers, schemas, entities, and repositories on 2026-10-16.

**BE-V1-001 implemented locally:** current tracking/latest lookup/latest run and
public snapshot UUIDs are committed and available after migration
`1792281600000-TrackingReadProjection`. Deployment is pending. See the
[backend implementation summary](../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-001-implementation-summary.md).

**Implemented locally through BE-V1-005:** Shipment tracking projection, search,
history, the operational overview endpoint, and the precise `tracking.changed`
event. Deployment is pending. Naming refinements must update this document,
backend docs, and consumers together.

Approved API base: `http://localhost:3000/api/v1` locally. The backend exposes
this prefix and the frontend targets this contract only.
Vite development requests use `/api/v1/*` and retain the prefix when forwarding.
Health checks use `/api/v1/health/*`; unversioned backend routes must return 404.
All endpoint paths below are relative to this API base; frontend page routes such
as `/shipments` are unchanged. Intended production origins remain
`https://api.globalresourcesdirect.com` and `https://dashboard.globalresourcesdirect.com`;
these are not deployed by this plan.

## Implemented surface

| Area      | Existing API / limits                                                                                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `POST /auth/sign-in`, `GET /auth/me`, `POST /auth/sign-out`, `POST /auth/change-password`. Profile responses and HttpOnly cookies, not tokens.                                                                                                                                                  |
| Accounts  | Admin GET list/detail, POST create, PATCH account, POST password under `/admin/accounts`. No account DELETE or emailed invitation/reset.                                                                                                                                                        |
| Carriers  | GET `/carriers`, GET/PATCH `/carriers/:externalId`; PATCH Admin-only. No create/delete/restore.                                                                                                                                                                                                 |
| Shipments | GET `/shipments/search` returns paginated/filterable rows and tab counts; GET `/shipments/:externalId/history` returns normalized snapshot history; legacy GET `/shipments` returns an unpaginated array; detail GET; single-item POST; notes-only PATCH; soft DELETE; per-shipment POST pause/resume. |
| Dashboard | GET `/dashboard/overview` returns consistent state counts and bounded attention, upcoming-delivery, and recent-change panels.                                                                                                                                                                   |
| Refresh   | POST `/shipments/:externalId/refresh` → 202 run; GET `/tracking-runs/:externalId` → run/attempt outcomes. Current/latest lookup/run also appear on Shipment responses.                                                                                                                          |
| SSE       | GET `/events`: `resync`, `shipment.changed`, `tracking.changed`, `run.changed`, `heartbeat`; invalidation events, no replay.                                                                                                                                                                    |

Existing Shipment JSON has `externalId`, Carrier summary, `trackingReference`,
`notes`, `verificationUrl`, `monitoringStatus`, `monitoringReason`,
`lastAttemptedAt`, `nextCheckAt`, `consecutiveNotFoundCount`, `createdAt`, and
`updatedAt`. It also contains the implemented `currentTracking`, `latestLookup`, and
`latestRun` projection below.

## Existing invariants to preserve

- API calls use Axios `withCredentials: true`; EventSource uses
  `{ withCredentials: true }`. Browser supplies Origin. No actor IDs, tokens in
  browser storage or arbitrary auth headers. The Better Auth client maps its
  operations in `features/auth/api.ts`; generic Better Auth routes never reach
  the backend.
- Mandatory password replacement permits only replacement/sign-out. Successful
  password change returns 204 and revokes all sessions; sign in again.
- Staff and Admin can perform Shipment actions. Only Admin manages accounts and
  carrier settings. Server is authoritative; handle protected Admin changes with 409. There is no self-deactivation or self-demotion.
- Shipment creation accepts one strict `{ carrierExternalId, trackingReference,
  notes? }` object per request. Tracking references are
  trimmed nonblank strings, at most 255 UTF-16 code units, no NUL. Preserve leading
  zeros and case. Notes are nullable or trimmed 1–500 code units, no NUL; clearing
  sends null. Reject unknown fields. Existing nondeleted duplicates return 200 with
  `outcome: "existing"` and remain unchanged; new records return 201 with
  `outcome: "created"`. Validation details use allowlisted field names.
- Notes are the only editable Shipment field. Carrier/reference correction is
  not a PATCH feature. Delete is soft and 204; re-add creates a new UUID.
- Pause: active → paused/manual. Resume: paused/manual → active. Threshold-paused
  shipments can refresh but cannot manually resume. Delivered is terminal.
  Disabled carriers block creation/refresh but do not hide existing shipments.
- Refresh is allowed for active or threshold-paused shipments with an eligible
  carrier; manual-paused and completed shipments cannot start a new refresh.
  Queued/running manual refreshes can coalesce. A 202 is a queued request, not
  evidence that a provider was queried; terminal races are valid.
- Safe links require valid HTTP(S) URLs and `noopener noreferrer`. A null URL
  means no verification link yet. Untrusted carrier text is rendered as text.
- Use status codes: 400 validation, 401 session, 403 authorization/replacement/
  Origin, 404 missing/deleted, 409 state conflict, 429 throttled, 5xx generic
  failure. Not every error uses the row-error shape. No automatic mutation retries.

## Implemented locally BE-V1-001: current tracking and lookup projection

These fields are returned consistently from Shipment list/detail, notes,
pause/resume and creation records. Every existing field and the legacy
GET array shape are preserved. Nulls are explicit and meaningful.

```ts
type TrackingSnapshot = {
  externalId: string; // New public UUIDv4; never the internal bigint snapshot ID.
  carrierStatus: string | null;
  carrierStatusDetail: string | null;
  pickedUpOn: string | null; // YYYY-MM-DD, no timezone conversion.
  estimatedDeliveryOn: string | null;
  deliveredOn: string | null;
  observedAt: string; // ISO timestamp when this snapshot was recorded.
};

type LatestLookup = {
  runExternalId: string;
  outcome: "found" | "not_found" | "failed" | "skipped";
  snapshotChanged: boolean;
  retryable: boolean | null;
  reasonCode: string | null;
  completedAt: string;
};

type ShipmentTrackingProjection = {
  currentTracking: TrackingSnapshot | null;
  latestLookup: LatestLookup | null;
  latestRun: TrackingRun | null; // Existing public run shape in backend handoff.
};
```

`latestLookup` selects the most recently completed attempt, ordered by completion
time and internal ID as a deterministic server-only tie-breaker. Pending attempts
never replace a known outcome. `latestRun` is the newest associated run by creation
time/ID and may be queued, running, or terminal; a manually requested run ID stays
independently queryable even if another run later becomes latest.

The current snapshot comes from the Shipment's current snapshot pointer, not an
assumed latest timestamp. Failed/not-found/skipped checks preserve known tracking
details according to existing backend behavior. `observedAt` is not "last checked":
unchanged successful checks may reuse the snapshot. Label all timestamps accurately.

Migration `1792281600000-TrackingReadProjection` assigns existing/new snapshots
stable unique non-null public UUIDs while retaining internal keys/FKs and immutable
snapshot semantics. It also indexes completed-attempt selection. Apply it before
starting the updated API. Rollback removes the public UUIDs; reapplication creates
new identities. Public responses exclude actor IDs, lock versions, source data,
credentials, diagnostic messages and internal IDs. `latestRun.attemptCount` counts
all attempts in the associated run.

Local verification covers empty/populated migration, immutability, unchanged and
unsuccessful checks, pending runs, deterministic ties, response consistency and
authorization. A 1,000-Shipment fixture is projected in one SQL statement; batch
response records share one projection query. Exact commands/results are recorded
in the linked backend summary. This status does not claim production deployment.

## Implemented BE-V1-002: paginated shipment queries

Add **GET `/shipments/search`** and register the static route ahead of the UUID
detail route. Preserve existing GET `/shipments` as an array for compatibility;
the new frontend uses the new route for its list.

| Query field                                    | Target rules                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `tab`                                          | `all`, `active` (default), `paused`, `delivered`, `attention`                                                                         |
| `q`                                            | Optional trimmed literal case-insensitive substring of reference or notes; max 255 code units; wildcard characters treated literally. |
| `carrierExternalId`                            | Optional carrier UUIDv4; one carrier initially.                                                                                       |
| `estimatedDeliveryFrom`, `estimatedDeliveryTo` | Optional inclusive ISO calendar-date bounds on current ETA; valid nonzero years, ordered from ≤ through. |
| `undeliveredOnly` | Optional `true`/`false`; true excludes completed shipments, including when tab is All. |
| `page`, `pageSize`                             | Positive page, default 1; page sizes 25/50/100, default 25, cap 100.                                                                  |
| `sortBy`, `sortDirection`                      | Default `createdAt`, `desc`; allowlisted `createdAt`, `trackingReference`, `estimatedDeliveryOn`; `asc`/`desc`.                       |

`createdAt desc` maps to SQL `created_at DESC, id DESC`; the internal ID is never
returned. Other sorts have deterministic secondary ordering and explicit nulls-last
behavior. Reject unknown or invalid query fields.
Search/filter/sort apply to the full dataset **before** pagination.

```ts
type ShipmentSearchResponse = {
  items: ShipmentWithTracking[]; // Existing Shipment plus BE-V1-001 projection.
  page: number;
  pageSize: number;
  total: number; // Selected tab + all filters.
  tabCounts: {
    all: number;
    active: number;
    paused: number;
    delivered: number;
    attention: number;
  };
};
```

Tab counts apply the other query filters but ignore the selected tab. The visible
Active, Delivered, and Attention counts partition All. The compatibility-only
Paused count is a subset of Attention, so consumers must not add all five fields.
All excludes soft-deleted Shipments. Delivered means completed/delivered. Attention
means any paused Shipment or a non-completed Shipment whose latest completed lookup
failed. Active means actively monitored without a failed latest completed lookup.
An otherwise Active shipment with a disabled carrier stays Active; show its
disabled-carrier warning.

`never_checked` means no completed attempt, even if a run is pending. Query counts
and page items must use a consistent read snapshot so concurrent worker updates
do not produce contradictory counts within a response. Out-of-range pages return
empty items with the true total; UI may navigate to the last valid page. Offset
pagination does not promise a frozen dataset across separate live requests.

The backend implements the response and validation described above. Items,
total, and tab counts come from one PostgreSQL statement snapshot. A disposable
PostgreSQL 18.3 plan check with 10,000 Shipments did not justify a new index or
migration; exact evidence is recorded in the backend implementation summary.

## Implemented BE-V1-003: shipment history

Add **GET `/shipments/:externalId/history?page=1&pageSize=25`** →
`{ items: TrackingSnapshot[], page, pageSize, total }`, newest `observedAt` first
with a stable internal tie-breaker. Same page-size limits as search. A shipment
with no snapshots returns an empty page; missing/deleted shipment returns 404.

History consists of app-recorded normalized snapshots, including the initial
observation. Unchanged successful checks do not create fake history entries.
This is not a carrier scan feed, lookup-attempt log, note audit, or source-data
diagnostic endpoint. Preserve known snapshots when a later lookup fails.

The backend implements this response with strict page validation and one
PostgreSQL statement for nondeleted Shipment existence, total and page items.
Disposable PostgreSQL tests cover initial/changed/unchanged/failed observations,
equal-time pagination, foreign ownership, empty history and deleted Shipments.

## Implemented BE-V1-004: overview aggregates

Add **GET `/dashboard/overview`** with unrestricted Staff/Admin policy:

```ts
type OverviewResponse = {
  asOf: string; // ISO timestamp for this consistent aggregate read.
  timezone: "America/New_York";
  counts: {
    all: number;
    active: number;
    paused: number;
    delivered: number;
    attention: number;
  };
  attention: { total: number; items: ShipmentWithTracking[] };
  upcomingWindow: { from: string; to: string }; // New York today through day +6.
  upcomingDeliveries: { total: number; items: ShipmentWithTracking[] };
};
```

Compute all aggregates on the server from nondeleted shipments. Attention follows
the search predicate, shows newest created first, and is capped at 5 items while
retaining its full total. Counts refer
to current monitoring state, not delivered-today or a performance KPI. Use one
consistent read snapshot; specify cache behavior (`no-store` initially). No
on-time-rate, transit-average, or carrier-ranking calculation is added.

Upcoming deliveries uses the same statement snapshot: non-completed, nondeleted
shipments whose current ETA is within `upcomingWindow`, inclusive. Disabled carriers
remain included; null ETAs are excluded. Return at most five rows, earliest ETA,
then creation/id ascending, plus a full total. View all uses the matching search
date bounds and `undeliveredOnly=true`; search's equal-ETA tie-breaker is id, so
membership and totals agree without promising identical tie ordering.

The backend implements this contract with one parameterized PostgreSQL statement
and `Cache-Control: no-store`. The response reuses the public Shipment projection
and search predicates. Disposable PostgreSQL verification covers
empty/null/disabled/deleted rows, drill-down parity, concurrent writes,
attention ordering/caps, and a 10,000-Shipment plan. No schema migration or dependency
was added.

## Implemented BE-V1-005: precise tracking-change signal

The existing authenticated SSE source includes:

```ts
type TrackingChangedEvent = {
  externalId: string; // Shipment public UUID.
  snapshotExternalId: string;
  observedAt: string;
};
// Named event: tracking.changed
```

The backend produces this transactionally only when the committed current snapshot pointer
changes to a new non-null snapshot, including first acquisition. Existing
`shipment.changed` and `run.changed` remain compatible. Notes-only edits,
scheduling changes, failed/not-found attempts, pause/resume, and successful
unchanged checks do not independently emit `tracking.changed`.

The implementation uses the established PostgreSQL notification path; rolled-back
updates do not notify browsers. The additive migration, runtime source validation,
types and controller serialization preserve UUIDs and canonicalize `observedAt`
to UTC, for example `2026-10-16T00:00:00.000Z`. Payloads contain no source data,
internal IDs or user information. Both Staff and Admin receive the event under
existing session checks.

This is a change signal, **not a replay log**. On reconnect, refresh data quietly;
do not promise missed audio/toast replay. Snapshot IDs deduplicate observed changes
and support durable local highlights. Ordinary event handling still refetches
authoritative records and aggregates. Event ordering must not let an older arrival
overwrite a newer highlighted revision; compare authoritative snapshot identity
and preserve newer revisions during acknowledgement races.

## Carrier form details

Use existing backend validation: name 1–100 trimmed characters; not-found threshold
integer 2–32767; poll interval integer 1–32767 minutes; rate limit integer 1–32767
or null. Only RPM accepts explicit null. Fetch mode is request for UPS, request or
browser for EchoShip/FFE. Code and UUID are read-only. Adapter minimum intervals
can exceed configured values; label scheduling as approximate, not an exact timer.
After editing, invalidate carrier data locally; existing SSE has no carrier event,
so also refresh on focus/reconnect. Account mutations have similar explicit
post-mutation invalidation and existing session-revocation behavior.


## SQ-V1-002 saved quote comparisons

Staff and Admin can create, list, and read all non-deleted comparisons. Existing
session, password-change, trusted-Origin and no-store policies apply.

| Method/path (under `/api/v1`) | Contract |
| --- | --- |
| GET `/quote-comparisons/providers` | Array of `{code,name,enabled}`; codes are `amazon` and `unishippers`. |
| POST `/quote-comparisons/providers/:code/default-refresh` | Empty body; waits up to 90 seconds for the worker. Returns `{refreshId,address,retrievedAt}`; failure is 503 and explicit sender entry remains available. Client timeout is 120 seconds. |
| POST `/quote-comparisons` | Strict input below; returns `{outcome: created/existing,comparison}`, HTTP 201/200. Reused key with changed input is 409. |
| GET `/quote-comparisons?page=1` | `{items,total,page,pageSize:25}`, newest first with a stable ID tie-breaker. |
| GET `/quote-comparisons/:externalId` | One immutable comparison, or 404. |

Input contains `idempotencyKey` (UUID), `shipDate` (YYYY-MM-DD, current/future in
America/New_York), `destination`, `providers[]`, and `packageGroups[]`.
Addresses contain `name,street,city,division,postalCode,country` plus optional
`street2`; sender country is US. Country/currency inputs use uppercase codes.
Provider entries contain `code`, `sender`, and `options`. Sender is
`{mode:explicit,address}` or `{mode:account_default,refreshId}`. Options contain
`signature` (`none`, `signature`, `adult_signature`) and nullable
`insurance:{amount,currency}`. Amounts and measurements are decimal strings.
Groups contain positive integer `quantity`, `units` (`imperial` or `metric`),
`length,width,height,weight`, and `customsItems`. International groups require
per-box items with `description,quantity,unitValue,currency,countryOfManufacture,
weight` and optional/blank `hsCode`. Unknown support never implies included coverage.

Comparison returns `externalId,createdAt,createdBy` (actor public UUID), `input`,
`senders`, `warnings`, `status:saved`, and `ratesRun:false`. Resolved senders contain
`code,address,mode,retrievedAt`; explicit addresses have null retrieval time.
No rate execution, SSE, retry, purchase, deletion or provider-admin endpoint is added.

The UI lives at `/quotes`, `/quotes/new`, and `/quotes/:comparisonId`. Saved details
are read-only. Copy uses `/quotes/new?copy=<uuid>`, creates a fresh save key, refreshes
account defaults, omits now-disabled providers, and retains other original inputs.
An old ship date must be corrected before saving the copy. Failed save retries keep
the same key while input is unchanged; edited input receives a new key.

### Sender refresh operational boundary

The API queues a bounded refresh in the provider account row and the worker reads
it through a feature-owned repository. Only the worker launches Playwright and
holds browser credentials/cookies. Each operation uses a fresh isolated browser,
with a 75-second browser deadline. Missing configuration, authentication challenges,
incomplete addresses, and ambiguous Amazon pickup addresses fail closed. There is
no quote request or provider-account mutation. Concurrent API refreshes for one
provider share work. The worker handles one default lookup at a time; no rates run.

After success the API keeps an actor-bound immutable refresh snapshot (up to 2,000
across the single API process). Later refreshes cannot overwrite it. API restart or
capacity eviction requires refreshing again before saving; explicit input is the
fallback. Completed comparisons persist their resolved sender permanently.
Provider disablement is rechecked in the save transaction. Credentials are read only
from `AMAZON_SHIPPING_EMAIL/PASSWORD` and `MYUNISHIPPERS_EMAIL/PASSWORD` environment
variables; raw provider responses, tokens, and cookies are never persisted.
