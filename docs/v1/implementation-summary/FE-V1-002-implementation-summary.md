# FE-V1-002 implementation summary

## Summary

Implemented and locally verified on 2026-10-16 in `grd-dashboard-fe`, on
`feature/dashboard-v1`, based on `8f683c2`. The approved scope is quality tooling,
hooks, deterministic scaffold tests, and CI. No backend implementation or
temporary shipment dataset/CRUD preview was added. The user approved the three
local commits recorded below.

The starting worktree contained only the temporary-data note/TODO added during
the earlier interview. The user explicitly superseded that plan after backend
implementation; this change removes it. No unrelated user edits were changed.
The backend's untracked `sample.txt` was left untouched.

## Changes Made

- Installed exact versions of the approved development tools and adapters:
  Biome 2.5.15, Vitest/coverage-v8 5.0.5, Testing Library React 16.3.3, DOM 10.4.2,
  jest-dom 7.0.1, user-event 14.6.8, jsdom 30.1.3, Playwright 1.64.1, Knip 6.41.0,
  Husky 9.1.7, and lint-staged 17.6.0. Node 24.21.0, pnpm 12.11.2, and all
  production dependency declarations remain unchanged. Registry engine/peer
  metadata and strict-peer/frozen installation verified compatibility.
- Added formatting/import/lint/dead-code gates, strict configuration and browser
  test typechecks, run-once unit/component tests, V8 coverage, and production-build
  Chromium smoke tests at desktop and 375px widths. Tests use isolated Query
  clients/history and explicit DOM/query/storage/timer/mock cleanup.
- Added a safe staged-file hook using lint-staged's default stash and partial-edit
  protection. The hook does not run full typechecks/tests or custom `git add`.
  Removed one unused browser configuration export found by Knip; the same parser
  still validates configuration during browser startup.
- Added GitHub Actions quality and full-history secret-scan jobs with frozen
  installation, pinned runtime/action commits, checksum-pinned Gitleaks, read-only
  permissions, timeouts, obsolete-PR cancellation, and seven-day report retention.
  No publishing, deployment, backend checkout, production credentials, or
  branch/default-branch changes were added.
- Documented exact scripts and limitations. The complete gate is `pnpm run ci`:
  pnpm 12's built-in `pnpm ci` installs dependencies instead of invoking the
  package script. Real-backend tests remain deferred until frontend integration;
  no empty/always-passing backend test command was installed.

## Files Changed

| File | Review purpose |
| --- | --- |
| `package.json` | Exact development dependencies; local/CI/test/format/hook scripts; expanded typecheck. |
| `pnpm-lock.yaml` | Reproducible tooling graph, verified by fresh frozen installation. |
| `pnpm-workspace.yaml` | Six exact-version release-age exceptions emitted by pnpm for the chosen stable test packages; no wildcard bypass. |
| `.gitignore` | Ignore coverage, Vitest, and Playwright outputs. |
| `biome.json` | Supported-file formatting, recommended React/test lint rules, import organization; exclude generated route tree. |
| `knip.json` | Project scope; installed plugins infer framework/test/config entries without blanket ignores. |
| `lint-staged.config.mjs` | Safe Biome fixes for staged supported extensions. |
| `.husky/pre-commit` | Run lint-staged; generated `.husky/_` helpers remain ignored. |
| `vitest.config.ts` | jsdom, React transform, existing TS aliases, setup/reset behavior, V8 coverage with no threshold. |
| `src/test/setup.ts` | DOM/storage/timer cleanup and test-only jsdom scroll stub; mock/global/env reset is configured in Vitest. |
| `src/lib/public-config.test.ts` | Default/normalization/invalid-origin tests and safe error/private-value boundary assertions. |
| `src/app/routes.test.tsx` | Real route-tree rendering and keyboard not-found recovery with per-test Query/history lifecycles. |
| `src/app/config.ts` | Remove the unused export while preserving startup validation. |
| `playwright.config.ts` | Desktop/mobile Chromium projects; fresh strict-port production preview; failure diagnostics. |
| `e2e/smoke.spec.ts` | Homepage/title/assets, narrow overflow, deep links/reload/back, keyboard recovery, and unexpected request/runtime failures. |
| `tsconfig.node.json` | Include all TypeScript tooling configurations. |
| `tsconfig.e2e.json` | Strict Node/browser types for Playwright tests. |
| `.github/workflows/ci.yml` | PR/main/manual quality and secret-scanning jobs. |
| `README.md` | Actual scripts, setup, coverage, hooks, CI, dependency inventory, and deferred backend suite. |
| `docs/v1/verification.md` | Replace target commands with implemented gates and explicit limitations. |
| `docs/v1/README.md` | Record FE-V1-002 local implementation status. |
| `docs/v1/tickets/README.md` | Record FE-V1-002 local implementation status. |
| `docs/v1/tickets/FE-V1-002-quality-and-ci.md` | Evidence-linked status and finalized tooling-only scope. |
| `docs/v1/implementation-summary/FE-V1-002-implementation-summary.md` | This implementation and review evidence. |

