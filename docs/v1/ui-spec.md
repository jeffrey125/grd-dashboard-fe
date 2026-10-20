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

Summary cards: All, Active, Delivered, Needs attention. Cards link to the
matching shipment tab. Active, Delivered, and Needs attention partition All so
the visible category counts total the shipment count. Counts exclude soft-deleted
shipments and are not computed from the current table page.

The first panel is **Needs attention**, including every paused Shipment and active
Shipments whose latest lookup failed. Explain the reason without claiming a
shipment is late. Show reference, carrier, reason, last known tracking status, and
a link to detail.

Show at most 5 Needs attention items. Reference links open detail and return to
Overview; the view-all link opens the Needs attention shipment view.

Upcoming deliveries follows Needs attention. Show at most five undelivered
shipments with current ETA from New York today through day +6 inclusive, ordered
by earliest ETA. The server supplies the date window, total and rows. Show reference,
carrier, estimated delivery and last known carrier status; estimates are not promises.
Reference links return to Overview. View all opens All shipments with that exact
date window, undelivered-only, and delivery ascending. Recent changes remains omitted.

Display business timezone and last successful aggregate refresh. Loading, empty,
error, and stale/reconnecting states remain distinct. Avoid inventing zeros on a
failed request. Refresh silently; tracking-change audio/toasts do not run here.
Refresh every minute while visible, alongside existing live synchronization.
Retain stale data and its warning during retries.

## Shipment list

Default `/shipments` state: `tab=active`, page 1, 25 rows, `createdAt desc`.
Tabs: **Active**, **Needs attention**, **Delivered**, **All Shipments**. Needs attention
includes paused Shipments and active Shipments whose latest lookup failed; those
failed rows are excluded from Active. Legacy `tab=paused` URLs redirect to Needs attention.
Respect explicit valid URL state on navigation/reload/back. Search and filters
apply within the selected tab; filter/sort/tab changes reset page to 1. Include
clear filters and empty-result guidance. Searches are debounced and cancelled when
superseded. Invalid URL values remain visible and block shipment requests until
staff correct or explicitly clear them. Do not silently remove invalid filters.
Carrier applies through **Apply filters** with inline validation. Search remains
independently debounced; unapplied filter drafts
survive search changes and live refreshes. Clear filters also discards drafts.

Approved controls: reference/notes search, carrier, estimated-delivery from/through
calendar dates and undelivered-only. Date/state controls use explicit Apply and
preserve invalid URL values until corrected or cleared.
Use the server's counts. Column sorting is limited to the API allowlist; don't
suggest sorting on a field the server ignores. Never client-sort/filter only the
loaded page while presenting it as a full-dataset result.

Suggested default columns: reference/carrier, carrier status, monitoring state,
pickup, delivery, created time, notes preview, row actions. The
list's concise Delivery label displays the carrier's estimated-delivery date;
actual delivery remains a separate detail/history value.
Detail shows full status text and pickup/delivery fields. Keep an explicit
reference link and accessible action-menu buttons in the desktop table. Below
900px, replace the tab strip with a full-width Shipment view selector and present
shipment cards with labeled details, wrapping reference/notes, stacked full-width
action buttons, explicit sort controls and server pagination; desktop retains the
tabs and table. Every real row/card opens Shipment detail; explicit links preserve
native modified-click behavior. Unseen updates use a green highlight and text
indicator. Unseen rows currently in Needs attention, including due follow-ups, use
a red highlight. Opening the row or reference acknowledges the displayed revision
before navigation so that highlight clears without consuming a newer update.

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
to the originating list URL or Overview for homepage-origin links; direct links
fall back to default `/shipments`.

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

**Account detail:** start read-only with Edit/Save/Cancel for first name, last name
and role. Email is displayed in a disabled field after creation. All administration is Admin-only.
Require explicit confirmations for role and activation changes and password reset. Disable
self-deactivation/demotion, handle backend protection conflicts, and respond to
session revocation. Reset uses an Admin-entered password, not a nonexistent
email-reset endpoint. Show password feedback inline without echoing it elsewhere.
For the current Admin, use the existing Change password page instead of an Admin
reset. Keep the implemented sign-out behavior for every password change/reset.
Preserve drafts on failed saves/background refreshes; protect dirty navigation.
The interview explicitly omitted concurrent-edit warnings/save blocking. Submit
only changed profile fields; the API has no conditional-write guarantee.

**Carriers list/detail:** view code/name/active status and configured tracking
settings. Edit only mutable supported fields; show carrier-specific fetch modes
and interval caveats. Confirm disabling because it affects future tracking.
No create/delete/restore action. Handle concurrent changes safely and invalidate
carrier-dependent forms, lists, and details after saving.

The three-carrier list uses a compact desktop table/mobile cards, without search
or pagination. Detail starts read-only with Edit/Save/Cancel. Confirm disabling
on Save, including other changed settings. Show immutable code/UUID and exact API
limits; blank RPM sends null, never zero. Polling guidance includes UPS production
30-minute/test 60-minute minimum and EchoShip/FFE five-minute minimum, plus worker
and quota delays.

Preserve drafts on background refresh and failed saves. Show detected server
changes and offer Use latest settings or Keep my draft. Keeping a draft requires
confirmation before saving changed fields over current values; this has no atomic
locking guarantee. New server changes invalidate an earlier confirmation. Failed
reads block Save until Retry succeeds; missing data remains unavailable for writes.
Protect dirty navigation/reload, and discard drafts on session loss. Focus refresh
uses the existing 30-second age policy; reconnect/resync bypasses it.

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

FE-V1-011 uses two-second burst summaries and one sound across browser tabs, including
background `/shipments` tabs. Sound controls sit below the page title. Only visible
detail views auto-review; a background detail page retains incoming highlights.
History auto-review requires the current snapshot on the first history page.
The mark-seen button covers the current results page, including rows below the
scroll position; it is unavailable while results are fetching, failed or placeholder
data. Acknowledgement confirms the displayed snapshot through a fresh authoritative
read, and newer concurrent updates remain unseen. Initial/reconnect reads stay quiet.

Sound defaults off and reuses the approved bundled Kieffy meow; enabling previews
the asset. Saved preference survives reload, subject to browser playback permission.
The explicit per-tab sound button permits preview/re-enabling after denial. A denied
playback produces one persistent warning and pauses further automatic attempts in
that tab until retry. Storage/coordination failure pauses automatic sound and keeps
the dashboard usable with a warning and in-memory review state.

## Dates and usability

Use `America/New_York` for timestamps and business-day boundaries, with correct
EST/EDT behavior. Date-only carrier values stay date-only; formatting must not
turn a date into the previous day. Show timezone beside timestamp groups.

Every page supports keyboard navigation, visible focus, labeled controls, readable
light/dark contrast, responsive layout, reduced motion, and loading/empty/error
states. Use confirmation dialogs for destructive or sensitive changes. Keep
error messages safe; the UI must not expose raw provider or database diagnostics.
