# Pages and interactions

## Navigation and access

| Route                        | Page / access                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `/login`                     | Sign-in, no public signup or emailed-reset promise.                                            |
| `/change-password`           | Password replacement; required for restricted sessions, also available to authenticated users. |
| `/`                          | Overview homepage; unrestricted Staff/Admin.                                                   |
| `/shipments`                 | Shipment table; unrestricted Staff/Admin.                                                      |
| `/shipments/$shipmentId`     | Dedicated detail; `tab=overview` default or `tab=history`. Public UUID parameter.              |
| `/admin/accounts`            | Account list; Admin.                                                                           |
| `/admin/accounts/new`        | Create account; Admin.                                                                         |
| `/admin/accounts/$accountId` | Account detail/edit, activation, password reset; Admin.                                        |
| `/admin/carriers`            | Carrier list; Admin.                                                                           |
| `/admin/carriers/$carrierId` | Carrier detail/settings; Admin.                                                                |

`$...` denotes TanStack's file-route parameter, not a literal URL segment.
Static `new` paths must never be parsed as UUIDs. Include authenticated not-found,
forbidden, and safe error states. Preserve a safe internal destination after login;
reject external redirects and loops to auth screens.

Sidebar: Overview, Shipments, then Admin-only Accounts and Carriers. Create/detail
pages use breadcrumbs and page-level navigation, not permanent sidebar entries.
Show user identity, sign-out, theme control, and access to password change. A
restricted account sees replacement/sign-out only. The logo links to `/` once the
session is unrestricted. Layout follows Tom's desktop sidebar/mobile drawer pattern.

## Overview homepage

Summary cards: All, Active, Paused, Delivered, Needs attention. Cards link to the
matching shipment tab. Counts exclude soft-deleted shipments, overlap as defined
in the API contract, and are not computed from the current table page.

Primary section: **Needs attention**, using the exact backend predicate. Explain
failed lookup versus threshold pause without claiming a shipment is late. Show
reference, carrier, reason, last known tracking status, and a link to detail.

Secondary sections: **Upcoming deliveries** (today plus six days, known ETA only)
and **Recent tracking changes** (app-recorded snapshots). Show at most 10 items per
section. Link upcoming items/view-all to All shipments with the ETA range and
`undeliveredOnly=true`; show the latter as a removable active-filter indicator.
The backend applies this constraint before pagination. Recent changes link directly to the shipment history;
there is no new global history page in v1.

Display business timezone and last successful aggregate refresh. Loading, empty,
error, and stale/reconnecting states remain distinct. Avoid inventing zeros on a
failed request. Refresh silently; tracking-change audio/toasts do not run here.

## Shipment list

Default `/shipments` state: `tab=active`, page 1, 25 rows, `createdAt desc`.
Tabs: **All shipments**, **Active**, **Paused**, **Delivered**, **Needs attention**.
Respect explicit valid URL state on navigation/reload/back. Search and filters
apply within the selected tab; filter/sort/tab changes reset page to 1. Include
clear filters and empty-result guidance. Searches are debounced and cancelled when
superseded. Invalid URL values remain visible and block shipment requests until
staff correct or explicitly clear them. Do not silently remove invalid filters.
Date fields use MUI calendar pickers backed by Day.js. Preserve malformed URL
values in visible error text until staff choose a valid date or explicitly clear
the field. Date-only strings never undergo timezone conversion.
Carrier, outcome and date controls apply together through **Apply filters** with
inline validation. Search remains independently debounced; unapplied filter drafts
survive search changes and live refreshes. Clear filters also discards drafts.

Approved controls: reference/notes search, carrier, latest completed lookup
outcome (including never checked), created date range, estimated-delivery range.
Use the server's counts. Column sorting is limited to the API allowlist; don't
suggest sorting on a field the server ignores. Never client-sort/filter only the
loaded page while presenting it as a full-dataset result.

