# GRD frontend agent instructions

## Start here

Read `/home/jeff/.codex/skills/i-have-adhd/SKILL.md` at the start of each session.
Keep ADHD mode active until the user says "stop adhd mode" or "normal mode".
Use TypeScript for code examples unless another language is requested.

Read [docs/v1/README.md](docs/v1/README.md) before implementation. For a ticket,
read its required documents and verify its dependencies are actually implemented;
a planning document or reference project is not completion evidence. Read the root
README for implemented scripts and routes; later features remain ticketed.

## Locate the relevant contract

- Page, interaction, or styling work: read [ui-spec.md](docs/v1/ui-spec.md) and
  [branding.md](docs/v1/branding.md).
- API, auth, or live-update work: read [api-contracts.md](docs/v1/api-contracts.md)
  and the backend's `docs/v1/frontend-handoff.md` and `docs/v1/auth-api.md`.
- New modules or dependencies: read [architecture.md](docs/v1/architecture.md)
  and [decisions.md](docs/v1/decisions.md).
- Tests or CI: read [verification.md](docs/v1/verification.md).
- Implementation handoff, commits, or releases: read
  [agent-workflow.md](docs/v1/agent-workflow.md) before acting.

The backend is the sibling `../grd-dashboard-be`. Backend prerequisite tickets in
this repository describe work to execute there under its own instructions. Do
not emulate a missing backend feature with fabricated frontend data.

## Dependency approval

Before each implementation task, inspect installed dependencies, package scripts,
and built-in capabilities; evaluate established, maintained packages for common
functionality. Present the recommended library or built-in approach, its fit and
material tradeoffs, and obtain confirmation before writing implementation code.
An explicit choice already approved for the current task counts as confirmation;
do not ask again unless the choice or scope materially changes.

The approvals in [decisions.md](docs/v1/decisions.md) are the recorded choices for
this rebuild. Approval of a feature alone is not approval of its dependencies.
After a grilling workflow, check its final specification and acceptance criteria
against those choices before implementation. If custom code is necessary,
explain why available libraries or built-ins do not fit and obtain confirmation.
Ask explicitly before adding any new production dependency outside the recorded
choices. Use pnpm and its lockfile after approval.

## Architecture boundaries

- Keep routes thin; feature folders own business UI, API calls, schemas, and tests.
- Import Material UI primitives directly instead of adding shallow local wrappers.
  Behavior-rich shared modules live in `src/components` (`layout` for the shell,
  `feedback` for notifications); theme infrastructure lives in `src/theme`.
- Dependency direction is app → routes → features → shared API/UI/utilities.
  Shared infrastructure must not import business features. Use feature exports
  rather than another feature's private internals.
- Follow the backend's area-specific import convention: use named aliases across
  directories and relative imports within the same directory. Frontend aliases
  map to their matching `src` areas (`@app/*` → `src/app/*`, for example).
  Define aliases in `tsconfig.json`; Vite reads them with `resolve.tsconfigPaths`.
  Add area aliases as folders gain code. Generated route imports and tooling
  bootstrap imports may remain relative. See README for the current mappings.
- Better Auth owns the auth session through the feature `api.ts` adapter; TanStack
  Query owns business server data; Router owns URL filters/page/sort; React owns
  local interaction state. Do not duplicate server data into a global store.
- Feature-local frontend Zod schemas mirror the public API. Never import NestJS,
  TypeORM entities, or backend source into the browser bundle.
- Keep backend access in `src/api/api.ts` and feature `api.ts` functions.
  API requests use `/api/v1`; Vite forwards that prefix unchanged in development. SSE uses
  the browser's credentialed EventSource, coordinated with the same auth lifecycle.

## Product invariants

- `/` is the operational overview. `/shipments` defaults to Active and
  `created_at DESC` with a stable server tie-breaker.
- Keep carrier status distinct from monitoring state and lookup outcome. A
  successful run is not proof of delivery or even a found shipment.
- IDs in public routes are UUIDs. Tracking references remain strings, including
  leading zeros. Date-only carrier fields must never shift through timezone conversion.
- Business timestamps and "today" use `America/New_York`. Session cookies belong
  to the API; use `withCredentials: true`, with no localStorage auth tokens.
- Tracking-change sounds/toasts are restricted to the exact `/shipments` pathname.
  User-action feedback is available on every page. Preserve reviewed-state isolation
  by account and browser, and clear sensitive cached data on session loss.
- Reuse the official GRD assets and light/dark tokens. Preserve unmodified sources.
- Hosting, Docker delivery choices, publishing, and deployment remain deferred.

## Completion

Review the final diff, separate pre-existing user work, and run checks appropriate
to the change. Follow the seven-heading handoff and commit approval workflow in
[agent-workflow.md](docs/v1/agent-workflow.md). After a full-stack change, start or
reuse both local servers, verify reachability, report their URLs, and leave them
running when possible. Report blockers instead of implying unrun checks passed.

## Commit standard

Match the backend's ticket-prefixed Conventional Commit format:
`<type>(<scope>): <ticket-id> <description>`, for example
`feat(scaffold): FE-V1-001 initialize the frontend application`.
Choose the type from the actual change; keep each commit single-purpose.
Before staging or committing, present each commit's exact message, files, and
behavioral summary and obtain explicit final approval. Stage only approved
files/hunks. Follow [agent-workflow.md](docs/v1/agent-workflow.md) for the full
commit handoff and release/tag rules.
