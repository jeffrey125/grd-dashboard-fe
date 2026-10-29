# HELP-V1-001: categorized illustrated Help page

## Summary

Added a dedicated signed-in `/help` page and sidebar entry. Five categories cover
Getting Started, Shipments, Tracking & Audit, Quote Compare and Administration.
The user approved reuse of installed MUI, TanStack Router and Playwright, with
HTML/CSS numbered markers over real local screenshots. No dependencies changed.

## Changes Made

- Nine guides explain dashboard use, shipment creation/search/editing, the Other
  shipments tab, monitoring/audit, history, quote comparison, accounts and Sales
  Reps/carrier/provider settings. Content reflects the current app and clearly
  separates carrier status, monitoring state and lookup outcomes.
- Nine screenshots use fictional fixture data. Numbered markers align with the
  explained controls; images scale responsively and have an enlarge dialog.
  Desktop captures illustrate the app; instructions explain differing mobile
  controls, including Other in the Shipment view selector.
- Category URLs are reloadable/shareable. Category-local search filters guide
  text, with a clear-search recovery. Unknown/unavailable categories recover to
  Getting Started. Accordions keep long categories manageable.
- Administration category and content are rendered only for Admin sessions. Staff
  direct category URLs do not render it or request its screenshots. The quote
  category follows the runtime Quote Compare flag. Existing sign-in/password
  replacement boundaries apply to Help.
- Screenshot generation is opt-in and uses mocked responses from existing test
  fixtures, never production. Marker positions are calculated from actual DOM
  bounds. Cropping removes unused viewport space without altering screen content.

## Files Changed

| File | Purpose |
| --- | --- |
| `src/routes/help.tsx` | Dedicated route and category query parsing. |
| `src/app/route-tree.gen.ts` | Generated route registration needed for navigation. |
| `src/components/layout/app-shell.tsx` | Help sidebar link and installed MUI icon. |
| `src/features/help/help-page.tsx` | Role/feature-gated categories, search, guide accordions, numbered overlays and image enlargement. |
| `src/features/help/content.ts` | User-facing instructions grouped into categories. |
| `src/features/help/captures.json` | Screenshot dimensions and marker coordinates. |
| `e2e/help-capture.spec.ts` | Explicit opt-in fixture screenshot/coordinate generator. |
| `e2e/help.spec.ts` | Desktop/mobile navigation, search, all image loads, zoom, role restrictions and sign-in checks. |
| `public/help/screenshots/overview.png` | Dashboard counts, attention and upcoming deliveries. |
| `public/help/screenshots/shipments.png` | Creation, search and shipment grid. |
| `public/help/screenshots/other.png` | Other view and manual carrier/status controls. |
| `public/help/screenshots/details.png` | Tracking, business details and notes. |
| `public/help/screenshots/audit.png` | Monitoring, lookup/run and attribution. |
| `public/help/screenshots/history.png` | History tab and observation. |
| `public/help/screenshots/quotes.png` | Provider, address and quote submission controls. |
| `public/help/screenshots/accounts.png` | Fictional employee account administration. |
| `public/help/screenshots/sales-reps.png` | Fictional Sales Rep directory and add action. |
| `docs/v1/ui-spec.md` | Help route, behavior and refresh procedure. |
| `docs/v1/implementation-summary/HELP-V1-001-implementation-summary.md` | This handoff. |

## Verification

Commands use installed package binaries, without dependency/lockfile changes.

- `node_modules/.bin/tsr generate` — passed; generated Help registration.
- `node_modules/.bin/tsc --noEmit` — passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.e2e.json` — passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.node.json` — passed.
- `node_modules/.bin/biome check --formatter-enabled=false .` and scoped Biome
  checks — passed.
- `node_modules/.bin/vite build` — passed; existing large-chunk advisory remains.
- `node_modules/.bin/vitest run` — 267 passed, including existing shell/route tests.
- `UPDATE_HELP_SCREENSHOTS=true node_modules/.bin/playwright test e2e/help-capture.spec.ts --project=chromium --workers=1`
  — passed; generated all nine screenshots and coordinates.
- `node_modules/.bin/playwright test e2e/help.spec.ts --workers=2` — final 8 passed
  across desktop/mobile. Checks all guide screenshots, Admin and Staff category
  behavior, direct URLs, unavailable categories, disabled quote feature, sign-in,
  search, enlargement and no page-width overflow.
- Desktop/mobile Help screenshots visually inspected. Initial browser assertions
  exposed nested heading semantics in the accordion; corrected by reusing MUI's
  own heading and reran the suite successfully.
- `git diff --check` — passed; final diff reviewed. Existing unrelated
  `e2e-backend/tracking-review.spec.ts` edit excluded.
- Local `/help` returned HTTP 200; API health returned `{"status":"ok"}`. Servers
  remain running at http://localhost:5173 and http://localhost:3000/api/v1.

Full frontend acceptance/all browser suites and backend tests were not rerun;
this adds UI help only and changes no backend behavior.

## Review Notes

Help role gating is based on the existing authenticated session, with no separate
permission model. Screenshots are non-sensitive fictional illustrations shipped
as public static assets; they must never contain actual customer/account secrets.
The Administration category/content is hidden from Staff in the app. Existing
administrative API authorization remains unchanged.

Guides and screenshot assets must be reviewed together when the product changes.
Regenerate screenshots after building the app, using the opt-in command above,
then format `captures.json`, rebuild and verify the Help browser suite.
No custom replacements for library functions or new production packages.

## Remaining Issues

None within the requested scope. Not committed, pushed or deployed. Screenshot
refresh is a maintenance task whenever the documented UI changes.

## Suggested Review Order

1. Category content and role/feature gating.
2. Screenshot overlays/assets and mobile enlargement.
3. Route/sidebar integration, browser tests and capture regeneration instructions.

Proposed single-purpose frontend commit, including every Help file listed above:
`feat(help): HELP-V1-001 add categorized guides with annotated screenshots`

Explicit final approval is required before staging/committing under AGENTS.md.
