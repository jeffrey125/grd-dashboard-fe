# Verification and CI plan

## Quality gates

FE-V1-001/002 now provide these commands. The root
[README](../../README.md#commands) records their exact script contents.

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Reproducible install with peer/engine checks. |
| `pnpm format:check` / `pnpm lint` | Biome formatting, lint, and import organization for supported source/config files. |
| `pnpm typecheck` | Generate routes; strictly check app, tooling, and browser-test TypeScript. |
| `pnpm knip` | Unused code/dependencies using Vite, Router, and test integrations. |
| `pnpm test` / `pnpm test:coverage` | Run Vitest once; optional V8 coverage reports without a percentage threshold. |
| `pnpm build` | Typecheck and create a Vite production artifact. |
| `pnpm test:e2e` | Build and run isolated desktop/mobile Chromium smoke tests. |
| `pnpm check` | Format, lint, types, Knip, and unit/component tests. |
| `pnpm run ci` | Format, lint, Knip, coverage, then build/types/browser smoke. |

`pnpm ci` is pnpm 12's clean-install command, so **`pnpm run ci` is required**
to invoke the quality script. Gitleaks runs as a separate GitHub Actions job;
local `pnpm run ci` does not install/run the secret scanner. With the pinned
Gitleaks 8.30.1 binary installed, the matching local command is
`gitleaks git --redact --no-banner --log-opts="--all" .`.

`pnpm test:e2e:backend` now builds the sibling backend and frontend and runs the
separate real-browser auth suite. It requires Docker and the backend's installed
dependencies; a disposable PostgreSQL container receives real migrations and
fixture accounts. The API runs without the worker, on localhost:3000, and the
browser frontend on localhost:4175 and Vite development server on localhost:4176. It verifies credentialed CORS/HttpOnly cookies,
login/reload/logout, Staff denial, password replacement, Admin protection conflict,
and revoked sessions. A second scenario verifies login, reload, HttpOnly cookies,
and logout through the `/api/v1` development proxy, preserving the backend prefix. The local
harness calls the backend's shared `configureApiRoutes` bootstrap helper; versioned health succeeds and
unversioned auth/health return 404. This verifies frontend compatibility with the same helper imported by backend
`main.ts`; the backend session owns its remaining checks and commit. It never resets existing developer accounts/databases.
Network traces are disabled in both suites to avoid recording auth request bodies.
The ordinary suite covers desktop/mobile faults and cross-tab behavior using test
interception. GitHub-hosted backend testing remains deferred pending an authorized
checkout arrangement; local success is not production-domain validation.

FE-V1-005 adds deterministic stream/query race tests and desktop/mobile tests for
one connection across navigation, delayed stale warnings, quiet recovery and auth
outage locking. `e2e-backend/live.spec.ts` instruments native EventSource while
retaining the real transport. It verifies cookie credentials, committed shipment
and run events, notes-only silence, closed-stream recovery, deletion responses,
and heartbeat-driven revocation without a page reload through both direct API
access and the Vite proxy. All fixtures use the disposable database and disabled
worker; they do not call real carriers. Positive tracking payload validation and
query/404/fetch-race behavior use deterministic registered query consumers; the
shipment-list UI now exists in FE-V1-006; detail and carrier administration UI
remain in their later tickets.

Biome excludes the generated route tree and supports JS/TS, JSON/JSONC, and CSS;
Markdown/YAML/HTML/shell/assets are outside that formatter/linter gate. Workflow
syntax was separately checked with actionlint. Knip's installed framework plugins
recognize route imports and test/config entries without blanket ignores.

Vitest teardown unmounts the DOM, restores mocks/stubs/timers, clears storage, and
route tests cancel/clear their per-test Query clients and destroy memory history.
Coverage includes untested application modules; only test/setup, declarations,
and generated routes are excluded. Initial unit line coverage is 60%, with the
entry/provider wiring covered by browser smoke rather than unit instrumentation.

Playwright starts a fresh production preview on strict port 4174 and refuses to
reuse an existing server. `pnpm exec playwright install chromium` installs its
browser locally; CI uses `--with-deps` on Ubuntu 24.04. Both desktop and 375px-wide
projects check the current homepage, assets, direct nested not-found URLs,
reload/keyboard/back navigation, overflow, and unexpected API/network failures.

Use React Testing Library with jsdom and accessible queries for behavior, not
implementation snapshots. Test important boundaries and races rather than writing
tests that merely repeat trivial implementation. Material UI itself does not need
duplicated upstream tests; test the customized theme and shared behavioral modules.

Use Playwright network interception for deterministic browser fixtures unless
another mocking package is explicitly approved. Those fixtures never enter the
runtime production bundle. They cannot substitute for real-backend acceptance.

## CI adaptation from Tom

GitHub Actions on PRs and pushes to `main`, with explicit permissions, timeouts,
reproducible pnpm installation, and cancellation of obsolete PR checks. Include
format, lint, types, Knip, tests/coverage, production build, and secret scanning.
Add Chromium browser smoke/behavior coverage with the built artifact, including
direct deep links, and retain bounded diagnostic artifacts on failure without
secrets. Record coverage; do not invent a percentage target before a meaningful
baseline exists.

Husky runs lint-staged safe formatting/lint fixes on intended staged files.
Typechecks/tests are full CI/local gates rather than silently running in partial
file mode. No script should stage unrelated working-tree changes.

Do not copy Tom's GHCR publishing, SSH deployment, DigitalOcean environment,
Docker delivery assumptions, or production-env sync scripts. No production
secrets are needed for ordinary CI. Future real-backend CI must identify an
authorized backend checkout/ref, disposable database, fixtures, and credentials;
never invent private-repository access or silently skip a required integration job.
Local real-backend checks remain a release-readiness requirement while that CI
checkout arrangement is unresolved.

## Acceptance matrix

| Group               | Required evidence                                                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                | Sign-in/out, reload restoration, invalid credentials, throttling, restricted-password redirect, post-change re-login, expired/revoked sessions, role denial, cleanup and no cached cross-user leakage.                                                                                                     |
| Create              | One/ten rows, 11 rejected, leading zeros/case, duplicate rules, all-duplicate 200, mixed 201, invalid atomic batch, 1-based row errors, disabled carrier, double-click prevention, correct list redirect/toast.                                                                                            |
| List                | Default Active and created-desc, stable ties, URL navigation, all five controls, full-dataset filtering/sorting, correct overlapping counts, page reset/clamp, 1,000–10,000-record representative backend fixtures.                                                                                        |
| Detail/actions      | Notes/clear, dirty draft vs live update, valid/invalid pause/resume, threshold refresh, manual-paused/terminal/disabled constraints, coalesced refresh, queued/running/terminal outcomes, safe delete and re-add, verification link safety.                                                                |
| Read models/history | No snapshot, partial null fields, unchanged success, stale known data after failure, latest completed lookup despite pending run, public UUIDs, history pagination, missing/deleted shipment, no source/internal data leakage.                                                                             |
| Overview            | Server aggregates independent of page, problem-first layout, exact attention predicate, upcoming date boundaries, recent changes, honest empty/error/stale states, card links.                                                                                                                             |
| SSE/review          | Subscribe-before-fetch; event during fetch; burst coalescing; resync without replay; disconnect/revocation; multiple subscribers; off-page tracking change; no alert for notes-only change; route-only audio; duplicates/out-of-order events; newer-change acknowledgement race; account-isolated storage. |
| Admin               | Staff denial, create/update/reset/activate accounts, protected Admin conflicts, password secrecy/revocation, carrier validation/modes/null RPM, focus/reconnect refresh.                                                                                                                                   |
| UX                  | Keyboard and focus, narrow/desktop layout, both themes, favicon at tab sizes, dirty-form navigation, disabled audio/storage, timezone/DST and date-only values.                                                                                                                                            |

For backend prerequisites, use its installed Vitest/Supertest/PostgreSQL tooling
and current scripts. Verify migrations and joins against real disposable
PostgreSQL, not SQLite. Assert contract and transaction behavior, including rolled-
back notifications and count/page consistency. Fixtures must not hit carrier
services or contain real provider credentials.

## Real local integration and handoff

Read the backend README before starting services. Use isolated fixtures and an
authorized test account; do not reset a user's existing account or expose provider
credentials to obtain a test login. Production-origin cookie/CORS verification
stays deferred until hosting/domains are actually configured; local success does
not prove production behavior.

After a full-stack implementation, start/reuse frontend and backend, verify both
are reachable, report their actual local URLs, and leave them running when the
environment permits. Check whether the worker is needed for that test and avoid
accidental live carrier calls. Record process/start instructions and blockers.

Every handoff names the exact checks run, results, and checks not run. Required
checks that cannot run leave a verification limitation; a passing fixture-only
suite does not claim backend parity. FE-V1-002 local evidence is in its
[implementation summary](implementation-summary/FE-V1-002-implementation-summary.md).
GitHub-hosted execution remains unverified until this repository has a remote and
the workflow is run there; local actionlint checks are not a hosted Actions run.

## FE-V1-006 shipment-list verification

The list suite covers defaults, page/search/sort URLs, placeholder destinations
and return navigation, blocked invalid dates, explicit Apply, stale/error and
previous-page states, request cancellation, page clamping, eligibility, conflicts,
and a row disappearing while its menu is open on desktop and 375px Chromium.

The isolated backend harness seeds 1,000 shipments through a test-only fixture
module: 800 Active, 100 manually paused, 50 threshold paused, 50 Delivered, and
two active shipments with failed lookups. All have tied creation timestamps and
known ETA. The browser suite verifies stable pagination, off-page notes search,
overlapping counts, carrier/outcome/date/undelivered combinations, and row actions
through both direct API access and the Vite proxy. Its dedicated employee account
avoids exhausting the auth suite's per-email login allowance. No worker or real
carrier calls are involved. See the FE-V1-006 implementation summary for results.

The FE-V1-006 follow-up covers calendar selection and malformed-date correction,
explicit clearing, touch dialogs, date-only preservation in Los Angeles, and
Day.js leap-year/early-year/DST boundaries. Mobile scenarios exercise cards,
shared commands, sorting/page controls, long text and resizing back to the grid.
