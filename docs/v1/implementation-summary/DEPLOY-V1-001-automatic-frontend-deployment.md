# DEPLOY-V1-001: automatic frontend deployment

## Summary

Remove the frontend deployment enable variable after the approved production cutover.

## Changes Made

Use the existing GitHub Actions branch/event condition without a separate enable flag.
Pushes and manual runs on main can deploy only after quality, secret-scan and
production-build jobs pass. Existing release serialization and commit checks remain.

## Files Changed

- `.github/workflows/ci.yml`: remove the enable-variable condition.
- `docs/v1/app-platform.md`: document automatic deployment eligibility.
- `README.md`: replace the obsolete deployment-disabled notice.
- This summary: record the scope and verification.

## Verification

- `/tmp/grd-actionlint/actionlint -color .github/workflows/ci.yml`: passed.
- `git diff --check`: passed.
- Final scoped diff reviewed: only the enable condition and associated documentation changed.
Application tests and container builds are not rerun for this condition/documentation change;
the workflow continues to require them on the next main run.

## Review Notes

No dependencies, application code, or App Platform spec changes.
Pre-existing edits to `e2e-backend/tracking-review.spec.ts` are outside this change.

## Remaining Issues

Commit/push approval and verification of the resulting remote deployment are pending.

## Suggested Review Order

Workflow condition, deployment guide, README, this summary.
