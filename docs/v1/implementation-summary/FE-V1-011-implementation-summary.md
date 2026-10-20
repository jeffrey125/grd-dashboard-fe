# FE-V1-011 implementation summary

## Summary

Implemented route-scoped tracking alerts, optional Kieffy meow audio and persistent
account/browser review highlights. Visible and background `/shipments` tabs receive
summaries, with one sound across tabs. Only visible detail views automatically
review displayed current revisions. Local quality, browser and real-backend checks
pass; commits await explicit approval.

The frontend worktree was clean at entry. The backend's pre-existing untracked
`sample.txt` was left untouched. Later approved refinements changed the backend
overview/search contract alongside the frontend. FE-V1-005/008 and
BE-V1-005 prerequisites were checked against actual event/detail implementations
and their verification summaries. The grilling interview established background
alerts, one sound across tabs, visible-only detail review and asset reuse. The
user approved the final existing-library/native-browser approach before coding.

## Changes Made

- Added feature-owned, versioned review storage, authoritative revision reconciliation,
  cross-tab updates, pending-event retention and compare-and-swap acknowledgement.
  Event timestamps and UUID lexical order never decide which snapshot is newer.
- Added exact `/shipments` route gating, two-second distinct-shipment summaries,
  one visible tracking toast per tab, six-second dismissal and a close button.
  Existing action notifications remain independent and available on other routes.
- Added native audio with the approved unmodified bundled asset, default-off saved
  preference, preview/re-enable control, leader election and atomic sound claims.
  Playback denial pauses further automatic attempts until an explicit retry.
- Added desktop row/mobile card highlights and Updated indicators. Tracking Number
  links acknowledge the displayed revision before opening shipment detail. The mark-seen
  action affects the current results page only. Visible Overview and current-snapshot
  History views acknowledge only the revision actually displayed and re-confirmed.
- Added race/storage tests, desktop/mobile browser checks, real PostgreSQL/SSE
  acceptance, sound provenance, implementation documentation and ticket status.
- Applied the later product simplification: Overview now contains four counts and
  Needs attention only; shipment filters are search/carrier only; Latest lookup/run
  and Last attempted were removed from list/table/card views. The backend rejects
  removed lookup/date/undelivered filters and last-attempted sorting.

## Files Changed

Paths are relative to the frontend repository. Each row identifies its review purpose.

