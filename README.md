# GRD Dashboard frontend

React/TypeScript/Vite foundation for the GRD shipment-monitoring dashboard.
FE-V1-001 supplies application composition, routing, a shared Query client, and
validated public configuration. FE-V1-002 adds quality gates, isolated tests, staged
checks, and GitHub Actions. FE-V1-003 supplies the branded shell; FE-V1-004 adds
real cookie-session authentication, password replacement, role guards, and cross-tab
session isolation. FE-V1-005 supplies live synchronization; FE-V1-006 supplies the
server-paginated shipment list, Apply filters, URL validation and quick row actions.
FE-V1-007 adds inline creation; FE-V1-008 adds shipment details, protected note
editing, monitoring actions and run progress. FE-V1-009 adds the paginated History
tab, normalized snapshot comparisons and shared requested-run progress.
FE-V1-010 adds the operational overview with server counts, problem-first panels,
silent live updates and one-minute visible-page polling.
FE-V1-011 adds tracking-change alerts, optional sound and persistent review highlights.
Administration and later features remain in the
[v1 implementation tickets](docs/v1/tickets/README.md).

## Local development

Use Node **24.21.0** (pinned in `.node-version`) and pnpm **12.11.2** (pinned in
`package.json`), matching the backend runtime and package manager. With Corepack
available, enable its pnpm shim once using `corepack enable`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. The separate backend's default origin is
**http://localhost:3000**; the app restores sessions through `/api/v1/auth/me` and requires the API for access.
All backend requests use `/api/v1`. During `pnpm dev`, browser requests use that
prefix on the frontend origin; Vite forwards it unchanged to `VITE_API_ORIGIN`.
Built/preview assets use `${VITE_API_ORIGIN}/api/v1` directly. The environment
value remains an origin without a path. There are no fallbacks to unversioned
API routes. The development proxy is not a production deployment configuration.
`pnpm dev` does not start the backend. Ports are strict: an occupied port produces an error instead of
silently switching to a different origin.

No environment file is required for these defaults. To customize public
configuration, copy `.env.example` to `.env.local`, edit it, and restart Vite.

| Variable | Default | Validation |
| --- | --- | --- |
| `VITE_API_ORIGIN` | `http://localhost:3000` | HTTP(S) origin; no credentials, path beyond `/`, query, or fragment. A trailing slash is normalized away. |

Configuration is validated at dev/build/preview startup and again in the browser.
An explicit empty or invalid origin fails with a safe message that does not echo
its value. **Every `VITE_*` variable is public build-time configuration.** Never
put credentials or secrets in these variables or in `public/`. Changing the
environment after building does not reconfigure an existing static artifact;
rebuild it. Non-public environment files are ignored by Git.

## Commands

