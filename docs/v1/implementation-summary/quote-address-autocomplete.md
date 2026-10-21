# Quote address autocomplete

## Summary

Implemented the approved frontend-only Google Places autocomplete for Sender and
Recipient, with explicit manual entry and editable selected addresses. The change
was deployed as a frontend-only LAN release; no backend Google proxy, API contract,
database migration, or worker change was introduced.

## Changes Made

- Added approved `@googlemaps/js-api-loader` 2.1.3 and development types
  `@types/google.maps` 3.66.7. Reused MUI, React Hook Form, Zod and use-debounce.
- Empty forms default to search when the key is configured. Manual entry and copied
  addresses retain the existing form and validation. Submission reveals hidden
  invalid fields and preserves existing focus behavior.
- Requests start at three characters after 300 ms, use US region restrictions and
  independent session tokens, and fetch only address components on selection.
- Structured component mapping fills street, city, state abbreviation and ZIP/ZIP+4.
  Missing components stay blank for correction; unknown/non-US countries are rejected.
  Names, contacts and apartment/suite remain manual. Google suggestions are transient.
- Generations invalidate stale search/detail responses on input changes or unmount;
  manual field edits end search so late responses cannot overwrite corrections.
- Browser tests build with a non-secret SDK fixture key. The user's ignored key was
  previously moved from backend `.env` into frontend `.env` under the Vite name.

## Files Changed

- `src/features/shipping-quotes/google-places.ts`: official loader and address mapping.
- `src/features/shipping-quotes/address-search.tsx`: debounced search, session lifecycle,
  keyboard-accessible MUI suggestions, Google Maps attribution and safe failure UI.
- `src/features/shipping-quotes/quote-form.tsx`: both address sections and manual mode.
- `src/features/shipping-quotes/google-places.test.ts`, `address-search.test.tsx`,
  `quote-form.test.tsx`: mapping, races, failures, focus, manual entry and regressions.
- `e2e/quote-address-search.spec.ts`, `e2e/quote-form.spec.ts`: desktop/mobile behavior.
- `e2e-backend/quotes.spec.ts`: existing quote fixtures select manual mode when available.
- `package.json`, `pnpm-lock.yaml`: dependencies and deterministic browser test build.
- `Dockerfile`, `docs/v1/lan-deployment.md`: preserve the public Places key in LAN
  image builds through an optional build argument.
- `src/vite-env.d.ts`, `.env.example`: typed optional public configuration.
- `README.md`: setup, browser-key restrictions, operation and test commands.
- This summary records approval, evidence and limitations. No ticket ID was assigned
  to this standalone request.

## Verification

- `pnpm check`: passed format, lint, typecheck, Knip and all 238 tests in 36 files.
- `pnpm exec vitest run src/features/shipping-quotes/address-search.test.tsx src/features/shipping-quotes/google-places.test.ts src/features/shipping-quotes/quote-form.test.tsx`:
  33 tests passed in 3 files.
- `VITE_GOOGLE_PLACES_API_KEY=browser-test-key pnpm build`: passed. Existing router
  circular-dependency warning and large auth chunk warning remain non-blocking.
- `pnpm exec playwright test e2e/quote-address-search.spec.ts e2e/quote-form.spec.ts`:
  all 6 Chromium desktop/mobile tests passed. Uses a synthetic SDK, no Google calls.
- `git diff --check`: passed; reviewed implementation/config/test diff and new files.
- Existing frontend `http://localhost:5173`: HTTP 200. Its
  `/api/v1/health/ready` proxy: HTTP 200 with application and database up. Existing
  server reused and left running. Direct localhost:3000 is not the configured service.
- `pnpm test:acceptance`: passed — 238 unit tests, 136 isolated desktop/mobile
  browser tests, 22 real-backend browser tests, 4 HTTPS container checks and 3
  HTTP-only container checks. Five existing provider-gated scenarios were skipped.
- Live Google suggestions, billing, API enablement and referrer/API restrictions
  were not verified. The browser checks use a synthetic SDK fixture and never call
  Google.
- LAN release `20261022-04` is active at `http://192.168.100.83`. Frontend image
  identity is `sha256:5b36dfc92dc2f3b7f93852e0dcd190e5b192f71c36327451384332a112cf6c00`;
  the transferred archive SHA-256 is
  `4e28cd6ce495386085f0eafd83ab9da827d3d8b0ed1cb06fee1b9e2ff025fbef`.
- The API and worker remain `grd-dashboard-be:20261022-03`; PostgreSQL remains
  `postgres:18.3-alpine`. `/healthz` returned `ok`, API readiness returned
  application/database `up`, `/quotes/new` returned HTTP 200, and the running
  frontend bundle contains the Places loader.
- Before activation, `/home/jeff/app/grd-dashboard/backups/grd-dashboard-pre-fe-20261022-04.dump`
  was created with mode 600, size 274406 bytes and SHA-256
  `0b35f6da3cff13c7ba11e103d2633b39b06f6dc2347c08251708dd5b06a28359`. The prior
  remote environment was preserved as `.env.pre-fe-20261022-04` with mode 600.

## Review Notes

The custom code only maps structured provider components and coordinates approved
form behavior; Google owns SDK loading/session tokens, MUI owns autocomplete, and
installed use-debounce owns scheduling. No custom replacement library was added.
Selected addresses remain editable and are not proof of carrier deliverability.

The key is public build-time configuration. Google Cloud must enable Maps JavaScript
API and Places API (New), billing and appropriate website/API restrictions. Required
terms/privacy disclosures are documented in README before rollout. An absent key
degrades to manual fields. The LAN image was rebuilt with the configured public key;
live Google project restrictions still require operator verification.

Pre-existing deployment changes observed at the start were not edited; they were
committed elsewhere during this task. Backend untracked Amazon documents and output
remain untouched. The implementation commit is `0d4a219`.

## Remaining Issues

Live Google/project configuration verification remains outstanding. No known failing
executed checks.

## Suggested Review Order

1. `google-places.ts` and `address-search.tsx`.
2. `quote-form.tsx` and component/browser tests.
3. Environment/dependencies, README and this summary.

## Proposed commit

One coherent frontend commit (approved and created):
`feat(shipping-quotes): add frontend address autocomplete`

Include the implementation, its tests, dependency/config changes and docs listed
above. Exclude ignored environment files and unrelated work.
