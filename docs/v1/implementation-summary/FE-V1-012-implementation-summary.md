# FE-V1-012 implementation summary

## Summary

Implemented Admin-only account list/create/detail pages using the existing account
API and Better Auth session adapter. Names and role are editable; email is disabled
after creation. Existing session-revocation policies are unchanged. The work is
committed on `feature/dashboard-v1` in the approved two-commit partition.

The frontend worktree was clean at entry. The backend's pre-existing untracked
`sample.txt` was left untouched; no backend source or dependencies were changed.
Prerequisites were checked against actual auth guards, account controller/service,
schemas, session adapter and existing test harness, then exercised with disposable
PostgreSQL through the real API. The grilling interview established the UI scope,
confirmations and omission of concurrent-edit warnings. The user explicitly required
Better Auth; the installed library remains the session owner.

## Changes Made

- Added `/admin/accounts`, `/admin/accounts/new` and UUID-validated account detail
  routes, using the existing guarded shell, breadcrumbs and safe error states.
- Added desktop Data Grid/mobile cards, name/email search across the fetched list,
  and URL-owned local pagination. Account reads refresh on focus/reconnect.
- Added validated creation and read-only-first Edit/Save/Cancel. PATCH includes only
  changed names/role; email and unchanged fields are excluded. Dirty navigation is
  protected and background refreshes retain drafts without conflict warnings.
- Added confirmed role/access changes and Admin-issued password reset. Self-access
  removal is disabled; own-password actions use the existing Change password page.
  Passwords stay out of query/mutation caches, storage, URLs and notifications.
- Added an authoritative Better Auth own-profile refresh after name edits, existing
  cross-tab invalidation, safe conflict messages, retry cooldowns and acceptance tests.

## Files Changed

Paths are relative to this repository. All changes belong to FE-V1-012.

| File | Review purpose |
| --- | --- |
| `src/features/auth/session.ts` | Recheck edited own profiles through Better Auth, wait for older reads, and notify other tabs. |
| `src/features/auth/session.test.ts` | Verify an own-profile refresh bypasses the normal cooldown. |
| `src/features/auth/index.ts` | Export the public profile schema/type and existing cooldown hook across the feature boundary. |
| `src/features/accounts/schemas.ts` | Strict create/edit/reset validation and changed-field PATCH construction. |
| `src/features/accounts/api.ts` | Versioned account endpoint adapters, safe response validation and allowlisted conflicts. |
| `src/features/accounts/use-account-write.ts` | Local pending/error/retry state, duplicate-submit lock and session-safe error handling without MutationCache. |
| `src/features/accounts/account-editor.tsx` | Names/role editor, disabled email, role confirmation and draft preservation. |
| `src/features/accounts/access-actions.tsx` | Confirmed activation/reset, self restrictions and own-password link. |
| `src/features/accounts/unsaved-changes.tsx` | Internal navigation discard dialog and native unload protection. |
| `src/features/accounts/pages/accounts-page.tsx` | Full-array account search, URL pagination, desktop grid and mobile cards. |
| `src/features/accounts/pages/create-account-page.tsx` | Creation, duplicate-email field feedback, private credential instructions and success navigation. |
| `src/features/accounts/pages/account-detail-page.tsx` | Authoritative account read, profile/access sections, missing/forbidden/error states. |
| `src/features/accounts/index.ts` | Public route-facing feature exports. |
| `src/features/accounts/schemas.test.ts` | Normalization, limits, forbidden edit fields and changed-only patches. |
| `src/features/accounts/api.test.ts` | Request/response boundaries and conflict sanitization. |
| `src/features/accounts/password-secrecy.test.tsx` | Pending/success password exclusion from Query/Mutation caches, storage and URLs. |
| `src/routes/admin.accounts.index.tsx` | Thin list route and search validation. |
| `src/routes/admin.accounts.new.tsx` | Thin dedicated creation route. |
| `src/routes/admin.accounts.$accountId.tsx` | Thin detail route with UUIDv4 validation. |
| `src/app/route-tree.gen.ts` | Generated registration of the three Admin routes. |
| `e2e/accounts.spec.ts` | Six scenarios across desktop/mobile, including access, cancellation, drafts, conflicts, passwords and themes. |
| `e2e-backend/accounts.spec.ts` | Two disposable PostgreSQL/API browser scenarios for complete account/session lifecycle. |
| `README.md` | Implemented routes, behavior and limitations. |
| `docs/v1/README.md` | Implementation status and evidence link. |
| `docs/v1/tickets/README.md` | Ticket index status and evidence link. |
| `docs/v1/tickets/FE-V1-012-account-administration.md` | Status and agreed interview refinements. |
| `docs/v1/decisions.md` | Recorded scope/library/Better Auth decisions. |
| `docs/v1/ui-spec.md` | Final editing, password and conflict behavior. |
| `docs/v1/architecture.md` | Session/query/credential ownership and refresh boundaries. |
| `docs/v1/verification.md` | Test design and real-backend coverage. |
| `docs/v1/implementation-summary/FE-V1-012-implementation-summary.md` | This file-by-file handoff, evidence and commit proposal. |

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm check` | Passed format, lint, types, Knip and 142 unit tests before the two password-cache component tests were added. |
| `pnpm exec vitest run src/features/accounts/password-secrecy.test.tsx` | Passed both added cache-secrecy component tests. |
| `pnpm exec playwright test e2e/accounts.spec.ts --workers=2` | Passed all 12 desktop/mobile account cases. |
| `pnpm build && pnpm exec playwright test e2e/accounts.spec.ts --grep 'name edits' --workers=2` | Passed desktop/mobile after the email field was changed from read-only to disabled; also covers background refresh and preserved drafts. |
| `pnpm --dir ../grd-dashboard-be build` | Passed; backend source unchanged. |
| `VITE_API_ORIGIN=http://localhost:3300 pnpm build` | Passed for the isolated backend test origin. |
| `FE_TEST_API_PORT=3300 pnpm exec playwright test --config playwright.backend.config.ts e2e-backend/accounts.spec.ts` | Passed both real account/session scenarios; test database/API removed by the harness afterward. |
| `CI=1 pnpm run ci` | Passed final format, lint, Knip, 144 unit/component tests with coverage, typechecks, normal-origin production build and all 112 desktop/mobile browser cases. |
| Visual inspection | Desktop dark and 375px mobile light account-detail screenshots inspected; no overflow or clipped actions. Browser tests check both themes and horizontal overflow. |
| Local reachability | Frontend `http://localhost:5173`, API `http://localhost:3300/api/v1/health/live`, and frontend `/api/v1/health/live` proxy all returned HTTP 200. |
| Manual Vite browser smoke | Passed Better Auth sign-in, real account list, own detail, disabled self-deactivation and own-password link through `http://localhost:5173` and its API proxy. |
| `git diff --check` and final diff review | Passed; reviewed requested source/test/documentation changes against the clean starting frontend. Backend `sample.txt` remains untouched. |
| Read-only Node manifest/link check | All 31 manifest files exist; all 79 relative links in changed Markdown resolve. |

