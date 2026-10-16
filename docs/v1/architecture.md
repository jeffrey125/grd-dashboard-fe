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
Failed logout remains locally locked until Retry confirms revocation. The real SSE
connection is deliberately implemented by FE-V1-005.

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

The proposed `tracking.changed` event enables accurate alerts for off-page rows.
Its snapshot UUID is identity/deduplication metadata; it does not replace fetching
current data. Gate toast/audio behavior on `pathname === '/shipments'`, ignoring
search parameters. Live data continues updating silently elsewhere.

## Configuration and delivery

Plan `VITE_API_ORIGIN` as public build configuration, local default
`http://localhost:3000`, with frontend origin `http://localhost:5173`. Validate it
and document that `VITE_*` values are public. Do not copy actual `.env` files or
reference-project domains/secrets. The future hosting choice must support SPA
deep links and credentialed same-site HTTPS API access.

Keep the build a Vite static artifact. `vite preview` is for verification, not a
selected production server. Docker delivery, reverse proxies, registry pushes,
production environment syncing, and hosting-specific runtime config are deferred.
