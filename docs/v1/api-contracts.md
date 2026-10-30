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
| Shipments | GET `/shipments/search` returns paginated/filterable rows and tab counts; GET `/shipments/:externalId/history` returns normalized snapshot history; legacy GET `/shipments` returns an unpaginated array; detail GET; single-item POST; notes/assignment/follow-up PATCH; soft DELETE; per-shipment POST pause/resume. |
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
- Notes, sales-rep assignment and follow-up date are editable. Carrier/reference correction is
  not a PATCH feature. Delete is soft and 204; re-add creates a new UUID.
- Pause: active → paused/manual. Resume: paused/manual → active. Threshold-paused
  shipments can refresh but cannot manually resume. Delivered shipments with future follow-up dates remain active until that date starts in New York time.
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
| `tab`                                          | `all`, `active` (default), `paused`, `delivered`, `attention`, `other`                                                                         |
| `q`                                            | Optional trimmed literal case-insensitive substring of reference or notes; max 255 code units; wildcard characters treated literally. |
| `carrierExternalId`                            | Optional carrier UUIDv4; one carrier initially.                                                                                       |
| `estimatedDeliveryFrom`, `estimatedDeliveryTo` | Optional inclusive ISO calendar-date bounds on current ETA; valid nonzero years, ordered from ≤ through. |
| `undeliveredOnly` | Optional `true`/`false`; true excludes completed shipments and known deliveries, including active delivered shipments and the All tab. |
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
Delivered and Attention can overlap when a delivered shipment has a due follow-up. The compatibility-only
Paused count is a subset of Attention, so consumers must not add all five fields.
All excludes soft-deleted Shipments. Delivered means completed/delivered. Attention
means any paused Shipment or a non-completed Shipment whose latest completed lookup
failed, or any Shipment with a follow-up due today or earlier. Active means actively monitored without a failed latest completed lookup or due follow-up.
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

Upcoming deliveries uses the same statement snapshot: non-completed, nondeleted, without a known delivery
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


## SQ-V1-003 asynchronous quote comparisons

Staff and Admin can create, list, and read all non-deleted comparisons. Existing
session, password-change, trusted-Origin and no-store policies apply.

