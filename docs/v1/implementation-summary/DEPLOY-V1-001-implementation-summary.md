# DEPLOY-V1-001: App Platform Static Site preparation

## Summary

Prepared an independently deployed App Platform Static Site for
`app.globalresourcesdirect.com`, connecting to `api.globalresourcesdirect.com`.
No paid resource, credential, DNS record or production deployment was changed.

## Changes Made

Retained the existing quality/browser and secret-scan gates. Added an isolated
static Docker build gate and official DigitalOcean deployment action, pinned by
commit hash. Production deploys are serialized, skip superseded main revisions,
and require an explicit repository enable variable. App Platform's separate
source autodeploy is disabled.

The static Docker build rejects a source commit different from the successful CI
revision. App Platform serves `/app/dist` with `index.html` SPA fallback; no web
service or Caddy process is deployed. The original LAN images are unchanged.
No dependency or lockfile changes were needed; Docker, Node/pnpm, official Actions
and shell built-ins implement the approved approach.

## Files Changed

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | Static-build gate and disabled-by-default App Platform release. |
| `.do/app.yaml` | Independent frontend app, domain, source build, API origin and SPA fallback. |
| `.do/Dockerfile` | Pinned static build with expected-commit equality check. |
| `.dockerignore` | Permit the dedicated static Dockerfile in the allowlisted context. |
| `scripts/check-app-platform.sh` | Compare public root and deep-link application shells. |
| `README.md` | Link to the approved deployment preparation guide. |
| `docs/v1/app-platform.md` | Production settings, DNS scope, release guard and rollback instructions. |
| This summary | Review and verification evidence. |

Pre-existing `e2e-backend/tracking-review.spec.ts` changes were preserved and are
excluded from the proposed commit. No application behavior was changed.

## Verification

- `pnpm run ci`: passed formatting, lint, Knip, type/build, 249 tests and 144
  desktop/mobile browser checks.
- `pnpm test:container`: passed, 5 tests (existing HTTPS LAN delivery).
- `pnpm test:container:http`: passed, 3 tests (existing HTTP LAN override).
- `docker build --file .do/Dockerfile --build-arg EXPECTED_COMMIT=fixture
  --build-arg BUILD_COMMIT=fixture
  --build-arg VITE_API_ORIGIN=https://api.globalresourcesdirect.com
  --tag grd-fe-static-check:local .`: passed. Extracted `/app/dist` contains
  `index.html`, assets and no `.env`.
- Same build with `EXPECTED_COMMIT=expected` and `BUILD_COMMIT=different`:
  rejected at the commit equality check, as intended.
- Docker emitted two ARG/ENV warnings for `VITE_GOOGLE_PLACES_API_KEY`; this is a
  deliberately public, optional browser key, not a server credential. Restrict
  its domain/API permissions. No real key was supplied to local builds.
- `doctl apps spec validate --schema-only /tmp/grd-fe-spec.json`: passed.
- `actionlint -shellcheck=` on both workflows: passed. External ShellCheck was
  unavailable; `bash -n` passed for both smoke scripts.
- Local HTTP fixture checks accepted the healthy SPA and rejected a broken deep
  link. Static spec assertions verified disabled source autodeploy and SPA fallback.
- Checksum-pinned Gitleaks 8.30.1 history scan: passed (93 commits).
- `git diff --check`: passed.
- Manual frontend `http://localhost:4176/shipments`: HTTP 200. Fixture API
  `http://localhost:3017/api/v1/health/ready`: HTTP 200. Both remain running with
  disposable data and no tracking/quote worker. Fixture Staff login is
  `frontend-staff@example.test` / `staff fixture password`.
- The full real-backend browser suite was not rerun: this change affects delivery
  configuration, and ordinary browser plus both container suites passed. The
  pre-existing edit in that suite remains outside this task.
- Remote Actions, App Platform build/commit binding, custom-domain DNS/TLS,
  production login/SSE, and CDN cache behavior were not verified.

## Review Notes

The static-site schema does not accept a registry-image source in the installed
validator, so the frontend builds from GitHub. The expected-commit equality check
prevents a newer main revision from bypassing this workflow's quality gates.
The first remote build must verify DigitalOcean supplies its documented build-time
commit binding; an absent/mismatched binding fails the build.

The enable flag is a repository variable; production secrets/project settings
belong to the production environment. All Vite variables are public. Backend,
carrier and database secrets must never be added here.

## Remaining Issues

Connect the GitHub repository to DigitalOcean, select the intended project,
configure the deployment token/optional browser key, and finish backend rollout
blockers before enabling production deployment. Verify the actual-domain browser
flow and static-site caching during first release. No commits or deploys made.

## Suggested Review Order

1. `docs/v1/app-platform.md` and `.do/app.yaml`.
2. `.do/Dockerfile`, `.dockerignore`, and the workflow.
3. Smoke script and verification evidence.

Proposed commit, pending explicit approval:
`ci(deploy): DEPLOY-V1-001 prepare frontend App Platform static site`
— all task files above, excluding `e2e-backend/tracking-review.spec.ts`.