| Command | Exact script / behavior |
| --- | --- |
| `pnpm dev` | `vite` — development server at http://localhost:5173. |
| `pnpm routes:generate` | `tsr generate` — regenerate the committed typed route tree. |
| `pnpm typecheck` | `pnpm routes:generate && tsc --noEmit && tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.e2e.json` — strict application, configuration, and browser-test checks. |
| `pnpm build` | `pnpm typecheck && vite build` — static output in `dist/`. |
| `pnpm preview` | `vite preview` — serve an existing build at http://localhost:4173. |
| `pnpm format` | `biome format --write .` — format supported files. |
| `pnpm format:check` | `biome format .` — read-only formatting gate. |
| `pnpm lint` | `biome check --formatter-enabled=false .` — lint and import organization gate. |
| `pnpm knip` | `knip` — unused files, exports, and dependencies. |
| `pnpm test` | `vitest run` — unit/component tests once, never watch. |
| `pnpm test:watch` | `vitest` — explicit interactive watch mode. |
| `pnpm test:coverage` | `vitest run --coverage` — text, HTML, LCOV, and JSON summary in `coverage/`. |
| `pnpm test:e2e` | `pnpm build && playwright test` — fresh production build and Chromium desktop/mobile smoke tests. |
| `pnpm check` | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm knip && pnpm test` — fast local gates. |
| `pnpm run ci` | `pnpm format:check && pnpm lint && pnpm knip && pnpm test:coverage && pnpm test:e2e` — complete application gates; typechecking runs through the browser suite's build. |
| `pnpm prepare` | `husky` — install local hooks; also runs after installation. |

**Use `pnpm run ci`, not `pnpm ci`.** pnpm 12 reserves bare `ci` for clean
installation; it does not execute this repository's quality script.

Preview is a local verification server, not a production hosting choice. Install
Chromium once before browser tests:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

On a supported Linux runner that also needs browser system libraries, use
`pnpm exec playwright install --with-deps chromium`. Playwright owns a strict
preview server at **http://127.0.0.1:4174** and stops it after the suite. It refuses
to reuse an occupied port, avoiding stale builds or a developer's running server.
Browser tests verify authentication, role guards, restricted-password flow,
outages, throttling, cross-tab locking, shell navigation, themes, and assets.
The ordinary suite intercepts auth responses; it does not establish backend parity.
Network traces are disabled so password submissions and cookies are not saved.

## Quality scope and CI

Biome handles JS/TS/JSX/TSX, JSON/JSONC, and CSS. It does not check Markdown,
YAML, HTML, shell scripts, or SVG assets. The generated route tree is explicitly
excluded from Biome; Knip's framework plugins discover Vite, Router, Vitest,
Playwright, and hook configuration without a broad unused-code suppression.

Vitest uses jsdom and accessible Testing Library queries. Each route test creates
its own Query client and memory history; teardown unmounts React, cancels/clears
queries, and destroys history. Shared setup clears browser storage, restores real
timers, and resets mocks/environment/global stubs. jsdom's missing `scrollTo` is
stubbed only in tests. Coverage includes untested application code, excludes only
tests/setup, declarations, and the generated tree, and has **no percentage gate**.
The initial line coverage is 60%; browser-tested entry/provider wiring is not
instrumented by the unit coverage report.

Husky's pre-commit hook runs `pnpm exec lint-staged`. Its only task is
`biome check --write --no-errors-on-unmatched` on staged supported extensions.
Only safe fixes are enabled. lint-staged's default backup and partial-staging
protection remain enabled; no custom `git add` sweeps in other files. Full
TypeScript/tests run through `pnpm check` or CI, outside the staged-file hook.

[GitHub Actions](.github/workflows/ci.yml) runs on pull requests, pushes to `main`,
and manual dispatch. It uses frozen/strict-peer installs, the pinned Node/pnpm
versions, commit-pinned actions, read-only repository permissions, timeouts, and
cancellation of obsolete PR runs. Quality runs `pnpm run ci`; a separate required
workflow job scans all fetched Git history using checksum-pinned Gitleaks 8.30.1.
Neither job is conditionally skipped for ordinary PR/main changes. Coverage and
browser failure diagnostics have seven-day retention. No production secrets,
backend checkout, publishing, or deployment jobs are used. Branch protection must
be configured separately once a GitHub remote/default branch is selected.

`pnpm test:e2e:backend` builds the installed sibling `../grd-dashboard-be`, builds
this frontend, and runs a separate Chromium suite against the real API. It requires
Docker, the backend's installed dependencies, Chromium, and free ports **3000** and
**4175**, and **4176** (Vite proxy verification). `scripts/auth-backend.mjs` creates disposable PostgreSQL 18.3, applies the
backend migrations, seeds isolated employee accounts through its auth service, and
starts the API without a worker. Playwright stops the API and database after tests.
It refuses to reuse existing servers. No developer database or account is reset.
This remains a local check; GitHub CI has no authorized backend checkout arrangement.

For a manual isolated session, build the backend, run `node scripts/auth-backend.mjs`
in one terminal, and run `pnpm dev` in another. The test-only accounts are
`frontend-admin@example.test` / `admin fixture password`,
`frontend-staff@example.test` / `staff fixture password`, and
`frontend-restricted@example.test` / `issued fixture password`.
The harness also seeds 1,000 deterministic shipment records (798 Active, 150
Paused through the compatibility API, 50 Delivered, and 152 Needs attention) and a dedicated
`frontend-shipments@example.test` / `shipments fixture password` account for
shipment browser checks. The worker remains disabled; no carrier requests occur.
These literals work only in the disposable fixture database. Stop the harness with
Ctrl-C to remove that database. A new harness run creates fresh fixtures.

FE-V1-008 adds five run-state scenarios and a second attempt for the mixed-result
run, plus `frontend-details@example.test` / `details fixture password` in this
disposable harness only. No worker or real carrier request is started.
To test detail flows while an existing API occupies port 3000:

```sh
pnpm --dir ../grd-dashboard-be build
VITE_API_ORIGIN=http://localhost:3018 pnpm build
FE_TEST_API_PORT=3018 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/shipment-detail.spec.ts
pnpm build
```

This targeted suite supports the API port override; older backend suites still
assume port 3000. Ports 4175/4176 must be free. The final build restores the normal
API origin. Each run creates and removes its own PostgreSQL database and API.

## Implemented and planned routes

`/login` provides employee sign-in; `/change-password` supports both required and
voluntary replacement. Successful replacement revokes every server session and
requires re-login. Safe internal return URLs retain query parameters. Restricted
accounts see password replacement and sign-out only.

Unrestricted Staff/Admin sessions see the branded shell at `/` and `/shipments`.
The overview uses `/dashboard/overview` for four summary cards and a bounded Needs
attention panel.
Counts and date windows come from the server. Upcoming view-all applies the server
ETA range and undelivered filter. Detail/history links return to Overview when
opened there. Failed refreshes retain known data with a persistent warning and
Retry; the last successful server timestamp remains visible. The page refreshes
every minute while visible, plus existing live/focus/reconnect synchronization.
`/shipments` now queries the real paginated
endpoint, defaults to Active/newest created first, and supports four shipment views,
server counts, 25/50/100-row pages, reference/notes search, carrier filtering
and allowlisted sorting. Carrier edits require Apply filters; invalid
URL filters pause results until corrected or explicitly cleared. Desktop row menus
expose refresh and valid pause/resume; mobile cards stack those actions as full-width
touch-friendly buttons. Desktop results include Pickup and Delivery date columns;
mobile uses a full-width Shipment view selector and cards with the same dates,
sorting, and pagination.
The Delivery label is the carrier's current estimated-delivery date. Latest lookup
and last attempted remain available on detail rather than in list results. `/shipments`
includes a compact single-shipment form above the filters and results. Existing
shipments are reported immediately without overwriting notes/status; successful
creation clears the reference and notes while retaining the selected carrier.
Search, filter, tab, sort, and pagination changes preserve scroll position. UUID
detail routes now show separate Tracking, Monitoring, Latest lookup & run, and
Notes sections. Drafts survive live updates, detected note conflicts require an
explicit choice, and dirty navigation is protected. Refresh follows the exact
accepted run, and reference-specific soft deletion returns to the originating
list. Overview and History tabs use URL state (`tab`, `page`, `pageSize`). History
defaults to 25 observations, with 25/50/100 options. Cards show full snapshots,
public IDs, New York recorded timestamps and date-only carrier values. Comparisons
use only adjacent records within the same response; the oldest entry is labeled
Initial observation. Live updates retain the page and scroll position, with a quiet
notice when the page's records/count change. New records can shift offset pages.
Switching tabs requires confirmation before discarding dirty notes. A requested
refresh remains visible above both tabs. Invalid detail URL values block content
until explicitly reset; valid out-of-range pages clamp after a successful response.
Staff direct links
to `/admin` and descendants show a forbidden state; Admin links currently lead to
an authenticated not-found screen until administration tickets are implemented.
Unknown protected paths remain authenticated and offer a return-home link.

Logout immediately hides protected content, cancels requests, clears Query and
transient UI state, and broadcasts a non-sensitive lock signal to other tabs using
`broadcast-channel`. Failed logout stays locked with Retry; it does not claim the
server cookie was revoked. Completed auth changes make other tabs recheck `/api/v1/auth/me`.
Better Auth visibility/online revalidation remains available if browser messaging/storage is blocked.
Suspended tabs process messages when the browser resumes them.

Concurrent business 403 and future SSE error callbacks share a deduplicated,
backed-off session check; 401 clears the current session. Old requests are rejected
through cancellation and a generation guard. Better Auth owns the session profile,
subscriptions and browser revalidation through `src/features/auth/api.ts`; the
remaining coordinator owns GRD lock/teardown rules. All requests pass through the
shared Axios module `src/api/api.ts` and feature `api.ts` functions. Auth forms clear password fields after
submission; no profile, cookie, token, or password is persisted by application code.
`Retry-After` is honored when exposed by CORS, with a 60-second fallback on 429.
FE-V1-005 now opens one credentialed SSE connection per authenticated tab, handles
validated resync/shipment/tracking/run events, and closes it on session loss.
The protected shell shows a quiet stale warning after two seconds; transport
recovery waits for resync and successful relevant refreshes. HTTP actions remain
available while the session is confirmed. Failed session checks still lock the app.

Future data queries opt in by spreading `liveQuery({ target })` from
`@features/tracking-updates` into their TanStack Query options. The coordinator
coalesces events over 100 ms and retains a trailing refresh during an existing
request. Inactive caches are invalidated; confirmed shipment 404s clear retained
detail/history data. Carrier-dependent targets opt into age-aware focus refreshes
and explicit post-edit invalidation. See [the registration contract](docs/v1/architecture.md#implemented-live-registration-boundary-fe-v1-005).
Shipment and overview queries register with the live coordinator, including
carrier-dependent refreshes. Tracking changes now highlight desktop rows/mobile cards
until reviewed. Tracking toasts and optional sound run only on exact `/shipments`,
including background tabs and filtered-out shipments. Two-second bursts produce one
summary per eligible tab and one sound across tabs. Sound defaults off, remembers
the account/browser preference, and uses the approved bundled Kieffy meow. Browser
playback denial pauses that tab's automatic audio until an explicit retry.

“Mark displayed changes as seen” covers the current results page. A visible detail
Overview or first History page automatically reviews only a successfully displayed,
authoritatively confirmed current snapshot. Background detail pages, failed reads,
older history pages and newer concurrent revisions do not clear unseen changes.
Review state and preferences synchronize across tabs of the same account; logout
clears in-memory state, with minimal account-scoped review identities retained for
the next login. Names, notes, credentials and server-response caches are not stored.

Versioned local storage retains up to 10,000 shipment records per account. Reviewed
records are evicted first; unseen records do not expire. Each record holds at most
32 unresolved snapshot IDs. Capacity or storage failure shows a warning; in-memory
fallback lasts until the tab closes. Sound is paused if durable storage or Web Locks
is unavailable, preserving the one-sound rule. Browser suspension can delay or miss
alerts; there is no historical event replay or cross-device review synchronization.

## Source boundaries and import aliases

`src/main.tsx` mounts the app. `src/app` owns configuration, providers, router,
and the shared Query client. `src/routes` owns thin route composition; `src/lib`
contains the public configuration parser used by both Vite and the browser.
Create feature and shared-component folders only when they contain real code.
Future business UI, API functions, schemas, and tests belong together in
`src/features/<feature>` as described in [architecture.md](docs/v1/architecture.md).

Match the backend's **area-specific aliases across directories; relative imports
within a directory** convention, adapted to the frontend layout:

| Alias | Directory |
| --- | --- |
| `@api/*` | `src/api/*` |
| `@test/*` | `src/test/*` |
| `@app/*` | `src/app/*` |
| `@components/*` | `src/components/*` |
| `@features/*` | `src/features/*` |
| `@routes/*` | `src/routes/*` |
| `@lib/*` | `src/lib/*` |
| `@theme/*` | `src/theme/*` |

TypeScript paths are the single mapping source; Vite's built-in
`resolve.tsconfigPaths` reads them. Add `@features/*`, `@components/*`, `@api/*`,
or test aliases when their corresponding folders gain code. Shared infrastructure
must not import features, and features consume other features' public exports.
Vite configuration imports are relative because they bootstrap before app alias
resolution. TanStack-generated imports retain the generator's relative form.

`tsr.config.json` is shared by the Router CLI and Vite plugin.
`src/app/route-tree.gen.ts` is generated **and committed**: never edit it by hand.
Regenerate after adding/removing routes and include the generated diff with the
route change. The standalone typecheck command generates it before checking, so
fresh checkouts do not depend on a prior dev server run.

## Dependency choices

All direct dependencies are pinned in `package.json`; `pnpm-lock.yaml` pins the
resolved graph. The choices were checked against npm engine/peer metadata on
2026-10-15 and use the approvals in [decisions.md](docs/v1/decisions.md).
`pnpm-workspace.yaml` records pnpm's exact-version release-age exceptions for
the selected recent stable releases; frozen installation verifies the lockfile
against pnpm's supply-chain policies. No dependency-provided agent skills were
approved or installed.

| Direct packages | Purpose |
| --- | --- |
| `react`, `react-dom` | Browser UI and mounting. |
| `@tanstack/react-router`, `@tanstack/react-query` | Typed routes and a shared server-state provider. |
| `@mui/material`, `@emotion/react`, `@emotion/styled` | Material UI components, responsive layout, CSS-variable themes, and styling engine. |
| `@mui/icons-material` | Material icons used by the shell and shared controls. |
| `zod` | Validate the public API origin. |
| `vite`, `@vitejs/plugin-react`, `typescript` | Development/build tooling and strict typechecking. |
| `@tanstack/router-plugin`, `@tanstack/router-cli` | Watch/build route generation and standalone generation before typechecking. |
| `@types/node`, `@types/react`, `@types/react-dom` | Runtime-matched type declarations. |

Quality tooling adds development-only `@biomejs/biome`, `vitest`,
`@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/dom`,
`@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`,
`@playwright/test`, `knip`, `husky`, and `lint-staged`. Exact versions are in
`package.json`; engines/peers and fresh frozen installation were verified.

Material UI replaces the superseded Tailwind/shadcn/Radix/Sonner plan. The shared
notification module uses MUI Snackbar/Alert. MUI X Data Grid Community 9.15.0 is installed for FE-V1-006, with server
pagination/sorting and external filters. Below 900px, a full-width selector replaces
the desktop tabs and the list uses MUI cards with the same server pagination and
sorting plus stacked full-width action buttons. MUI X Date Pickers Community
9.15.0 and Day.js 1.11.23 provide calendar filters. Day.js is the approved choice
for future date work; business timestamps use America/New_York and date-only
values remain unshifted YYYY-MM-DD strings. FE-V1-004 installs
Axios 1.20.0, React Hook Form 7.90.0, resolvers 5.9.1, and the additionally approved
broadcast-channel 7.4.0. The follow-up adds the user-selected Better Auth 1.7.7
client, matching the installed backend. Zod remains the feature schema boundary.
No font, standalone state-store, or hosting package was added.

Implementation uses the user-selected `feature/dashboard-v1` branch from the
existing `master` history. A future switch of the default branch to `main` remains
pending. See [AGENTS.md](AGENTS.md) and
[agent-workflow.md](docs/v1/agent-workflow.md) for commit approval and release rules.
Hosting, publishing, and deployment remain deferred. Local auth integration
evidence is recorded in the FE-V1-004 implementation summary.
