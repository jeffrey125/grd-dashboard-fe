# FE-V1-003: Build the GRD application shell and theme system

## Status

Not started. Depends on FE-V1-002.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Create the Tom-inspired navigation shell using official GRD assets, accessible light/dark themes, and a shared toast host.

## Required reading

- [branding.md](../branding.md)
- [ui-spec.md](../ui-spec.md)
- [architecture.md](../architecture.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Build desktop sidebar, mobile drawer, page header/breadcrumbs, identity/sign-out slots, and role-aware navigation as reusable layout components.
- Configure Tailwind and shadcn with the approved Radix primitives, checking actual generated imports. Install/use Sonner rather than silently switching toast libraries.
- Apply semantic blue/gold/neutral tokens with system-default and saved explicit light/dark preference, including pre-paint theme initialization.
- Wire the official full logo and SVG favicon with ICO fallback; preserve original source files and source attribution. Handle the dark-lettered wordmark on dark surfaces.
- Add responsive, keyboard, reduced-motion, and focus behavior. Keep font/icon package selection explicit; fallback typography requires no new production package.

## Acceptance criteria

- Overview/Shipments and Admin-only navigation follow the page map; create/detail pages use breadcrumbs, and mobile navigation closes appropriately.
- Theme persists, follows system when no override exists, and avoids an initial incorrect-theme flash. Both modes have readable controls/statuses/logo.
- SVG and multi-size ICO load successfully and look correct at real browser tab sizes; the favicon does not display the full tiny horizontal wordmark.
- Sonner is themed and globally available for action feedback without enabling tracking sounds/alerts prematurely.
- UI primitives remain separate from business features; shell fixtures do not become hardcoded production users or permissions.

## Verification

Run relevant component/Playwright tests plus quality gates. Inspect desktop and narrow screens, keyboard drawer navigation, both theme modes, reduced motion, logo aspect ratio, and favicon requests/rendering. Capture review screenshots when a runnable shell exists.

## Review notes and completion

Tom provides layout conventions; GRD provides branding. Authentication wiring is FE-V1-004. Do not copy marketing navigation, HRD assets, or Adobe font delivery assumptions.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
