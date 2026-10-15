# FE-V1-001 implementation summary

## Summary

Implemented and locally verified on 2026-10-15 in `grd-dashboard-fe`, on the
user-selected `feature/dashboard-v1` branch. The scaffold runs at
http://localhost:5173; the production preview runs at http://localhost:4173.
Both were left running for manual review. The backend was not changed or started:
this frontend-only foundation makes no API requests.

The initial worktree was clean at `b6adeb5`. The user approved the three local
commits recorded below. Merging, tagging, pushing, and deployment remain separate
actions.

## Changes Made

- Added a private React/TypeScript/Vite application, exact dependency versions,
  pnpm lockfile, Node 24.21.0 runtime pin, and pnpm 12.11.2 package-manager pin.
  Engine/peer requirements were inspected before installation; strict peer
  installation and fresh frozen installation passed.
- Composed TanStack Router and Query around a single shared Query client. File
  routes are generated during dev/build and before standalone typechecks. The
  generated route tree is included in the proposed scaffold commit.
- Implemented only the placeholder `/` route and an unknown-route fallback.
  The original logo and SVG/ICO favicon assets are referenced without changes.
  No mock shipment data, authentication, live updates, API transport, shell,
  feature folders without code, or hosting configuration was introduced.
- Validated the public API origin with the already approved Zod dependency in
  Vite configuration and browser startup. Omission defaults to localhost:3000;
  explicit empty/invalid input fails with a safe message. Only HTTP(S) origins
  without credentials, paths beyond `/`, queries, or fragments are accepted.
- Applied the user's post-interview decision to replace the planned `@/` alias
  with backend-style area aliases. `@app/*`, `@routes/*`, and `@lib/*` map to the
  corresponding frontend directories. TypeScript is the single mapping source;
  Vite reads it through built-in `resolve.tsconfigPaths` support. Cross-directory
  application imports use aliases; same-directory imports remain relative.
  Generated imports and Vite's bootstrap import are documented exceptions.

The backend's `AGENTS.md`, import-placement rules, and recent commit history were
inspected. Frontend `AGENTS.md` now explicitly requires ticket-prefixed
Conventional Commits, single-purpose partitions, and final approval before
staging or committing. The existing detailed workflow remains the handoff source.

## Files Changed

### Tooling and public configuration

| File | Purpose |
| --- | --- |
| `package.json` | Exact direct dependencies, runtime/package-manager requirements, dev/generation/typecheck/build/preview scripts. |
| `pnpm-lock.yaml` | Reproducible dependency and package-manager resolution. |
| `pnpm-workspace.yaml` | Exact-version release-age exceptions emitted by pnpm for the selected recent stable releases. |
| `.node-version` | Pin the supported local Node release. |
| `.npmrc` | Enforce engine requirements and exact dependency saves. |
| `.gitignore` | Exclude build/dependency artifacts, private environment files, and local agent/credential directories. |
| `.env.example` | Safe public localhost API-origin example. |
| `tsconfig.json` | Strict browser TypeScript, named aliases, and modern bundler resolution. |
| `tsconfig.node.json` | Strict Node-side Vite/configuration typechecking. |
| `tsr.config.json` | Shared route-generation settings for CLI and Vite. |
| `vite.config.ts` | Router/React plugins, built-in alias resolution, environment validation, and strict local ports. |

### Application

| File | Purpose |
| --- | --- |
| `index.html` | Browser entry, title/metadata, official SVG and ICO favicon links. |
| `src/main.tsx` | Validate configuration and mount the provider composition under React StrictMode. |
| `src/vite-env.d.ts` | Restrict application environment typing to the declared public key. |
| `src/styles.css` | Minimal readable, responsive placeholder styles and visible link focus. |
| `src/lib/public-config.ts` | Shared Zod parser; normalize valid origins and reject invalid values without echoing them. |
| `src/app/config.ts` | Read only the declared public browser configuration. |
| `src/app/router.ts` | Typed router and shared Query client/context. |
| `src/app/providers.tsx` | Query/Router provider composition. |
| `src/app/route-tree.gen.ts` | Generated route types/tree; included because fresh-checkout and regeneration behavior matter to review. |
| `src/routes/__root.tsx` | Typed root context, outlet, and accessible unknown-route fallback. |
| `src/routes/index.tsx` | Honest placeholder homepage using the existing GRD logo. |

