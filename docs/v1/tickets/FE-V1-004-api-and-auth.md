# FE-V1-004: Implement Axios infrastructure and employee authentication

## Status

Implemented, locally verified, and committed on 2026-10-16.
FE-V1-003 and the existing backend auth implementation were verified in source.
See [implementation summary](../implementation-summary/FE-V1-004-implementation-summary.md)
for exact checks, scope boundaries, and remaining environment limitations.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Connect the browser to the real cookie-session facade with correct role/replacement routing and cache isolation.

## Required reading

- [api-contracts.md](../api-contracts.md)
- [architecture.md](../architecture.md)
- [ui-spec.md](../ui-spec.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Implement shared Axios configuration with withCredentials, public API origin, cancellation, safe status-based errors, JSON and 204 support, and no automatic unsafe mutation retries.
- Build dedicated sign-in and password-change pages using approved React Hook Form/Zod/resolvers, with separate frontend schemas aligned to backend validation.
- Use the approved Better Auth client through the feature `api.ts` compatibility adapter; restore sessions through /api/v1/auth/me; route restricted users to replacement/sign-out only; guard Staff/Admin pages and safely preserve internal return URLs.
- Implement sign-out and session-loss teardown: close live subscriptions, cancel requests, clear Query/transient sensitive state, and guard against late responses from the previous account.
- Deduplicate auth rechecks for business 403/SSE errors, respect throttling, and show persistent connection/auth errors alongside appropriate toasts.

## Acceptance criteria

- Real local login, reload restoration, invalid credentials, logout, and forced replacement work. Replacement 204 leads to re-login because all sessions were revoked.
- No public signup, email reset promise, bearer/localStorage token, actor input, manual Origin header, or generic Better Auth backend endpoint is introduced.
- Staff cannot access Admin routes by direct URL; server authorization failures remain authoritative despite hidden controls.
- Concurrent 401/403 responses do not cause retry storms or redirect loops. A previous-account response cannot refill the next account's cache.
- Passwords follow the correct sign-in versus new-password constraints and are never logged, stored, or echoed in notification text.

The final follow-up approval uses `/api/v1` for every backend endpoint, including
health. Vite forwards the prefix unchanged; built assets append it to the configured
API origin. No unversioned fallback or alias is added. Backend implementation is
owned by a separate session.

## Verification

Run transport/schema/component tests and Playwright auth/guard cases, plus actual local backend session/cookie/CORS checks with authorized isolated accounts. Test restricted, expired/revoked, role-conflict, 204, network-failure, and concurrent-error cases. Run quality gates.

## Review notes and completion

Auth sources are backend docs/v1/auth-api.md and frontend-handoff.md. Production-origin validation remains deferred until a real environment exists.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
