# FE-V1-004 implementation summary

## Summary

Implemented and locally verified on 2026-10-16 in `grd-dashboard-fe`, on
`feature/dashboard-v1`. Employees can sign in with the real backend cookie,
restore sessions, replace passwords, and sign out. Restricted and Staff/Admin
access decisions are enforced in the root UI boundary. Logout/account changes
isolate requests, Query data, notifications, and forms across browser tabs.
The implementation was approved and partitioned into four focused commits.

## Changes Made

- Added the approved Axios 1.20.0, React Hook Form 7.90.0, resolvers 5.9.1, and
  user-selected broadcast-channel 7.4.0 and Better Auth 1.7.7, using existing Zod,
  MUI, Query, and Router. Better Auth matches the backend package version.
  Exact compatible versions and peers were checked before pnpm installation.
- Added credentialed transport with safe status errors, 204 handling, request
  cancellation, and a session generation guard. No automatic mutation/auth retry,
  bearer token, browser Origin override, or generic Better Auth backend endpoint
  was introduced. Every backend request uses `/api/v1`; Vite preserves the prefix when forwarding.
- Added `/login` and `/change-password` with frontend schemas matching the backend:
  email normalization; sign-in/current passwords 1–128 characters; new passwords
  12–128 with NUL rejected and whitespace preserved. Confirmation is frontend-only.
  Password inputs clear after submission. Replacement 204 requires a new login.
- Added session restoration, safe internal return paths, role/replacement routing,
  deduplicated business 403/future SSE rechecks, backoff and 429 cooldowns, persistent
  error/retry screens, cross-tab invalidation, and complete sensitive UI teardown.
  Failed logout locks content until Retry confirms revocation. The actual SSE
  connection remains in FE-V1-005; auth exposes cleanup/recheck interfaces for it.
- Added a separate real-backend browser harness using the sibling backend's real
  app, migrations and auth service with disposable PostgreSQL. No worker, live
  carrier calls, backend source changes, developer-account resets, or deployment.

## Files Changed

| Files | Why |
| --- | --- |
| `src/api/api.ts`, `src/api/api.test.ts` | Credentialed transport, safe errors/cooldowns, 204 and cancellation/generation tests. |
| `src/features/auth/api.ts`, `schemas.ts`, `schemas.test.ts` | Public endpoint/schema boundary, strict password rules, safe return paths. |
| `src/features/auth/session.ts`, `session.test.ts`, `context.tsx`, `session-boundary.tsx`, `use-cooldown.ts`, `index.ts` | GRD session policy, Better Auth profile ownership, tab messaging, React subscription, guarded layout and exports. |
| `src/features/auth/pages/auth-layout.tsx`, `auth-pages.tsx` | Branded responsive forms, inline/toast feedback, replacement and sign-out controls. |
| `src/app/config.ts`, `session.ts`, `providers.tsx`, `router.ts`, `routes.test.tsx`, `providers.test.tsx`; `src/routes/__root.tsx`, `login.tsx`, `change-password.tsx`; `src/app/route-tree.gen.ts` | Runtime composition, transient-state remount, retry policy, route registration and authenticated route tests. The generated route tree is required for checkout/build parity. |

