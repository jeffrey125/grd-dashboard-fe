# Verification and CI plan

## Quality gates

FE-V1-001/002 will establish and document actual package scripts. Until then these
are **target commands**, not commands that currently exist:

| Command                            | Purpose                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`   | Reproducible install after a lockfile exists.                      |
| `pnpm format:check` / `pnpm lint`  | Biome checks for supported application/config files.               |
| `pnpm typecheck`                   | Route generation where needed and strict TypeScript.               |
| `pnpm knip`                        | Unused code/dependencies with Vite/router/test entries configured. |
| `pnpm test` / `pnpm test:coverage` | Vitest unit/component suite, with a compatible coverage provider.  |
| `pnpm build`                       | Vite production artifact.                                          |
| `pnpm test:e2e`                    | Deterministic Playwright suite.                                    |
| `pnpm test:e2e:backend`            | Opt-in real local backend integration suite.                       |
| `pnpm check` / `pnpm ci`           | Local/CI aggregate gates defined by FE-V1-002.                     |

Use React Testing Library with jsdom and accessible queries for behavior, not
implementation snapshots. Test important boundaries and races rather than writing
tests that merely repeat trivial implementation. Generated shadcn primitives need
integration coverage where customized, not a copied exhaustive upstream suite.

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
suite does not claim backend parity. This planning milestone has no application
test, typecheck, lint, build, or server command to run yet.