| Method/path (under `/api/v1`)                             | Contract                                                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/quote-comparisons/providers`                        | Array of `{code,name,enabled,executionMode}`; Amazon mode is `api`, myUnishippers mode is `request` or `browser`.                                                                         |
| POST `/quote-comparisons/providers/:code/default-refresh` | Empty body; waits up to 90 seconds for the worker. Returns `{refreshId,address,retrievedAt}`; failure is 503 and explicit sender entry remains available. Client timeout is 120 seconds. |
| POST `/quote-comparisons`                                 | Strict input below; returns `{outcome: created/existing,comparison}`, HTTP 201/200. Reused key with changed input is 409.                                                                |
| GET `/quote-comparisons?page=1`                           | `{items,total,page,pageSize:25}`, newest first with a stable ID tie-breaker.                                                                                                             |
| GET `/quote-comparisons/:externalId`                      | One immutable comparison, or 404.                                                                                                                                                        |

Input contains `idempotencyKey` (UUID), `shipDate` (YYYY-MM-DD, current/future in
America/New_York), `destination`, `providers[]`, and `packageGroups[]`.
Addresses contain `name,street,city,division,postalCode,country` plus optional
`street2`, optional `contactName` (up to 100 characters), and optional `phone`
(validated against the address country with libphonenumber metadata).
Sender country is US. Country and currency values use ISO 3166-1 alpha-2 and ISO 4217
codes. The form sources country and state/province options from `country-region-data`.
Provider entries contain `code`, `sender`, and `options`. New submissions require
`{mode:explicit,address}`; historical responses may retain
`{mode:account_default,refreshId}`. Options contain
`signature` (`none`, `signature`, `adult_signature`) and nullable
`insurance:{amount,currency}`. Amounts and measurements are decimal strings.
Groups contain positive integer `quantity`, `units` (`imperial` or `metric`),
`length,width,height,weight`, and `customsItems`. International groups require
per-box items with `description,quantity,unitValue,currency,countryOfManufacture,
weight` and optional/blank `hsCode`. Unknown support never implies included coverage.
A myUnishippers-only comparison may leave all three dimension strings blank. Partial
dimensions and every Amazon-inclusive comparison require all three positive values.
Weight is always required.
myUnishippers uses Quick Quote one-box requests and calculated group quantities;
only today's `America/New_York` ship date is supported, and international lanes,
signature, and insurance are unavailable in this flow.

Comparison returns `externalId,createdAt,createdBy` (actor public UUID), `input`,
`senders`, `warnings`, `status`, `ratesRun`, and `attempts`. Resolved senders contain
`code,address,mode,retrievedAt`; explicit addresses have null retrieval time.
New comparisons start `queued`; historical `saved` records remain unchanged.
Status is `saved|queued|running|completed|failed`; completed means at least one
successful provider after all attempts finish, so inspect each attempt for partial
failure. `ratesRun` indicates an execution started, not a successful real quote.
Retry and soft-delete/restore are implemented by SQ-V1-007 below. Purchase and
provider-admin endpoints remain deferred.

Each attempt contains `externalId,provider,status,attemptNumber,executionMode,
startedAt,completedAt,recoveryCount,outcome,reasonCode,simulated,quotes`.
Mode is null until execution; timestamps are nullable ISO UTC strings. Outcome is
null until terminal, then `success|validation_failed|unsupported|timeout|
authentication_failed|failed`. Diagnostics and lease ownership remain private.
Known reasons are `adapter_unavailable,provider_disabled,validation_failed,
sender_company_too_long,
contact_details_required,
unsupported,timeout,authentication_failed,provider_setup_required,provider_failed,
recovery_exhausted`. Historical Amazon browser attempts may retain
`provider_setup_required`; an eligible retry uses the current API mode instead of
the retired browser onboarding flow.
Unknown reasons must use generic safe UI copy.

Each quote contains `platform,carrier,service,transportationTotal,currency,
estimateMethod,transitDescription,retrievedAt,expiresAt,optionCoverage,dutyStatus,
taxStatus,clearanceStatus,charges,groupContributions`. Money is an exact decimal
string; missing transit/expiry is null. `charges` contains `{description,amount,scope,
packageGroupPosition}` rows where scope is `package`, `shipment`, or `pickup` and
shipment/pickup rows use a null group position. `groupContributions` contains
`{packageGroupPosition,quantity,subtotal}` for calculated package totals.
Amazon sandbox and demo results are always `simulated:true`. Amazon displays
**Amazon sandbox mode — test data, not live commercial prices**. Simulated results
never receive a Lowest price badge. Requested option coverage remains unverified.

`GET /quote-comparisons/:externalId/events` is credentialed SSE. It emits
`quote.changed` with only `{externalId}`, `resync` with `{}` on connect/listener
recovery, and 15-second `heartbeat` with `{}`. Every frame rechecks the session
and comparison visibility. All unrestricted employees share non-deleted history;
streams filter to the requested comparison and close if access is lost.
Events are transient hints, without replay or sequence guarantees. Subscribe while
viewing nondeleted detail; fetch authoritative detail after open/resync/change. Serialize reads
and reread if another hint arrives during a request. The frontend also refreshes
visible comparisons every 15 seconds to recover missed signals, closes streams on
session loss/unmount/deletion, and retries failed connections after session recheck.

The UI lives at `/quotes`, `/quotes/new`, and `/quotes/:comparisonId`. Saved details
are read-only. Copy uses `/quotes/new?copy=<uuid>`, creates a fresh save key, converts
historical account-default snapshots into editable explicit senders, omits now-disabled
providers, and retains other original inputs.
An old ship date must be corrected before saving the copy. Failed save retries keep
the same key while input is unchanged; edited input receives a new key.

### SQ-V1-007 history and retry

- `POST /quote-comparisons/:externalId/attempts/:attemptId/retry` returns the updated
  comparison (201). The attempt UUID identifies the failure being retried; a stale,
  nonlatest, successful, validation-failed, unsupported, queued, or running attempt
  returns 409. A missing/deleted comparison returns 404. Staff and Admin may retry.
- Retry preserves the original input, resolved sender, conversions, earlier attempts,
  and quotes. It uses the current provider mode when execution starts. Eligibility
  is checked under database locks and again at worker claim: disabled providers,
  past ship dates (America/New_York), and currently invalid inputs cannot execute.
  Correcting input requires Copy to new comparison. One provider can retry while
  the other runs; duplicate clicks cannot enqueue a second active attempt.
- `DELETE /quote-comparisons/:externalId` (Admin, 200) soft deletes only completed or
  failed comparisons without active attempts. `POST /quote-comparisons/:externalId/restore`
  (Admin, 201) restores visibility without running rates. Repeating either operation
  retains its timestamp. Children are retained; there is no purge or cancellation.
- `GET /quote-comparisons?deleted=true&page=1` lists deleted records for Admin only
  (Staff receives 403). Normal lists exclude deleted records. Admin can open deleted
  detail; Staff receives 404, including on the SSE endpoint.
- Comparison adds nullable `deletedAt,lastDeletedAt,restoredAt`. The last two retain
  the latest lifecycle timestamps after restore. Attempts add `createdAt,sender`
  and nullable `retryBlockedReason` (null means eligible). Reasons are
  `comparison_deleted,newer_attempt,attempt_active,outcome_not_retryable,
  provider_disabled,ship_date_passed,input_invalid`. Unknown reasons fail closed.
- Results add nullable `staleAt`: null when provider expiry is known, otherwise
  retrieval time plus the provider's currently configured stale hours (default 24).
  Provider expiry is authoritative; changing stale policy changes its derived
  deadline without rewriting quote history.
- Frontend price sorting and Lowest price require equivalent actual origin,
  currency, shared immutable shipment details, and requested options. Requested
  options with unverified/unsupported coverage and any simulated rate also suppress
  an overall winner. Ties share the badge. Stale/expired/unknown-freshness
  rates never receive it; all rates remain readable. Exact comparison uses decimal.js.
- Visible details refresh every 15 seconds, including terminal comparisons. SSE
  stays subscribed to nondeleted detail so another user's retry is observed.
  A confirmed 401/403/404 hides cached detail. Deleted Admin views use polling;
  retry/delete/restore invalidate the detail and all history query variants.
  The UI updates freshness locally as deadlines pass, with timestamps labelled ET.

### Sender refresh operational boundary

The API queues a bounded myUnishippers refresh in the provider account row and the
worker reads it through a feature-owned repository. Only the worker launches
Playwright and holds myUnishippers browser credentials/cookies. Each operation uses
a fresh isolated browser with a 75-second deadline. Amazon requires an explicit
sender and rejects default refresh. There is no quote request or provider-account
mutation. Concurrent refreshes share work; the worker handles one at a time.

After success the API keeps an actor-bound immutable refresh snapshot (up to 2,000
across the single API process). Later refreshes cannot overwrite it. API restart or
capacity eviction requires refreshing again before saving; explicit input is the
fallback. Completed comparisons persist their resolved sender permanently.
Provider disablement is rechecked in the save transaction. myUnishippers credentials
are read only from `MYUNISHIPPERS_EMAIL/PASSWORD`; raw provider responses, tokens,
and cookies are never persisted.

## SQ-V1-008 provider administration API

All paths below use `/api/v1`. Admin-only routes:

| Method/path | Body / result |
| --- | --- |
| GET `/admin/shipping-providers` | Settings array: code/name/enabled/executionMode/maintenanceMessage/staleHours/revision/updatedAt/updatedBy/savedConnectionTest. |
| PATCH `/admin/shipping-providers/:code` | Full editable settings plus revision; optional connectionTestId and acknowledgeFailure. Returns updated settings array. |
| POST `/admin/shipping-providers/:code/connection-tests` | Amazon accepts `api`; myUnishippers accepts `request` or `browser`. Returns durable test, HTTP 201. |
| GET `/admin/shipping-providers/:code/connection-tests/:id` | Testing admin's test; poll queued/running until succeeded/failed. |

Test fields: `id`, `executionMode`, `state`, `failureSummary`, `createdAt`,
`completedAt`, `expiresAt`, `testedBy` (public employee UUID), `savedAt`.
Failure summaries are allowlisted codes, never raw exceptions. Saved failed tests
remain visible on the settings card. Results expire after 15 minutes and cannot be
reused across provider, mode, admin, settings revision or a prior successful save.
A mode change requires a completed test; a failed result additionally requires
`acknowledgeFailure: true`. Invalid input is 400; missing test is 404; revision/test
conflicts are 409; staff administration is 403. Enabled/message/stale changes alone
require no readiness test. Readiness performs no sample-rate request.

Staff/Admin discovery GET `/quote-comparisons/providers` additionally returns
`maintenanceMessage`, `staleHours`, and `cachedDefault` (null or `{address,retrievedAt}`).
These are effective read-only settings; no test/audit/session secrets are exposed.
POST `/quote-comparisons/providers/:code/default-refresh` remains available to staff
for enabled myUnishippers and returns `expiresAt` alongside refreshId/address/retrievedAt.
Backend submission rejects expired refresh IDs after 15 minutes. Cached defaults
never provide a refresh ID. Amazon returns 400 because API quotes require an explicit
sender. Show myUnishippers cached details as stale if a current refresh fails.

Stale policy defaults to 1 hour, accepts 1–168 whole hours and applies on read to
all history without provider expiry. Provider expiry remains authoritative. Disable
blocks new work and queued execution; running quotes may finish. Historical actual
mode/origin remain unchanged. Frontend settings route: `/admin/shipping-providers`.


## Shared US-only quote form (2026-10-22)

The approved v1 release uses one sender for all selected shipping providers.
Sender and destination countries are US-only; international/customs inputs are absent.
Changing or clearing provider selections preserves shared address and option entries.
The form expands the sender into the existing per-provider API snapshots, and the
backend rejects different pickup addresses or non-US destinations for new requests.
Historical response schemas remain readable.

Signature/insurance appear once when supported by a selected provider, with unsupported
providers explicitly identified. Both current adapters advertise no support. Discovery
adds `inputRequirements: {sender, destination}` with `requiredFields` (contactName,
phone, division), `maxNameLength`, `maxStreetLength`, and `maxContactNameLength`.
The union of selected providers' requirements
applies to shared fields; myUnishippers sender names are limited to 35 characters.
Future providers use the shared inputs; only provider-exclusive fields get their own
section. Existing React Hook Form, MUI, Zod and standards libraries are reused.

## Runtime quote feature flag (SQ-V1-013)

Public `GET /api/v1/features` returns `{ quoteComparisonEnabled: boolean }` with
`Cache-Control: no-store`. The flag comes from the API/worker environment variable
`QUOTE_COMPARISON_ENABLED` (strict `true|false`, default `false`). When false,
authenticated quote/provider API requests, including quote SSE, return 404.
Navigation and all quote pages are unavailable. Metadata loading/failure never
enables quote tools by default or prevents shipment tracking. No frontend rebuild
is needed after changing the server environment and restarting both processes.


## MON-V1-002: monitor delivered shipments until follow-up

Staff/Admin **Monitor again** uses the existing Shipment PATCH with a future
`followUpOn`. The backend atomically reactivates a completed Shipment and schedules
checks, preserving delivery snapshots and carrier status. The dialog defaults to
tomorrow in New York; today/past dates cannot restart monitoring. Clearing the
follow-up stops a known delivery immediately. Future date edits preserve manual
and safeguard pauses; the existing resume/retry actions handle those pauses.

A future follow-up keeps delivered Shipments active through repeated delivery
results. Automatic checks stop at the start of that date in `America/New_York`.
Existing completed Shipments with future dates reactivate on the first worker
scan. State/tab changes reconcile on scans; independent per-lookup eligibility
checks enforce expiry even during a long-running scan. Active monitoring and the
carrier's Delivered status are distinct. Completed deliveries return to Delivered,
with due follow-ups also in Attention. No schema or public response changes.

## Multi-rep shipment filtering

Shipment search uses `salesRepExternalIds`, a comma-separated string of UUIDv4
values and/or `unassigned`. Empty/omitted means any rep; selected values match
with OR and combine with all other filters using AND. Counts and pagination use
the same filter. The old singular search parameter is rejected; assignment
requests still use singular `salesRepExternalId`.

`GET /api/v1/sales-reps/filter-options` is available to Staff and returns active
and inactive reps as `{ externalId, firstName, lastName, active }`, active first.
Assignment continues to use the active-only `GET /api/v1/sales-reps` endpoint.
The filter uses MUI Autocomplete with checkboxes and chips, retains Apply filters,
and persists the selection in the URL. Applying resets the page. Unknown or invalid
URL values remain visible for explicit correction; they are never silently removed.

## MON-V1-004: manual Other carrier

Other uses code `other` and no automated checks. The Add shipment form reveals
manual fields only when Other is selected; the existing detail assignment form
also edits manual tracking using Save changes. Creation requires a reference,
defaults to Pending Pickup and permits blank dates. Dates retain the existing
Pickup/estimated Delivery table meaning.

Create/update bodies accept `manualTracking: { carrierStatus, pickedUpOn,
estimatedDeliveryOn }` only for Other. Status is one of Pending Pickup, Pickedup,
Out for delivery, Delivered; dates are nullable ISO dates. Delivered records today's
New York date internally; reopening clears it in a new history snapshot. No Refresh,
pause/resume or Monitor again action is offered for Other.

The `other` tab/count and homepage Other count include all manual shipments, also
included in All Shipments. Active and Delivered exclude Other. Due follow-ups
include Other in Needs attention even when delivered or disabled. Views overlap.

Admins may toggle only Other's Active state. Disabling blocks creation, while
existing records remain editable. Automatic polling controls do not apply.

## Monitoring creator scope (FILTER-V1-002)

Search and overview accept `scope=mine|everyone`. The UI always sends its saved
scope; an omitted API scope retains Everyone for compatibility. The server resolves
Mine from the current session, and applies it before pagination/counts/panels.
See the backend's [scope contract](../../../grd-dashboard-be/docs/v1/frontend-handoff.md#monitoring-creator-scope-filter-v1-002).

## SALES-V1-001: Sales Rep email

Admin Sales Rep records include required unique `email`. Duplicate create/update
requests return HTTP 409, including email reserved by inactive reps. Creation and the editor require
a valid email (trimmed, lowercased, up to 254 characters); PATCH may update it.
The list displays email on desktop and mobile. Backend migration
`1793577600000-SalesRepEmails` backfills the nine confirmed representatives.
Deploy the matching backend first and coordinate the frontend rollout: old create
requests without email return 400. Filter-options remains unchanged.

## SHIP-V1-002: order details

Shipment records add `poNumbers`, `soNumbers`, and `products` string arrays.
Details PATCH sends only changed lists; omission preserves them and `[]` clears
them. Each list accepts up to 100 trimmed, nonempty, NUL-free values of at most 255
characters. The API sorts and deduplicates entries. Do not split product names or
PO identifiers on punctuation. Keep the existing `poNumber` summary for the
monitoring grid; use `poNumbers` for editing. Do not submit both PO input forms.
Warehouse stock has PO# `0` with its SO stored separately. SO and Product appear
only in shipment details, with the existing dirty-form and save protections.
The frontend tolerates absent SO/Product arrays during rollout and falls back to
one opaque legacy PO value when the API omits `poNumbers`. Deploy the new API and
migration before enabling list edits; older APIs cannot accept the new fields.