| File | Purpose |
| --- | --- |
| `src/features/tracking-updates/review-store.ts` | Versioned account storage, validated identities, capacity/fallback handling, cross-tab notifications, atomic state/sound claims and CAS tokens. |
| `src/features/tracking-updates/review-controller.ts` | Bounded authoritative reads, pending revision reconciliation, quiet resync, deletion and acknowledgement races. |
| `src/features/tracking-updates/review-context.tsx` | React lifecycle, route-scoped summaries, controls and visible-detail acknowledgement hooks. |
| `src/features/tracking-updates/sound.ts` | Native audio, saved consent, per-tab denial/retry and package leader election. |
| `src/features/tracking-updates/review.test.ts` | Fourteen state/storage/controller boundary and race tests. |
| `src/features/tracking-updates/index.ts` | Public review UI/provider/hook exports. |
| `src/app/tracking-review.tsx` | App-owned session and public Shipment-reader composition. |
| `src/app/router.ts` | Mount review composition inside Router context with `InnerWrap`. |
| `src/app/live-login.test.tsx` | Stub jsdom's unavailable media pause while preserving the StrictMode single-stream regression. |
| `src/features/shipments/index.ts` | Export the existing public Shipment read adapter to app composition. |
| `src/features/shipments/pages/shipments-page.tsx` | Sound and displayed-page review controls, disabled during unavailable/stale-transition results. |
| `src/features/shipments/shipment-grid.tsx` | Theme-aware desktop/mobile highlights and textual Updated indicators. |
| `src/features/shipments/pages/shipment-detail-page.tsx` | Review successfully displayed current Overview revisions only while visible. |
| `src/features/shipments/history-section.tsx` | Review the current snapshot displayed on History page one; leave older pages unacknowledged. |
| `public/sounds/kieffy-meow.m4a` | Unmodified approved one-second notification audio. |
| `public/sounds/README.md` | Source commit, explicit owner reuse approval and SHA-256 provenance. |
| `e2e/tracking-review.spec.ts` | Ten desktop/mobile scenarios for alerts, audio, review, routes, history, storage and session isolation. |
| `e2e-backend/tracking-review.spec.ts` | Real notes-only silence, committed tracking alerts, reload and detail review through direct API and mobile proxy. |
| `scripts/auth-backend.mjs` | Label the disposable test database by API port so the integration fixture resolves exactly one isolated target. |
| `README.md` | Implemented behavior, persistence and browser limitations. |
| `docs/v1/README.md` | FE-V1-011 status and evidence link. |
| `docs/v1/tickets/README.md` | Ticket index status and evidence link. |
| `docs/v1/tickets/FE-V1-011-alerts-and-review.md` | Implemented/verified status and review evidence. |
| `docs/v1/decisions.md` | Approved interview decisions, dependencies, retention and failure behavior. |
| `docs/v1/architecture.md` | Runtime boundaries, authoritative reconciliation, coordination and bounded storage. |
| `docs/v1/ui-spec.md` | Final alert/review/denial interactions. |
| `docs/v1/verification.md` | Test coverage and disposable real-backend verification design. |
| `docs/v1/implementation-summary/FE-V1-011-implementation-summary.md` | This handoff, complete manifest, exact evidence and commit proposal. |

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm run ci` | Passed formatting, lint, Knip, 139 unit tests with coverage, types/build and all 102 desktop/mobile browser cases at the full-regression checkpoint. |
| `pnpm check` | Passed final formatting, lint, all TypeScript configurations, Knip and all 141 unit tests after storage-limit/lock-failure hardening. |
| `pnpm exec vitest run src/features/tracking-updates/review.test.ts src/app/live-login.test.tsx` | Passed 15 focused tests, including 14 new revision/storage/controller tests. |
| `pnpm build` | Passed after final runtime hardening; normal localhost:3000 API origin retained. |
| `pnpm exec playwright test e2e/tracking-review.spec.ts` | Passed 18 desktop/mobile cases, including saved consent after reload, native M4A decoding, denial recovery and visual captures, before the final two history cases were added. |
| `pnpm exec playwright test e2e/tracking-review.spec.ts --grep 'older history'` | Passed both added desktop/mobile history-review cases. All 20 review cases have passing evidence across these runs. |
| `pnpm exec playwright test e2e/tracking-review.spec.ts --grep 'bursts'` | Passed both burst/reload cases and regenerated final light/dark visual evidence. |
| `pnpm --dir ../grd-dashboard-be build` | Passed; no backend source modifications. |
| `pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/tracking-review.spec.ts` | Passed both real PostgreSQL/HTTP/SSE scenarios against the final build, through production preview/direct API and mobile Vite proxy. No worker or carrier I/O. |
| `pnpm exec tsc --noEmit -p tsconfig.e2e.json` | Passed after the final history assertion. |
| `git diff --check` | Passed; final source/asset/test/documentation changes reviewed against the clean frontend starting state. |
| Visual inspection | Inspected desktop and 375px mobile screenshots in light/dark themes; controls, updated indicators and toast text fit without horizontal overflow. Copies retained under `/tmp/grd-review-011-visuals/`. |
| Sound provenance | Copied asset matches SHA-256 `79df7051deecb09f9d8d8d69e17ae8df11e48b524fef3ff7e182eba097b6fe37`; native Chromium play resolves after an explicit gesture. Human audible playback was not independently assessed. |
| `pnpm check` (final refinement checkpoint) | Passed formatting, lint, all TypeScript configurations, Knip and all 135 unit tests. |
| `pnpm --dir ../grd-dashboard-be check` | Passed formatting, lint, typecheck, all 263 backend unit tests and build. |
| Backend integration: shipment search + dashboard overview | Passed 10/10 against disposable PostgreSQL. |
| `pnpm exec playwright test e2e/overview.spec.ts e2e/shipments.spec.ts` | Passed 28/28 desktop/mobile cases. |
| Real-backend overview + shipment browser suites | Passed 4/4 through production preview and Vite proxy on isolated API port 3020. |
| Reachability: `http://127.0.0.1:5173` and `http://localhost:3021/api/v1/health/live` | Both return HTTP 200 and are left running for manual testing. |
| Read-only Node relative-link check | All relative links resolve in the ten changed Markdown files. |

The full-regression coverage checkpoint reported 68.13% lines, 65.70% statements,
51.24% branches and 58.99% functions. Browser-only behaviors are not instrumented
in that unit coverage figure; no coverage threshold was introduced.

Initial browser test failures were assertions that expected asynchronous sound
permission/storage updates to be synchronous, and one assertion that checked only
the confirmed unseen flag instead of including pending unseen IDs. The tests now
wait for the relevant state and check both forms of unseen changes. The initial
sandbox server attempt lacked localhost binding permission; approved local test
runs passed with the required access.

