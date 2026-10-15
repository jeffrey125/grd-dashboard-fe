# API contracts and backend prerequisites

## Authority and status

**Implemented today:** the sibling backend's
[`frontend-handoff.md`](../../../grd-dashboard-be/docs/v1/frontend-handoff.md) and
[`auth-api.md`](../../../grd-dashboard-be/docs/v1/auth-api.md), checked against its
controllers, schemas, entities, and repositories on 2026-10-15.

**BE-V1-001 implemented locally:** current tracking/latest lookup/latest run and
public snapshot UUIDs are committed and available after migration
`1792281600000-TrackingReadProjection`. Deployment is pending. See the
[backend implementation summary](../../../grd-dashboard-be/docs/v1/implementation-summary/BE-V1-001-implementation-summary.md).

**Proposed below:** new endpoint/event under BE-V1-004 and BE-V1-005.
They are concrete targets for those tickets and must be verified against the
resulting backend before frontend integration. Naming refinements must update
this document, backend docs, and consumers together. No endpoint listed as
proposed is available merely because this document exists.

API base: `http://localhost:3000` locally, no `/api` prefix. Intended production
origins remain `https://api.globalresourcesdirect.com` and
`https://dashboard.globalresourcesdirect.com`; these are not deployed by this plan.

## Implemented surface

| Area      | Existing API / limits                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `POST /auth/sign-in`, `GET /auth/me`, `POST /auth/sign-out`, `POST /auth/change-password`. Profile responses and HttpOnly cookies, not tokens.             |
| Accounts  | Admin GET list/detail, POST create, PATCH account, POST password under `/admin/accounts`. No account DELETE or emailed invitation/reset.                   |
| Carriers  | GET `/carriers`, GET/PATCH `/carriers/:externalId`; PATCH Admin-only. No create/delete/restore.                                                            |
| Shipments | GET `/shipments/search` returns paginated/filterable rows and tab counts; GET `/shipments/:externalId/history` returns normalized snapshot history; legacy GET `/shipments` returns an unpaginated array; detail GET; bulk POST; notes-only PATCH; soft DELETE; per-shipment POST pause/resume. |
| Refresh   | POST `/shipments/:externalId/refresh` → 202 run; GET `/tracking-runs/:externalId` → run/attempt outcomes. Current/latest lookup/run also appear on Shipment responses.                   |
| SSE       | GET `/events`: `resync`, `shipment.changed`, `run.changed`, `heartbeat`; invalidation events, no replay.                                                   |

Existing Shipment JSON has `externalId`, Carrier summary, `trackingReference`,
`notes`, `verificationUrl`, `monitoringStatus`, `monitoringReason`,
`lastAttemptedAt`, `nextCheckAt`, `consecutiveNotFoundCount`, `createdAt`, and
`updatedAt`. It also contains the implemented `currentTracking`, `latestLookup`, and
`latestRun` projection below.

## Existing invariants to preserve

- API calls use Axios `withCredentials: true`; EventSource uses
  `{ withCredentials: true }`. Browser supplies Origin. No actor IDs, tokens in
  browser storage, arbitrary auth headers, or Better Auth generic client routes.
- Mandatory password replacement permits only replacement/sign-out. Successful
  password change returns 204 and revokes all sessions; sign in again.
- Staff and Admin can perform Shipment actions. Only Admin manages accounts and
  carrier settings. Server is authoritative; handle protected Admin changes with 409. There is no self-deactivation or self-demotion.
