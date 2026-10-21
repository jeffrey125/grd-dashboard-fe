# Quote address autocomplete

## Summary

Implemented the approved frontend-only Google Places autocomplete for Sender and
Recipient, with explicit manual entry and editable selected addresses. No backend
Google proxy, API contract, database, or deployment change is part of this work.

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
- Full browser suite, real-backend/disposable database tests, coverage and container
  acceptance were not run for this frontend-only change. Updated backend browser
  fixture is typechecked but its execution remains unverified.
- Live Google suggestions, billing, API enablement and referrer/API restrictions
  were not verified. No provider quotes, production changes or deployment performed.

## Review Notes

The custom code only maps structured provider components and coordinates approved
form behavior; Google owns SDK loading/session tokens, MUI owns autocomplete, and
installed use-debounce owns scheduling. No custom replacement library was added.
Selected addresses remain editable and are not proof of carrier deliverability.

The key is public build-time configuration. Google Cloud must enable Maps JavaScript
API and Places API (New), billing and appropriate website/API restrictions. Required
terms/privacy disclosures are documented in README before rollout. An absent key
degrades to manual fields. Test-built `dist` contains the fake key; rebuild with real
configuration for deployment, which remains separately authorized work.

Pre-existing deployment changes observed at the start were not edited; they were
committed elsewhere during this task. Backend untracked Amazon documents and output
remain untouched. No staging or commits were performed.

## Remaining Issues

Live Google/project configuration verification and deployment remain outstanding.
Real-backend/container acceptance was not rerun. No known failing executed checks.

## Suggested Review Order

1. `google-places.ts` and `address-search.tsx`.
2. `quote-form.tsx` and component/browser tests.
3. Environment/dependencies, README and this summary.

## Proposed commit

One coherent frontend commit (pending approval):
`feat(shipping-quotes): add frontend address autocomplete`

Include the implementation, its tests, dependency/config changes and docs listed
above. Exclude ignored environment files and unrelated work.
