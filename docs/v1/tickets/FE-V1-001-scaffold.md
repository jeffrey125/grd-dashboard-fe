# FE-V1-001: Scaffold the React, TypeScript, Vite, and pnpm application

## Status

Not started. Depends on Approved v1 plan.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Create a reproducible frontend foundation while preserving the planning documents and acquired brand assets.

## Required reading

- [decisions.md](../decisions.md)
- [architecture.md](../architecture.md)
- [agent-workflow.md](../agent-workflow.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Inspect the empty application baseline and existing files. Use the approved React/TypeScript/Vite/pnpm approach with strict TypeScript and an @/ source alias.
- Select compatible stable runtime/tool versions, record engines/packageManager, create the pnpm lockfile, and enumerate direct dependencies. Reuse approved selections; seek explicit approval for any additional production package.
- Set up app/providers/router composition and feature-local boundaries, including TanStack Router generation appropriate to Vite and a shared TanStack Query provider.
- Add validated public API-origin configuration, a safe example environment file, ignore rules, and local development/build/preview scripts. Preserve default localhost:5173 and API localhost:3000.
- Document actual startup commands and planned versus implemented routes. Inspect the unborn master/main situation and handle repository branch setup deliberately; do not commit or push without the required approval.

## Acceptance criteria

- Fresh pnpm install and frozen reinstall work on the pinned supported runtime; strict typecheck and Vite build pass.
- No Bun server, backend proxy, backend source imports, hosting configuration, or copied reference-project environment values enter the scaffold.
- Source layout matches the approved dependency direction, generated route files are consistently managed, and no empty ceremonial architecture is introduced.
- All existing docs and brand assets survive unchanged. Only public configuration can enter the bundle; no fake backend responses are shipped as real integration.
- The README reports the real available scripts and URLs without claiming later features are implemented.

## Verification

Run clean/frozen installation, route generation if required, typecheck, build, and a local development/preview smoke check. Inspect the built output for unexpected backend/runtime imports and accidental sensitive configuration.

## Review notes and completion

Scaffolding is not approval to implement every ticket at once. Additional icon/font/helper dependencies need the recorded dependency review. No deployment target is selected.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