### Instructions and evidence

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Area-alias convention, explicit backend-aligned commit standard, and current-state pointer. |
| `README.md` | Actual startup commands, routes, configuration, aliases, dependency inventory, generated-file policy, and deferred work. |
| `docs/v1/agent-workflow.md` | Reference the authoritative commit format; require approval before staging; correct the historical branch note. |
| `docs/v1/README.md` | Record the implemented scaffold while preserving the planning milestone's historical scope. |
| `docs/v1/tickets/README.md` | Record FE-V1-001 completion and the remaining 18 not-started tickets. |
| `docs/v1/tickets/FE-V1-001-scaffold.md` | Evidence-linked status and the user's alias/branch decisions. |
| `docs/v1/implementation-summary/FE-V1-001-implementation-summary.md` | This review and verification record. |

All four existing public assets are byte-for-byte unchanged. Other planning
contracts and ticket files are unchanged. Documentation edits above are limited
to the requested conventions, actual startup instructions, and ticket evidence.

## Verification

Commands ran with Node 24.21.0 and pnpm 12.11.2. Sandbox access was expanded for
the user-authorized branch creation, package-store/network access, local servers,
and Chromium. No approval review rejected an action.

| Check / command | Result |
| --- | --- |
| `pnpm install --strict-peer-dependencies` | Passed; installed the approved runtime packages and enumerated build/type/generation tooling. |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Passed twice in a fresh temporary copy at `/tmp/grd-fe-scaffold-check-69wiet5x`, including an empty dependency directory and then a frozen reinstall. |
| `pnpm build` | Passed in the working tree and clean copy. Runs `pnpm typecheck`, which runs `pnpm routes:generate`, `tsc --noEmit`, and `tsc --noEmit -p tsconfig.node.json`, followed by `vite build`. |
| Clean-copy route recovery | Deleted only the temporary copy's generated route tree before verification; build regenerated byte-identical output. Frozen installation left the lockfile unchanged. |
| `node --input-type=module` configuration assertion harness | Passed five valid/default cases and twelve invalid cases, including credentials/path/query/fragment/scheme rejection, safe error messages, IPv6, trailing-slash normalization, and private-key exclusion. Imported the real TypeScript parser using Node's built-in type stripping. |
| `VITE_API_ORIGIN=https://example.com/api pnpm exec vite build` in the clean copy | Expected failure passed: nonzero exit with the safe configuration message and no supplied value echoed. |
| Clean-build artifact inspection | Passed: a private environment sentinel supplied during the build was absent from all output files; no NestJS, TypeORM, sibling-backend, `node:fs`, or `node:process` strings were found. No Console Ninja instrumentation was present in the actual `dist` files. |
| `pnpm dev` / `pnpm preview` | Both started successfully at their documented ports. `curl --fail --silent --show-error http://localhost:5173/` returned the dev HTML. Browser checks confirmed HTTP 200 for both entry points. |
| `env -u NODE_OPTIONS node /tmp/grd-fe-scaffold-smoke.mjs` | Passed against both servers using the already installed backend Playwright/Chromium solely as an external verification tool. Checked homepage/title, logo load, SVG/ICO assets, 375px viewport overflow, direct unknown URL, keyboard return-home, browser back, no page errors, no failed app responses, and no API requests. No backend package is imported by frontend source or declared in its manifest. |
| Desktop/mobile visual inspection | Inspected production-preview screenshots at 1280×800 and 375×812; content/logo fit without clipping. SVG and ICO were separately rendered and inspected at actual 16px and 32px sizes. Screenshots are temporary `/tmp/grd-fe-*` artifacts. |
| `git diff --check` and final tracked/new-file review | Passed; initial tree was clean, all changes belong to this task, no staged files, no public-asset modifications, and only the listed planning documents changed. |

