# FE-V1-007: Build inline single-shipment creation

## Status

Implemented and locally verified on 2026-10-16; commit approval pending. FE-V1-006
and the revised single-item creation API were verified in source and against the
isolated PostgreSQL fixture API. See the
[implementation summary](../implementation-summary/FE-V1-007-implementation-summary.md).

## Target repository

This frontend repository, `grd-dashboard-fe`, plus the required public-contract
adjustment in sibling `grd-dashboard-be`.

## Objective

Allow staff to add one shipment without leaving `/shipments`, with immediate,
accurate created/existing feedback and no bulk-import workflow.

## Scope

- Render one compact carrier/reference/notes form above the shipment filters.
- Submit one strict object to `POST /shipments`; remove `/shipments/new`, row
  numbering, add/remove controls, and all 1–10-row behavior.
- Preserve leading zeros/reference case and normalize blank optional notes to null.
- Retain carrier selection after success; clear reference/notes and refresh list
  and overview queries without navigating away.
- Report existing shipments immediately without changing their notes/status.
- Preserve scroll position for search/filter/tab/sort/page URL updates.
- Retain drafts on validation, carrier, and connectivity failures.

## Acceptance criteria

- The form works at desktop and mobile widths without horizontal page overflow.
- Local and backend validation expose safe field errors; disabled-carrier races and
  connectivity failures retain the draft.
- Pending fields are locked and double submission sends one request.
- 201 `created` and 200 `existing` outcomes are distinct; existing notes/status
  remain unchanged and an All shipments action is available.
- No public frontend or backend batch/import creation contract remains.

## Verification

Run schema/API tests, browser workflows, backend unit/HTTP/PostgreSQL tests, both
quality gates, and the real-backend desktop/mobile Playwright suite.

## Review notes and completion

The existing installed form/UI/query/router/HTTP stack is reused with no new
dependency. The repository keeps its internal `createMany` persistence helper for
fixtures and concurrency-safe writes; it is no longer exposed as a public API.
