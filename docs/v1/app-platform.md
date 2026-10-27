# DEPLOY-V1-001: frontend App Platform Static Site

## Target and delivery

The approved frontend is a separate App Platform **Static Site** named
`grd-dashboard-fe`, at `https://app.globalresourcesdirect.com`. The backend is
`https://api.globalresourcesdirect.com`. Frontend releases do not restart the
backend worker. This decision supersedes the older public-hosting deferral;
the LAN Dockerfile and Caddy configurations remain supported.

`.do/Dockerfile` uses the pinned Node/pnpm toolchain to create `/app/dist`.
App Platform extracts that directory and serves it as static files; no Caddy or
Node web service runs. `catchall_document: index.html` supports direct navigation
to React routes such as `/shipments`.

The workflow retains the existing quality/browser and secret-scan gates, adds a
production static-build check, then invokes the official DigitalOcean deployment
action. The spec disables independent deploy-on-push. Production releases are
serialized; obsolete main revisions are skipped before deployment.

Because App Platform fetches main again, the Dockerfile requires the platform's
`${_self.COMMIT_HASH}` to equal the successful workflow's `EXPECTED_COMMIT`. A race
with a newer push therefore fails the build instead of deploying untested source.
The latest main workflow can subsequently deploy its own verified revision.
The equality check is also exercised with explicit build arguments in local CI.
This platform-provided binding still needs confirmation during the first remote
build; failure is closed and cannot publish mismatched source.

## GitHub and DigitalOcean setup

| Location | Setting | Purpose |
| --- | --- | --- |
| Production environment variable | `DIGITALOCEAN_PROJECT_ID` | Intended project UUID. |
| Production environment secret | `DIGITALOCEAN_ACCESS_TOKEN` | Permission to manage the frontend App Platform app. |
| Production environment variable | `VITE_GOOGLE_PLACES_API_KEY` | Optional public browser key; restrict it to the app domain and required APIs. Never use a private server key. |

Connect DigitalOcean's GitHub integration to `jeffrey125/grd-dashboard-fe` so the
platform can fetch the source. No GHCR pull credential is needed for this static
site. Define the `production` GitHub environment and restrict it to main.
Pushes to `main` and manual workflow runs on `main` deploy automatically after
quality, secret-scan and production-build jobs succeed. Pull requests and other
branches cannot deploy. No separate enable variable is required.
Both app names are fixed in their specs; verify
that they do not identify an unrelated existing app before the first invocation.

The API origin is fixed at build time. All `VITE_*` values are public browser
configuration. Database, carrier and auth secrets belong only in the backend.
Quotes are hidden according to the backend runtime feature endpoint; no frontend
quote build flag is added.

Use the exact DNS records supplied by DigitalOcean for the app subdomain. Do not
replace the parent domain's nameservers, website records or mail records. Wait for
HTTPS provisioning before testing credentialed login. The API must trust exactly
`https://app.globalresourcesdirect.com`.

## Verification and rollback

CI checks the built artifact contains the application shell/assets and no `.env`.
The static build must reject mismatched commit arguments. After deployment,
`scripts/check-app-platform.sh` requires `/` and `/shipments` to return the same
application shell. It does not prove login, loaded assets, SSE, or carrier health;
verify those against the real production API before declaring cutover complete.

Run `pnpm run ci` for ordinary frontend gates. Container changes also require the
existing `pnpm test:container` and `pnpm test:container:http` checks. The real-backend
suite requires the sibling backend and disposable PostgreSQL; do not point fixture
commands at managed production data.

To recover, merge a reviewed revert/fix and run the normal pipeline. No workflow
changes production database data. The migration and worker cutover procedure is
in the backend's [deployment guide](../../../grd-dashboard-be/docs/v1/app-platform.md).

Hosting costs depend on current static-only app allowances and bandwidth usage;
this configuration is not a guarantee of a free account bill. The first real
App Platform build, custom-domain TLS, commit binding, cache behavior and browser
acceptance remain external verification steps. No deployment is performed by
preparing these files.

References: [static sites](https://docs.digitalocean.com/products/app-platform/how-to/manage-static-sites/),
[environment bindings](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/),
[deployment action](https://github.com/digitalocean/app_action).