Suggested default columns: reference/carrier, carrier status, monitoring state,
pickup, delivery, latest lookup, created time, notes preview, row actions. The
list's concise Delivery label displays the carrier's estimated-delivery date;
actual delivery remains a separate detail/history value.
Detail shows full status text and pickup/delivery fields. Keep an explicit
reference link and accessible action-menu buttons in the desktop table. Below
900px, replace the tab strip with a full-width Shipment view selector and present
shipment cards with labeled details, wrapping reference/notes, stacked full-width
action buttons, explicit sort controls and server pagination; desktop retains the
tabs and table. Row highlights include a textual/icon "Updated" indicator.

Page header contains sound preference and **Mark displayed changes
as seen** when appropriate. Row menu offers detail, refresh, and permitted
pause/resume; action availability follows backend rules. No refresh-all, bulk
pause/delete, or scheduler start/stop. Editing notes/deletion belongs on detail.

Live changes refetch affected pages/counts; an active row may leave Active when
delivered/paused. Created-time ordering prevents updates from moving rows to the
top just because tracking changed. Refetch must not activate the wrong row action
or silently drop pending user input. Clamp an invalid page after deletions.

## Create shipment

Place one compact form above the `/shipments` filters and results: enabled carrier,
literal tracking reference, optional notes, and **Add shipment**. There is no bulk
entry or import route. The backend rechecks carrier eligibility. Preserve leading
zeros/case and turn blank optional notes into null.

Lock editing and repeat submission while pending. On 201, clear reference and notes,
retain the selected carrier, refresh shipment/overview queries, and show success
without leaving the current list view. On 200 `existing`, immediately explain that
the existing notes/status were retained and offer an All shipments action. Validation,
carrier-race, and connectivity failures retain the draft and use allowlisted field
messages. Filter/search/tab/sort/page URL changes remain within the view, preserve
the draft, and do not scroll to the top.

## Shipment detail

Header persists across future tabs (it is not sticky while scrolling): reference, carrier, monitoring state/reason, valid
verification link, refresh, valid pause/resume, and delete confirmation. Return
to the originating list URL; direct links fall back to default `/shipments`.

**Overview:** current carrier status/detail, pickup/estimated/actual delivery
dates, snapshot-recorded time, last attempted/next-check times, latest completed
lookup outcome, and latest run/explicitly requested run progress. Preserve known
tracking values during failed lookup and label them separately. Unknown values
use "Not available" or equivalent, never made-up dates/statuses.

Editable notes have save/cancel, dirty-state protection, and null clearing. A
server refresh must not overwrite an unsaved draft. Delete requires confirmation
identifying the reference, then returns to the list; disclose removal from active
views without promising a restore feature. Handle a concurrent delete with a
clear missing/deleted screen and list link.

FE-V1-008 uses separate Tracking, Monitoring, Latest lookup & run, and Notes cards.
FE-V1-009 adds Overview/History navigation. Notes start read-only with Edit notes;
detected concurrent changes show the latest server note while preserving the draft,
with Use latest note and Save my draft anyway choices. Conditional save/locking is
not supported by the current API. Internal navigation uses a discard dialog;
reload/tab close uses the browser warning. A delete dialog also names any unsaved
note loss, avoiding a second confirmation after successful deletion.

Refresh remains visible with a reason when disabled. Pause/Resume are shown only
when valid. A requested run remains labeled Your refresh even when another run
becomes Latest run; duplicate IDs render once. Run summaries describe whole-run
attempt counts and only this shipment's attempt outcome. Unknown diagnostics have
safe generic wording. Poll displayed queued/running runs every 15 seconds while
visible as a fallback to live events; stop periodic work on terminal or inaccessible
runs. Refresh acceptance may already be terminal and never implies delivery.

**History:** paginated normalized snapshots, newest first. Label initial tracking
separately from later changes and render readable status/date differences where
available; don't invent the previous record at a pagination boundary. It is the
application's observation history, not a full carrier event timeline. Distinguish
never observed, empty page, loading, and failure. Store tab/page in the URL.

