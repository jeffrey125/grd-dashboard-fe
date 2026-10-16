# FE-V1-013 implementation summary

## Summary

Implemented Admin carrier list/details and settings editing on `feature/dashboard-v1`.
The interview selected read-only details, explicit Edit/Save/Cancel, protected drafts,
conflict choices and overwrite confirmation, failed-read save blocking, and desktop
table/mobile cards. No production dependency or backend carrier behavior was changed.
The separately requested Upcoming restoration is recorded in
[its own summary](FE-V1-010-upcoming-restoration.md).

## Changes Made

- Added `/admin/carriers` and `/admin/carriers/$carrierId`, with existing session/role
  guards and UUID validation. Staff retains existing carrier reads on shipment screens.
- Mirrored the actual API validation: trimmed names, threshold 2–32767, interval
  1–32767, RPM 1–32767/null, UPS request-only, EchoShip/FFE request/browser. Code/UUID
  remain read-only. Timing guidance describes carrier minimums and approximate scheduling.
- PATCH contains only fields changed from the edit baseline. Background changes retain
  drafts and show latest changed values. Use latest resets the draft; Keep my draft
  requires save confirmation. A newer server value invalidates the older confirmation.
  Failed reads block Save until successful recovery; failed writes retain input.
- Disabling confirms effects on creation/tracking while preserving existing shipments.
  Saves reconcile carrier settings and call the existing carrier-dependent invalidation
  coordinator, refreshing creation choices, shipment eligibility and overview data.
  Focus after 30 seconds and reconnect/resync revalidate without a carrier SSE event.
- Internal navigation/reload protects dirty input. Session teardown discards drafts.
  Pending writes lock controls and prevent duplicate submissions; rate limits expose cooldown.

## Files Changed

Paths are relative to this frontend repository; shared documentation is split by
feature-specific hunks in the proposed commit plan.

| File | Review purpose |
| --- | --- |
| `src/features/carriers/schemas.ts` | Full carrier response, strict settings/mode validation and changed-field projection. |
| `src/features/carriers/api.ts` | Credentialed list/detail/PATCH adapter, cancellation and response identity checks. |
| `src/features/carriers/carrier-editor.tsx` | Draft baseline, conflicts, confirmations, mutations, invalidation and navigation guard. |
| `src/features/carriers/pages/carriers-page.tsx` | Responsive Admin catalog and load/error states. |
| `src/features/carriers/pages/carrier-detail-page.tsx` | Read-only identity/settings, editor lifecycle and read-failure gating. |
| `src/features/carriers/index.ts` | Public page exports. |
| `src/routes/admin.carriers.index.tsx` | Thin list route. |
| `src/routes/admin.carriers.$carrierId.tsx` | UUID-validated detail route. |
| `src/app/route-tree.gen.ts` | Generated registration for the two new routes. |
| `src/features/carriers/schemas.test.ts` | Numeric/null/mode/immutable-field and changed-field boundaries. |
| `src/features/carriers/api.test.ts` | Request/cancellation and malformed/mismatched response checks. |
| `src/test/carrier-fixture.ts` | Shared test-only carrier record. |
| `e2e/carriers.spec.ts` | Desktop/mobile forms, conflicts, errors, eligibility, focus/reconnect, roles and teardown. |
| `e2e-backend/carriers.spec.ts` | Real cookie/API/PostgreSQL validation, UI editing, disable behavior and Staff restrictions. |
| `README.md` | Implemented route/workflow documentation; carrier-specific hunks. |
| `docs/v1/ui-spec.md` | Agreed carrier behavior. |
| `docs/v1/decisions.md` | Interview decisions and reuse of the approved stack. |
| `docs/v1/verification.md` | Carrier acceptance evidence. |
| `docs/v1/README.md` | Implementation status and summary link. |
| `docs/v1/tickets/README.md` | Ticket status and evidence link. |
| `docs/v1/tickets/FE-V1-013-carrier-administration.md` | Implemented/verified status. |
| `docs/v1/implementation-summary/FE-V1-013-implementation-summary.md` | This handoff and commit partition. |

## Verification

| Exact command / check | Result |
| --- | --- |
| `pnpm check` | Passed format, lint, generated routes, application/tooling/browser TypeScript, Knip and all 169 then-current unit tests. |
| `pnpm exec playwright test e2e/carriers.spec.ts e2e/overview.spec.ts --workers=2` | Passed 22 desktop/mobile cases. Initial sandbox server launch was denied; permitted rerun passed. |
| `pnpm run ci` | Passed format, lint, Knip, coverage, typechecks, production build, 174 final unit tests and 126 final Chromium desktop/mobile cases. Unit line coverage 63.97%; browser execution is not included in that percentage. |
| `pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/carriers.spec.ts e2e-backend/overview.spec.ts` | Passed all 4 real-API cases, direct API/preview and mobile development proxy. First attempt exposed a Node Day.js extension issue, fixed in the separate Overview change. |
| Backend: `pnpm check` | Passed formatting, lint, types, 264 unit tests and build. |
| Backend: `pnpm exec vitest run --project integration test/integration/dashboard-overview.spec.ts test/integration/shipment-search.spec.ts --project e2e test/e2e/dashboard.spec.ts test/e2e/carriers.spec.ts` | Passed all 35 tests in 4 files using disposable PostgreSQL. |
| `git diff --check` in both repositories | Passed. Final source/test/documentation diffs reviewed; initial frontend worktree was clean and backend's unrelated `sample.txt` remains untouched. |
| Visual inspection | Reviewed carrier mobile dark and Overview mobile light captures; browser suites also render both themes at desktop/mobile widths and check overflow. |
| Local reachability | Existing frontend `http://localhost:5173` returns 200; API `http://localhost:3000/api/v1/health/ready` reports application/database up; frontend `/api/v1/health/live` proxy returns ok. |

Full remote Actions, production-origin behavior, live carrier I/O and release/container
checks were not run; hosting/deployment is deferred. The worker stayed disabled.
Non-failing tool warnings include router generation, the existing large bundle, and
one duplicate-Emotion warning during the development proxy run; browser assertions passed.

## Review Notes

Conflict detection is best-effort read comparison. The backend has no conditional
write token, so a change between the latest read and PATCH remains last-write-wins.
Only baseline-changed fields are sent, retaining unrelated server edits. No save
response is installed directly over newer cached projections. Carrier Admin reads use
`carrier-settings` keys, separate from shipment carrier summaries, but register with
the same live coordinator. There is no new polling loop or cross-tab settings channel.

The local API is the disposable harness started with `node scripts/auth-backend.mjs`;
it remains running with the existing frontend. Manual Admin login is
`frontend-admin@example.test` / `admin fixture password` (isolated test database only).
Stop the harness with Ctrl-C to remove its disposable database.

## Remaining Issues

No functional acceptance blocker. Commits await explicit approval. Production,
hosted CI and live provider verification remain outside this local implementation.
The non-failing development/tool warnings above were not expanded into unrelated fixes.

## Suggested Review Order

1. `schemas.ts` and `api.ts`, then their tests.
2. `carrier-editor.tsx`, detail/list pages and route registration.
3. Browser/real-backend tests, followed by the updated contracts and this summary.

Proposed frontend carrier commit: `feat(carriers): FE-V1-013 implement carrier administration`.
It contains the files above and only their carrier-related shared-documentation hunks.
The Upcoming feature is a separate frontend commit and backend commit described in
the restoration summary. Nothing has been staged or committed.