The Chrome DevTools connector initially failed because its expected Chrome binary
was absent; the installed Playwright Chromium completed browser verification.
An initial sandboxed build warned that pnpm could not acquire its store lock;
the full build was repeated with package-store access and passed.

Formatting/lint, unit-suite, coverage, Knip, and CI checks were **not run** because
FE-V1-002 owns installation/configuration of those tools. The configuration and
browser checks above were temporary verification harnesses, not a claim that a
committed test suite exists. Backend integration was **not run** because this
ticket has no backend/API functionality. No full-stack readiness is claimed.

## Review Notes

- The runtime/package manager match the backend; frontend build libraries are
  selected stable releases verified against their own engine/peer requirements.
  The Router CLI/plugin/runtime publish independently, so their version numbers
  differ; strict peer installation and actual generation/build verify this set.
- pnpm 12 emitted eight narrowly pinned release-age exceptions in
  `pnpm-workspace.yaml`. The lockfile passed its supply-chain checks in both fresh
  and subsequent installations. No wildcard exception or global disabling was
  added. The optional dependency-provided agent skills remain unapproved.
- `src/app/route-tree.gen.ts` is intentionally included in the commit proposal;
  changes are generated rather than hand-edited. FE-V1-002 should exclude this
  generated file from formatting/lint/dead-code rules as appropriate.
- Placeholder pages contain no protected data. Query defaults/auth lifecycle
  policies will be integrated with real transport/session behavior in FE-V1-004;
  no server requests or invented authentication checks occur here.
- `VITE_*` values are public and baked into the static build. Previewing with a
  different environment does not alter an existing artifact. The parser's local
  default does not imply that a backend process is reachable.

Implementation used the official [Vite alias documentation](https://vite.dev/guide/features.html)
and [TanStack file-routing guidance](https://tanstack.com/router/latest/docs/routing/file-based-routing),
alongside installed package types/source and npm registry metadata.

## Remaining Issues

- TanStack's CLI emits the non-fatal warning `Accessing non-existent property
  'replaceRouteChunk' of module exports inside circular dependency`.
  `env -u NODE_OPTIONS node --trace-warnings node_modules/@tanstack/router-cli/bin/tsr.cjs generate`
  traced it to `@tanstack/router-core`'s CommonJS build. Generation exits zero,
  generated output is stable, and browser/build checks pass. No dependency patch
  or warning suppression was added.
- Formatting/lint/test infrastructure remains assigned to FE-V1-002; application
  features and full-backend integration remain in later tickets. The default
  branch is still `master`; the user only authorized `feature/dashboard-v1`.
- The three approved local commits were created. No merge/release/tag/push was done.

## Suggested Review Order

1. `AGENTS.md` / workflow changes and the explicit alias decision.
2. `package.json`, pnpm files, TypeScript/Vite/router configuration.
3. Public configuration parser → app providers/router → route files and HTML/CSS.
4. README, ticket status, and this verification record.

### Approved commit partition

1. `docs(agents): FE-V1-001 align frontend import and commit conventions`
   - Created as `a48024c`.
   - Files: `AGENTS.md`, `docs/v1/agent-workflow.md`.
   - Behavior: document named aliases, ticket-prefixed Conventional Commits,
     approval before staging/committing, and the chosen working branch.
2. `feat(scaffold): FE-V1-001 initialize the frontend application`
   - Created as `597eb0d`.
   - Files: `.env.example`, `.gitignore`, `.node-version`, `.npmrc`, `index.html`,
     `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`,
     `tsconfig.node.json`, `tsr.config.json`, `vite.config.ts`, `README.md`, and
     every source file in the Application inventory above.
   - Behavior: install and run the reproducible typed frontend foundation with
     public configuration validation, routing, Query composition, and honest
     placeholder screens.
3. `docs(plan): FE-V1-001 record scaffold verification`
   - This summary accompanies the approved documentation commit; its final hash
     is reported in the implementation handoff.
   - Files: `docs/v1/README.md`, `docs/v1/tickets/README.md`,
     `docs/v1/tickets/FE-V1-001-scaffold.md`, and this implementation summary.
   - Behavior: update plan/ticket state and record decisions, exact validation,
     limitations, review order, and the proposed commit partition.
