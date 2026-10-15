# FE-V1-002: Establish quality tooling, hooks, and CI

## Status

Not started. Depends on FE-V1-001.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Adapt Tom's quality checks to Vite/pnpm, making regressions visible before merge while leaving publishing and deployment deferred.

## Required reading

- [verification.md](../verification.md)
- [decisions.md](../decisions.md)
- [source-evidence.md](../source-evidence.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Configure approved Biome, Vitest/React Testing Library/jsdom, Playwright, Knip, Husky, and lint-staged. Add compatible development adapters, matchers, and coverage tooling as needed.
- Implement the verification document's target scripts, document their exact contents, and ensure tests run once in CI rather than watch indefinitely.
- Add GitHub Actions for PR/main quality gates and Gitleaks-style secret scanning. Pin maintained actions appropriately, use minimum permissions/timeouts, and cancel obsolete PR checks.
- Provide deterministic browser smoke tests of the built app and SPA deep links; later tickets extend behavioral coverage. Use test-only network fixtures and no production secrets.
- Configure staged safe fixes without sweeping unrelated work into commits. Make fixture/component and real-backend tests clearly separate.

## Acceptance criteria

- Formatting, lint, strict types, Knip, behavior tests/coverage, build, and browser smoke commands have meaningful passing evidence.
- The workflow uses pnpm's frozen lockfile and the pinned runtime; it fails visibly when a required gate fails.
- CI contains no GHCR publish, Docker delivery requirement, SSH, DigitalOcean deployment, production environment sync, or hidden publish-on-main job.
- Test setup cleans up DOM/query/event state between tests. Generated route entries, test files, and framework integrations are correctly understood by Knip.
- README and verification docs reflect actual scripts. Coverage is reported without an arbitrary unapproved threshold; known limitations are explicit.

## Verification

Run each installed gate and the combined CI script locally where possible; validate workflow syntax and hook behavior on controlled temporary fixtures without committing. Verify a known failing test/gate actually fails, then remove the temporary fixture. Report any unavailable CI-only secret-scan/browser environment.

## Review notes and completion

Do not copy Tom's Bun commands or its deployment jobs. Real backend CI access is not assumed; document the authorized checkout/fixture arrangement if added later.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