The generated route tree and official public assets remain unchanged. All tests
and adapters are outside the production dependency graph; no application fixture
data or business routes were added.

## Verification

Commands used Node 24.21.0 and pnpm 12.11.2. Package-store/network/browser access
was authorized by the sandbox approval mechanism; no automatic approval rejection
occurred. All temporary failure fixtures were outside the working repository.

| Exact command/check | Result |
| --- | --- |
| `pnpm add -D --save-exact --strict-peer-dependencies` with the versions listed above | Passed engine/peer compatibility and installed only approved development tools/adapters. |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` in `/tmp/grd-fe-quality-check-hgc9ufhz` | Passed from an empty dependency directory; lockfile and release-age policy stayed byte-identical to the working tree. |
| `pnpm check` in the fresh checkout | Passed `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm knip`, and `pnpm test`; 16 tests passed. |
| `pnpm run ci` in the working tree | Passed formatting, lint/imports, Knip, coverage, strict types, production build, and two browser project runs. |
| `CI=true HUSKY=0 pnpm run ci` in the fresh checkout | Passed the same complete gates under CI settings; 16 unit/component tests and two Chromium smoke runs passed. |
| `pnpm typecheck` | Passed route generation, `tsc --noEmit`, `tsc --noEmit -p tsconfig.node.json`, and `tsc --noEmit -p tsconfig.e2e.json`. |
| `pnpm test:coverage` | Passed; statements/lines 60%, branches 81.81%, functions 85.71%. Reports include untested source and apply no percentage gate. |
| `pnpm exec playwright install chromium` | Passed using the available Ubuntu 24.04 fallback browser build; host OS is not an officially supported Playwright distribution. |
| `pnpm test:e2e` (through both CI runs) | Passed fresh production build and desktop/mobile smoke at strict `http://127.0.0.1:4174`; preview processes shut down after the suite. |
| `python3 /tmp/grd-fe-verify-hook.py` | Passed actual `sh .husky/_/pre-commit` checks in the disposable checkout: safe formatting updates the staged file only, partial unstaged edits survive, unrelated README bytes and staged Markdown survive, invalid syntax returns exit 1 and restores the index/worktree, no commit is created, no stash is left. |
| `pnpm test src/lib/intentional-failure.test.ts` in the disposable checkout | Expected failure returned exit 1; temporary test removed. |
| `/tmp/grd-fe-quality-tools/actionlint -shellcheck= .github/workflows/ci.yml` | Passed workflow parsing, schema/expression checks. ShellCheck integration was not run because ShellCheck is not installed. |
| `/tmp/grd-fe-quality-tools/gitleaks git --redact --no-banner --log-opts=--all .` | Passed all 11 existing commits with no leaks. Binary download was verified against the official SHA-256 checksum pinned in CI. |
| Gitleaks `dir --redact --no-banner` on an isolated synthetic-token fixture | Expected detection returned exit 1; fixture removed, output kept redacted. |
| Gitleaks `dir --redact --no-banner /tmp/grd-fe-review-export-4_cxakvb` | Passed a dependency-free export of all tracked and nonignored new working files, including the uncommitted implementation; no leaks found. |
| Changed-document link check | Passed: every local Markdown link in the six changed documentation files resolves. |
| Final diff, staging, asset/generated-file, and documentation review | Requested changes only; no user-repository files staged or committed. `git diff --check` passed. |