FE-V1-009 uses responsive snapshot cards with full normalized values, public UUIDs,
and optional field-change callouts. Compare only neighboring observations in one
response; explain unavailable comparison context at page boundaries. Default to
25 observations with 25/50/100 options. Live refresh retains page/scroll, with a
quiet dismissible notice when records/count change; offset pages can shift.
Switching from Overview with dirty notes requires the existing discard confirmation.
Keep the explicitly requested run above both tabs; Overview retains any distinct
latest run. Invalid URL values remain visible with Reset view, while valid
out-of-range pages replace the URL with the last available page after a successful read.

## Admin pages

**Accounts list:** name, email, role, active/replacement state, links to create and
detail. The current backend list is unpaginated; account scale is not the 10,000-
shipment requirement. Local account search is acceptable if clearly scoped.

**Create account:** first/last name, email, role, issued password. Successful
creation requires replacement at next sign-in. Explain out-of-band credential
delivery; no email is sent by this UI/backend. Never put passwords in URLs,
browser storage, telemetry, toasts, or logs.

**Account detail:** edit supported fields; explicit confirmations for activation
changes and password reset, and clear messaging for role changes. Disable
self-deactivation/demotion, handle backend protection conflicts, and respond to
session revocation. Reset uses an Admin-entered password, not a nonexistent
email-reset endpoint. Show password feedback inline without echoing it elsewhere.

**Carriers list/detail:** view code/name/active status and configured tracking
settings. Edit only mutable supported fields; show carrier-specific fetch modes
and interval caveats. Confirm disabling because it affects future tracking.
No create/delete/restore action. Handle concurrent changes safely and invalidate
carrier-dependent forms, lists, and details after saving.

## Alerts, sound, and review state

User-action confirmations/errors can toast on any page. Field errors also appear
beside fields; auth/connectivity problems retain a persistent visible state.

Tracking-change alerts run **only while the exact pathname is `/shipments`**,
across every tab/page/filter. They are disabled on `/` and
shipment detail/admin/auth routes. The data subscriptions remain live elsewhere.
Debounce/coalesce bursts into a short summary and one sound, with a close control
and a sensible maximum of visible toasts. A manual refresh is first "queued";
do not report tracking success before the actual outcome is known. Deduplicate
action/run feedback and tracking-change feedback rather than spamming both.

Sound defaults off, persists by account/browser, and is activated by an explicit
user gesture. Handle autoplay denial without repeated errors. Use an approved
existing sound asset or ask before adding a sound library; the legacy asset's
provenance must be checked before reuse.

Track observed change revisions by shipment and account. An unseen revision stays
highlighted across reloads until its detail is successfully displayed or the user
marks displayed changes seen. Viewing a newer authoritative snapshot also reviews
earlier observed revisions for that shipment. If a newer event arrives during detail fetch/save/
acknowledgement, acknowledge only the displayed revision and earlier observations,
never a later unseen revision. Do not clear
off-page changes with a displayed-only action. Switching accounts must never
display the prior account's marks or preference state.

Initial loads and resyncs refresh quietly; the event stream has no historical
replay guarantee. Highlights already observed persist, but offline/missed changes
are not promised as alerts. History remains the place to inspect past observations.
Deleted highlighted records are removed when their deletion is confirmed. Browser
storage is bounded/versioned and may fall back to memory; persistence is not a
shared/team acknowledgement or cross-device feature.

## Dates and usability

Use `America/New_York` for timestamps and business-day boundaries, with correct
EST/EDT behavior. Date-only carrier values stay date-only; formatting must not
turn a date into the previous day. Show timezone beside timestamp groups.

Every page supports keyboard navigation, visible focus, labeled controls, readable
light/dark contrast, responsive layout, reduced motion, and loading/empty/error
states. Use confirmation dialogs for destructive or sensitive changes. Keep
error messages safe; the UI must not expose raw provider or database diagnostics.