Not run: the entire older real-backend suite, hosted GitHub Actions, production
origin checks, Firefox/Safari, worker execution or live carriers. Local Gitleaks is
not installed. Existing Router CLI circular-dependency and Vite large-chunk warnings
remain; they do not fail the build.

## Review Notes

- A revision is identified by public UUID; ordering comes from fresh authoritative
  reads, not timestamps. Random storage tokens reject stale cross-tab writes and
  concurrent acknowledgements. New observations survive failed reads in a pending list.
- Generic invalidations check deletion without silently consuming a later precise
  tracking event. Resync is quiet. Four concurrent review reads per tab and a 100 ms
  queue window bound reconciliation; existing Query invalidation remains authoritative
  for displayed business data.
- “Displayed” in the bulk action means the current results page, not only viewport
  pixels. It never clears other pages. Detail auto-review requires a visible document,
  a successful settled response and a displayed UUID matching a fresh current read.
  History page two/older snapshots never review an undisplayed current revision.
- Storage retains at most 10,000 shipment records/account, 32 unresolved IDs/shipment,
  256 recent sound claims and four million serialized characters. Reviewed records
  are evicted first; unseen marks never expire silently. Full capacity warns and
  retains existing marks. Failed/invalid storage uses memory with a warning; reload
  can lose memory-only changes. Automatic audio pauses without durable coordination.
- Browser background suspension/autoplay policy can delay or prevent sound. Saved
  consent is retained, and a denied tab requires explicit retry. Coordination uses
  installed `broadcast-channel` leader election plus native Web Locks; no new package,
  lockfile change, API endpoint, schema migration or production infrastructure is added.

Manual testing uses `pnpm dev --host localhost` at `http://localhost:5173` and
`FE_TEST_API_PORT=3021 node scripts/auth-backend.mjs` at `http://localhost:3021/api/v1`, with a new disposable
database and no worker. Fixture login: `frontend-shipments@example.test` /
`shipments fixture password`. These are synthetic local credentials only.
Stop the harness with Ctrl-C to remove its disposable database; it does not touch
an existing developer database.

## Remaining Issues

None within the implemented FE-V1-011 scope. Verification/platform limits are
listed above. Commit approval, hosted CI, deployment, push/merge and release tagging
remain separate pending actions.

## Suggested Review Order

1. `review-store.ts`, `review-controller.ts` and `review.test.ts` for persistence/races.
2. `sound.ts`, `review-context.tsx` and app composition for lifecycle/route coordination.
3. Shipment list/detail/history integrations, sound provenance and browser scenarios.
4. Disposable backend fixture/test, then decisions, verification and this handoff.

## Proposed commits — approval required

No files have been staged or committed for this ticket.

1. `feat(tracking): FE-V1-011 add tracking alerts and review highlights`
   - Behavior: implement persistent review state, route-scoped summaries, one-sound
     coordination, shipment UI integration and deterministic unit/browser coverage.
   - Files: all six changed/new files in `src/features/tracking-updates` listed above;
     `src/app/tracking-review.tsx`, `src/app/router.ts`, `src/app/live-login.test.tsx`;
     all five changed files in `src/features/shipments` listed above;
     `public/sounds/kieffy-meow.m4a`, `public/sounds/README.md`;
     `e2e/tracking-review.spec.ts`.
2. `test(tracking): FE-V1-011 verify alerts against the real API`
   - Behavior: isolate the fixture database and verify notes-only silence versus real
     committed tracking alerts through both frontend access paths.
   - Files: `scripts/auth-backend.mjs`, `e2e-backend/tracking-review.spec.ts`.
3. `docs(tracking): FE-V1-011 record decisions and verification`
   - Behavior: record agreed behavior, limits, architecture, exact verification and status.
   - Files: `README.md`; `docs/v1/README.md`, `docs/v1/architecture.md`,
     `docs/v1/decisions.md`, `docs/v1/ui-spec.md`, `docs/v1/verification.md`,
     `docs/v1/tickets/README.md`, `docs/v1/tickets/FE-V1-011-alerts-and-review.md`,
     `docs/v1/implementation-summary/FE-V1-011-implementation-summary.md`.
4. `refactor(shipments): FE-V1-011 simplify overview and shipment list`
   - Behavior: remove Upcoming deliveries and Recent tracking changes, reduce list
     filters/columns, retain carrier filtering, and align mock/real-backend coverage.
   - Files: Overview/list implementation and tests, package manifest/lockfile, and
     the corresponding README, contract, decision, ticket and verification docs.

The sibling backend requires its own commit:
`refactor(shipments): BE-V1-004 simplify overview and search contract`. It includes
the dashboard/search schemas, PostgreSQL queries, tests and frontend handoff; the
untracked `sample.txt` is excluded.
