# GRD Dashboard frontend

React/TypeScript/Vite foundation for the GRD shipment-monitoring dashboard.
FE-V1-001 supplies application composition, routing, a shared Query client, and
validated public configuration. FE-V1-002 adds quality gates, isolated tests, staged
checks, and GitHub Actions. Business features remain in the
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
**http://localhost:3000**; this scaffold makes no API requests and does not start
the backend. Ports are strict: an occupied port produces an error instead of
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
Browser tests verify `/`, nested unknown URLs/reloads, keyboard recovery/back
navigation, official assets, narrow layout, and absence of API requests/errors.

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

`pnpm test:e2e:backend` is **not implemented** and is not a passing placeholder.
The current frontend has no API/auth integration. Real-backend tests remain
separate future work; fixture/browser success does not establish backend parity.
Fixtures must stay in tests and use Playwright interception when API behavior
arrives. No temporary shipment dataset or local CRUD preview is included.

## Implemented and planned routes

`/` now renders the responsive branded application shell and an honest overview
placeholder without shipment data or authentication. `/shipments` is a temporary
shell-only placeholder that FE-V1-006 must replace. Unknown paths render a
shell-integrated not-found page with a working link home. The official logo, SVG
favicon, and ICO fallback are reused without modifying their source assets.

The authenticated operational overview, `/login`, `/change-password`, shipment
data/actions, shipment creation/details/history, and account/carrier
administration remain planned. The full route contract is in
[ui-spec.md](docs/v1/ui-spec.md); neither placeholder fabricates business data.

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
notification module uses MUI Snackbar/Alert. MUI X Data Grid Community is approved
for FE-V1-006 but remains uninstalled until that ticket uses it. Axios and form
packages remain approved future-ticket choices, installed when used. No font,
state-store, hosting, or backend-client helper package was added.

Implementation uses the user-selected `feature/dashboard-v1` branch from the
existing `master` history. A future switch of the default branch to `main` remains
pending. See [AGENTS.md](AGENTS.md) and
[agent-workflow.md](docs/v1/agent-workflow.md) for commit approval and release rules.
Hosting, publishing, deployment, authentication, and backend integration are
outside this scaffold's completion claim.