| Files | Why |
| --- | --- |
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts` | Pinned approved dependencies, API/test aliases, development proxy, and real-backend test command. |
| `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`, `src/test/auth-fixture.ts`, `playwright.config.ts` | Desktop/mobile auth/fault/tab coverage, authenticated shell fixtures, and disabled network traces. |
| `scripts/auth-backend.mjs`, `e2e-backend/auth.spec.ts`, `playwright.backend.config.ts`, `tsconfig.e2e.json`, `knip.json` | Disposable real API/database harness, browser verification, and test/tooling discovery. |
| `AGENTS.md`, `README.md`, `docs/v1/api-contracts.md`, `architecture.md`, `decisions.md`, `verification.md` | Implemented auth behavior, approved package choice, test prerequisites and manual fixture instructions. |
| `docs/v1/README.md`, `docs/v1/tickets/README.md`, `FE-V1-004-api-and-auth.md`, this summary | Ticket status and reviewable implementation/verification evidence. |

This follow-up started with the earlier FE-V1-004 implementation unstaged.
The requested Better Auth/proxy changes are layered onto that same ticket; nothing
has been staged or committed. The backend's unrelated untracked `sample.txt` stays
untouched, and this session does not edit backend source. The separate backend session owns
its versioning changes; overlapping frontend base-URL edits were preserved and
the duplicate declaration was reconciled. Official brand assets are unchanged.

## Verification

Latest follow-up verification on 2026-10-16 includes the Better Auth adapter,
StrictMode/Alt-Tab preservation, mounted outage locking and the real Vite proxy.
The two real-backend scenarios and full CI suite were rerun after the migration.
The historical visual captures and Gitleaks runs below predate this follow-up;
the auth UI layout is unchanged, and those checks are not claimed as rerun.


| Exact command/check | Result |
| --- | --- |
| `pnpm view axios version engines --json`, `pnpm view react-hook-form version peerDependencies --json`, `pnpm view @hookform/resolvers version peerDependencies --json`, `pnpm view broadcast-channel version engines --json` | Passed; selected compatible pinned versions. Optional resolver peers do not require unrelated validation libraries. |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Passed lockfile, peer, and supply-chain checks. Dependency-provided agent skills were not installed/approved. |
| `pnpm check` | Passed format, lint/imports, generated routes, app/tool/browser types, Knip, and **47 unit/component tests** across 11 files. |
| `pnpm run ci` | Passed format, lint, Knip, coverage, production build/typechecks, and **12 desktop/mobile Chromium tests**. Final unit line coverage: **85.84%**; no invented coverage gate. Browser-only paths are not instrumented by Vitest. |
| `pnpm test:e2e:backend` | Passed backend and frontend builds plus **2 real-backend browser scenarios**, including versioned health and unversioned 404 checks: invalid login, HttpOnly/SameSite cookie and credentialed CORS, reload restoration, Staff direct/API denial, logout, wrong current password, forced replacement 204/re-login, Admin self-demotion conflict, and revoked-session restoration; development proxy login/HttpOnly cookie/reload/logout. |

| Exact command/check | Result |
| --- | --- |
| `/tmp/grd-fe-quality-tools/gitleaks git --redact --no-banner --log-opts="--all" .` | Gitleaks 8.30.1 passed; 16 commits, no leaks. |
| `/tmp/grd-fe-quality-tools/gitleaks dir --redact --no-banner /tmp/grd-fe004-secret-scan` | Passed a scratch copy of requested changed/new files; no leaks. |
| `git diff --check` and final tracked/new-file review | Passed; no staging, commit, push, or tag. |
| `node scripts/auth-backend.mjs` and `pnpm dev` | Running for manual testing; HTTP checks to frontend and versioned API liveness both returned **200**. Frontend: **http://localhost:5173**; API: **http://localhost:3000/api/v1**. Worker disabled. |
| Playwright captures at 1440×900 light and 375×812 dark; visual inspection | Verified readable auth forms, official logo, theme control, restricted screen, and no mobile horizontal overflow. Captures are under `/tmp/fe004-*.png`, outside the repo. |

Initial local sandbox attempts could not open browser-server ports or Docker;
authorized escalated reruns passed. Early failures found an old synchronous route
test assumption and a throttling fixture missing CORS exposure for Retry-After;
both were fixed. Visual review removed a misleading expired-session notice for
first-time visitors, with a regression test and final full-suite rerun.

Follow-up: the user's Alt-Tab report was reproduced with
`pnpm exec vitest run src/app/providers.test.tsx`: an expected anonymous 401
incremented the session generation from 1 to 2 and cleared the sign-in draft.
The fix skips expiry teardown when the session is already anonymous. The same
full-provider regression now preserves both inputs, while a separate revoked-session
test confirms that protected data still clears. The targeted tests, `pnpm check`,
and `pnpm run ci` pass with the updated totals above. No new dependency was needed.
The real-backend scenarios were subsequently repeated for the Better Auth/proxy migration.

GitHub-hosted workflow execution and production-domain cookies/CORS were not run:
no hosted backend checkout arrangement or production hosting/domains are selected.
Full backend unit/integration suites belong to the separate backend session and
were not run here; the real auth browser scenarios use its freshly built API,
shared routing helper and migrations.

## Library audit requested in the follow-up

| Area inspected | Library or built-in decision | Remaining application code |
| --- | --- | --- |
| Auth fetching/cache/browser revalidation (`features/auth/api.ts`, `session.ts`) | Replaced the custom Query-backed auth fetch and focus/online listeners with [Better Auth](https://better-auth.com/docs/concepts/client). Pinned 1.7.7 matches the backend. | A `customFetchImpl` adapter preserves the existing public facade and timestamps/204s. Session policy retains restricted access, fail-closed logout, cleanup, and account generation boundaries. The adapter contains all access to the library session atom; upgrade tests must cover this seam. |
| HTTP/proxy (`api/api.ts`, `vite.config.ts`) | Existing Axios owns HTTP/cancellation; [Vite server.proxy](https://vite.dev/config/server-options.html#server-proxy) owns forwarding. | Safe product error messages and cross-account mutation cancellation stay in the application. Query cancellation alone does not cover mutations. No custom proxy server. |
| Forms, validation, routes (`auth-pages.tsx`, `schemas.ts`, `session-boundary.tsx`) | Existing React Hook Form + Zod/resolvers and TanStack Router. | GRD password/role policies and internal-return URL allowlisting remain explicit. Native `URL` performs parsing; no new validation/router package needed. |
| Cross-tab and UI cleanup (`session.ts`, providers) | Existing broadcast-channel; Better Auth handles ordinary session refresh signals. | `lock` must reach other tabs before logout succeeds, including failed logout; this is outside Better Auth's successful-signout notification. Private Query caches and UI must be cleared by the application. |
| Notifications (`notification-provider.tsx`, from FE-V1-003) | [Notistack 3.0.2](https://notistack.com/features/basic) can replace the hand-managed MUI queue; npm metadata supports React 19. The installed MUI Snackbar/Alert already owns rendering/timing. | Separate production-dependency approval requested; no answer received during this work, so the existing approved MUI queue remains. Preserve keyboard, theme and session teardown behavior if adopted. |
| Theme, countdown and test harness | MUI already owns theme/system-mode behavior; React/browser timers handle the short countdown; Testcontainers/Playwright/Nest already own the test lifecycle. | Theme storage exception handling, the retry deadline display, fixture seeding and GRD assertions remain small application adapters. No additional package is needed for these. |

Better Auth adds an adapter, so this is not claimed as a net line-count reduction.
It moves generic session behavior to the library while keeping the backend's
reviewed access policies. The user subsequently approved `/api/v1` for every backend route, including
health. That backend change is owned by a separate session. This frontend has no
unversioned fallback; its local harness imports the backend's shared `configureApiRoutes` helper,
also imported by `main.ts`. No backend source is edited here.

## Review Notes

- Better Auth owns the session profile; the policy snapshot exposes the validated
  public account for guards. Business data stays in Query. The adapter maps only
  the four supported backend operations, and normalizes anonymous 401 to `null`.
  Cancellation plus generation comparison prevents late requests from repopulating
  the next account. Session generation remounts transient UI/notification providers.
- The first business auth error can recheck immediately after ordinary focus
  restoration; subsequent errors share one request and a cooldown. Network/server
  failures retain a locked state with a two-second minimum cooldown enforced in
  `api.ts`, including library-driven browser revalidation. Better Auth also applies
  its built-in visibility recheck throttling.
  Retry-After is used when browser-readable; otherwise 429 waits 60 seconds.
- Cross-tab messages contain only `lock` and `changed`. Browser suspension or blocked
  storage may delay delivery; focus/online rechecks provide recovery. Failed logout
  is visibly unconfirmed, since the frontend cannot revoke an HttpOnly cookie by itself.
- Admin pages are still future tickets. Staff Admin URLs are forbidden; Admin
  navigation currently reaches the authenticated not-found page. The backend remains
  authoritative. Future feature requests must use this transport and Query cancellation,
  and live resources must register with the session cleanup boundary.
- Auth traces are disabled to avoid recording passwords/cookies. The real harness
  seeds only its new disposable database; README contains fixture-only login details.
  Stop its process with Ctrl-C to close the API and remove that disposable database.

## Remaining Issues

- The `/api/v1` backend implementation belongs to another session; its shared
  routing helper is integrated here. That session owns full backend checks/commit.

- The existing Vite chunk-size warning remains; auth increases the largest chunk
  to about **726 kB minified / 233 kB gzip**. Route-generator circular-dependency and
  Playwright color-environment warnings are non-fatal and remain visible.
- Hosted CI and production-domain verification remain unverified/deferred as above.
  Browser automation covers Chromium desktop/mobile, not a Firefox/WebKit matrix.
- Actual SSE synchronization, shipment data, and administration screens remain
  their assigned future tickets; no claim of their implementation is made here.

## Suggested Review Order

1. Transport and auth schemas/API.
2. Session lifecycle and its tests, followed by app composition and route boundary.
3. Forms and desktop/mobile browser tests.
4. Real-backend harness, configuration, and integration scenario.
5. Dependency and documentation diffs.

Approved commit partition:

1. `b8d50fd feat(auth): FE-V1-004 add Better Auth cookie sessions and isolation`
   - Files: all changed/new `src/` files, `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`,
     `playwright.config.ts`, `tsconfig.json`, `pnpm-lock.yaml`, and only the
     dependency additions in `package.json`. Exclude versioning/proxy hunks listed in the next commit.
   - Behavior: transport, schemas/forms, guarded routes, session isolation and
     ordinary unit/browser coverage.
   - Commit body records the follow-up cause: an unchanged anonymous 401 on
     focus must not remount the sign-in form and erase its draft.
2. `5816eca feat(api): FE-V1-004 use versioned API paths and Vite proxy`
   - Files: `vite.config.ts`, versioned base-URL hunks in `src/api/api.ts`/`api.test.ts`,
     the matching base-URL reference in `src/features/auth/api.ts`,
     `src/app/session.ts`, and versioned URLs in ordinary `e2e/` tests.
   - Behavior: forward frontend `/api/v1/*` unchanged; append the versioned prefix to
     the configured API origin in production builds.
3. `f555f2b test(auth): FE-V1-004 verify real backend and proxy cookie flows`
   - Files: `scripts/auth-backend.mjs`, `e2e-backend/auth.spec.ts`,
     `playwright.backend.config.ts`, `tsconfig.e2e.json`, `knip.json`, and only the
     backend-test script addition in `package.json`.
   - Behavior: opt-in isolated real API/database browser verification.
4. `docs(auth): FE-V1-004 record library choices and verification`
   - Files: `AGENTS.md`, `README.md`, `docs/v1/README.md`, `docs/v1/api-contracts.md`, `docs/v1/architecture.md`,
     `docs/v1/decisions.md`, `docs/v1/verification.md`, `docs/v1/tickets/README.md`,
     `docs/v1/tickets/FE-V1-004-api-and-auth.md`, and this implementation summary.
   - Behavior: recorded approval, auth behavior, manual use, ticket status and evidence.
