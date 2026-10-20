# SQ-V1-009 implementation summary

## Summary

Added full-stack quote readiness acceptance. Live quote readiness remains blocked
by provider sender/login failures; no successful live sample rates were obtained.
See the backend [readiness matrix](../../../../grd-dashboard-be/docs/v1/shipping-quotes-readiness.md)
for cross-repository evidence and operational limits.

## Changes Made

- Added real-backend browser checks for concurrent idempotent submissions, partial
  results, SSE reconnect/snapshot refetch and multi-group estimate labels.
- Added international capability, original metric input, native CAD display,
  requested-option uncertainty, unknown duties/taxes and absent purchase-action checks.
- Added an explicit fixture release gate so the browser observes partial results
  before the second domestic provider finishes. The release route exists only in
  the disposable harness and is registered before Nest initializes its 404 handler.
- Updated the container migration expectation from 8 to all 15 current migrations.
- Reused installed Playwright and Node timers; no production dependencies or UI
  behavior changed. Fixture rates are labelled simulated and never call providers.

## Files Changed

| File | Purpose |
| --- | --- |
| `e2e-backend/quote-readiness.spec.ts` | Staff full-stack readiness behaviors and safe action boundaries. |
| `scripts/quote-readiness-fixture.mjs` | Deterministic external provider substitute and explicit completion gate. |
| `scripts/auth-backend.mjs` | Opt-in disposable readiness wiring; no production route added. |
| `test/container/runtime.test.ts` | Match migration count to the complete quote feature. |
| `docs/v1/verification.md` | Readiness commands and fixture limits. |
| This summary | Verification and review handoff. |

## Verification

- `pnpm run ci`: passed format, lint, Knip, 210 unit/component tests in 34 files,
  typechecks, production build and 126 desktop/mobile browser tests. Coverage:
  61.82% statements, 48.45% branches, 54.98% functions, 63.46% lines.
- `pnpm typecheck`: passed after final fixture gate edits.
- `FE_TEST_QUOTE_READINESS=true pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/quote-readiness.spec.ts`: final explicit-release suite passed, 2 tests.
- Full real-backend suite with API port 3016: 16 passed, 5 skipped, 6 failed;
  legacy tests hardcode port 3000. Rebuilt for port 3000 and reran: 21 passed,
  5 opt-in skips, 1 timeout before the Vite-proxy login form in `live.spec.ts`.
  Final unchanged full rerun after backend coverage completed passed: 22 tests,
  5 explicit opt-in skips. The five skipped cases all passed in their separate
  opt-in commands below.
- `pnpm test:container`: initial run found stale migration count (`15` versus `8`).
  After correction, 4 passed, including fresh migrations and same-origin HTTPS.
- `pnpm test:container:http`: 3 passed, including HTTP-only routing and no worker.
- `FE_TEST_QUOTE_DEMO=true FE_TEST_QUOTE_RETRY=true pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/quote-history.spec.ts`: 1 passed.
- Provider admin scenario with `FE_TEST_PROVIDER_ADMIN=true`: 1 passed. Running admin
  and history together initially caused a 400 because admin intentionally leaves a
  provider disabled; each scenario now has its documented separate disposable database.
- `FE_TEST_QUOTE_DEMO=true pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/quotes.spec.ts`: final run 3 passed. An earlier run during combined
  backend coverage timed out with sign-in/quote execution still pending; unchanged
  tests passed after that workload finished.
- `git diff --check`: passed. Final independent standards/specification reviews: no
  residual findings after deterministic-release and route-order corrections.
- Manual frontend `http://localhost:5173/` and backend readiness
  `http://localhost:3017/api/v1/health/ready`: HTTP 200; left running with disposable
  fixture data. Staff account: `frontend-staff@example.test` / `staff fixture password`.

## Review Notes

Started at `69a83f73a9e5bb8e0bfc31df9c443bdd9145bb9f` with a clean tracked tree.
The backend had unrelated untracked `work/` content; it was not changed.
Standards review identified the timing-sensitive fixture; explicit release fixes
it. Follow-up review identified route ordering, corrected before initialization.
Specification review found no implementation defects; live rate evidence remains
an explicit external blocker.

The API/worker/database/SSE are real in these browser checks. Only external provider
I/O uses synthetic prices. CAD output tests display semantics, not a verified live
provider currency capability. Required business contacts remain in authenticated
snapshots under the approved privacy decision; diagnostics and SSE exclude them.

## Remaining Issues

- Live sample rates remain unsuccessful for both providers in both modes.
- Deployment was subsequently requested for `debian-vm`; SSH to 192.168.100.83
  currently reports `No route to host`. No remote changes made.

## Suggested Review Order

1. Browser readiness assertions and deterministic fixture adapter.
2. Test harness route/worker registration.
3. Container migration expectation and verification documentation.

## Proposed commits — final approval required

1. `test(shipping-quotes): SQ-V1-009 add full-stack readiness acceptance`
   - Files: `e2e-backend/quote-readiness.spec.ts`,
     `scripts/quote-readiness-fixture.mjs`, `scripts/auth-backend.mjs`,
     `docs/v1/verification.md`, this summary.
   - Purpose: deterministic browser acceptance with real API/database/SSE and
     synthetic provider I/O; documented evidence and limitations.
2. `test(release): SQ-V1-009 verify all quote migrations in containers`
   - File: `test/container/runtime.test.ts`.
   - Purpose: verify all fifteen migrations in the existing LAN container gate.

Nothing is staged or committed. Deployment authorization does not imply commit approval.
