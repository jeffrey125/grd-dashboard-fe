# GRD Dashboard frontend

React/TypeScript/Vite foundation for the GRD shipment-monitoring dashboard.
FE-V1-001 supplies application composition, routing, a shared Query client, and
validated public configuration. Business features remain in the
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

| Command | Behavior |
| --- | --- |
| `pnpm dev` | Vite development server at http://localhost:5173; regenerates routes as they change. |
| `pnpm routes:generate` | Generate the typed route tree from `src/routes`. |
| `pnpm typecheck` | Generate routes, then strictly check application and Vite configuration TypeScript. |
| `pnpm build` | Typecheck and build static output into `dist/`. |
| `pnpm preview` | Serve the existing build at http://localhost:4173 for local verification. |

Preview requires `pnpm build` first. It is a local verification server, not a
production hosting decision. Formatting/linting, unit/browser test scripts,
hooks, and CI are assigned to FE-V1-002 and are not installed by this ticket.

## Implemented and planned routes

Only `/` is implemented, as a clearly labeled placeholder homepage without
shipment data or authentication. Unknown paths render a not-found page with a
working link home. The official logo, SVG favicon, and ICO fallback are reused
without modifying their source assets.

The authenticated operational overview, `/login`, `/change-password`,
`/shipments`, shipment creation/details/history, and account/carrier
administration remain planned. The full route contract is in
[ui-spec.md](docs/v1/ui-spec.md); none of these business routes is implemented by
the placeholder. The branded shell and theme controls belong to FE-V1-003.

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
| `@routes/*` | `src/routes/*` |
| `@lib/*` | `src/lib/*` |

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
| `zod` | Validate the public API origin. |
| `vite`, `@vitejs/plugin-react`, `typescript` | Development/build tooling and strict typechecking. |
| `@tanstack/router-plugin`, `@tanstack/router-cli` | Watch/build route generation and standalone generation before typechecking. |
| `@types/node`, `@types/react`, `@types/react-dom` | Runtime-matched type declarations. |

Axios, Tailwind/shadcn, forms, tables, toasts, and quality tooling are approved
future-ticket choices, installed when used. No icon, font, state-store, alias,
hosting, or backend-client helper package was added.

Implementation uses the user-selected `feature/dashboard-v1` branch from the
existing `master` history. A future switch of the default branch to `main` remains
pending. See [AGENTS.md](AGENTS.md) and
[agent-workflow.md](docs/v1/agent-workflow.md) for commit approval and release rules.
Hosting, publishing, deployment, authentication, and backend integration are
outside this scaffold's completion claim.
