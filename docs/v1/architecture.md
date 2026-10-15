# Frontend architecture

## Planned structure

This is a target structure, not an inventory of implemented files.

```text
src/
  app/                 # Providers, router, runtime configuration, session composition
  routes/              # Thin route guards and page composition
  features/
    auth/              # Sign-in, password replacement, session lifecycle
    overview/          # Server aggregates and attention/delivery/change panels
    shipments/         # List, create, details, tracking history, commands
    tracking-updates/   # Event-to-cache coordination, route alerts, review state
    accounts/          # Admin account management
    carriers/          # Carrier reads and Admin settings
  components/
    ui/                # shadcn/Radix primitives
    layout/            # Shell, sidebar, page header, theme controls
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

## State ownership

| State                                                                  | Owner                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Server responses, overview totals, shipments, runs, accounts, carriers | TanStack Query                                                  |
| Shipment tab, search, filters, pagination, sort, detail tab            | TanStack Router URL state                                       |
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
set browser Origin manually or send actor IDs/auth tokens. Do not install a Better
Auth client against the backend's application facade.

Deduplicate `/auth/me` rechecks after concurrent auth errors. A 401 closes events,
cancels in-flight requests, clears query data and transient UI, and routes to
sign-in. A business 403 triggers one session recheck to distinguish role denial
from mandatory password replacement. Prevent previous-account responses from
repopulating the next account's cache with cancellation plus a session generation
guard. Do not automatically retry non-idempotent mutations or auth failures.

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
