# FE-V1-003: Shared interaction motion

## Summary

Applied the user-approved subtle 320 ms MUI transitions to the existing frontend
before the separate Upcoming Shipments implementation. No dependency was added.

## Changes

- Shared theme duration tokens and easing govern existing dialogs, drawers,
  snackbars, tab indicators, and control transitions.
- Menu/popover and accordion/collapse defaults explicitly use 320 ms instead of
  automatic or library-level timings. The navigation collapse inherits the theme.
- MUI `motion.reducedMotion: system` disables transition lifecycle delays when
  the device requests reduced motion. The existing CSS reduction remains a safety
  override. No custom animation engine or page/list remounting was introduced.
- The shell component test waits for collapse completion. Browser coverage checks
  actual timing, reduced-motion inline timing, modal/menu/drawer focus restoration,
  expanded sections, and horizontal overflow on desktop and mobile.

## Verification

- `pnpm build`: passed, including app/tooling/browser TypeScript checks. Existing
  Router circular-dependency and Vite large-chunk warnings remain non-blocking.
- `pnpm format:check && pnpm lint && pnpm knip`: passed.
- `pnpm exec biome check src/theme/grd-theme.ts src/components/layout/app-shell.tsx src/components/layout/app-shell.test.tsx e2e/motion.spec.ts`: passed after final source edits.
- `pnpm test`: 267 tests passed across 39 files. Initial run found one immediate
  collapse assertion; it now waits for the user-visible transition to complete.
- `pnpm exec playwright test e2e/motion.spec.ts e2e/help.spec.ts e2e/smoke.spec.ts --workers=2`: 16 passed across desktop and mobile.
- `pnpm exec playwright test e2e/shipments.spec.ts --grep 'tab transitions keep' --workers=2`: 2 passed; results stay anchored during delayed updates.
- Desktop/mobile Help screenshots visually reviewed; layout and existing markers
  remain correct. Browser checks use intercepted fixture APIs, not a real backend.
- Full browser suite, real-backend integration, container acceptance, and deployment
  were not run for this frontend motion-only change.

## Review and handoff

The new shared defaults also apply to future MUI consumers unless explicitly
overridden. Animations preserve MUI focus, dismissal, and mounting lifecycles.
Unrelated pre-existing changes in `AGENTS.md` and
`e2e-backend/tracking-review.spec.ts` were preserved and are excluded from this
change's proposed commit.

Help: approval pending for one Getting Started tip explaining the device's Reduce
Motion preference. No Help content or screenshots were changed.

Local frontend: `http://localhost:5173`. Local API:
`http://localhost:3000/api/v1/health/ready`. Both were verified running during the
later shipment-files implementation. The original port 4175 preview was stopped.

This document records completed workspace implementation and verification. The
motion source changes remain uncommitted and are separate from this documentation
commit. Earlier AGENTS.md policy changes were committed separately.

Proposed source commit (not created):
`feat(theme): FE-V1-003 apply subtle shared UI motion`
