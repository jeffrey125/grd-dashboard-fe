# SQ-V1-009 frontend deployment follow-up

## Summary

Deployed application commit `05c067d5d552495c22e246fee28b6943070874d9` to
`debian-vm` as `grd-dashboard-fe:http-20261021-03`. Updated outdated browser-test
expectations so the deployment acceptance gate verifies the approved UI.

## Changes Made

- Navigation checks use the Monitoring link within the Shipments group.
- Real-backend shipment checks match the All Shipments label and open row actions
  without forcing horizontal scrolling.
- Tracking-review checks click the explicit Tracking Number link. An additional
  assertion verifies that clicking carrier-status text keeps the list and unseen
  highlight, then opening details acknowledges the update.
- Reused installed Playwright. No production code, dependencies, API, database
  schema, or runtime configuration was changed in the source repositories.

## Files Changed

- `e2e/carriers.spec.ts`: return to Monitoring after editing a carrier.
- `e2e/live.spec.ts`: use Monitoring for navigation and SSE lifetime checks.
- `e2e/smoke.spec.ts`: use Monitoring for mouse and keyboard navigation.
- `e2e-backend/shipments.spec.ts`: current tab capitalization and visible actions.
- `e2e-backend/tracking-review.spec.ts`: explicit navigation/acknowledgement checks.
- This report: verification, release identity, and commit handoff.

The frontend worktree was clean before these edits. The backend's existing
untracked investigation report and `work/` were untouched.

## Verification

- Initial `pnpm check`: passed formatting, lint, typechecks, Knip, and 220 tests.
- Initial deployment acceptance identified six old navigation selectors; separate
  real-backend acceptance identified tab-capitalization and coordinate-click
  expectations. No application regression was inferred from those failures.
- An intermediate run passed all 130 browser checks but had one desktop backend
  timeout: its already-collected test still clicked Notes, hidden at that viewport.
  The final test clicks the always-visible carrier status instead.
- Final `pnpm test:acceptance`: exit 0. Format/lint/Knip, coverage/unit tests,
  typechecks/build, 130 desktop/mobile browser checks, 22 real-backend browser
  checks, four HTTPS container checks, and three HTTP container checks passed.
  Five opt-in backend scenarios were skipped by their existing configuration;
  they were not independently enabled in this deployment run.
- `git diff --check`: passed. Final source diff reviewed; test corrections only.
- Docker release build passed with the HTTP LAN origin and Caddyfile. Existing
  bundle-size and framework warnings were non-failing.
- Archive SHA-256 matched on both machines:
  `5c13208cefe55e7b2de51c09078b0b61076005a92e50a3ad139f4cbe0809714a`.
- Local and VM image identity matched:
  `sha256:2848a5d6fa7a82a1187f4914084f947140ebf250eacac7bbc7451a1a3200dfa9`.
  Its revision label identifies application commit `05c067d5d552495c22e246fee28b6943070874d9`.
- VM activation recreated only frontend, using `up -d --wait --no-deps frontend`.
  Backend API/worker remained on `20261021-02`; database remained running.
- Live `/healthz`, `/api/v1/health/ready`, and `/quotes/new` passed; quote route HTTP 200.
- Authenticated browser inspection at `http://192.168.100.83/quotes/new` showed
  numbered shipping-service, sender, recipient, and box sections with plain-language
  guidance. No quote was submitted and no live provider call was made for this check.

## Review Notes

Deployment uses the existing explicitly selected HTTP-only LAN topology. The
frontend image contains the already approved application commit; the local test
corrections do not change its runtime bundle. No commit, tag, merge, or push occurred.
The VM retains the preceding frontend image for rollback and preserved its current
environment as `.env.pre-fe-20261021-03` before updating release/frontend image keys.
A mode-600 backup was created at
`/home/jeff/app/grd-dashboard/backups/grd-dashboard-pre-fe-20261021-03.dump`.

## Remaining Issues

- Test/report commit awaits explicit approval.
- Five opt-in backend scenarios were not rerun; external carrier pricing was not tested.
- Amazon Manual rate-card work is not part of this release.

## Suggested Review Order

Review tracking-review assertions, then shipment-list assertions, then the three
navigation checks, and finally this deployment report.

Proposed single-purpose commit (six files listed above):
`test(shipping-quotes): SQ-V1-009 align deployment checks with approved UI`