- Shipment creation accepts 1–10 items atomically. Tracking references are
  trimmed nonblank strings, at most 255 UTF-16 code units, no NUL. Preserve leading
  zeros and case. Notes are nullable or trimmed 1–500 code units, no NUL; clearing
  sends null. Reject unknown fields. In-batch duplicates collapse, last notes win;
  existing nondeleted duplicates remain unchanged. Row errors are 1-based.
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
pause/resume and inserted/duplicate records. Every existing field and the legacy
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
| `lookupOutcome`                                | Optional `never_checked`, `found`, `not_found`, `failed`, `skipped`; based on latest completed attempt.                               |
| `createdFrom`, `createdTo`                     | Optional inclusive calendar dates, interpreted in `America/New_York`; SQL uses inclusive start and exclusive next-day boundary.       |
| `estimatedDeliveryFrom`, `estimatedDeliveryTo` | Optional inclusive date-only range; unknown ETA excluded when this filter is active.                                                  |
| `undeliveredOnly`                              | Optional boolean, default false; supports the upcoming-deliveries drill-down without including completed/delivered records.           |
| `page`, `pageSize`                             | Positive page, default 1; page sizes 25/50/100, default 25, cap 100.                                                                  |
| `sortBy`, `sortDirection`                      | Default `createdAt`, `desc`; allowlisted `createdAt`, `trackingReference`, `estimatedDeliveryOn`, `lastAttemptedAt`; `asc`/`desc`.    |

`createdAt desc` maps to SQL `created_at DESC, id DESC`; the internal ID is never
returned. Other sorts have deterministic secondary ordering and explicit nulls-last
behavior. Reject unknown/invalid query fields, reversed ranges, and invalid dates.
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

Tab counts apply the other query filters but ignore the selected tab. Attention
overlaps other tabs; totals must not sum all tab counts. All excludes soft-deleted
Shipments. Delivered means completed/delivered. Attention means **not completed**
and either latest completed lookup failed or paused/not_found_threshold. An active
shipment with a disabled carrier stays Active; show its disabled-carrier warning
without silently redefining the approved Attention tab.

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

## Proposed BE-V1-004: overview aggregates

Add **GET `/dashboard/overview`** with unrestricted Staff/Admin policy:

```ts
type OverviewResponse = {
  asOf: string; // ISO timestamp for this consistent aggregate read.
  timezone: "America/New_York";
  upcomingWindow: { from: string; to: string }; // Date-only inclusive boundaries.
  counts: {
    all: number;
    active: number;
    paused: number;
    delivered: number;
    attention: number;
  };
  attention: { total: number; items: ShipmentWithTracking[] };
  upcomingDeliveries: { total: number; items: ShipmentWithTracking[] };
  recentChanges: Array<{
    shipmentExternalId: string;
    trackingReference: string;
    carrier: { externalId: string; code: string; name: string };
    snapshot: TrackingSnapshot;
  }>;
};
```

Compute all aggregates on the server from nondeleted shipments. Attention follows
the search predicate and shows newest created first. Upcoming is undelivered with
known ETA from business-today through day +6, ordered by ETA then stable creation
order. Recent changes are the 10 most recently recorded snapshots belonging to
nondeleted shipments, including initial observations, ordered deterministically.
Cap each panel at 10 items and expose full totals where indicated. Counts refer
to current monitoring state, not delivered-today or a performance KPI. Use one
consistent read snapshot; specify cache behavior (`no-store` initially). No
on-time-rate, transit-average, or carrier-ranking calculation is added.

## Proposed BE-V1-005: precise tracking-change signal

Extend the existing authenticated SSE source with:

```ts
type TrackingChangedEvent = {
  externalId: string; // Shipment public UUID.
  snapshotExternalId: string;
  observedAt: string;
};
// Named event: tracking.changed
```

Produce this transactionally only when the committed current snapshot pointer
changes to a new non-null snapshot, including first acquisition. Existing
`shipment.changed` and `run.changed` remain compatible. Notes-only edits,
scheduling changes, failed/not-found attempts, pause/resume, and successful
unchanged checks do not independently emit `tracking.changed`.

Use the established PostgreSQL notification path; rolled-back updates must not
notify browsers. Update DB trigger/migration, runtime source validation/types,
and controller serialization together: today's serializer only emits `externalId`.
Keep payloads small, with no source data or user information. Validate IDs and
dates. Both Staff and Admin receive the event under existing session checks.

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