GitHub-hosted execution was **not run**: there is no Git remote configured.
The branch is still `feature/dashboard-v1`; `master`/future `main` setup remains
separate. Hosted browser system-package installation and report upload have not
been exercised here. Local workflow validation is not a claim of a hosted pass.
Real-backend tests were **not run** because the frontend still lacks API/auth
integration. This was frontend tooling work, so backend services were not started
and no full-stack readiness claim is made.

## Review Notes

- `pnpm check` omits coverage/build/browser work for a faster local loop.
  `pnpm run ci` builds once through `test:e2e`; build includes strict types.
  The secret scanner is a separate workflow job, not part of the local aggregate.
- Biome currently checks JS/TS/JSX/TSX, JSON/JSONC, and CSS. Markdown, YAML, HTML,
  shell, and assets are outside its formatting/lint scope. Workflow syntax gets
  separate actionlint verification. No extra formatter dependency was added.
- Unit coverage does not instrument the browser-entry/provider wiring exercised
  by Playwright. The coverage include pattern still counts those untested modules;
  it does not hide them to increase the percentage. The initial suite protects the
  current scaffold only; future tickets extend behavior coverage.
- Browser interception blocks unexpected API/external requests. It contains no
  fabricated backend responses or production data. Future API fixtures belong in
  tests; real-backend acceptance stays separate.
- Hooks keep lint-staged's backup/partial-staging defaults and safe Biome fixes.
  No test/typecheck receives a misleading partial file list. The generated route
  tree is excluded from Biome while Knip understands it via framework integration.

Implementation consulted the official [Vitest guide](https://vitest.dev/guide/),
[Playwright web-server guide](https://playwright.dev/docs/test-webserver),
[Knip Vitest plugin documentation](https://knip.dev/reference/plugins/vitest),
and [Gitleaks repository](https://github.com/gitleaks/gitleaks), plus installed
package types, npm engine/peer metadata, and official GitHub release/tag metadata.

## Remaining Issues

- GitHub-hosted execution and branch protection remain unverified/unconfigured
  until a remote and intended default branch are selected. No push was performed.
- The pre-existing TanStack Router CLI circular-dependency warning remains
  non-fatal; generation/types/build/browser tests pass. Playwright also emits
  host-OS fallback and inherited color-environment warnings; browser runs pass.
- Real-backend tests and business features remain future tickets. They are not
  included in FE-V1-002's completed scope. No temporary-data removal TODO remains.

## Suggested Review Order

1. `package.json`, formatter/Knip/type/test configs, and the hook.
2. Configuration and route tests, then Playwright config/smoke test.
3. GitHub workflow, followed by README, verification, and ticket evidence.

### Approved commit partition

1. `test(tooling): FE-V1-002 establish frontend quality gates`
   - Created as `64d703b`.
   - Files: `.gitignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
     `biome.json`, `knip.json`, `lint-staged.config.mjs`, `.husky/pre-commit`,
     `vitest.config.ts`, `src/test/setup.ts`, `src/lib/public-config.test.ts`,
     `src/app/routes.test.tsx`, `src/app/config.ts`, `playwright.config.ts`,
     `e2e/smoke.spec.ts`, `tsconfig.node.json`, `tsconfig.e2e.json`.
   - Behavior: reproducible development tooling, safe staged checks, isolated
     scaffold tests, coverage, strict types, and production-browser smoke.
2. `ci(quality): FE-V1-002 enforce checks and secret scanning`
   - Created as `5511d1a`.
   - File: `.github/workflows/ci.yml`.
   - Behavior: run the local gate suite and full-history Gitleaks on PR/main/manual
     workflows with pinned tools, bounded diagnostics, and minimum permissions.
3. `docs(plan): FE-V1-002 record quality tooling verification`
   - This summary accompanies the approved documentation commit; its final hash
     is reported in the implementation handoff.
   - Files: `README.md`, `docs/v1/verification.md`, `docs/v1/README.md`,
     `docs/v1/tickets/README.md`,
     `docs/v1/tickets/FE-V1-002-quality-and-ci.md`,
     `docs/v1/implementation-summary/FE-V1-002-implementation-summary.md`.
   - Behavior: document real commands, finalized scope, passing local evidence,
     coverage baseline, and the hosted/backend verification limits.

The three approved local commits were created. No merge, tag, push, deployment,
or default-branch change was performed. Temporary verification cloned the existing
history and staged only disposable fixtures without creating commits there.