Final coverage: 66.84% lines, 64.51% statements, 49.59% branches and 57.32%
functions. Browser-only behaviors are not included in unit coverage; no coverage
threshold was introduced. The final build restores the default API origin at port
3000; only the running manual Vite process uses the separate API on port 3300.

Earlier failures were a test passing an entire create payload to the strict reset
schema, invalid Testing Library type options, ambiguous/hidden UI assertions, and
a synthetic visibility event that did not bubble to Query's window listener. These
were corrected without weakening the production contracts. Local server/Docker
access required sandbox escalation. Existing port 3000 was not reused: automatic
approval review rejected a manual fixture API there due to its earlier occupancy,
so manual testing uses the approved separate port 3300.

Not run: the entire older real-backend suite, hosted GitHub Actions, production
cookie/domain checks, Firefox/Safari, worker execution or live carriers. These are
outside this ticket's local evidence. Existing Router CLI circular-dependency and
Vite large-chunk warnings remain non-fatal. No new dependency or lockfile change.

## Review Notes

- Better Auth owns authentication; account operations use GRD's implemented
  `/api/v1/admin/accounts` facade through Axios. No generic Better Auth Admin plugin
  endpoint, replacement auth state or token storage was introduced.
- The backend still permits authorized email PATCH requests; this ticket makes
  email read-only in the frontend only. Backend authorization remains authoritative.
- No account SSE event exists. Query's ordinary focus/reconnect refresh is used.
  Drafts preserve their original edit baseline; only changed fields are sent.
  Same-field concurrent saves remain last-write-wins, as accepted in the interview.
- Create/reset credentials exist only in local form/request memory. Success or
  cancellation clears them; failures retain editable drafts, session loss discards
  them, and no credential-bearing mutation is registered in Query's global cache.
- Confirmations identify the target and effect. Names save without confirmation;
  role changes revoke sessions. Admin-issued passwords still require replacement.

## Remaining Issues

No known implementation issue within the agreed scope. Hosted/production verification
is deferred. The current API provides no
conditional-save guarantee.

Manual test services remain running: frontend **http://localhost:5173** and disposable
API **http://localhost:3300**. The worker is disabled. Use the fixture Admin
`frontend-admin@example.test` / `admin fixture password` (test database only).
The frontend process was started with `VITE_API_ORIGIN=http://localhost:3300 pnpm dev --host localhost`;
the API with `FE_TEST_API_PORT=3300 node scripts/auth-backend.mjs`. Stop those processes
when finished; the API harness removes its disposable database on shutdown.

## Suggested Review Order

1. Agreed ticket/UI decisions, then account schemas/API adapters.
2. Better Auth profile refresh and account write/draft boundaries.
3. Account pages, editor and confirmed access actions.
4. Unit/component/browser acceptance and this verification evidence.

## Approved commit partition

1. `feat(auth): FE-V1-012 refresh edited profiles through Better Auth`
   - Files: `src/features/auth/session.ts`, `src/features/auth/session.test.ts`.
   - Behavior: authoritative own-profile recheck and cross-tab refresh after edits.
2. `feat(accounts): FE-V1-012 add Admin account management`
   - Files: every other file in the Files Changed table above, including the auth
     feature exports, generated route tree, tests and implementation documentation.
   - Behavior: complete Admin account UI, safe credential submissions, access
     confirmations and local acceptance coverage.

The Better Auth commit is `fc07958`. Exact final hashes are reported in the agent
handoff. No merge, tag, push or deployment was performed.
