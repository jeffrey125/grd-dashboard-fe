# FE-V1-003 implementation summary

## Summary

Implemented and locally verified on 2026-10-16 in `grd-dashboard-fe` on
`feature/dashboard-v1`. The dashboard now has a responsive GRD-branded Material
UI shell, system/light/dark theme handling, role-aware navigation interfaces,
feature-owned placeholder pages, breadcrumbs, and shared action notifications.
No backend calls, authentication fixtures, shipment records, tracking alerts,
audio, publishing, or deployment were added. The commit remains pending explicit
approval.

## Changes Made

- Replaced the planned Tailwind/shadcn/Radix/Sonner/Lucide stack with the
  user-approved Material UI 9.5.0, Emotion, and Material Icons foundation. The
  future shipment table decision now records MUI X Data Grid Community, installed
  only when FE-V1-006 uses it.
- Added a fixed desktop sidebar and temporary MUI Drawer mobile navigation with
  keyboard activation, an explicit close control, route-close behavior, Overview
  and Shipments links, optional identity/sign-out slots, and Admin-only account/
  carrier links. No production user or role is hardcoded before FE-V1-004.
- Added GRD website blue/gold/neutral palettes, readable light/dark schemes,
  preserved system-font/Open Sans fallback, pre-paint initialization, explicit
  persisted modes, a System option that removes the override, reduced-motion
  behavior, and a protected light surface for the official dark-lettered logo.
- Added a bounded queued Snackbar/Alert notification module and a reusable page
  header/breadcrumb module. Ordinary MUI primitives remain direct imports rather
  than shallow wrappers.
- Moved page implementations into feature-owned folders. `/` remains an honest
  overview placeholder; `/shipments` is an explicit temporary page for shell
  navigation and must be replaced by FE-V1-006 without fabricated data.

## Files Changed

| Files | Review purpose |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | Pin Material UI, Emotion, and Material Icons with a reproducible dependency graph. |
| `index.html`, `src/theme/*`, `src/styles.css` | Pre-paint mode selection, GRD palettes, persistence adapter, theme control, global/reduced-motion behavior, and theme tests. |
| `src/components/layout/*` | Responsive shell, official logo treatment, navigation/session slots, and reusable page headers/breadcrumbs with component tests. |
| `src/components/feedback/*`, `src/app/providers.tsx` | Shared bounded notification queue/host, provider composition, and interface test. |
| `src/features/overview/*`, `src/features/shipments/*` | Feature-owned page implementations with honest no-data states. |
| `src/routes/*`, `src/app/route-tree.gen.ts`, `src/app/routes.test.tsx` | Thin route composition, temporary `/shipments`, shell-integrated not-found behavior, generated route registration, and navigation tests. |
| `e2e/smoke.spec.ts`, `src/test/setup.ts`, `tsconfig.json` | Desktop/mobile theme, drawer, asset, reduced-motion, deep-link checks; MUI-compatible test environment; area aliases. |
| `AGENTS.md`, `README.md`, `docs/v1/{architecture,branding,decisions,source-evidence,verification}.md` | Record the Material UI decision and production module/page structure. |
| `docs/v1/tickets/{README,FE-V1-003-branded-shell,FE-V1-006-shipment-list}.md` | Record ticket status and the approved MUI X Community follow-on contract. |

The official source logo, original favicon, derived SVG favicon, and multi-size
ICO were not modified.

## Verification

| Exact command/check | Result |
| --- | --- |
| `pnpm view @mui/material version` and matching queries for Emotion, Material Icons, and MUI X | Verified current package versions before installation; MUI X was recorded for FE-V1-006 and removed from this ticket's installed graph because it is not yet used. |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Passed lockfile, peer, and pnpm supply-chain-policy verification. |
| `pnpm check` | Passed format, lint/import organization, route generation, strict app/tool/browser types, Knip, and 24 unit/component tests. |
| `pnpm run ci` | Passed format, lint, Knip, coverage, production build, and desktop/mobile Chromium shell behavior. |
| Playwright visual captures at 1440×900 light and 375×812 dark | Inspected layout, responsive spacing, readable dark surfaces, and the official logo's protected light treatment. Screenshots were review artifacts under `/tmp`, not repository inputs. |
| `identify public/favicon.ico public/favicon.svg public/brand/grd-logo.svg` | Confirmed ICO frames at 16/32/48/64/128/256, square 544×544 SVG favicon framing, and 1580×470 logo source. Extracted 16px/32px ICO frames show the globe/GRD mark without the horizontal wordmark. |
| `sha256sum public/brand/grd-logo.svg public/brand/grd-original-favicon.ico` | Matched the documented official-source hashes exactly. |
| `git diff --check` and final diff/status review | Passed whitespace validation; requested FE-V1-003 and approved decision updates only, with no staged or committed files. |

The browser suite initially exposed that MUI's React-rendered initialization script
does not execute early enough in this client-only Vite app. The final implementation
uses a small static head bootstrap and the same MUI color-scheme selector/storage
interface; reruns passed explicit persistence and system-default checks.

## Review Notes

- Shared modules follow deep-module seams: the shell hides responsive/navigation
  behavior, the theme module hides MUI color-scheme/storage behavior, and the
  notification module hides queue behavior. Ordinary MUI controls are not wrapped.
- System mode removes `grd-theme-mode`; an absent or inaccessible storage value
  follows `prefers-color-scheme`. Explicit light/dark preferences persist in the
  same key and are applied in the document head before application styles paint.
- MUI X Community is not installed by this ticket. FE-V1-006 should add its then-
  compatible pinned version, keep filters in external MUI controls/Router state,
  and use the backend's numbered `LIMIT/OFFSET` pages. Pro/Premium features remain
  unapproved.
- Production build reports one initial JavaScript chunk above Vite's 500 kB
  warning threshold (about 529 kB minified / 166 kB gzip). The always-visible MUI
  shell is the dominant shared UI payload; the warning remains visible for future
  route/package optimization rather than being suppressed.

## Remaining Issues

- Authentication/session wiring is intentionally deferred to FE-V1-004, so the
  runtime shell omits identity, sign-out, password-change, and Admin navigation.
  Their optional interfaces and role behavior have component coverage.
- `/shipments` is intentionally temporary and contains no data. FE-V1-006 must
  replace it with the approved MUI X Community server-paginated list.
- GitHub-hosted execution remains unverified until the repository has a remote and
  workflow run. No backend or real-session verification was applicable to this
  frontend-only shell ticket.
- The pre-existing TanStack route-generator circular-dependency warning and
  Playwright host/color-environment warnings remain non-fatal. The new Vite chunk
  size warning is documented above.

## Suggested Review Order

1. `src/theme/*`, `index.html`, then `src/components/layout/app-shell.tsx`.
2. `src/components/feedback/*` and provider composition.
3. Feature pages and thin routes, followed by component/browser tests.
4. Dependency and architecture decision diffs, then this verification summary.
